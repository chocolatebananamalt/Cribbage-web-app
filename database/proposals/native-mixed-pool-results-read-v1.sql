-- PRIVATE DEFAULT-OFF current pool awards read proof. No table, writer,
-- access grant, policy, amount algorithm, ordinary result or money change.
begin;
-- BEGIN POOL RESULTS DEPENDENCIES
do $dependencies$declare x record;p record;begin
 for x in select*from(values ('app.execute_native_mixed_pool_finance_v1(uuid,uuid,uuid,jsonb)','f982de5e3df213f651dfa45da607c8b3459d570dfe934c325cbbb25efa68b921',true,'v',array['search_path=""','TimeZone=UTC','lock_timeout=250ms']::text[]),('app.native_mixed_pool_setup_v1(uuid,uuid,text,uuid,jsonb)','127eda06e2c176a2bd7fcd463f58e033764fc1a44d826c9d21f62247e653e388',true,'s',array['search_path=""']::text[]),('app.native_mixed_pool_amounts_v1(jsonb,integer,integer)','caf2318914292c5b23ed9db1f39a1eaeaafdeeda007af3f853b7432bd9b6b48c',false,'i',array['search_path=""']::text[]))v(signature,body_sha,definer,volatility,configs)loop
  select*into p from pg_proc where oid=to_regprocedure(x.signature);
  if p.oid is null or encode(extensions.digest(replace(p.prosrc,E'\r\n',E'\n'),'sha256'),'hex')<>x.body_sha
   or pg_get_userbyid(p.proowner)<>'postgres'or p.prosecdef is distinct from x.definer or p.provolatile::text<>x.volatility or p.proconfig is distinct from x.configs
   or has_function_privilege('anon',p.oid,'execute')or has_function_privilege('authenticated',p.oid,'execute')or has_function_privilege('service_role',p.oid,'execute')
  then raise exception 'pool_results_dependency_changed: %',x.signature;end if;
 end loop;end$dependencies$;
-- END POOL RESULTS DEPENDENCIES
create function app.native_mixed_pool_results_enabled_v1()returns boolean
language sql immutable set search_path=''set timezone='UTC'as $$select false$$;

-- Historical leaf binding only. Current source and sealed membership are
-- established separately below; a stored ACK alone never means current awards.
create function app.native_mixed_pool_result_record_bound_v1(record_value uuid)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare v app.native_mixed_pool_records_v1%rowtype;o app.native_mixed_pool_operations_v1%rowtype;r app.operation_receipts%rowtype;
 prior app.native_mixed_pool_records_v1%rowtype;policy app.native_mixed_pool_records_v1%rowtype;el app.native_mixed_pool_records_v1%rowtype;
 q jsonb;d jsonb;a jsonb;part jsonb;expected jsonb;response jsonb;action text;key text;rh text;begin
 select*into v from app.native_mixed_pool_records_v1 where id=record_value;if v.id is null then return false;end if;
 select*into o from app.native_mixed_pool_operations_v1 where actor_id=v.actor_id and operation_id=v.operation_id;
 if o.record_id is distinct from v.id or o.tournament_id is distinct from v.tournament_id or o.event_id is distinct from v.event_id then return false;end if;
 q:=o.request_payload;d:=q->'data';action:=q->>'action';
 if app.native_mixed_pool_exact_v1(q,array['version','action','expectedJournalDigest','data','reason'])is distinct from true
  or q->>'version'is distinct from'native-mixed-pool-request-v1'or action is null or action not in('policy','elect','fund','seal','final')
  or coalesce(q->>'expectedJournalDigest','')!~'^[a-f0-9]{64}$'or jsonb_typeof(q->'reason')is distinct from'string'
  or length(q->>'reason')not between 1 and 500 or q->>'reason'<>btrim(q->>'reason')or q->>'reason'~'[[:cntrl:]]'
  or v.kind is distinct from(case action when'elect'then'election'when'fund'then'funding'else action end)then return false;end if;
 if v.version=1 then if v.prior_id is not null then return false;end if;
 else
  select*into prior from app.native_mixed_pool_records_v1 where id=v.prior_id;
  if prior.id is null or prior.tournament_id<>v.tournament_id or prior.event_id<>v.event_id or prior.entity_key<>v.entity_key or prior.kind<>v.kind or prior.version<>v.version-1 then return false;end if;
 end if;
 if action='policy'then
  if app.native_mixed_pool_exact_v1(d,array['kind','poolId','amountPolicy','disclosure','expectedFundingDigest'])is distinct from true
   or d->>'kind'not in('q','side')or app.native_mixed_simulation_uuid_v1(d->>'poolId')is distinct from true
   or coalesce(d->>'expectedFundingDigest','')!~'^[a-f0-9]{64}$'or jsonb_typeof(d->'disclosure')is distinct from'string'
   or length(btrim(d->>'disclosure'))not between 1 and 1000 then return false;end if;
  a:=d->'amountPolicy';
  if app.native_mixed_pool_exact_v1(a,array['version','kind','method','feeMinor','ratio','roundingUnitMinor'])is distinct from true
   or a->>'version'is distinct from'native-mixed-pool-policy-v1'or a->'kind'is distinct from d->'kind'
   or a->'feeMinor'is distinct from v.payload#>'{setupSource,feeMinor}'or a->'ratio'is distinct from v.payload#>'{setupSource,ratio}'
   or a->'method'is distinct from v.payload#>'{setupSource,method}'or a->'roundingUnitMinor'not in('100'::jsonb,'500'::jsonb,'1000'::jsonb)
   or d->'poolId'is distinct from v.payload#>'{setupSource,poolId}'or d->'kind'is distinct from v.payload#>'{setupSource,kind}'
   or app.native_mixed_simulation_uuid_v1(v.payload->>'fundingScopeId')is distinct from true then return false;end if;
  -- Preserve the original writer's admitted fee/method domain even for a
  -- genuinely empty policy (whose final branch does not call the calculator).
  if jsonb_typeof(a->'feeMinor')is distinct from'number'or jsonb_typeof(a->'roundingUnitMinor')is distinct from'number'
   or(a->>'kind'='side'and(a->>'feeMinor')::integer not in(1000,2000,5000,10000))
   or(a->>'kind'='q'and a->>'method'='q-v3-raw-selected-step-v1'and((a->>'feeMinor')::integer<500 or(a->>'feeMinor')::integer%500<>0))
   or(a->>'kind'='q'and a->>'method'='q-equal-exact-selected-step-v1'and(a->>'feeMinor')::integer%100<>0)then return false;end if;
  key:='policy:'||(d->>'kind')||':'||(d->>'poolId');
  expected:=jsonb_build_object('setupSource',v.payload->'setupSource','amountPolicy',a,'disclosure',d->'disclosure','fundingScopeId',v.payload->'fundingScopeId','fundingSourceDigest',d->'expectedFundingDigest','simulationOnly',true);
 elsif action='elect'then
  if app.native_mixed_pool_exact_v1(d,array['policyId','policyDigest','participantId','elected','acknowledged','consentReference'])is distinct from true
   or app.native_mixed_simulation_uuid_v1(d->>'policyId')is distinct from true or app.native_mixed_simulation_uuid_v1(d->>'participantId')is distinct from true
   or jsonb_typeof(d->'elected')is distinct from'boolean'or jsonb_typeof(d->'acknowledged')is distinct from'boolean'
   or(d->'elected'='true'::jsonb and d->'acknowledged'is distinct from'true'::jsonb)or jsonb_typeof(d->'consentReference')is distinct from'string'
   or length(btrim(d->>'consentReference'))not between 1 and 500 then return false;end if;
  select*into policy from app.native_mixed_pool_records_v1 where id=(d->>'policyId')::uuid and tournament_id=v.tournament_id and event_id=v.event_id and kind='policy';part:=v.payload->'participant';
  if policy.id is null or policy.source_digest is distinct from d->>'policyDigest'or part->'participantId'is distinct from d->'participantId'
   or not((part->>'mode'='digital'and part->>'profileId'=v.actor_id::text)or(part->>'mode'='paper'and part->'profileId'='null'::jsonb))then return false;end if;
  key:='election:'||policy.id::text||':'||(d->>'participantId');
  expected:=jsonb_build_object('policyId',policy.id,'policyDigest',policy.source_digest,'participant',part,'elected',d->'elected','acknowledged',d->'acknowledged','consentReference',d->'consentReference','simulationOnly',true);
 elsif action='fund'then
  if app.native_mixed_pool_exact_v1(d,array['electionId','electionDigest'])is distinct from true or app.native_mixed_simulation_uuid_v1(d->>'electionId')is distinct from true then return false;end if;
  select*into el from app.native_mixed_pool_records_v1 where id=(d->>'electionId')::uuid and tournament_id=v.tournament_id and event_id=v.event_id and kind='election';
  select*into policy from app.native_mixed_pool_records_v1 where id=(el.payload->>'policyId')::uuid and tournament_id=v.tournament_id and event_id=v.event_id and kind='policy';
  if el.id is null or policy.id is null or el.source_digest is distinct from d->>'electionDigest'or el.payload->'elected'is distinct from'true'::jsonb then return false;end if;
  key:='funding:'||policy.id::text||':'||(el.payload#>>'{participant,participantId}');
  expected:=jsonb_build_object('policyId',policy.id,'policyDigest',policy.source_digest,'electionId',el.id,'electionDigest',el.source_digest,'participantId',el.payload#>'{participant,participantId}','amountMinor',policy.payload#>'{amountPolicy,feeMinor}',
   'fundingScopeId',policy.payload->'fundingScopeId','fundingSourceDigest',policy.payload->'fundingSourceDigest','method','simulated','actualMoneyReceived',false,'moneyMoved',false);
 elsif action='seal'then
  if app.native_mixed_pool_exact_v1(d,array['expectedFundingDigest'])is distinct from true or d->'expectedFundingDigest'is distinct from v.payload->'fundingSourceDigest'
   or app.native_mixed_pool_exact_v1(v.payload,array['policies','fundingSourceDigest','simulationOnly'])is distinct from true or v.payload->'simulationOnly'is distinct from'true'::jsonb then return false;end if;
  key:='seal';expected:=v.payload;
 else
  if app.native_mixed_pool_exact_v1(d,array['sealId','sealDigest','startId'])is distinct from true or d->'sealId'is distinct from v.payload->'sealId'or d->'sealDigest'is distinct from v.payload->'sealDigest'or d->'startId'is distinct from v.payload->'startId'
   or app.native_mixed_pool_exact_v1(v.payload,array['sealId','sealDigest','startId','reviewSourceDigest','fundingSourceDigest','pools','status','ordinaryLiability','moneyMoved','refunds'])is distinct from true
   or v.payload->>'status'is distinct from'UNPAID_SIMULATED'or v.payload->'ordinaryLiability'is distinct from'false'::jsonb or v.payload->'moneyMoved'is distinct from'false'::jsonb or v.payload->'refunds'is distinct from'[]'::jsonb then return false;end if;
  key:='final';expected:=v.payload;
 end if;
 if key is distinct from v.entity_key or expected is distinct from v.payload or(action in('fund','seal','final')and(v.version<>1 or v.prior_id is not null))then return false;end if;
 rh:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-pool-finance-v1',v.actor_id,v.operation_id,v.tournament_id,v.event_id,q));
 if o.request_hash is distinct from rh or v.source_digest is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-pool-record-v1',v.id,v.tournament_id,v.event_id,v.entity_key,v.version,v.prior_id,v.kind,v.actor_id,v.operation_id,v.payload))then return false;end if;
 response:=jsonb_build_object('status','accepted','kind','native-mixed-pool-receipt-v1','action',action,'recordId',v.id,'recordDigest',v.source_digest,'operationId',v.operation_id,'tournamentId',v.tournament_id,'eventId',v.event_id,'simulationOnly',true,'current',true,'ordinaryLiability',false,'actualMoneyReceived',false,'moneyMoved',false,'payoutAuthorized',false,'refunds','[]'::jsonb);
 select*into r from app.operation_receipts where id=o.receipt_id;
 return r.id is not null and r.tournament_id=v.tournament_id and r.actor_profile_id=v.actor_id and r.client_operation_id=v.operation_id and r.target_id=v.id
  and r.operation_type='native_mixed_pool_simulation_v1'and r.request_hash=rh and r.outcome='accepted'and r.response_payload=response and o.response_payload=response
  and exists(select 1 from app.audit_events x where x.operation_receipt_id=r.id and x.tournament_id=v.tournament_id and x.actor_profile_id=v.actor_id and x.entity_type='native_mixed_pool_simulation'and x.entity_id=v.id and x.action=q->>'action'
   and x.after_state=jsonb_build_object('digest',v.source_digest,'simulationOnly',true,'moneyMoved',false));
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$$;

create function app.get_native_mixed_pool_results_v1(tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;sid uuid;funding jsonb;review jsonb;st app.native_mixed_simulation_starts_v1%rowtype;seal app.native_mixed_pool_records_v1%rowtype;final_row app.native_mixed_pool_records_v1%rowtype;
 v app.native_mixed_pool_records_v1%rowtype;o app.native_mixed_pool_operations_v1%rowtype;expected jsonb;prior_journal text;latest_prize jsonb;unit text;
 item jsonb;pool jsonb;ob jsonb;policy jsonb;pools jsonb:='[]';obligations jsonb;expected_obligations jsonb:='[]';part jsonb;response jsonb;begin
 if app.native_mixed_pool_results_enabled_v1()is distinct from true or app.native_mixed_pool_finance_enabled_v1()is distinct from true or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null or auth.jwt()->>'sub'is distinct from actor::text or tid is null or eid is null then return null;end if;sid:=(auth.jwt()->>'session_id')::uuid;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1,app.tournament_roles in share mode nowait;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;
 if not found or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','blocked','code','source_busy');end if;
 lock table app.native_mixed_pool_records_v1,app.native_mixed_pool_operations_v1,app.native_mixed_pool_obligations_v1,app.operation_receipts,app.audit_events,
  app.native_mixed_simulation_starts_v1,app.tournament_setup_q_pool_versions,app.tournament_setup_side_pool_versions,app.tournament_setup_side_pool_materializations,app.event_side_pool_definition_versions in share mode nowait;
 select*into final_row from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='final';
 if final_row.id is null then return jsonb_build_object('status','blocked','code','pool_final_unavailable');end if;
 if(select count(*)from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='final')<>1 or(select count(*)from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='seal')<>1 then return null;end if;
 select*into seal from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind='seal';
 select*into st from app.native_mixed_simulation_starts_v1 where tournament_id=tid and event_id=eid;
 if st.id is null or(select count(*)from app.native_mixed_simulation_starts_v1 where tournament_id=tid and event_id=eid)<>1
  or st.id::text is distinct from final_row.payload->>'startId'or st.started_at<seal.created_at or final_row.created_at<st.started_at then return null;end if;
 funding:=app.native_mixed_funding_seal_source_v1(tid,eid);if funding->>'status'is distinct from'source_available'then return null;end if;
 for v in select*from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid loop
  if app.native_mixed_pool_result_record_bound_v1(v.id)is distinct from true then return null;end if;
  if v.kind in('policy','funding')and(v.payload->>'fundingSourceDigest'is distinct from funding->>'sourceDigest'or v.payload->'fundingScopeId'is distinct from funding#>'{scope,scopeId}')then return null;end if;
  if v.kind='policy'then
   if app.native_mixed_pool_setup_v1(tid,eid,v.payload#>>'{amountPolicy,kind}',(v.payload#>>'{setupSource,poolId}')::uuid,funding)is distinct from v.payload->'setupSource'then return null;end if;
   select s.source_capture#>'{baseSource,latestPrize}'into latest_prize from app.native_mixed_funding_scopes_v1 s where s.id=(funding#>>'{scope,scopeId}')::uuid and s.tournament_id=tid and s.event_id=eid;
   if latest_prize is not null then
    unit:=latest_prize#>>array['plan','draft','rounding',case when v.payload#>>'{amountPolicy,kind}'='q'then'qPool'else'sidePool'end];
    if latest_prize->>'kind'is distinct from'native-mixed-latest-prize-pin-v1'or unit is null or unit not in('1','5','10')or v.payload#>'{amountPolicy,roundingUnitMinor}'is distinct from to_jsonb(unit::integer*100)then return null;end if;
   end if;
  elsif v.kind='election'then
   select x into part from jsonb_array_elements(funding->'entries')x where x->>'participantId'=v.payload#>>'{participant,participantId}';
   if part is null or part-'obligation'-'receipt'is distinct from v.payload->'participant'then return null;end if;
  end if;
 end loop;
 -- Seal/final are the two terminal event-wide CAS points. There is no global
 -- journal sequence, so arbitrary historical order is not inferred from time.
 select app.native_mixed_simulation_hash_v1(coalesce(jsonb_agg(jsonb_build_array(entity_key,version,source_digest)order by entity_key,version),'[]'))into prior_journal from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and kind not in('seal','final');
 select*into o from app.native_mixed_pool_operations_v1 where actor_id=seal.actor_id and operation_id=seal.operation_id;
 if o.request_payload->>'expectedJournalDigest'is distinct from prior_journal then return null;end if;
 expected:=app.native_mixed_pool_expected_seal_results_v1(tid,eid,o.request_payload->'data',funding);
 if expected is null or expected is distinct from seal.payload then return null;end if;
 select app.native_mixed_simulation_hash_v1(coalesce(jsonb_agg(jsonb_build_array(entity_key,version,source_digest)order by entity_key,version),'[]'))into prior_journal from app.native_mixed_pool_records_v1 where tournament_id=tid and event_id=eid and id<>final_row.id;
 select*into o from app.native_mixed_pool_operations_v1 where actor_id=final_row.actor_id and operation_id=final_row.operation_id;
 if o.request_payload->>'expectedJournalDigest'is distinct from prior_journal then return null;end if;
 review:=app.native_mixed_qualification_review_v1(tid,eid,st.id);
 if review->>'kind'is distinct from'native-mixed-qualification-finance-review-v1'or review->>'status'is distinct from'review_available'or review->'entrantCount'is distinct from'18'::jsonb or review->'qualifyingCount'is distinct from'5'::jsonb
  or review->>'startId'is distinct from st.id::text or review->>'startSourceDigest'is distinct from st.source_digest or review->>'tournamentId'is distinct from tid::text or review->>'eventId'is distinct from eid::text then return null;end if;
 expected:=app.native_mixed_pool_expected_final_results_v1(tid,eid,o.request_payload->'data',funding,review);
 if expected is null or expected is distinct from final_row.payload then return null;end if;
 for item in select value from jsonb_array_elements(final_row.payload->'pools')loop
  select value->'policy'into policy from jsonb_array_elements(seal.payload->'policies')where value#>'{policy,id}'=item->'policyId';if policy is null then return null;end if;
  obligations:='[]';
  for ob in select value from jsonb_array_elements(item->'obligations')loop
   obligations:=obligations||jsonb_build_array(jsonb_build_object('participantId',ob->'participantId','amountMinor',ob->'amountMinor'));
   expected_obligations:=expected_obligations||jsonb_build_array(jsonb_build_object('policyId',policy->'id','participantId',ob->'participantId','amountMinor',ob->'amountMinor','roundingUnitMinor',policy#>'{payload,amountPolicy,roundingUnitMinor}'));
  end loop;
  pools:=pools||jsonb_build_array(jsonb_build_object('policyId',policy->'id','policyDigest',policy->'source_digest','poolId',policy#>'{payload,setupSource,poolId}',
   'kind',policy#>'{payload,amountPolicy,kind}','method',policy#>'{payload,amountPolicy,method}','feeMinor',policy#>'{payload,amountPolicy,feeMinor}','ratio',policy#>'{payload,amountPolicy,ratio}',
   'roundingUnitMinor',policy#>'{payload,amountPolicy,roundingUnitMinor}','paidCount',(select jsonb_array_length(x->'contributions')from jsonb_array_elements(seal.payload->'policies')x where x#>'{policy,id}'=policy->'id'),
   'fundMinor',item->'fundMinor','status',case when item->>'status'='empty_no_obligations'then'empty_no_obligations'else'UNPAID_SIMULATED'end,'obligations',obligations));
 end loop;
 if(select count(*)from app.native_mixed_pool_obligations_v1 where tournament_id=tid and event_id=eid)<>jsonb_array_length(expected_obligations)
  or exists(select 1 from app.native_mixed_pool_obligations_v1 x where x.tournament_id=tid and x.event_id=eid and(x.final_record_id<>final_row.id or x.status<>'UNPAID_SIMULATED'or x.actual_money_received or x.ordinary_liability or x.money_moved
   or not exists(select 1 from jsonb_array_elements(expected_obligations)e where x.policy_record_id::text=e->>'policyId'and x.participant_id::text=e->>'participantId'and x.amount_minor=(e->>'amountMinor')::bigint and x.rounding_unit_minor=(e->>'roundingUnitMinor')::integer)))then return null;end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor or auth.jwt()->>'sub'is distinct from actor::text or auth.jwt()->>'session_id'is distinct from sid::text or app.native_mixed_pilot_permitted_v1(actor,tid,eid,false)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 response:=jsonb_build_object('kind','native-mixed-pool-final-results-v1','status','source_available','actorId',actor,'sessionId',sid,'tournamentId',tid,'eventId',eid,
  'startId',st.id,'startSourceDigest',st.source_digest,'reviewSourceDigest',review->'sourceDigest','fundingSourceDigest',funding->'sourceDigest','journalDigest',app.native_mixed_pool_journal_digest_v1(tid,eid),
  'finalRecordId',final_row.id,'finalRecordDigest',final_row.source_digest,'sealId',seal.id,'sealDigest',seal.source_digest,'pools',pools,
  'currentSourceVerified',true,'writeAuthorized',false,'simulationOnly',true,'actualMoneyReceived',false,'ordinaryLiability',false,'moneyMoved',false,'payoutAuthorized',false,'mrpAwarded',false,'refunds','[]'::jsonb);return response;
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');
 when invalid_text_representation or numeric_value_out_of_range then return null;end$$;

create function public.get_native_mixed_pool_results_v1(p_tournament_id uuid,p_event_id uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$begin
 if auth.role()is distinct from'authenticated'then return null;end if;
 return app.get_native_mixed_pool_results_v1(p_tournament_id,p_event_id);end$$;

-- BEGIN DERIVED FUNCTIONS: build-native-mixed-pool-results-read-v1.mjs
create function app.native_mixed_pool_expected_seal_results_v1(tid uuid,eid uuid,data jsonb,funding jsonb)returns jsonb
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare policy app.native_mixed_pool_records_v1%rowtype;setup_source jsonb;elections jsonb;contributions jsonb;entry jsonb;policy_rows jsonb:='[]';key text;record_payload jsonb;begin
  if not app.native_mixed_pool_exact_v1(data,array['expectedFundingDigest'])or data->>'expectedFundingDigest'is distinct from funding->>'sourceDigest'
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

 return record_payload;
exception when sqlstate'P0001'then if sqlerrm like'native_pool_%'then return null;else raise;end if;
 when invalid_text_representation or numeric_value_out_of_range then return null;end$$;

create function app.native_mixed_pool_expected_final_results_v1(tid uuid,eid uuid,data jsonb,funding jsonb,verified_review jsonb)returns jsonb
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare seal app.native_mixed_pool_records_v1%rowtype;review jsonb;cards jsonb;item jsonb;amount_policy jsonb;requested_kind text;setup_source jsonb;paid integer;unit integer;fund bigint;ranked jsonb;recipients integer;calc jsonb;awards jsonb;i integer;results jsonb:='[]';key text;record_payload jsonb;begin
  if not app.native_mixed_pool_exact_v1(data,array['sealId','sealDigest','startId'])then raise exception using errcode='P0001',message='native_pool_invalid_request';end if;
  select*into seal from app.native_mixed_pool_records_v1 where id=(data->>'sealId')::uuid and tournament_id=tid and event_id=eid and kind='seal';
  if seal.id is null or seal.source_digest<>data->>'sealDigest'or seal.payload->>'fundingSourceDigest'<>funding->>'sourceDigest'
   or not exists(select 1 from app.native_mixed_simulation_starts_v1 where id=(data->>'startId')::uuid and tournament_id=tid and event_id=eid and started_at>=seal.created_at)
  then raise exception using errcode='P0001',message='native_pool_current_seal_and_start_required';end if;
  review:=verified_review;
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
 return record_payload;
exception when sqlstate'P0001'then if sqlerrm like'native_pool_%'then return null;else raise;end if;
 when invalid_text_representation or numeric_value_out_of_range then return null;end$$;
alter function app.native_mixed_pool_results_enabled_v1()owner to postgres;
revoke all on function app.native_mixed_pool_results_enabled_v1()from public,anon,authenticated,service_role;
alter function app.native_mixed_pool_result_record_bound_v1(uuid)owner to postgres;
revoke all on function app.native_mixed_pool_result_record_bound_v1(uuid)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_pool_results_v1(uuid,uuid)owner to postgres;
revoke all on function app.get_native_mixed_pool_results_v1(uuid,uuid)from public,anon,authenticated,service_role;
alter function public.get_native_mixed_pool_results_v1(uuid,uuid)owner to postgres;
revoke all on function public.get_native_mixed_pool_results_v1(uuid,uuid)from public,anon,authenticated,service_role;
alter function app.native_mixed_pool_expected_seal_results_v1(uuid,uuid,jsonb,jsonb)owner to postgres;
revoke all on function app.native_mixed_pool_expected_seal_results_v1(uuid,uuid,jsonb,jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_pool_expected_final_results_v1(uuid,uuid,jsonb,jsonb,jsonb)owner to postgres;
revoke all on function app.native_mixed_pool_expected_final_results_v1(uuid,uuid,jsonb,jsonb,jsonb)from public,anon,authenticated,service_role;
commit;
