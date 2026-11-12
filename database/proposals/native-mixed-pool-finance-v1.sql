-- PRIVATE LOCAL CANDIDATE. Requires native mixed funding/review and pool amounts V1.
-- UNPAID SIMULATED obligations only. No ordinary payment, attendance, liability,
-- refund, disbursement, public capability or historical policy is changed.
begin;
create function app.native_mixed_pool_finance_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;
create function app.native_mixed_pool_exact_v1(v jsonb,keys text[])returns boolean
language sql immutable set search_path=''as $$select case when jsonb_typeof(v)='object'
 then (select count(*)from jsonb_object_keys(v))=cardinality(keys)and v?&keys else false end$$;
-- The existing subject helper locks current user/session records. This new
-- boundary also checks the JWT expiry itself, including direct SQL callers.
create function app.native_mixed_pool_actor_v1()returns uuid
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;claims jsonb;expires numeric;begin
 actor:=app.native_mixed_game_own_subject_v1();if actor is null then return null;end if;
 claims:=auth.jwt();
 if jsonb_typeof(claims->'exp')is distinct from'number'or coalesce(claims->>'exp','')!~'^[0-9]{1,16}$'then return null;end if;
 expires:=(claims->>'exp')::numeric;if expires<=extract(epoch from clock_timestamp())then return null;end if;
 return actor;
end$$;

create table app.native_mixed_pool_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,receipt_id uuid not null unique,
 record_id uuid not null,request_payload jsonb not null,request_hash text not null,
 response_payload jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 check(request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array(
  'native-mixed-pool-finance-v1',actor_id,operation_id,tournament_id,event_id,request_payload)))
);
create table app.native_mixed_pool_records_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 entity_key text not null check(length(entity_key)between 1 and 180),version integer not null check(version>0),
 prior_id uuid,kind text not null check(kind in('policy','election','funding','seal','final')),
 actor_id uuid not null,operation_id uuid not null,payload jsonb not null,source_digest text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id,entity_key,version),unique(id,tournament_id,event_id,entity_key),
 unique(id,tournament_id,event_id),unique(actor_id,operation_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)references app.native_mixed_pool_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(prior_id,tournament_id,event_id,entity_key)references app.native_mixed_pool_records_v1(id,tournament_id,event_id,entity_key),
 check((version=1 and prior_id is null)or(version>1 and prior_id is not null)),
 check(source_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array(
  'native-mixed-pool-record-v1',id,tournament_id,event_id,entity_key,version,prior_id,kind,actor_id,operation_id,payload)))
);
alter table app.native_mixed_pool_operations_v1 add foreign key(record_id,tournament_id,event_id)
 references app.native_mixed_pool_records_v1(id,tournament_id,event_id)deferrable initially deferred;
create table app.native_mixed_pool_obligations_v1(
 id uuid primary key default extensions.gen_random_uuid(),final_record_id uuid not null,policy_record_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,participant_id uuid not null,
 amount_minor bigint not null check(amount_minor>0),rounding_unit_minor integer not null check(rounding_unit_minor in(100,500,1000)),
 status text not null default'UNPAID_SIMULATED'check(status='UNPAID_SIMULATED'),
 actual_money_received boolean not null default false check(not actual_money_received),
 ordinary_liability boolean not null default false check(not ordinary_liability),
 money_moved boolean not null default false check(not money_moved),
 unique(final_record_id,policy_record_id,participant_id),
 foreign key(final_record_id,tournament_id,event_id)references app.native_mixed_pool_records_v1(id,tournament_id,event_id),
 foreign key(policy_record_id,tournament_id,event_id)references app.native_mixed_pool_records_v1(id,tournament_id,event_id),
 foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 check(amount_minor%rounding_unit_minor=0)
);
do $security$declare n text;begin foreach n in array array[
 'native_mixed_pool_operations_v1','native_mixed_pool_records_v1','native_mixed_pool_obligations_v1']loop
 execute format('alter table app.%I owner to postgres',n);
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger immutable before update or delete on app.%I for each row execute function app.reject_immutable_history()',n);
 execute format('create trigger no_truncate before truncate on app.%I for each statement execute function app.reject_immutable_history()',n);
end loop;end$security$;

create function app.native_mixed_pool_journal_digest_v1(tid uuid,eid uuid)returns text
language sql stable security definer set search_path=''as $$select app.native_mixed_simulation_hash_v1(
 coalesce(jsonb_agg(jsonb_build_array(entity_key,version,source_digest)order by entity_key,version),'[]'))
 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid$$;

-- Read the saved activated setup, not a caller's fee/ratio or display name.
create function app.native_mixed_pool_setup_v1(tid uuid,eid uuid,kind text,pool uuid,funding jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare intent app.native_mixed_admission_intents_v1%rowtype;s app.native_mixed_funding_scopes_v1%rowtype;
 q jsonb;definition jsonb;ratio text;method text;fee integer;
begin
 select*into s from app.native_mixed_funding_scopes_v1 where id=(funding#>>'{scope,scopeId}')::uuid and tournament_id=tid and event_id=eid;
 select*into intent from app.native_mixed_admission_intents_v1 where id=s.admission_intent_id and tournament_id=tid and event_id=eid;
 if intent.id is null then return null;end if;
 if kind='q'then
  select to_jsonb(x)into q from app.tournament_setup_q_pool_versions x where x.id=pool and x.tournament_id=tid
   and x.setup_event_version_id=(intent.setup_event_capture->>'id')::uuid;
  if q is null then return null;end if;fee:=(q->>'entry_fee_cents')::integer;
  if q->>'pool_type_code'='Equal (Pays All Equally)'then method:='q-equal-exact-selected-step-v1';ratio:=null;
  elsif q->>'pool_type_code'~'^Graduated \(1-in-[1-9][0-9]*\)$'then
   method:='q-v3-raw-selected-step-v1';ratio:=substring(q->>'pool_type_code'from'1-in-([0-9]+)');
  else return null;end if;
 elsif kind='side'then
  select to_jsonb(x)into q from app.tournament_setup_side_pool_materializations m
   join app.tournament_setup_side_pool_versions x on x.id=m.setup_side_pool_version_id and x.tournament_id=m.tournament_id
   where m.tournament_id=tid and m.event_id=eid and m.pool_id=pool
   and x.setup_event_version_id=(intent.setup_event_capture->>'id')::uuid;
  select to_jsonb(x)into definition from app.event_side_pool_definition_versions x
   where x.tournament_id=tid and x.event_id=eid and x.pool_id=pool order by x.version desc limit 1;
  if q is null or definition is null or definition->'active'is distinct from'true'::jsonb
   or q->'entry_fee_cents'is distinct from definition->'entry_fee_minor'then return null;end if;
  fee:=(q->>'entry_fee_cents')::integer;method:='side-sheet20-40-selected-step-v1';
  if q->>'payout_type'~'^graduated-1-in-[1-9][0-9]*$'then ratio:=substring(q->>'payout_type'from'1-in-([0-9]+)');
  elsif q->>'payout_type'is null and coalesce(q->>'custom_ratio_denominator_v3','')~'^[1-9][0-9]*$'then ratio:=q->>'custom_ratio_denominator_v3';
  else return null;end if;
 else return null;end if;
 if fee<=0 or(ratio is not null and(ratio::numeric<1 or ratio::numeric>2147483647))then return null;end if;
 return jsonb_build_object('kind',kind,'poolId',pool,'setup',q,'definition',definition,
  'admissionIntentId',intent.id,'setupEventVersionId',intent.setup_event_capture->'id',
  'method',method,'feeMinor',fee,'ratio',case when ratio is null then null else ratio::integer end);
end$$;

-- New pools are sealed before an existing native Start. No-policy starts are unchanged.
create function app.native_mixed_pool_start_guard_v1()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=new.tournament_id and event_id=new.event_id and kind='policy')
 and not exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=new.tournament_id and event_id=new.event_id and kind='seal')
 then raise exception using errcode='P0001',message='native_pool_seal_before_start_required';end if;return new;
end$$;
create trigger native_pool_seal_guard_v1 before insert on app.native_mixed_simulation_starts_v1
 for each row execute function app.native_mixed_pool_start_guard_v1();

create function app.execute_native_mixed_pool_finance_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;action text;data jsonb;funding jsonb;setup_source jsonb;amount_policy jsonb;latest_prize jsonb;saved_rounding text;
 old app.native_mixed_pool_operations_v1%rowtype;head app.native_mixed_pool_records_v1%rowtype;
 policy app.native_mixed_pool_records_v1%rowtype;el app.native_mixed_pool_records_v1%rowtype;
 seal app.native_mixed_pool_records_v1%rowtype;part jsonb;entry jsonb;record_payload jsonb;response jsonb;
 key text;requested_kind text;pool uuid;rid uuid:=extensions.gen_random_uuid();receipt uuid:=extensions.gen_random_uuid();
 h text;rh text;journal text;seq integer;prior uuid;code text;review jsonb;cards jsonb;ranked jsonb;
 policy_rows jsonb:='[]';elections jsonb;contributions jsonb;results jsonb:='[]';awards jsonb;calc jsonb;
 paid integer;recipients integer;fund bigint;unit integer;i integer;item jsonb;ob jsonb;is_director boolean;
begin
 if app.native_mixed_pool_finance_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 actor:=app.native_mixed_pool_actor_v1();
 if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 if tid is null or eid is null or op is null or not app.native_mixed_pool_exact_v1(request,array['version','action','expectedJournalDigest','data','reason'])
  or request->>'version'is distinct from'native-mixed-pool-request-v1'
  or coalesce(request->>'expectedJournalDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or request->>'reason'<>trim(request->>'reason')
  or length(request->>'reason')not between 1 and 500 or request->>'reason'~'[[:cntrl:]]'
 then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
 action:=request->>'action';data:=request->'data';
 if action is null or action not in('policy','elect','fund','seal','final')then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;
 is_director:=found;
 if action<>'elect'and not is_director then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))
 then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 select*into old from app.native_mixed_pool_operations_v1 where actor_id=actor and operation_id=op;
 if old.operation_id is not null then
  if old.tournament_id<>tid or old.event_id<>eid or old.request_payload<>request then raise exception using errcode='P0001',message='native_pool_operation_conflict';end if;
  if action='elect'and not is_director and not exists(select 1 from app.native_mixed_pool_records_v1 r
   where r.id=old.record_id and r.kind='election'and r.payload#>>'{participant,mode}'='digital'and r.payload#>>'{participant,profileId}'=actor::text)
  then return null;end if;
  if not exists(select 1 from app.operation_receipts r join app.native_mixed_pool_records_v1 x on x.id=old.record_id
   where r.id=old.receipt_id and r.actor_profile_id=actor and r.client_operation_id=op and r.tournament_id=tid
   and r.operation_type='native_mixed_pool_simulation_v1'and r.request_hash=old.request_hash and r.outcome='accepted'
   and r.response_payload=old.response_payload and x.actor_id=actor and x.operation_id=op)
  then raise exception using errcode='P0001',message='native_pool_journal_integrity';end if;
  return old.response_payload||jsonb_build_object('replayed',true,'current',false,'historicalReceipt',true);
 end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true then raise exception using errcode='P0001',message='native_pool_operation_conflict';end if;
 funding:=app.native_mixed_funding_seal_source_v1(tid,eid);
 if funding->>'status'is distinct from'source_available'then raise exception using errcode='P0001',message='native_pool_current_funding_required';end if;
 lock table app.native_mixed_pool_operations_v1,app.native_mixed_pool_records_v1,app.native_mixed_pool_obligations_v1 in share row exclusive mode nowait;
 lock table app.tournament_setup_q_pool_versions,app.tournament_setup_side_pool_versions,
  app.tournament_setup_side_pool_materializations,app.event_side_pool_definition_versions in share mode nowait;
 journal:=app.native_mixed_pool_journal_digest_v1(tid,eid);
 if journal<>request->>'expectedJournalDigest'then raise exception using errcode='P0001',message='native_pool_source_changed';end if;
 if action<>'final'and exists(select 1 from app.native_mixed_simulation_starts_v1 where tournament_id=tid and event_id=eid)
 then raise exception using errcode='P0001',message='native_pool_prestart_required';end if;
 if exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='final')
 then raise exception using errcode='P0001',message='native_pool_already_final';end if;
 if action not in('final','seal')and exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='seal')
 then raise exception using errcode='P0001',message='native_pool_membership_sealed';end if;

 if action='policy'then
  if not app.native_mixed_pool_exact_v1(data,array['kind','poolId','amountPolicy','disclosure','expectedFundingDigest'])
   or data->>'expectedFundingDigest'is distinct from funding->>'sourceDigest'
   or jsonb_typeof(data->'disclosure')is distinct from'string'or length(trim(data->>'disclosure'))not between 1 and 1000
  then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
  requested_kind:=data->>'kind';pool:=(data->>'poolId')::uuid;amount_policy:=data->'amountPolicy';
  setup_source:=app.native_mixed_pool_setup_v1(tid,eid,requested_kind,pool,funding);
  if setup_source is null or not app.native_mixed_pool_exact_v1(amount_policy,array['version','kind','method','feeMinor','ratio','roundingUnitMinor'])
   or amount_policy->>'version'is distinct from'native-mixed-pool-policy-v1'or amount_policy->>'kind'is distinct from requested_kind
   or amount_policy->'feeMinor'is distinct from setup_source->'feeMinor'or amount_policy->'ratio'is distinct from setup_source->'ratio'
   or amount_policy->'method'is distinct from setup_source->'method'or amount_policy->'roundingUnitMinor'not in('100'::jsonb,'500'::jsonb,'1000'::jsonb)
  then raise exception using errcode='P0001',message='native_pool_saved_policy_mismatch';end if;
  -- The current seal proves the entire immutable funding/base capture. Latest
  -- saved rounding is a setting, not a caller-selectable override here.
  -- Legacy captures have no latestPrize and retain their original behavior.
  select s.source_capture#>'{baseSource,latestPrize}'into latest_prize
   from app.native_mixed_funding_scopes_v1 s
   where s.id=(funding#>>'{scope,scopeId}')::uuid and s.tournament_id=tid and s.event_id=eid;
  if latest_prize is not null then
   saved_rounding:=latest_prize#>>array['plan','draft','rounding',case when requested_kind='q'then'qPool'else'sidePool'end];
   if latest_prize->>'kind'is distinct from'native-mixed-latest-prize-pin-v1'
    or saved_rounding is null or saved_rounding not in('1','5','10')then
    raise exception using errcode='P0001',message='native_pool_saved_rounding_unavailable';end if;
   if amount_policy->'roundingUnitMinor'is distinct from to_jsonb(saved_rounding::integer*100)then
    raise exception using errcode='P0001',message='native_pool_saved_rounding_mismatch';end if;
  end if;
  if(requested_kind='side'and(amount_policy->>'feeMinor')::integer not in(1000,2000,5000,10000))
   or(requested_kind='q'and amount_policy->>'method'='q-v3-raw-selected-step-v1'and((amount_policy->>'feeMinor')::integer<500 or(amount_policy->>'feeMinor')::integer%500<>0))
   or(requested_kind='q'and amount_policy->>'method'='q-equal-exact-selected-step-v1'and(amount_policy->>'feeMinor')::integer%100<>0)
  then raise exception using errcode='P0001',message='native_pool_unsupported_amount_domain';end if;
  key:='policy:'||requested_kind||':'||pool::text;
  if exists(select 1 from app.native_mixed_pool_records_v1 e join app.native_mixed_pool_records_v1 p on p.id=(e.payload->>'policyId')::uuid
   where e.tournament_id=tid and e.event_id=eid and e.kind='election'and p.entity_key=key)
  then raise exception using errcode='P0001',message='native_pool_policy_has_elections';end if;
  record_payload:=jsonb_build_object('setupSource',setup_source,'amountPolicy',amount_policy,'disclosure',data->'disclosure',
   'fundingScopeId',funding#>'{scope,scopeId}','fundingSourceDigest',funding->'sourceDigest','simulationOnly',true);
 elsif action='elect'then
  if not app.native_mixed_pool_exact_v1(data,array['policyId','policyDigest','participantId','elected','acknowledged','consentReference'])
   or jsonb_typeof(data->'elected')is distinct from'boolean'or jsonb_typeof(data->'acknowledged')is distinct from'boolean'
   or(data->'elected'='true'::jsonb and data->'acknowledged'is distinct from'true'::jsonb)
   or jsonb_typeof(data->'consentReference')is distinct from'string'or length(trim(data->>'consentReference'))not between 1 and 500
  then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
  select*into policy from app.native_mixed_pool_records_v1 where id=(data->>'policyId')::uuid and tournament_id=tid and event_id=eid and kind='policy';
  if policy.id is null or policy.source_digest<>data->>'policyDigest'or exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and entity_key=policy.entity_key and version>policy.version)
  then raise exception using errcode='P0001',message='native_pool_policy_changed';end if;
  select x into part from jsonb_array_elements(funding->'entries')x where x->>'participantId'=data->>'participantId';
  if app.native_mixed_pool_setup_v1(tid,eid,policy.payload#>>'{amountPolicy,kind}',(policy.payload#>>'{setupSource,poolId}')::uuid,funding)
   is distinct from policy.payload->'setupSource'or policy.payload->>'fundingSourceDigest'<>funding->>'sourceDigest'
  then raise exception using errcode='P0001',message='native_pool_setup_or_funding_changed';end if;
  if part is null or(part->>'mode'='digital'and part->>'profileId'is distinct from actor::text)
   or(part->>'mode'='paper'and(part->>'profileId'is not null or not is_director))
  then raise exception using errcode='P0001',message='native_pool_own_or_fictional_subject_required';end if;
  if exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and entity_key='funding:'||policy.id::text||':'||(part->>'participantId'))
  then raise exception using errcode='P0001',message='native_pool_funded_change_requires_policy';end if;
  key:='election:'||policy.id::text||':'||(part->>'participantId');
  record_payload:=jsonb_build_object('policyId',policy.id,'policyDigest',policy.source_digest,'participant',part-'obligation'-'receipt',
   'elected',data->'elected','acknowledged',data->'acknowledged','consentReference',data->'consentReference','simulationOnly',true);
 elsif action='fund'then
  if not app.native_mixed_pool_exact_v1(data,array['electionId','electionDigest'])then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
  select*into el from app.native_mixed_pool_records_v1 where id=(data->>'electionId')::uuid and tournament_id=tid and event_id=eid and kind='election';
  if el.id is null or el.source_digest<>data->>'electionDigest'or el.payload->'elected'is distinct from'true'::jsonb
   or exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and entity_key=el.entity_key and version>el.version)
  then raise exception using errcode='P0001',message='native_pool_current_election_required';end if;
  select*into policy from app.native_mixed_pool_records_v1 where id=(el.payload->>'policyId')::uuid and kind='policy';
  if app.native_mixed_pool_setup_v1(tid,eid,policy.payload#>>'{amountPolicy,kind}',(policy.payload#>>'{setupSource,poolId}')::uuid,funding)
   is distinct from policy.payload->'setupSource'or policy.payload->>'fundingSourceDigest'<>funding->>'sourceDigest'
  then raise exception using errcode='P0001',message='native_pool_setup_or_funding_changed';end if;
  key:='funding:'||policy.id::text||':'||(el.payload#>>'{participant,participantId}');
  if exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and entity_key=key)
  then raise exception using errcode='P0001',message='native_pool_contribution_already_recorded';end if;
  record_payload:=jsonb_build_object('policyId',policy.id,'policyDigest',policy.source_digest,'electionId',el.id,'electionDigest',el.source_digest,
   'participantId',el.payload#>'{participant,participantId}','amountMinor',policy.payload#>'{amountPolicy,feeMinor}',
   'fundingScopeId',funding#>'{scope,scopeId}','fundingSourceDigest',funding->'sourceDigest',
   'method','simulated','actualMoneyReceived',false,'moneyMoved',false);
 elsif action='seal'then
  if not app.native_mixed_pool_exact_v1(data,array['expectedFundingDigest'])or data->>'expectedFundingDigest'is distinct from funding->>'sourceDigest'
   or exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='seal')
  then raise exception using errcode='P0001',message='native_pool_seal_conflict';end if;
  for policy in select distinct on(entity_key)*from app.native_mixed_pool_records_v1
   where tournament_id=tid and event_id=eid and kind='policy'order by entity_key,version desc loop
   setup_source:=app.native_mixed_pool_setup_v1(tid,eid,policy.payload#>>'{amountPolicy,kind}',(policy.payload#>>'{setupSource,poolId}')::uuid,funding);
   if setup_source is distinct from policy.payload->'setupSource'or policy.payload->>'fundingSourceDigest'<>funding->>'sourceDigest'
   then raise exception using errcode='P0001',message='native_pool_setup_or_funding_changed';end if;
   select coalesce(jsonb_agg(to_jsonb(x)order by x.entity_key),'[]')into elections from(
    select distinct on(entity_key)*from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid
     and kind='election'and payload->>'policyId'=policy.id::text order by entity_key,version desc)x;
   select coalesce(jsonb_agg(to_jsonb(x)order by x.entity_key),'[]')into contributions from app.native_mixed_pool_records_v1 x
    where tournament_id=tid and event_id=eid and kind='funding'and payload->>'policyId'=policy.id::text;
   for entry in select value from jsonb_array_elements(elections)where value#>'{payload,elected}'='true'::jsonb loop
    if not exists(select 1 from jsonb_array_elements(contributions)c where c#>>'{payload,electionId}'=entry->>'id'and c#>>'{payload,electionDigest}'=entry->>'source_digest')
    then raise exception using errcode='P0001',message='native_pool_unfunded_election';end if;
   end loop;
   if jsonb_array_length(contributions)<>(select count(*)from jsonb_array_elements(elections)x where x#>'{payload,elected}'='true'::jsonb)
   then raise exception using errcode='P0001',message='native_pool_contribution_mismatch';end if;
   policy_rows:=policy_rows||jsonb_build_array(jsonb_build_object('policy',to_jsonb(policy),'elections',elections,'contributions',contributions));
  end loop;
  if jsonb_array_length(policy_rows)=0 then raise exception using errcode='P0001',message='native_pool_no_policies';end if;
  key:='seal';record_payload:=jsonb_build_object('policies',policy_rows,'fundingSourceDigest',funding->'sourceDigest','simulationOnly',true);
 else
  if not app.native_mixed_pool_exact_v1(data,array['sealId','sealDigest','startId'])then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
  select*into seal from app.native_mixed_pool_records_v1 where id=(data->>'sealId')::uuid and tournament_id=tid and event_id=eid and kind='seal';
  if seal.id is null or seal.source_digest<>data->>'sealDigest'or seal.payload->>'fundingSourceDigest'<>funding->>'sourceDigest'
   or not exists(select 1 from app.native_mixed_simulation_starts_v1 where id=(data->>'startId')::uuid and tournament_id=tid and event_id=eid and started_at>=seal.created_at)
  then raise exception using errcode='P0001',message='native_pool_current_seal_and_start_required';end if;
  review:=app.native_mixed_qualification_review_v1(tid,eid,(data->>'startId')::uuid);
  if review->>'status'is distinct from'review_available'or review->'qualificationReady'is distinct from'true'::jsonb
   or review->'tieReviewRequired'is distinct from'false'::jsonb or review->>'fundingSourceDigest'<>funding->>'sourceDigest'
  then raise exception using errcode='P0001',message='native_pool_verified_untied_cards_required';end if;
  cards:=review->'cards';
  for item in select value from jsonb_array_elements(seal.payload->'policies')loop
   amount_policy:=item#>'{policy,payload,amountPolicy}';requested_kind:=amount_policy->>'kind';
   setup_source:=app.native_mixed_pool_setup_v1(tid,eid,requested_kind,(item#>>'{policy,payload,setupSource,poolId}')::uuid,funding);
   if setup_source is distinct from item#>'{policy,payload,setupSource}'then raise exception using errcode='P0001',message='native_pool_setup_or_funding_changed';end if;
   paid:=jsonb_array_length(item->'contributions');unit:=(amount_policy->>'roundingUnitMinor')::integer;
   fund:=paid::bigint*(amount_policy->>'feeMinor')::bigint;
   if paid=0 then results:=results||jsonb_build_array(jsonb_build_object('policyId',item#>'{policy,id}','status','empty_no_obligations','fundMinor',0,'obligations','[]'::jsonb));continue;end if;
   select jsonb_agg(c order by(c->>'gamePoints')::integer desc,(c->>'wins')::integer desc,
    case when requested_kind='q'then(c->>'netSpread')::integer else 0 end desc,(c->>'positiveSpread')::integer desc)
   into ranked from jsonb_array_elements(cards)c where exists(select 1 from jsonb_array_elements(item->'contributions')p where p#>>'{payload,participantId}'=c->>'participantId')
    and(amount_policy->>'method'<>'q-equal-exact-selected-step-v1'or(c->>'rank')::integer<=5);
   if coalesce(jsonb_array_length(ranked),0)=0 then raise exception using errcode='P0001',message='native_pool_no_eligible_paid_recipients';end if;
   if requested_kind='side'and exists(select 1 from jsonb_array_elements(ranked)c group by c->>'gamePoints',c->>'wins',c->>'positiveSpread'having count(*)>1)
   then raise exception using errcode='P0001',message='native_pool_cash_tie_unresolved';end if;
   recipients:=case when amount_policy->>'method'='q-equal-exact-selected-step-v1' then jsonb_array_length(ranked)
    else ceil(paid::numeric/(amount_policy->>'ratio')::numeric)::integer end;
   if recipients>jsonb_array_length(ranked)then raise exception using errcode='P0001',message='native_pool_recipient_source_mismatch';end if;
   calc:=app.native_mixed_pool_amounts_v1(amount_policy,paid,recipients);
   if calc->>'status'is distinct from'calculated'or(calc->>'fundMinor')::bigint<>fund
   then raise exception using errcode='P0001',message='native_pool_amount_blocked:'||coalesce(calc->>'code','unknown');end if;
   awards:='[]';for i in 0..recipients-1 loop awards:=awards||jsonb_build_array(jsonb_build_object(
    'participantId',ranked#>array[i::text,'participantId'],'amountMinor',calc#>array['awardsMinor',i::text],
    'status','UNPAID_SIMULATED','ordinaryLiability',false,'moneyMoved',false));end loop;
   results:=results||jsonb_build_array(jsonb_build_object('policyId',item#>'{policy,id}','fundMinor',fund,'calculation',calc,'obligations',awards));
  end loop;
  key:='final';record_payload:=jsonb_build_object('sealId',seal.id,'sealDigest',seal.source_digest,'startId',data->'startId',
   'reviewSourceDigest',review->'sourceDigest','fundingSourceDigest',funding->'sourceDigest','pools',results,
   'status','UNPAID_SIMULATED','ordinaryLiability',false,'moneyMoved',false,'refunds','[]'::jsonb);
 end if;

 select*into head from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and entity_key=key order by version desc limit 1;
 seq:=coalesce(head.version,0)+1;prior:=head.id;
 h:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-pool-record-v1',rid,tid,eid,key,seq,prior,case action when'elect'then'election'when'fund'then'funding'else action end,actor,op,record_payload));
 rh:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-pool-finance-v1',actor,op,tid,eid,request));
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true
 then raise exception using errcode='P0001',message='native_pool_authorization_changed';end if;
 response:=jsonb_build_object('status','accepted','kind','native-mixed-pool-receipt-v1','action',action,'recordId',rid,
  'recordDigest',h,'operationId',op,'tournamentId',tid,'eventId',eid,'simulationOnly',true,'current',true,
  'ordinaryLiability',false,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'refunds','[]'::jsonb);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(receipt,tid,actor,'native_mixed_pool_simulation_v1',rid,rh,op,'accepted',response,clock_timestamp());
 insert into app.native_mixed_pool_operations_v1 values(actor,op,tid,eid,receipt,rid,request,rh,response,clock_timestamp());
 insert into app.native_mixed_pool_records_v1 values(rid,tid,eid,key,seq,prior,case action when'elect'then'election'when'fund'then'funding'else action end,actor,op,record_payload,h,clock_timestamp());
 if action='final'then for item in select value from jsonb_array_elements(results)loop
  for ob in select value from jsonb_array_elements(item->'obligations')loop
   insert into app.native_mixed_pool_obligations_v1(final_record_id,policy_record_id,tournament_id,event_id,participant_id,amount_minor,rounding_unit_minor)
   values(rid,(item->>'policyId')::uuid,tid,eid,(ob->>'participantId')::uuid,(ob->>'amountMinor')::bigint,
    (select(payload#>>'{amountPolicy,roundingUnitMinor}')::integer from app.native_mixed_pool_records_v1 where id=(item->>'policyId')::uuid));
  end loop;end loop;end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,receipt,'native_mixed_pool_simulation',rid,action,jsonb_build_object('digest',h,'simulationOnly',true,'moneyMoved',false));
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','native_pool_invalid_request');
 when sqlstate'P0001'then get stacked diagnostics code=message_text;
  if code not like'native_pool_%'then raise;end if;return jsonb_build_object('status','rejected','code',code,'moneyMoved',false);
end$$;

-- Cohort-only read model: public-shaped policy/count summaries, own election
-- references, and a Director-only work list. Unknown/stale funding is not zero.
create function app.get_native_mixed_pool_finance_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;director boolean;funding jsonb;policies jsonb;own_entries jsonb;work jsonb;seals jsonb;saved_policy record;
begin
 if app.native_mixed_pool_finance_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();
 if actor is null then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then
  return jsonb_build_object('status','blocked','code','source_busy');end if;
 funding:=app.native_mixed_funding_seal_source_v1(tid,eid);
 if funding->>'status'is distinct from'source_available'then return jsonb_build_object('status','blocked','code','current_funding_unavailable');end if;
 lock table app.native_mixed_pool_operations_v1,app.native_mixed_pool_records_v1 in share mode nowait;
 lock table app.tournament_setup_q_pool_versions,app.tournament_setup_side_pool_versions,
  app.tournament_setup_side_pool_materializations,app.event_side_pool_definition_versions in share mode nowait;
 for saved_policy in select distinct on(entity_key)*from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='policy'order by entity_key,version desc loop
  if app.native_mixed_pool_setup_v1(tid,eid,saved_policy.payload#>>'{amountPolicy,kind}',(saved_policy.payload#>>'{setupSource,poolId}')::uuid,funding)
   is distinct from saved_policy.payload->'setupSource'or saved_policy.payload->>'fundingSourceDigest'<>funding->>'sourceDigest'
  then return jsonb_build_object('status','blocked','code','pool_setup_or_funding_changed');end if;
 end loop;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;
 director:=found;
 with p as(select distinct on(entity_key)*from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='policy'order by entity_key,version desc),
 e as(select distinct on(entity_key)*from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='election'order by entity_key,version desc)
 select coalesce(jsonb_agg(jsonb_build_object('policyId',p.id,'policyDigest',p.source_digest,
  'poolId',p.payload#>'{setupSource,poolId}','amountPolicy',p.payload->'amountPolicy','disclosure',p.payload->'disclosure',
  'electedCount',(select count(*)from e where e.payload->>'policyId'=p.id::text and e.payload->'elected'='true'::jsonb),
  'simulatedPaidCount',(select count(*)from app.native_mixed_pool_records_v1 f where f.tournament_id=tid and f.event_id=eid and f.kind='funding'and f.payload->>'policyId'=p.id::text),
  'simulatedFundMinor',(select coalesce(sum((f.payload->>'amountMinor')::bigint),0)from app.native_mixed_pool_records_v1 f where f.tournament_id=tid and f.event_id=eid and f.kind='funding'and f.payload->>'policyId'=p.id::text))order by p.entity_key),'[]')into policies from p;
 with e as(select distinct on(entity_key)*from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='election'order by entity_key,version desc)
 select coalesce(jsonb_agg(jsonb_build_object('electionId',e.id,'electionDigest',e.source_digest,'policyId',e.payload->'policyId',
  'participantId',e.payload#>'{participant,participantId}','mode',e.payload#>'{participant,mode}','elected',e.payload->'elected',
  'simulatedFunded',exists(select 1 from app.native_mixed_pool_records_v1 f where f.tournament_id=tid and f.event_id=eid and f.kind='funding'and f.payload->>'electionId'=e.id::text))order by e.entity_key),'[]')
 into work from e where director or e.payload#>>'{participant,profileId}'=actor::text;
 select coalesce(jsonb_agg(jsonb_build_object('participantId',x->'participantId','rosterEntryId',x->'rosterEntryId')),'[]')into own_entries
 from jsonb_array_elements(funding->'entries')x where x->>'mode'='digital'and x->>'profileId'=actor::text;
 select jsonb_build_object('sealed',exists(select 1 from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='seal'),
  'seal',case when director then(select jsonb_build_object('id',id,'digest',source_digest)from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='seal')else null end)into seals;
 return jsonb_build_object('status','source_available','kind','native-mixed-pool-workspace-v1','actorId',actor,'tournamentId',tid,'eventId',eid,
  'journalDigest',app.native_mixed_pool_journal_digest_v1(tid,eid),'fundingSourceDigest',funding->'sourceDigest',
  'policies',policies,'ownParticipants',own_entries,'elections',work,'membership',seals,
  'simulationOnly',true,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'ordinaryLiability',false);
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');end$$;

do $acl$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_pool_finance_enabled_v1()'::regprocedure,'app.native_mixed_pool_exact_v1(jsonb,text[])'::regprocedure,
 'app.native_mixed_pool_actor_v1()'::regprocedure,
 'app.native_mixed_pool_journal_digest_v1(uuid,uuid)'::regprocedure,'app.native_mixed_pool_setup_v1(uuid,uuid,text,uuid,jsonb)'::regprocedure,
 'app.native_mixed_pool_start_guard_v1()'::regprocedure,'app.execute_native_mixed_pool_finance_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.get_native_mixed_pool_finance_v1(uuid,uuid)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$acl$;
commit;
