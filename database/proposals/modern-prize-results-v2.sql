-- UNEXECUTED read-only candidate. No tables, grants, or access activation.
begin;
create function app.modern_prize_results_enabled_v2()returns boolean
language sql stable set search_path=''as $gate$select false$gate$;
-- Remove ONLY observation identity and digests that include that identity.
-- Persisted reviewer/game-action actors, record IDs, versions, evidence and
-- independent content digests are deliberately retained. Never recursive.
create function app.modern_prize_fund_result_evidence_v2(c jsonb)returns jsonb
language sql immutable set search_path=''as $evidence$
 select(((c-'actorId'-'sourceDigest')#-'{recipientSource,actorId}')#-'{recipientSource,sourceDigest}')#-'{recipientSource,nativeFinanceSource,actorId}'
$evidence$;
create function app.modern_prize_workspace_result_evidence_v2(w jsonb)returns jsonb
language sql immutable set search_path=''as $evidence$
 select((w-'actorId')#-'{nativeSource,actorId}')#-'{nativeSource,sourceDigest}'
$evidence$;
create function app.get_current_modern_prize_results_v2(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare actor uuid:=auth.uid();record_value jsonb;stored jsonb;fund_capture jsonb;workspace jsonb;fee jsonb;
 heads jsonb:='null';entrants jsonb:='null';population integer;fee_valid boolean;
begin
 if actor is null or tid is null or eid is null then return null;end if;
 if app.modern_prize_results_enabled_v2()is distinct from true or app.modern_prize_awards_enabled_v2()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('event-lifecycle:'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','event_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')order by role for key share nowait;
 if not found then return null;end if;
 -- Final award rows are immutable. Never impersonate their recording actor.
 record_value:=app.get_modern_prize_award_record_v2(tid,eid);
 if record_value is null then return jsonb_build_object('status','held','code','no_modern_award_record');end if;
 if record_value->>'status'='retry_exact'then return record_value;end if;
 stored:=record_value->'sourceCapture';
 perform app.lock_operational_event_finance_sources_v1();
 lock table app.roster_payment_obligation_versions,app.qualification_result_rows,app.tournament_roster_entries in share mode nowait;
 -- Read under the CURRENT authenticated official. The old fund-review hash is
 -- actor-bound, so compare complete semantic evidence rather than rewriting it.
 fund_capture:=app.get_native_recorded_fund_review_source_v1(tid,eid);
 if fund_capture->>'status'='retry_exact'then return fund_capture;end if;
 workspace:=app.get_playoff_prize_proposal_workspace_v2(tid,eid);
 if workspace->>'status'='retry_exact'then return workspace;end if;
 if fund_capture->>'status'is distinct from'review_source_available'or fund_capture->>'actorId'is distinct from actor::text
  or workspace->>'kind'is distinct from'playoff-prize-proposal-workspace-v2'or workspace->>'actorId'is distinct from actor::text
  or workspace->'stale'is distinct from'false'::jsonb then return jsonb_build_object('status','held','code','current_award_source_unavailable');end if;
 if app.modern_prize_fund_result_evidence_v2(fund_capture)is distinct from app.modern_prize_fund_result_evidence_v2(stored#>'{fundSource,capture}')
  or app.modern_prize_workspace_result_evidence_v2(workspace)is distinct from app.modern_prize_workspace_result_evidence_v2(stored->'prizeWorkspace')then
  return jsonb_build_object('status','held','code','award_source_changed');end if;
 fee:=stored->'entryFeeSource';
 if fee is not null and fee<>'null'::jsonb then
  -- The record decoder proves the original full-fee allocation. Separately
  -- recheck every current head and complete roster mapping, without calling an
  -- actor-bound award writer/source or minting a new fee review for this reader.
  with current_rows as materialized(
   select qr.participant_id,p.roster_entry_id,p.status,r.id receipt_id,r.version receipt_version,r.event_type,r.amount_minor,
    o.id obligation_id,o.version obligation_version,o.amount_owed_minor
   from app.qualification_result_rows qr join app.event_participants p on p.id=qr.participant_id and p.event_id=qr.event_id and p.tournament_id=qr.tournament_id
   left join lateral(select*from app.roster_payment_events where tournament_id=tid and roster_entry_id=p.roster_entry_id order by version desc limit 1)r on true
   left join lateral(select*from app.roster_payment_obligation_versions where tournament_id=tid and roster_entry_id=p.roster_entry_id order by version desc limit 1)o on true
   where qr.tournament_id=tid and qr.event_id=eid and qr.result_version_id=(fund_capture#>>'{recipientSource,proposal,qualificationResultVersionId}')::uuid
  )select count(*),jsonb_agg(jsonb_build_object('participantId',participant_id,'receiptId',receipt_id,'receiptVersion',receipt_version,'obligationId',obligation_id,'obligationVersion',obligation_version)order by participant_id),
   jsonb_agg(jsonb_build_object('participantId',participant_id,'rosterEntryId',roster_entry_id)order by participant_id),
   bool_and(status in('registered','checked_in')and event_type='received'and receipt_id is not null and obligation_id is not null and roster_entry_id is not null
    and amount_minor=(fee#>>'{evidence,advertisedFeeMinor}')::numeric and amount_owed_minor=(fee#>>'{evidence,advertisedFeeMinor}')::numeric)
   into population,heads,entrants,fee_valid from current_rows;
  if fee_valid is distinct from true or population<>jsonb_array_length(fee#>'{evidence,entrants}')
   or heads is distinct from(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(fee->'heads')x)
   or entrants is distinct from(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(fee#>'{evidence,entrants}')x)then
   return jsonb_build_object('status','held','code','award_fee_heads_changed');end if;
 end if;
 return jsonb_build_object('kind','current-modern-prize-results-v2','status','source_available','actorId',actor,'tournamentId',tid,'eventId',eid,
  'record',record_value,'facts',jsonb_build_object('fundCapture',fund_capture,'prizeWorkspace',workspace,'feeHeads',heads,'feeEntrants',entrants),'snapshotConsistency','locked_source_snapshot',
  'moneyMoved',false,'payoutAuthorized',false,'writeAuthorized',false,'bankReceiptVerified',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$body$;
create function public.get_current_modern_prize_results_provider_v2(p_tid uuid,p_eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $wrapper$begin
 if app.modern_prize_results_enabled_v2()is distinct from true or app.require_operational_provider_official_v1(p_tid)is null then return null;end if;
 return app.get_current_modern_prize_results_v2(p_tid,p_eid);
end$wrapper$;
alter function app.modern_prize_results_enabled_v2()owner to postgres;
alter function app.modern_prize_fund_result_evidence_v2(jsonb)owner to postgres;
alter function app.modern_prize_workspace_result_evidence_v2(jsonb)owner to postgres;
alter function app.get_current_modern_prize_results_v2(uuid,uuid)owner to postgres;
alter function public.get_current_modern_prize_results_provider_v2(uuid,uuid)owner to postgres;
revoke all on function app.modern_prize_results_enabled_v2(),app.modern_prize_fund_result_evidence_v2(jsonb),app.modern_prize_workspace_result_evidence_v2(jsonb),app.get_current_modern_prize_results_v2(uuid,uuid),public.get_current_modern_prize_results_provider_v2(uuid,uuid)from public,anon,authenticated,service_role;
commit;
