-- LOCAL CANDIDATE: explicit optional-fund ownership, not a V1 guard bypass.
-- Depends on the native Finance stack and Custom Q/Side/V10 candidates.
-- No public grants, regular Finance adoption, final award or disbursement.
begin;
create function app.native_optional_pool_ownership_enabled_v2()returns boolean
language sql immutable set search_path=''as $$select false$$;
-- Actor-explicit PRIVATE composition of the native raw reader. The caller
-- must prove the existing service role and Director identity; no claim changes.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.get_native_event_ledger_sources_v1(uuid)'::regprocedure);
 p:=replace(d,'FUNCTION app.get_native_event_ledger_sources_v1(p_tournament_id uuid)','FUNCTION app.native_optional_recorded_sources_v2(actor uuid, p_tournament_id uuid)');
 if p=d or position('a uuid:=auth.uid()'in p)=0 then raise exception'native optional raw source clone anchor changed';end if;
 p:=replace(p,'a uuid:=auth.uid()','a uuid:=actor');execute p;
end$$;
revoke all on function app.native_optional_recorded_sources_v2(uuid,uuid)from public,anon,authenticated,service_role;

create table app.native_optional_pool_ownership_operations_v2(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,request_payload jsonb not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
 'native-optional-pool-ownership-v2',actor_id,operation_id,tournament_id,event_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.native_optional_pool_ownership_revisions_v2(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version between 1 and 2147483647),prior_revision_id uuid,
 actor_id uuid not null,operation_id uuid not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 source_capture jsonb not null,reason text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,version),unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(prior_revision_id,tournament_id,event_id)references app.native_optional_pool_ownership_revisions_v2(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_pool_ownership_operations_v2(actor_id,operation_id,tournament_id,event_id)
);
create table app.native_optional_pool_ownership_outcomes_v2(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_optional_pool_ownership_operations_v2(actor_id,operation_id,tournament_id,event_id)
);
do $$declare n text;begin foreach n in array array[
 'native_optional_pool_ownership_operations_v2','native_optional_pool_ownership_revisions_v2','native_optional_pool_ownership_outcomes_v2'
]loop execute format('alter table app.%I owner to postgres',n);
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;

-- Full physical roster receipts are retained. The Q shares partition those
-- receipts; Side election rows remain distinct recorded sources, not new cash.
create function app.native_optional_pool_ownership_source_v2(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare basis jsonb;m jsonb;q jsonb;side_basis jsonb;qr app.q_obligation_reviews_v2%rowtype;
 entry jsonb;part jsonb;parts jsonb;receipts jsonb:='[]';side_sources jsonb:='[]';capture jsonb;digest text;native_raw jsonb;playoff_source jsonb;
 allocation app.q_pool_allocation_versions_v1%rowtype;payment app.roster_payment_events%rowtype;
 election record;amount numeric;side_total numeric:=0;receipt_total numeric:=0;policy_id uuid;election_request jsonb;election_response jsonb;election_hash text;reason_prefix text;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_native_ledger_sources_v1();
 perform app.lock_event_settings_playoff_sources_v1();
 lock table app.q_operating_policies_v2,app.side_pool_graduated_policies_v2,app.side_pool_recipient_policies_v3,
  app.q_obligation_reviews_v2,app.side_pool_recipient_reviews_v3,app.qualification_result_versions,app.qualification_result_rows,
  app.tournament_setup_side_pool_materializations,app.setup_custom_payout_intents_v2,app.setup_custom_payout_batches_v2,
  app.operation_receipts,app.roster_payment_obligation_versions,app.roster_entry_lifecycle_events,
  app.event_side_pool_definition_versions,app.native_unrestricted_income_sources_v1,app.native_unrestricted_income_records_v1 in share mode nowait;
 if app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false
  or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)
 then return jsonb_build_object('status','blocked','code','existing_financial_liability');end if;
 native_raw:=app.native_optional_recorded_sources_v2(actor,tid);
 if native_raw->>'status'='retry_exact'then return native_raw;end if;
 if native_raw is null or native_raw->>'status'is distinct from'sources_available'
 then return jsonb_build_object('status','blocked','code','native_sources_unavailable');end if;
 if exists(select 1 from app.native_unrestricted_income_sources_v1 i
   join app.roster_payment_events p on p.tournament_id=i.tournament_id and p.id=i.physical_evidence_id where i.tournament_id=tid)
  or exists(select 1 from app.native_unrestricted_income_sources_v1 i
   join app.tournament_expense_events x on x.tournament_id=i.tournament_id and x.id=i.physical_evidence_id where i.tournament_id=tid)
 then return jsonb_build_object('status','blocked','code','physical_evidence_conflict');end if;
 playoff_source:=app.event_settings_playoff_source_v1(tid,eid);
 if playoff_source->>'status'='retry_exact'then return playoff_source;end if;
 if playoff_source is null or playoff_source->>'status'is distinct from'source_available'
 then return jsonb_build_object('status','blocked','code','native_binding_required');end if;
 basis:=app.q_base_financial_basis_v9(tid,eid);
 if basis->>'status'is distinct from'supported'then return jsonb_build_object('status','blocked','code','optional_ownership_scope_unsupported');end if;
 m:=public.get_q_pool_membership_workspace_v1(actor,tid);q:=app.q_obligation_sources_v2(actor,tid);
 if q is null or q->>'eventId'is distinct from eid::text or jsonb_typeof(q->'blockers')is distinct from'array'
  or jsonb_array_length(q->'blockers')<>0 or jsonb_typeof(q->'obligations')is distinct from'array'
  or exists(select 1 from jsonb_array_elements(q->'obligations')p where p->>'kind'is distinct from'award')
 then return jsonb_build_object('status','blocked','code','q_source_unresolved');end if;
 select*into qr from app.q_obligation_reviews_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if qr.id is null or qr.source_digest is distinct from q->>'sourceDigest'or qr.obligations is distinct from q->'obligations'
 then return jsonb_build_object('status','blocked','code','q_review_required');end if;
 side_basis:=app.combined_side_basis_v9(actor,tid,eid);
 if side_basis is null or jsonb_typeof(side_basis->'blockers')is distinct from'array'or jsonb_array_length(side_basis->'blockers')<>0
 then return jsonb_build_object('status','blocked','code','side_source_unresolved');end if;
 for entry in select value from jsonb_array_elements(m->'entries')loop
  select*into allocation from app.q_pool_allocation_versions_v1 where tournament_id=tid and event_id=eid and roster_entry_id=(entry->>'rosterEntryId')::uuid order by version desc limit 1;
  select*into payment from app.roster_payment_events where tournament_id=tid and id=(entry->>'receiptId')::uuid;
  if allocation.id is null or payment.id is null or allocation.receipt_id<>payment.id or allocation.membership_version_id is null
   or payment.event_type<>'received'or payment.amount_minor is distinct from(entry->>'receivedMinor')::integer
  then return jsonb_build_object('status','blocked','code','receipt_ownership_changed');end if;
  parts:=jsonb_build_array(jsonb_build_object('eventId',eid,'bucket','regular_entry','poolId',null,'amountMinor',(entry->>'baseAllocatedMinor')::bigint,'classificationReviewed',true));
  amount:=(entry->>'baseAllocatedMinor')::numeric;
  for part in select value from jsonb_array_elements(entry->'pools')loop
   if(part->>'amountAllocatedMinor')::numeric>0 then
    if part->>'paidEntryEligible'is distinct from'true'then return jsonb_build_object('status','blocked','code','q_paid_eligibility_changed');end if;
    amount:=amount+(part->>'amountAllocatedMinor')::numeric;
    parts:=parts||jsonb_build_array(jsonb_build_object('eventId',eid,'bucket','q','poolId',part->'poolVersionId','amountMinor',(part->>'amountAllocatedMinor')::bigint,'classificationReviewed',true));
   end if;
  end loop;
  if amount<>payment.amount_minor then return jsonb_build_object('status','blocked','code','nonconserving_receipt_partition');end if;
  receipt_total:=receipt_total+amount;
  receipts:=receipts||jsonb_build_array(jsonb_build_object('receipt',to_jsonb(payment),'allocation',to_jsonb(allocation),
   'source',jsonb_build_object('sourceId',payment.id,'physicalEvidenceId',payment.id,'kind','entry_receipt','amountMinor',payment.amount_minor,'state','active','allocations',parts)));
 end loop;
 for election in select distinct on(e.pool_id,e.participant_id)e.*,to_jsonb(o)as receipt_capture
  from app.event_side_pool_election_versions e join app.operation_receipts o on o.id=e.operation_receipt_id and o.tournament_id=e.tournament_id
  where e.tournament_id=tid and e.event_id=eid order by e.pool_id,e.participant_id,e.version desc loop
  if not election.elected then
   if election.amount_received_minor<>0 then return jsonb_build_object('status','blocked','code','side_funding_unresolved');end if;continue;
  end if;
  if election.amount_received_minor<=0 or election.amount_received_minor<>election.amount_due_minor
   or election.receipt_capture->>'operation_type'is distinct from'side_pool_graduated_v2_election'
   or election.receipt_capture->>'outcome'is distinct from'accepted'
   or election.receipt_capture->>'actor_profile_id'is distinct from election.actor_profile_id::text
   or election.receipt_capture->>'target_id'is distinct from election.pool_id::text
   or exists(select 1 from app.roster_payment_events where tournament_id=tid and id=election.id)
   or exists(select 1 from app.tournament_expense_events where tournament_id=tid and id=election.id)
   or exists(select 1 from app.native_unrestricted_income_sources_v1 where tournament_id=tid and physical_evidence_id=election.id)
  then return jsonb_build_object('status','blocked','code','side_receipt_ownership_unresolved');end if;
  select id into policy_id from app.side_pool_graduated_policies_v2 where tournament_id=tid and event_id=eid and pool_id=election.pool_id;
  reason_prefix:='Side policy '||policy_id::text||': ';
  if policy_id is null or not starts_with(election.reason,reason_prefix)then return jsonb_build_object('status','blocked','code','side_operation_binding_unresolved');end if;
  election_request:=jsonb_build_object('policyId',policy_id,'participantId',election.participant_id,'electionId',election.election_id,
   'expectedVersion',election.version-1,'elected',election.elected,'receivedMinor',election.amount_received_minor,
   'paymentMethod',election.payment_method,'paymentReference',election.payment_reference,'reason',substr(election.reason,length(reason_prefix)+1));
  election_hash:=encode(extensions.digest(convert_to(jsonb_build_array('side_pool_graduated_v2','election',election.actor_profile_id,tid,eid,election.pool_id,election_request)::text,'utf8'),'sha256'),'hex');
  election_response:=jsonb_build_object('status','side_pool_election_saved_v2','poolId',election.pool_id,'participantId',election.participant_id,
   'electionId',election.election_id,'version',election.version,'moneyMoved',false);
  if election.receipt_capture->>'request_hash'is distinct from election_hash or election.receipt_capture->'response_payload'is distinct from election_response
  then return jsonb_build_object('status','blocked','code','side_operation_binding_unresolved');end if;
  side_total:=side_total+election.amount_received_minor;
  side_sources:=side_sources||jsonb_build_array(jsonb_build_object('election',to_jsonb(election)-'receipt_capture','operationReceipt',election.receipt_capture,
   'source',jsonb_build_object('sourceId',election.id,'physicalEvidenceId',election.id,'kind','entry_receipt','amountMinor',election.amount_received_minor,
   'state','active','allocations',jsonb_build_array(jsonb_build_object('eventId',eid,'bucket','side','poolId',election.pool_id,'amountMinor',election.amount_received_minor,'classificationReviewed',true)))));
 end loop;
 if receipt_total<>(basis->>'receiptTotalMinor')::numeric or side_total<>(side_basis->>'sideIncomeMinor')::numeric
 then return jsonb_build_object('status','blocked','code','optional_receipt_coverage_incomplete');end if;
 capture:=jsonb_build_object('kind','native-optional-pool-ownership-source-v2','tournamentId',tid,'eventId',eid,
  'refundPolicy','no-pool-refunds-v1','nativeRawSource',native_raw,'nativePlayoffSource',playoff_source,'basis',basis,'membership',m,'qSource',q,'qReview',to_jsonb(qr),'sideBasis',side_basis,
  'rosterReceiptPartitions',receipts,'sideRecordedSources',side_sources,
  'evidenceMeaning','recorded bookkeeping only; not bank verification or disbursement');
 digest:=encode(extensions.digest(convert_to(capture::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('status','ownership_source_available','kind','native-optional-pool-ownership-source-v2','actorId',actor,
  'tournamentId',tid,'eventId',eid,'sourceDigest',digest,'capture',capture,'funds',jsonb_build_object(
  'regularReceiptsMinor',basis->'grossEntryIncomeMinor','qReceiptsMinor',basis->'qIncomeMinor','sideReceiptsMinor',side_total,
  'recordedReceiptsMinor',receipt_total+side_total),'moneyMoved',false,'bankReceiptVerified',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;

create function app.save_native_optional_pool_ownership_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare source_value jsonb;head app.native_optional_pool_ownership_revisions_v2%rowtype;cost jsonb;cost_ids text[]:='{}';cost_total numeric:=0;
 prior app.native_optional_pool_ownership_operations_v2%rowtype;h text;rid uuid:=extensions.gen_random_uuid();result jsonb;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null or op is null then return null;end if;
 if app.native_optional_pool_ownership_enabled_v2()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for update nowait;if not found then return null;end if;
 if jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>6
  or not(request?&array['expectedVersion','sourceDigest','reason','reviewed','kind','costClassifications'])or request->>'kind'is distinct from'native-optional-pool-ownership-v2'
  or request->'reviewed'is distinct from'true'::jsonb or jsonb_typeof(request->'expectedVersion')is distinct from'number'
  or jsonb_typeof(request->'sourceDigest')is distinct from'string'or coalesce(request->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,9})$'
  or(request->>'expectedVersion')::numeric>=2147483647 or coalesce(request->>'sourceDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'is distinct from app.custom_payout_classification_text_v2(request->>'reason')
  or app.event_settings_js_text_length_v3(request->>'reason')not between 1 and 2000
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-pool-ownership-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.native_optional_pool_ownership_operations_v2 where actor_id=actor and operation_id=op;
 if found then
  if prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select o.result into result from app.native_optional_pool_ownership_outcomes_v2 o where o.actor_id=actor and o.operation_id=op;
  return coalesce(result,jsonb_build_object('status','retry_exact','code','operation_incomplete'));
 end if;
 source_value:=app.native_optional_pool_ownership_source_v2(actor,tid,eid);
 if source_value->>'status'='retry_exact'then return source_value;end if;
 if source_value is null or source_value->>'status'is distinct from'ownership_source_available'then return jsonb_build_object('status','rejected','code','source_blocked');end if;
 if source_value->>'sourceDigest'is distinct from request->>'sourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 if jsonb_typeof(request->'costClassifications')is distinct from'array'
  or jsonb_array_length(request->'costClassifications')<>jsonb_array_length(source_value#>'{capture,basis,expenses}')
 then return jsonb_build_object('status','rejected','code','cost_coverage_incomplete');end if;
 for cost in select value from jsonb_array_elements(request->'costClassifications')loop
  if jsonb_typeof(cost)is distinct from'object'or(select count(*)from jsonb_object_keys(cost))<>2
   or not(cost?&array['expenseEventId','category'])or coalesce(cost->>'category','')not in('player_benefit','operating_expense')
   or coalesce(cost->>'expenseEventId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or cost->>'expenseEventId'=any(cost_ids)
   or not exists(select 1 from jsonb_array_elements(source_value#>'{capture,basis,expenses}')x where x->>'expenseEventId'=cost->>'expenseEventId')
  then return jsonb_build_object('status','rejected','code','invalid_cost_classification');end if;
  cost_ids:=array_append(cost_ids,cost->>'expenseEventId');
  cost_total:=cost_total+(select(x->>'amountMinor')::numeric from jsonb_array_elements(source_value#>'{capture,basis,expenses}')x where x->>'expenseEventId'=cost->>'expenseEventId');
 end loop;
 if cost_total>(source_value#>>'{funds,regularReceiptsMinor}')::numeric then return jsonb_build_object('status','rejected','code','negative_regular_fund');end if;
 select*into head from app.native_optional_pool_ownership_revisions_v2 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(head.version,0)<>(request->>'expectedVersion')::integer then return jsonb_build_object('status','rejected','code','stale_version');end if;
 insert into app.native_optional_pool_ownership_operations_v2(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)values(actor,op,tid,eid,request,h);
 insert into app.native_optional_pool_ownership_revisions_v2(id,tournament_id,event_id,version,prior_revision_id,actor_id,operation_id,source_digest,source_capture,reason)
 values(rid,tid,eid,coalesce(head.version,0)+1,head.id,actor,op,source_value->>'sourceDigest',source_value,request->>'reason');
 result:=jsonb_build_object('status','optional_pool_ownership_reviewed_v2','revisionId',rid,'version',coalesce(head.version,0)+1,
  'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'sourceDigest',source_value->>'sourceDigest','moneyMoved',false,'finalizationAuthorized',false);
 insert into app.native_optional_pool_ownership_outcomes_v2(actor_id,operation_id,tournament_id,event_id,result)values(actor,op,tid,eid,result);
 return result;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
create function app.reconcile_native_optional_pool_ownership_v2(actor uuid,tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare prior app.native_optional_pool_ownership_operations_v2%rowtype;result_value jsonb;h text;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=tid for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select*into prior from app.native_optional_pool_ownership_operations_v2 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op);end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-optional-pool-ownership-v2',actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 if prior.request_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select o.result into result_value from app.native_optional_pool_ownership_outcomes_v2 o where o.actor_id=actor and o.operation_id=op;
 return jsonb_build_object('status','historical_operation','result',result_value,'currentFundAuthority',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;
revoke all on function app.native_optional_pool_ownership_enabled_v2(),app.native_optional_pool_ownership_source_v2(uuid,uuid,uuid),app.save_native_optional_pool_ownership_v2(uuid,uuid,uuid,uuid,jsonb),app.reconcile_native_optional_pool_ownership_v2(uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
do $$declare signature text;begin foreach signature in array array[
 'app.native_optional_pool_ownership_enabled_v2()','app.native_optional_recorded_sources_v2(uuid,uuid)',
 'app.native_optional_pool_ownership_source_v2(uuid,uuid,uuid)','app.save_native_optional_pool_ownership_v2(uuid,uuid,uuid,uuid,jsonb)',
 'app.reconcile_native_optional_pool_ownership_v2(uuid,uuid,uuid,uuid,jsonb)'
]loop execute format('alter function %s owner to postgres',signature);end loop;end$$;
commit;
