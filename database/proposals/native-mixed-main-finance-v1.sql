-- PRIVATE / DEFAULT-OFF LOCAL CANDIDATE. Native simulated Main only.
-- Director-entered costs and whole-group awards, never an automatic payout
-- policy, genuine receipt, ordinary qualification, liability or disbursement.
begin;
create function app.native_mixed_main_finance_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create table app.native_mixed_main_finance_records_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 sequence integer not null check(sequence>0),prior_id uuid,kind text not null check(kind in('cost-line','review-costs','propose-awards','finalize-unpaid')),
 actor_id uuid not null references app.profiles(id),actor_session_id uuid not null,operation_id uuid not null,receipt_id uuid not null unique,
 request_payload jsonb not null,request_hash text not null,source_capture jsonb not null,source_digest text not null,
 payload jsonb not null,record_digest text not null,response_payload jsonb not null,created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,sequence),unique(actor_id,operation_id),unique(id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(prior_id,tournament_id,event_id)references app.native_mixed_main_finance_records_v1(id,tournament_id,event_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check((sequence=1 and prior_id is null)or(sequence>1 and prior_id is not null)),
 check(source_digest=app.native_mixed_simulation_hash_v1(source_capture)),
 check(request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-request-v1',actor_id,tournament_id,event_id,request_payload))),
 check(record_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-record-v1',id,tournament_id,event_id,sequence,prior_id,kind,actor_id,actor_session_id,operation_id,request_payload,source_digest,payload)))
);
create table app.native_mixed_main_finance_obligations_v1(
 id uuid primary key default extensions.gen_random_uuid(),final_record_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 participant_id uuid not null,first_place integer not null,last_place integer not null,
 amount_minor bigint not null check(amount_minor>0),rounding_unit_minor integer not null check(rounding_unit_minor in(100,500,1000)),
 status text not null default'UNPAID_SIMULATED'check(status='UNPAID_SIMULATED'),
 actual_money_received boolean not null default false check(not actual_money_received),ordinary_liability boolean not null default false check(not ordinary_liability),
 money_moved boolean not null default false check(not money_moved),unique(final_record_id,participant_id),
 foreign key(final_record_id,tournament_id,event_id)references app.native_mixed_main_finance_records_v1(id,tournament_id,event_id),
 foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 check(amount_minor%rounding_unit_minor=0)
);
do $security$declare n text;begin foreach n in array array['native_mixed_main_finance_records_v1','native_mixed_main_finance_obligations_v1']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',n);
 execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',n);
end loop;end$security$;

create function app.native_mixed_main_finance_journal_v1(tid uuid,eid uuid)returns text
language sql stable security definer set search_path=''as $$select app.native_mixed_simulation_hash_v1(coalesce(jsonb_agg(jsonb_build_array(id,sequence,record_digest)order by sequence),'[]'))from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid$$;

-- Only existing native source, sealed simulated Main funding, and receipt-bound
-- native playoff completion are accepted. No ordinary V2 IDs are synthesized.
create function app.native_mixed_main_finance_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare p jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;f app.native_mixed_playoff_completions_v1%rowtype;body jsonb;begin
 p:=app.native_mixed_playoff_source_v1(tid,eid);if p is null then return null;end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid;
 select*into f from app.native_mixed_playoff_completions_v1 where context_id=c.id;
 if c.id is null or f.id is null or c.source_capture is distinct from p->'capture'or c.source_digest is distinct from p->>'sourceDigest'
  or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true or app.native_mixed_playoff_completion_bound_v1(c.id)is distinct from true
  or p#>'{capture,review,simulatedGrossMinor}'is null or p#>>'{capture,review,simulatedGrossMinor}'!~'^[1-9][0-9]{0,11}$'
  or p#>'{capture,review,actualMoneyReceived}'is distinct from'false'::jsonb
  or p#>'{capture,settingsBinding,context,sanctioned}'is distinct from'false'::jsonb
 then return null;end if; -- sanctioned coverage needs an actual assessment bridge
 body:=jsonb_build_object('kind','native-mixed-main-finance-source-v1','tournamentId',tid,'eventId',eid,'playoffContextId',c.id,
  'playoffContextDigest',c.context_digest,'playoffSource',p,'completionId',f.id,'completionDigest',f.source_digest,'completion',f.source_capture,
  'simulatedGrossMinor',p#>'{capture,review,simulatedGrossMinor}','mainFundingSourceDigest',p#>'{capture,review,fundingSourceDigest}',
  'historicalSavedDraft',p#>'{capture,settingsBinding,draft}','costsReviewed',false,'netPrizeFundMinor',null,
  'simulationOnly',true,'ordinaryQualificationRecorded',false,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false);
 return jsonb_build_object('sourceDigest',app.native_mixed_simulation_hash_v1(body),'capture',body);
end$$;

create function app.native_mixed_main_finance_record_bound_v1(record_value uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare v app.native_mixed_main_finance_records_v1%rowtype;p app.native_mixed_main_finance_records_v1%rowtype;r app.operation_receipts%rowtype;
 review app.native_mixed_main_finance_records_v1%rowtype;award app.native_mixed_main_finance_records_v1%rowtype;
 d jsonb;costs jsonb;expected jsonb;response jsonb;groups jsonb:='[]';recipients jsonb:='[]';g jsonb;a jsonb;pid jsonb;total bigint:=0;previous_amount bigint;unit integer;i integer;prior_journal text;begin
 select*into v from app.native_mixed_main_finance_records_v1 where id=record_value;if v.id is null then return false;end if;
 if v.sequence>1 then select*into p from app.native_mixed_main_finance_records_v1 where id=v.prior_id and tournament_id=v.tournament_id and event_id=v.event_id and sequence=v.sequence-1;if p.id is null then return false;end if;end if;
 if not app.native_mixed_pool_exact_v1(v.request_payload,array['version','action','expectedSourceDigest','expectedJournalDigest','data','reason'])then return false;end if;
 select app.native_mixed_simulation_hash_v1(coalesce(jsonb_agg(jsonb_build_array(id,sequence,record_digest)order by sequence),'[]'))into prior_journal
  from app.native_mixed_main_finance_records_v1 where tournament_id=v.tournament_id and event_id=v.event_id and sequence<v.sequence;
 if v.request_payload->>'expectedJournalDigest'is distinct from prior_journal then return false;end if;
 d:=v.request_payload->'data';costs:=app.native_mixed_main_finance_costs_v1(v.tournament_id,v.event_id,(v.source_capture->>'simulatedGrossMinor')::bigint,v.sequence);
 if v.kind='cost-line'then
  if not app.native_mixed_pool_exact_v1(d,array['lineId','priorRecordId','category','label','amountMinor','voided'])then return false;end if;
  select*into p from app.native_mixed_main_finance_records_v1 where tournament_id=v.tournament_id and event_id=v.event_id and kind='cost-line'and sequence<v.sequence and payload->>'lineId'=d->>'lineId'order by sequence desc limit 1;
  if d->>'priorRecordId'is distinct from p.id::text or(p.id is not null and d->>'category'is distinct from p.payload->>'category')then return false;end if;
  expected:=d||jsonb_build_object('recordId',v.id,'simulationOnly',true);
 elsif v.kind='review-costs'then
  if not app.native_mixed_pool_exact_v1(d,array['roundingUnitMinor','coverage','expectedBenefitsMinor','expectedExpensesMinor','expectedIncomeMinor','expectedNetMinor','confirmed'])
   or d->'confirmed'is distinct from'true'::jsonb or d->'expectedBenefitsMinor'is distinct from costs->'benefitsMinor'or d->'expectedExpensesMinor'is distinct from costs->'expensesMinor'
   or d->'expectedIncomeMinor'is distinct from costs->'additionalIncomeMinor'or d->'expectedNetMinor'is distinct from costs->'netMinor'then return false;end if;
  expected:=jsonb_build_object('costs',costs,'coverage',d->'coverage','roundingUnitMinor',d->'roundingUnitMinor','costsExplicitlyReviewed',true,'zeroCostsNotInferred',true,'simulationOnly',true);
 else
  select*into review from app.native_mixed_main_finance_records_v1 where id=(d->>'costReviewId')::uuid and tournament_id=v.tournament_id and event_id=v.event_id and kind='review-costs'and sequence<v.sequence;
  if review.id is null or review.source_digest<>v.source_digest or review.payload#>>'{costs,costDigest}'is distinct from costs->>'costDigest'then return false;end if;
  unit:=(review.payload->>'roundingUnitMinor')::integer;
  if v.kind='propose-awards'then
   if not app.native_mixed_pool_exact_v1(d,array['costReviewId','manualPolicy','groups','confirmed'])or d->'confirmed'is distinct from'true'::jsonb or jsonb_typeof(d->'groups')is distinct from'array'then return false;end if;
   if jsonb_array_length(d->'groups')<>4 or d#>'{manualPolicy,roundingUnitMinor}'is distinct from to_jsonb(unit)then return false;end if;
   for i in 0..3 loop
    g:=d->'groups'->i;a:=(v.source_capture#>'{completion,finishingGroups}')->i;
    if not app.native_mixed_pool_exact_v1(g,array['firstPlace','lastPlace','perPersonMinor'])or g->'firstPlace'is distinct from a->'firstPlace'or g->'lastPlace'is distinct from a->'lastPlace'
     or coalesce(g->>'perPersonMinor','')!~'^[1-9][0-9]{0,11}$'or(g->>'perPersonMinor')::bigint%unit<>0 then return false;end if;
    if i>0 and(g->>'perPersonMinor')::bigint>previous_amount then return false;end if;previous_amount:=(g->>'perPersonMinor')::bigint;
    total:=total+(g->>'perPersonMinor')::bigint*jsonb_array_length(a->'participantIds');groups:=groups||jsonb_build_array(g||jsonb_build_object('participantIds',a->'participantIds'));
   end loop;
   if total<>(costs->>'netMinor')::bigint then return false;end if;
   expected:=jsonb_build_object('costReviewId',review.id,'costReviewDigest',review.record_digest,'costDigest',costs->>'costDigest','manualPolicy',d->'manualPolicy','groups',groups,'totalMinor',total,
    'historicalSavedDraft',v.source_capture->'historicalSavedDraft','distributionAutomaticallyApproved',false,'feeComparisonNotEvaluated',true,'simulationOnly',true);
  elsif v.kind='finalize-unpaid'then
   if not app.native_mixed_pool_exact_v1(d,array['costReviewId','awardProposalId','confirmed'])or d->'confirmed'is distinct from'true'::jsonb then return false;end if;
   select*into award from app.native_mixed_main_finance_records_v1 where id=(d->>'awardProposalId')::uuid and tournament_id=v.tournament_id and event_id=v.event_id and kind='propose-awards'and sequence<v.sequence;
   if award.id is null or award.source_digest<>v.source_digest or award.payload->>'costReviewDigest'<>review.record_digest then return false;end if;
   groups:=award.payload->'groups';total:=(award.payload->>'totalMinor')::bigint;if total<>(costs->>'netMinor')::bigint then return false;end if;
   for g in select value from jsonb_array_elements(groups)loop
    for pid in select value from jsonb_array_elements(g->'participantIds')loop recipients:=recipients||jsonb_build_array(jsonb_build_object('participantId',pid,'firstPlace',g->'firstPlace','lastPlace',g->'lastPlace','amountMinor',g->'perPersonMinor','status','UNPAID_SIMULATED'));end loop;
   end loop;
   if(select count(*)from app.native_mixed_main_finance_obligations_v1 where final_record_id=v.id)<>jsonb_array_length(recipients)
    or exists(select 1 from jsonb_array_elements(recipients)x where not exists(select 1 from app.native_mixed_main_finance_obligations_v1 ob where ob.final_record_id=v.id and ob.tournament_id=v.tournament_id and ob.event_id=v.event_id
     and ob.participant_id::text=x->>'participantId'and ob.first_place=(x->>'firstPlace')::integer and ob.last_place=(x->>'lastPlace')::integer and ob.amount_minor=(x->>'amountMinor')::bigint and ob.rounding_unit_minor=unit and ob.status='UNPAID_SIMULATED'))then return false;end if;
   expected:=jsonb_build_object('costReviewId',review.id,'costReviewDigest',review.record_digest,'awardProposalId',award.id,'awardProposalDigest',award.record_digest,'completionDigest',v.source_capture->'completionDigest',
    'roundingUnitMinor',unit,'groups',groups,'recipients',recipients,'totalMinor',total,'reviewedCosts',costs,'status','UNPAID_SIMULATED','simulationOnly',true,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false,'refunds','[]'::jsonb);
  else return false;end if;
 end if;
 if v.payload is distinct from expected then return false;end if;
 response:=jsonb_build_object('status','accepted','kind','native-mixed-main-finance-receipt-v1','action',v.kind,'recordId',v.id,'recordDigest',v.record_digest,'sequence',v.sequence,
  'simulationOnly',true,'ordinaryQualificationRecorded',false,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false,'payoutAuthorized',false);
 if v.response_payload is distinct from response then return false;end if;
 select*into r from app.operation_receipts where id=v.receipt_id;
 return v.request_payload->>'action'=v.kind and v.request_payload->>'version'='native-mixed-main-finance-request-v1'
  and v.request_payload->>'expectedSourceDigest'=v.source_digest and v.source_capture->>'tournamentId'=v.tournament_id::text and v.source_capture->>'eventId'=v.event_id::text
  and v.source_digest=app.native_mixed_simulation_hash_v1(v.source_capture)
  and v.request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-request-v1',v.actor_id,v.tournament_id,v.event_id,v.request_payload))
  and v.record_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-record-v1',v.id,v.tournament_id,v.event_id,v.sequence,v.prior_id,v.kind,v.actor_id,v.actor_session_id,v.operation_id,v.request_payload,v.source_digest,v.payload))
  and r.id is not null and r.tournament_id=v.tournament_id and r.actor_profile_id=v.actor_id and r.client_operation_id=v.operation_id
  and r.operation_type='native_mixed_main_finance_v1'and r.target_id=v.id and r.request_hash=v.request_hash and r.outcome='accepted'and r.response_payload=v.response_payload
  and exists(select 1 from app.audit_events a where a.operation_receipt_id=r.id and a.tournament_id=v.tournament_id and a.actor_profile_id=v.actor_id
   and a.entity_type='native_mixed_main_finance_simulation'and a.entity_id=v.id and a.action=v.kind and a.after_state=v.response_payload);
end$$;

-- Replays active cost lines only; absence is NOT Director review of zero costs.
create function app.native_mixed_main_finance_costs_v1(tid uuid,eid uuid,gross bigint,before_sequence integer default 2147483647)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare rows jsonb;benefits bigint;expenses bigint;income bigint;h text;begin
 select coalesce(jsonb_agg(payload order by payload->>'lineId'),'[]')into rows from(
  select distinct on(payload->>'lineId')payload from app.native_mixed_main_finance_records_v1
   where tournament_id=tid and event_id=eid and kind='cost-line'and sequence<before_sequence order by payload->>'lineId',sequence desc)x;
 select coalesce(sum((x->>'amountMinor')::bigint)filter(where x->>'category'='player_benefit'and x->'voided'='false'::jsonb),0),
  coalesce(sum((x->>'amountMinor')::bigint)filter(where x->>'category'='operating_expense'and x->'voided'='false'::jsonb),0),
  coalesce(sum((x->>'amountMinor')::bigint)filter(where x->>'category'='unrestricted_income'and x->'voided'='false'::jsonb),0)into benefits,expenses,income from jsonb_array_elements(rows)x;
 h:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-cost-lines-v1',rows));
 return jsonb_build_object('lines',rows,'costDigest',h,'grossMinor',gross,'benefitsMinor',benefits,'expensesMinor',expenses,'additionalIncomeMinor',income,'netMinor',gross-benefits-expenses+income);
end$$;

create function app.execute_native_mixed_main_finance_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;action text;d jsonb;source jsonb;head app.native_mixed_main_finance_records_v1%rowtype;old app.operation_receipts%rowtype;
 previous app.native_mixed_main_finance_records_v1%rowtype;review app.native_mixed_main_finance_records_v1%rowtype;awards app.native_mixed_main_finance_records_v1%rowtype;
 costs jsonb;record_payload jsonb;groups jsonb;g jsonb;actual jsonb;recipients jsonb:='[]';pid jsonb;total bigint:=0;amount bigint;previous_amount bigint;unit integer;latest_prize jsonb;saved_rounding text;
 rh text;rd text;response jsonb;rid uuid:=extensions.gen_random_uuid();idv uuid:=extensions.gen_random_uuid();n integer;i integer;begin
 if app.native_mixed_main_finance_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1,app.tournament_roles in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 if tid is null or eid is null or op is null or not app.native_mixed_pool_exact_v1(request,array['version','action','expectedSourceDigest','expectedJournalDigest','data','reason'])
  or request->>'version'is distinct from'native-mixed-main-finance-request-v1'or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'or coalesce(request->>'expectedJournalDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or length(request->>'reason')not between 1 and 500 or request->>'reason'<>trim(request->>'reason')or request->>'reason'~'[[:cntrl:]]'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 action:=request->>'action';d:=request->'data';if action is null or action not in('cost-line','review-costs','propose-awards','finalize-unpaid')then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 rh:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-request-v1',actor,tid,eid,request));
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if old.id is not null then
  if old.tournament_id<>tid or old.operation_type<>'native_mixed_main_finance_v1'or old.request_hash<>rh then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  if app.native_mixed_main_finance_record_bound_v1(old.target_id)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 source:=app.native_mixed_main_finance_source_v1(tid,eid);if source is null or source->>'sourceDigest'<>request->>'expectedSourceDigest'then return jsonb_build_object('status','rejected','code','source_or_fee_coverage_unavailable');end if;
 lock table app.native_mixed_main_finance_records_v1,app.native_mixed_main_finance_obligations_v1 in share row exclusive mode nowait;
 if request->>'expectedJournalDigest'<>app.native_mixed_main_finance_journal_v1(tid,eid)then return jsonb_build_object('status','rejected','code','journal_changed');end if;
 if exists(select 1 from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and(source_digest<>source->>'sourceDigest'or app.native_mixed_main_finance_record_bound_v1(id)is distinct from true))then return jsonb_build_object('status','blocked','code','source_or_history_changed');end if;
 if exists(select 1 from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and kind='finalize-unpaid')then return jsonb_build_object('status','rejected','code','already_finalized');end if;
 select*into head from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid order by sequence desc limit 1;n:=coalesce(head.sequence,0)+1;
 costs:=app.native_mixed_main_finance_costs_v1(tid,eid,(source#>>'{capture,simulatedGrossMinor}')::bigint);
 if action='cost-line'then
  if not app.native_mixed_pool_exact_v1(d,array['lineId','priorRecordId','category','label','amountMinor','voided'])or app.native_mixed_simulation_uuid_v1(d->>'lineId')is distinct from true
   or(d->'priorRecordId'is distinct from'null'::jsonb and app.native_mixed_simulation_uuid_v1(d->>'priorRecordId')is distinct from true)
   or coalesce(d->>'category','')not in('player_benefit','operating_expense','unrestricted_income')or jsonb_typeof(d->'label')is distinct from'string'or length(d->>'label')not between 1 and 200 or d->>'label'<>trim(d->>'label')or d->>'label'~'[[:cntrl:]]'
   or jsonb_typeof(d->'amountMinor')is distinct from'number'or coalesce(d->>'amountMinor','')!~'^(0|[1-9][0-9]{0,11})$'or jsonb_typeof(d->'voided')is distinct from'boolean'
   then return jsonb_build_object('status','rejected','code','invalid_cost_line');end if;
  select r.*into previous from app.native_mixed_main_finance_records_v1 r where r.tournament_id=tid and r.event_id=eid and r.kind='cost-line'and r.payload->>'lineId'=d->>'lineId'order by r.sequence desc limit 1;
  if(previous.id is null and(d->'priorRecordId'is distinct from'null'::jsonb or d->'voided'='true'::jsonb))or(previous.id is not null and(d->>'priorRecordId'is distinct from previous.id::text or d->>'category'is distinct from previous.payload->>'category'))
   or(d->'voided'='true'::jsonb and d->'amountMinor'is distinct from'0'::jsonb)then return jsonb_build_object('status','rejected','code','cost_lineage_changed');end if;
  record_payload:=d||jsonb_build_object('recordId',idv,'simulationOnly',true);
 elsif action='review-costs'then
  if not app.native_mixed_pool_exact_v1(d,array['roundingUnitMinor','coverage','expectedBenefitsMinor','expectedExpensesMinor','expectedIncomeMinor','expectedNetMinor','confirmed'])
   or d->'confirmed'is distinct from'true'::jsonb or d->'roundingUnitMinor'not in('100'::jsonb,'500'::jsonb,'1000'::jsonb)
   or not app.native_mixed_pool_exact_v1(d->'coverage',array['status','reason'])or d#>>'{coverage,status}'is distinct from'not_applicable'
   or jsonb_typeof(d#>'{coverage,reason}')is distinct from'string'or length(trim(d#>>'{coverage,reason}'))not between 1 and 500
   or d->'expectedBenefitsMinor'is distinct from costs->'benefitsMinor'or d->'expectedExpensesMinor'is distinct from costs->'expensesMinor'
   or d->'expectedIncomeMinor'is distinct from costs->'additionalIncomeMinor'or d->'expectedNetMinor'is distinct from costs->'netMinor'
   or(costs->>'netMinor')::bigint<0 then return jsonb_build_object('status','rejected','code','cost_review_required');end if;
  -- Latest regular rounding is captured by the verified current playoff source.
  -- Existing legacy sources and exact historical receipts remain unchanged.
  latest_prize:=source#>'{capture,playoffSource,capture,latestPrize}';
  if latest_prize is not null then
   saved_rounding:=latest_prize#>>'{plan,draft,rounding,regular}';
   if latest_prize->>'kind'is distinct from'native-mixed-latest-prize-pin-v1'
    or saved_rounding is null or saved_rounding not in('1','5','10')then
    return jsonb_build_object('status','rejected','code','saved_rounding_unavailable');end if;
   if d->'roundingUnitMinor'is distinct from to_jsonb(saved_rounding::integer*100)then
    return jsonb_build_object('status','rejected','code','saved_rounding_mismatch');end if;
  end if;
  record_payload:=jsonb_build_object('costs',costs,'coverage',d->'coverage','roundingUnitMinor',d->'roundingUnitMinor','costsExplicitlyReviewed',true,'zeroCostsNotInferred',true,'simulationOnly',true);
 else
  if action='propose-awards'then
   if not app.native_mixed_pool_exact_v1(d,array['costReviewId','manualPolicy','groups','confirmed'])or d->'confirmed'is distinct from'true'::jsonb
    or app.native_mixed_simulation_uuid_v1(d->>'costReviewId')is distinct from true or jsonb_typeof(d->'groups')is distinct from'array'
    or not app.native_mixed_pool_exact_v1(d->'manualPolicy',array['version','roundingUnitMinor','disclosure'])or d#>>'{manualPolicy,version}'is distinct from'native-mixed-main-manual-whole-group-v1'
    or jsonb_typeof(d#>'{manualPolicy,disclosure}')is distinct from'string'or length(trim(d#>>'{manualPolicy,disclosure}'))not between 1 and 1000
   then return jsonb_build_object('status','rejected','code','invalid_manual_awards');end if;
   select*into review from app.native_mixed_main_finance_records_v1 where id=(d->>'costReviewId')::uuid and tournament_id=tid and event_id=eid and kind='review-costs';
  else
   if not app.native_mixed_pool_exact_v1(d,array['costReviewId','awardProposalId','confirmed'])or d->'confirmed'is distinct from'true'::jsonb
    or app.native_mixed_simulation_uuid_v1(d->>'costReviewId')is distinct from true or app.native_mixed_simulation_uuid_v1(d->>'awardProposalId')is distinct from true then return jsonb_build_object('status','rejected','code','invalid_finalize');end if;
   select*into awards from app.native_mixed_main_finance_records_v1 where id=(d->>'awardProposalId')::uuid and tournament_id=tid and event_id=eid and kind='propose-awards';
   select*into review from app.native_mixed_main_finance_records_v1 where id=(d->>'costReviewId')::uuid and tournament_id=tid and event_id=eid and kind='review-costs';
   if awards.id is null or awards.payload->>'costReviewId'is distinct from review.id::text
    or awards.id is distinct from(select id from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and kind='propose-awards'order by sequence desc limit 1)
   then return jsonb_build_object('status','rejected','code','award_proposal_changed');end if;
  end if;
  if review.id is null or review.id is distinct from(select id from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and kind='review-costs'order by sequence desc limit 1)
   or review.payload#>>'{costs,costDigest}'is distinct from costs->>'costDigest'or review.source_digest<>source->>'sourceDigest'
   then return jsonb_build_object('status','rejected','code','current_cost_review_required');end if;
  unit:=(review.payload->>'roundingUnitMinor')::integer;
  if action='propose-awards'then
   if d#>'{manualPolicy,roundingUnitMinor}'is distinct from to_jsonb(unit)or jsonb_array_length(d->'groups')<>4 then return jsonb_build_object('status','rejected','code','manual_policy_or_groups_changed');end if;
   groups:='[]';
   for i in 0..3 loop
    g:=d->'groups'->i;actual:=(source#>'{capture,completion,finishingGroups}')->i;
    if not app.native_mixed_pool_exact_v1(g,array['firstPlace','lastPlace','perPersonMinor'])or g->'firstPlace'is distinct from actual->'firstPlace'or g->'lastPlace'is distinct from actual->'lastPlace'
     or jsonb_typeof(g->'perPersonMinor')is distinct from'number'or coalesce(g->>'perPersonMinor','')!~'^[1-9][0-9]{0,11}$'then return jsonb_build_object('status','rejected','code','whole_group_required');end if;
    amount:=(g->>'perPersonMinor')::bigint;if amount%unit<>0 then return jsonb_build_object('status','rejected','code','selected_increment_required');end if;
    if i>0 and amount>previous_amount then return jsonb_build_object('status','rejected','code','award_order_required');end if;previous_amount:=amount;
    total:=total+amount*jsonb_array_length(actual->'participantIds');groups:=groups||jsonb_build_array(g||jsonb_build_object('participantIds',actual->'participantIds'));
   end loop;
   if total<>(costs->>'netMinor')::bigint then return jsonb_build_object('status','rejected','code','fund_imbalance');end if;
   record_payload:=jsonb_build_object('costReviewId',review.id,'costReviewDigest',review.record_digest,'costDigest',costs->>'costDigest','manualPolicy',d->'manualPolicy','groups',groups,'totalMinor',total,
    'historicalSavedDraft',source#>'{capture,historicalSavedDraft}','distributionAutomaticallyApproved',false,'feeComparisonNotEvaluated',true,'simulationOnly',true);
  else
   groups:=awards.payload->'groups';total:=(awards.payload->>'totalMinor')::bigint;
   if total<>(costs->>'netMinor')::bigint or awards.payload->>'costReviewDigest'<>review.record_digest then return jsonb_build_object('status','rejected','code','fund_or_review_changed');end if;
   for g in select value from jsonb_array_elements(groups)loop
    for pid in select value from jsonb_array_elements(g->'participantIds')loop recipients:=recipients||jsonb_build_array(jsonb_build_object('participantId',pid,'firstPlace',g->'firstPlace','lastPlace',g->'lastPlace','amountMinor',g->'perPersonMinor','status','UNPAID_SIMULATED'));end loop;
   end loop;
   if jsonb_array_length(recipients)<>5 or(select count(distinct x->>'participantId')from jsonb_array_elements(recipients)x)<>5 then return jsonb_build_object('status','blocked','code','recipient_mapping_changed');end if;
   record_payload:=jsonb_build_object('costReviewId',review.id,'costReviewDigest',review.record_digest,'awardProposalId',awards.id,'awardProposalDigest',awards.record_digest,'completionDigest',source#>'{capture,completionDigest}',
    'roundingUnitMinor',unit,'groups',groups,'recipients',recipients,'totalMinor',total,'reviewedCosts',costs,'status','UNPAID_SIMULATED','simulationOnly',true,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false,'refunds','[]'::jsonb);
  end if;
 end if;
 rd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-main-finance-record-v1',idv,tid,eid,n,head.id,action,actor,(auth.jwt()->>'session_id')::uuid,op,request,source->>'sourceDigest',record_payload));
 response:=jsonb_build_object('status','accepted','kind','native-mixed-main-finance-receipt-v1','action',action,'recordId',idv,'recordDigest',rd,'sequence',n,
  'simulationOnly',true,'ordinaryQualificationRecorded',false,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false,'payoutAuthorized',false);
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then raise exception using errcode='P0001',message='native_main_authorization_changed';end if;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,tid,actor,'native_mixed_main_finance_v1',idv,rh,op,'accepted',response,clock_timestamp());
 insert into app.native_mixed_main_finance_records_v1(id,tournament_id,event_id,sequence,prior_id,kind,actor_id,actor_session_id,operation_id,receipt_id,request_payload,request_hash,source_capture,source_digest,payload,record_digest,response_payload)
  values(idv,tid,eid,n,head.id,action,actor,(auth.jwt()->>'session_id')::uuid,op,rid,request,rh,source->'capture',source->>'sourceDigest',record_payload,rd,response);
 if action='finalize-unpaid'then
  for g in select value from jsonb_array_elements(recipients)loop insert into app.native_mixed_main_finance_obligations_v1(final_record_id,tournament_id,event_id,participant_id,first_place,last_place,amount_minor,rounding_unit_minor)
   values(idv,tid,eid,(g->>'participantId')::uuid,(g->>'firstPlace')::integer,(g->>'lastPlace')::integer,(g->>'amountMinor')::bigint,unit);end loop;
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,rid,'native_mixed_main_finance_simulation',idv,action,response);
 if app.native_mixed_main_finance_record_bound_v1(idv)is distinct from true then raise exception 'native Main receipt postcondition failed';end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.get_native_mixed_main_finance_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;source jsonb;costs jsonb;rows jsonb;response jsonb;begin
 if app.native_mixed_main_finance_enabled_v1()is distinct from true then return null;end if;actor:=app.native_mixed_pool_actor_v1();if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1,app.tournament_roles in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 source:=app.native_mixed_main_finance_source_v1(tid,eid);if source is null then return jsonb_build_object('status','blocked','code','source_or_fee_coverage_unavailable');end if;
 lock table app.native_mixed_main_finance_records_v1,app.native_mixed_main_finance_obligations_v1 in share mode nowait;
 if exists(select 1 from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and(source_digest<>source->>'sourceDigest'or app.native_mixed_main_finance_record_bound_v1(id)is distinct from true))then return jsonb_build_object('status','blocked','code','source_or_history_changed');end if;
 costs:=app.native_mixed_main_finance_costs_v1(tid,eid,(source#>>'{capture,simulatedGrossMinor}')::bigint);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'sequence',sequence,'kind',kind,'payload',payload,'recordDigest',record_digest)order by sequence),'[]')into rows from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid;
 response:=jsonb_build_object('status','source_available','source',source,'journalDigest',app.native_mixed_main_finance_journal_v1(tid,eid),'costs',costs,'records',rows,
  'costsReviewed',exists(select 1 from app.native_mixed_main_finance_records_v1 where tournament_id=tid and event_id=eid and kind='review-costs'and payload#>>'{costs,costDigest}'=costs->>'costDigest'),
  'simulationOnly',true,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false,'payoutAuthorized',false);
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

do $acl$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_main_finance_enabled_v1()'::regprocedure,'app.native_mixed_main_finance_journal_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_main_finance_source_v1(uuid,uuid)'::regprocedure,'app.native_mixed_main_finance_record_bound_v1(uuid)'::regprocedure,
 'app.native_mixed_main_finance_costs_v1(uuid,uuid,bigint,integer)'::regprocedure,'app.execute_native_mixed_main_finance_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.get_native_mixed_main_finance_v1(uuid,uuid)'::regprocedure]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$acl$;
commit;
