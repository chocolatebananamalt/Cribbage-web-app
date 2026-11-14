-- UNEXECUTED private source candidate. No grants, route, or award enablement.
-- Requires modern-prize-awards-v2 and its current native fund dependencies.
begin;
create function app.common_entry_fee_source_enabled_v1()returns boolean
language sql stable set search_path=''as $gate$select false$gate$;
create function app.get_current_common_entry_fee_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare actor uuid:=auth.uid();f jsonb;raw jsonb;body jsonb;evidence jsonb;participants jsonb;
 q app.qualification_result_versions%rowtype;a app.native_ledger_allocation_revisions_v1%rowtype;
 fee integer;setup_id uuid;roster_row record;receipt app.roster_payment_events%rowtype;
 owed app.roster_payment_obligation_versions%rowtype;allocation jsonb;line jsonb;
 entrants jsonb:='[]';receipts jsonb:='[]';obligations jsonb:='[]';allocations jsonb:='[]';heads jsonb:='[]';
 seen_rosters uuid[]:='{}';seen_receipts uuid[]:='{}';count_sources integer;
begin
 if actor is null then return jsonb_build_object('status','blocked','code','authentication_required');end if;
 if tid is null or eid is null then return jsonb_build_object('status','blocked','code','invalid_request');end if;
 if app.common_entry_fee_source_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object('status','blocked','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','blocked','code','not_director');end if;
 -- Freeze receipt, allocation, activation and qualification heads, including
 -- writers that do not lock the tournament. No weaker fallback on contention.
 perform app.lock_operational_event_finance_sources_v1();
 lock table app.roster_payment_obligation_versions,app.qualification_result_rows,
  app.tournament_roster_entries in share mode nowait;
 f:=app.current_native_prize_fund_v2(tid,eid);
 if f->>'status'='retry_exact'then return f;end if;
 if f->>'kind'is distinct from'current-native-prize-fund-v2'or f->>'status'is distinct from'source_available'
  or f->>'actorId'is distinct from actor::text or f->>'tournamentId'is distinct from tid::text or f->>'eventId'is distinct from eid::text then
  return jsonb_build_object('status','blocked','code','current_fund_required');end if;
 raw:=f#>'{capture,recipientSource,nativeFinanceSource,raw}';setup_id:=(raw#>>'{binding,setupEventVersionId}')::uuid;
 select v.entry_fee_cents into fee from app.tournament_setup_event_versions v join app.tournament_setup_activations b
  on b.setup_event_version_id=v.id and b.tournament_id=v.tournament_id
  where v.id=setup_id and v.tournament_id=tid and b.event_id=eid and b.id=(raw#>>'{binding,activationId}')::uuid;
 if fee is null or fee<=0 then return jsonb_build_object('status','blocked','code','positive_saved_event_fee_required');end if;
 select*into q from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 if q.id is null or q.id::text is distinct from raw#>>'{qualification,resultVersionId}'
  or q.id::text is distinct from f#>>'{capture,recipientSource,proposal,qualificationResultVersionId}'
  or q.participant_count not between 2 and 10000 or q.participant_count is distinct from(raw#>>'{qualification,participantCount}')::integer
  or(select count(*)from app.qualification_result_rows where result_version_id=q.id and tournament_id=tid and event_id=eid)<>q.participant_count then
  return jsonb_build_object('status','blocked','code','complete_current_qualification_required');end if;
 select*into a from app.native_ledger_allocation_revisions_v1 where tournament_id=tid order by version desc limit 1;
 if a.id is null or a.id::text is distinct from raw#>>'{allocation,revisionId}'or a.source_digest is distinct from raw#>>'{allocation,sourceDigest}'
  or a.version is distinct from(raw#>>'{allocation,version}')::integer then return jsonb_build_object('status','blocked','code','allocation_changed');end if;
 for roster_row in select qr.participant_id,p.roster_entry_id,p.status from app.qualification_result_rows qr join app.event_participants p
  on p.id=qr.participant_id and p.event_id=qr.event_id and p.tournament_id=qr.tournament_id
  where qr.result_version_id=q.id and qr.tournament_id=tid and qr.event_id=eid order by qr.participant_id loop
  if roster_row.roster_entry_id is null or roster_row.roster_entry_id=any(seen_rosters)or roster_row.status not in('registered','checked_in')then
   return jsonb_build_object('status','blocked','code','entrant_binding_requires_review');end if;
  select*into receipt from app.roster_payment_events where tournament_id=tid and roster_entry_id=roster_row.roster_entry_id order by version desc limit 1;
  select*into owed from app.roster_payment_obligation_versions where tournament_id=tid and roster_entry_id=roster_row.roster_entry_id order by version desc limit 1;
  -- A cumulative roster receipt is usable only when the entire current amount
  -- and explicit obligation both equal this event's fee. Never sum installments,
  -- infer waivers, apportion a bundle, or reuse the base Main fee for an add-on.
  if receipt.id is null or receipt.event_type<>'received'or owed.id is null or receipt.amount_minor<>fee or owed.amount_owed_minor<>fee then
   return jsonb_build_object('status','blocked','code','nonstandard_or_incomplete_fee_requires_policy_review');end if;
  select count(*)into count_sources from jsonb_array_elements(a.snapshot->'sources')x where x->>'sourceId'=receipt.id::text;
  if count_sources<>1 then return jsonb_build_object('status','blocked','code','full_event_allocation_required');end if;
  select x into allocation from jsonb_array_elements(a.snapshot->'sources')x where x->>'sourceId'=receipt.id::text;
  if allocation->>'physicalEvidenceId'is distinct from receipt.id::text or allocation->>'kind'is distinct from'entry_receipt'
   or allocation->>'state'is distinct from'active'or allocation->'amountMinor'is distinct from to_jsonb(fee)
   or jsonb_typeof(allocation->'allocations')is distinct from'array'or jsonb_array_length(allocation->'allocations')<>1 then
   return jsonb_build_object('status','blocked','code','split_or_changed_receipt_allocation');end if;
  line:=allocation->'allocations'->0;
  if line->>'eventId'is distinct from eid::text or line->>'bucket'is distinct from'regular_entry'or line->'poolId'is distinct from'null'::jsonb
   or line->'amountMinor'is distinct from to_jsonb(fee)or line->'classificationReviewed'is distinct from'true'::jsonb then
   return jsonb_build_object('status','blocked','code','full_reviewed_event_entry_allocation_required');end if;
  seen_rosters:=array_append(seen_rosters,roster_row.roster_entry_id);seen_receipts:=array_append(seen_receipts,receipt.id);
  entrants:=entrants||jsonb_build_array(jsonb_build_object('participantId',roster_row.participant_id,'rosterEntryId',roster_row.roster_entry_id));
  receipts:=receipts||jsonb_build_array(jsonb_build_object('sourceId',receipt.id,'physicalEvidenceId',receipt.id,'rosterEntryId',roster_row.roster_entry_id,'amountMinor',fee,'currency','USD','eligibleEventIds',jsonb_build_array(eid)));
  obligations:=obligations||jsonb_build_array(jsonb_build_object('rosterEntryId',roster_row.roster_entry_id,'sourceId',owed.id,'amountOwedMinor',owed.amount_owed_minor));
  allocations:=allocations||jsonb_build_array(allocation-'kind'-'state');
  heads:=heads||jsonb_build_array(jsonb_build_object('participantId',roster_row.participant_id,'receiptId',receipt.id,'receiptVersion',receipt.version,'obligationId',owed.id,'obligationVersion',owed.version));
 end loop;
 if jsonb_array_length(entrants)<>q.participant_count then return jsonb_build_object('status','blocked','code','complete_current_qualification_required');end if;
 -- Every regular-entry source in this reviewed event fund must belong to this
 -- exact original field. Expense sources are separate and never become fees.
 if exists(select 1 from jsonb_array_elements(raw#>'{allocation,eventSources}')x where x->>'kind'='entry_receipt'and not((x->>'sourceId')::uuid=any(seen_receipts)))
  or(f#>>'{capture,totals,regularEntryMinor}')::numeric<>fee::numeric*q.participant_count then
  return jsonb_build_object('status','blocked','code','fee_fund_coverage_changed');end if;
 select jsonb_agg(x->'participantId'order by x->>'participantId')into participants from jsonb_array_elements(entrants)x;
 evidence:=jsonb_build_object('eventId',eid,'qualificationResultVersionId',q.id,'setupEventVersionId',setup_id,'advertisedFeeMinor',fee,'entrants',entrants,'receipts',receipts,'obligations',obligations,'allocations',allocations);
 body:=jsonb_build_object('kind','current-common-entry-fee-source-v1','status','source_available','actorId',actor,'tournamentId',tid,'eventId',eid,
  'fundSource',f,'allocationRevisionId',a.id,'allocationVersion',a.version,'allocationSourceDigest',a.source_digest,
  'qualificationParticipantIds',participants,'evidence',evidence,'heads',heads,'snapshotConsistency','locked_source_snapshot',
  'bankReceiptVerified',false,'awardAuthorized',false,'moneyMoved',false);
 return body||jsonb_build_object('sourceDigest',encode(extensions.digest(convert_to(jsonb_build_array('current-common-entry-fee-source-v1',body)::text,'utf8'),'sha256'),'hex'));
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$body$;
alter function app.common_entry_fee_source_enabled_v1()owner to postgres;
alter function app.get_current_common_entry_fee_source_v1(uuid,uuid)owner to postgres;
revoke all on function app.common_entry_fee_source_enabled_v1(),app.get_current_common_entry_fee_source_v1(uuid,uuid)from public,anon,authenticated,service_role;
commit;
