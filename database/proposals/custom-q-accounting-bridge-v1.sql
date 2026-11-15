-- UNEXECUTED LOCAL CUSTOM-Q ACCOUNTING BRIDGE CANDIDATE.
-- Q only. Satellite and Side remain unsupported here. This file publishes an
-- immutable custom Q policy, binds it to the versioned setup intent, and lets
-- the existing reviewed Q-obligation and V6 unpaid-accounting writers consume
-- the current source. It does not record a payment or move money.
--
-- Required order: migrations through 0259, then
-- custom-graduated-amounts-v3.sql, custom-payout-intent-journal-v2.sql and
-- custom-payout-q-setup-save-v2.sql.
begin;

alter table app.q_operating_policies_v2 drop constraint q_operating_method_v4_check;
alter table app.q_operating_policies_v2 drop constraint q_operating_configuration_v4_check;
alter table app.q_operating_policies_v2 add constraint q_operating_method_v5_check check(method in(
 'equal-paid-playoff-qualifiers-v2','graduated-paid-card-rank-v2',
 'acc-weighted-largest-remainder-5usd-v1','graduated-acc-weighted-largest-remainder-5usd-v2',
 'q-custom-graduated-policy-v5'));
alter table app.q_operating_policies_v2 add constraint q_operating_configuration_v5_check check(
 (method='equal-paid-playoff-qualifiers-v2'and ratio is null and schedule_id is null)or
 (method='graduated-paid-card-rank-v2'and ratio is not null and schedule_id is not null and
  ((ratio=6 and schedule_id in('friend-q-p2-10-6-v1','friend-q-p3-20-6-v1','friend-q-p4-50-6-v1'))or
   (ratio=4 and schedule_id in('friend-q-p5-10-4-v1','friend-q-p6-20-4-v1','friend-q-p7-50-4-v1'))))or
 (method='acc-weighted-largest-remainder-5usd-v1'and ratio is not null and ratio in(4,6)and schedule_id is not null and schedule_id='acc-weighted-largest-remainder-5usd-v1')or
 (method='graduated-acc-weighted-largest-remainder-5usd-v2'and ratio is not null and ratio in(4,6)and schedule_id is not null and schedule_id='graduated-acc-weighted-largest-remainder-5usd-v2')or
 (method='q-custom-graduated-policy-v5'and ratio is not null and ratio between 1 and 2147483647 and schedule_id is not null and schedule_id='graduated-custom-ratio-largest-remainder-5usd-v3'));

-- This is the auditable setup-policy binding. The caller's request is never
-- treated as authority: the exact original intent must already exist in the
-- immutable setup journal for this current pool/event/slot.
create function app.custom_q_policy_bindings_v5(p_tournament_id uuid,p_event_id uuid)
returns jsonb language sql stable security definer set search_path=''as $$
select coalesce(jsonb_agg(jsonb_build_object(
 'kind','custom-q-policy-binding-v5','policyId',p.id,'operationReceiptId',p.operation_receipt_id,
 'poolVersionId',p.pool_version_id,'method',p.method,'ratio',p.ratio,'amountMethod',p.schedule_id,
 'disclosureReference',p.disclosure_reference,'policyActorId',p.actor_id,
 'policyOperationId',o.client_operation_id,'policyRequestHash',o.request_hash,
 'setupBatchId',i.batch_id,'setupActorId',b.actor_id,'setupOperationId',b.operation_id,'setupRequestHash',b.request_hash,
 'setupRevisionId',q.setup_revision_id,'setupEventVersionId',q.setup_event_version_id,
 'eventClientRowId',e.client_row_id,'poolSlot',q.slot,'originalIntent',i.original_intent,
 'baseSetupRevisionId',b.base_setup_revision_id,'baseSetupVersion',b.base_setup_version,
 'baseSourceDigest',b.base_source_digest)order by p.pool_version_id),'[]'::jsonb)
from app.q_operating_policies_v2 p
join app.operation_receipts o on o.id=p.operation_receipt_id and o.tournament_id=p.tournament_id
 and o.operation_type='q_operating_v5'and o.outcome='accepted'
join app.tournament_setup_q_pool_versions q on q.id=p.pool_version_id and q.tournament_id=p.tournament_id
join app.tournament_setup_event_versions e on e.id=q.setup_event_version_id and e.tournament_id=q.tournament_id and e.setup_revision_id=q.setup_revision_id
join app.setup_custom_payout_intents_v2 i on i.tournament_id=q.tournament_id and i.setup_revision_id=q.setup_revision_id
 and i.setup_event_version_id=q.setup_event_version_id and i.scope='q'and i.pool_slot=q.slot
 and i.ratio_denominator=p.ratio and i.amount_method=p.schedule_id
join app.setup_custom_payout_batches_v2 b on b.id=i.batch_id and b.tournament_id=i.tournament_id and b.setup_revision_id=i.setup_revision_id
where p.tournament_id=p_tournament_id and p.event_id=p_event_id and p.method='q-custom-graduated-policy-v5';
$$;
revoke all on function app.custom_q_policy_bindings_v5(uuid,uuid)from public,anon,authenticated,service_role;

create function app.save_q_custom_policy_v5_impl(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=''as $$
declare c jsonb;locked_c jsonb;w jsonb;pool jsonb;intent jsonb;source_value jsonb;prior app.operation_receipts%rowtype;
 h text;response jsonb;code text;pid uuid;rid uuid:=extensions.gen_random_uuid();oid uuid:=extensions.gen_random_uuid();
 fee integer;setupcode text;ratio_value integer;setup_event uuid;setup_revision uuid;slot_value smallint;event_client_row uuid;
 context_changed boolean:=false;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'or p_actor_id is null or p_tournament_id is null or p_operation_id is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 c:=app.q_pool_context_v1(p_tournament_id);if c is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('qualification-finalization:'||(c->>'eventId'),0));
 perform 1 from app.tournaments where id=p_tournament_id and status in('draft','open','pending_finalization')for no key update;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director'for update;if not found then return null;end if;
 locked_c:=app.q_pool_context_v1(p_tournament_id);
 context_changed:=locked_c is null or locked_c->>'eventId'is distinct from c->>'eventId'
  or locked_c->>'setupEventVersionId'is distinct from c->>'setupEventVersionId';
 c:=locked_c;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('q_operating_v5',p_actor_id,p_tournament_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if prior.tournament_id=p_tournament_id and prior.operation_type='q_operating_v5'and prior.request_hash=h then return prior.response_payload;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 begin
  if context_changed then raise exception'source_changed';end if;
  if jsonb_typeof(p_request)is distinct from'object'or(select count(*)from jsonb_object_keys(p_request))<>8
   or not(p_request?&array['action','poolVersionId','method','ratio','amountMethod','disclosureReference','disclosed','intent'])
   or p_request->>'action'is distinct from'publish'or p_request->>'method'is distinct from'q-custom-graduated-policy-v5'
   or p_request->>'amountMethod'is distinct from'graduated-custom-ratio-largest-remainder-5usd-v3'or p_request->'disclosed'is distinct from'true'::jsonb
   or jsonb_typeof(p_request->'poolVersionId')is distinct from'string'or(p_request->>'poolVersionId')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or jsonb_typeof(p_request->'ratio')is distinct from'number'or coalesce(p_request->>'ratio','')!~'^[1-9][0-9]*$'or(p_request->>'ratio')::numeric>2147483647
   or jsonb_typeof(p_request->'disclosureReference')is distinct from'string'or length(trim(p_request->>'disclosureReference'))not between 1 and 500
   or p_request->>'disclosureReference'<>trim(p_request->>'disclosureReference')or p_request->>'disclosureReference'~'[[:cntrl:]]'
   or jsonb_typeof(p_request->'intent')is distinct from'object'then raise exception'invalid_request';end if;
  intent:=p_request->'intent';source_value:=intent->'source';ratio_value:=(p_request->>'ratio')::integer;pid:=(p_request->>'poolVersionId')::uuid;
  if(select count(*)from jsonb_object_keys(intent))<>4 or not(intent?&array['kind','scope','ratioDenominator','source'])
   or intent->>'kind'is distinct from'custom-payout-intent-v1'or intent->>'scope'is distinct from'q'
   or intent->'ratioDenominator'is distinct from p_request->'ratio'or jsonb_typeof(source_value)is distinct from'object'
   or(select count(*)from jsonb_object_keys(source_value))<>6
   or not(source_value?&array['tournamentId','eventClientRowId','setupRevisionId','setupVersion','poolSlot','sourceDigest'])
   or source_value->>'tournamentId'is distinct from p_tournament_id::text
   or coalesce(source_value->>'eventClientRowId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or jsonb_typeof(source_value->'setupVersion')is distinct from'number'or coalesce(source_value->>'setupVersion','')!~'^(0|[1-9][0-9]*)$'
   or(source_value->>'setupVersion')::numeric>2147483647
   or((source_value->>'setupVersion')='0'and source_value->'setupRevisionId'is distinct from'null'::jsonb)
   or((source_value->>'setupVersion')<>'0'and coalesce(source_value->>'setupRevisionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
   or jsonb_typeof(source_value->'poolSlot')is distinct from'number'or coalesce(source_value->>'poolSlot','')!~'^[12]$'
   or coalesce(source_value->>'sourceDigest','')!~'^[a-f0-9]{64}$'then raise exception'invalid_request';end if;
  w:=public.get_q_operating_workspace_v2(p_actor_id,p_tournament_id);
  select value into pool from jsonb_array_elements(w->'membership'->'pools')where value->>'poolVersionId'=pid::text;
  if pool is null then raise exception'pool_version_mismatch';end if;
  if exists(select 1 from app.q_pool_policies_v1 where pool_version_id=pid)or exists(select 1 from app.q_operating_policies_v2 where pool_version_id=pid)then raise exception'policy_frozen';end if;
  if c->>'started'='true'then raise exception'entries_locked';end if;
  if w->>'canPublish'is distinct from'true'then raise exception'collection_or_consent_already_started';end if;
  select q.pool_type_code,q.entry_fee_cents,q.setup_event_version_id,q.setup_revision_id,q.slot,e.client_row_id
   into setupcode,fee,setup_event,setup_revision,slot_value,event_client_row
  from app.tournament_setup_q_pool_versions q join app.tournament_setup_event_versions e
   on e.id=q.setup_event_version_id and e.tournament_id=q.tournament_id and e.setup_revision_id=q.setup_revision_id
  where q.id=pid and q.tournament_id=p_tournament_id and e.event_kind in('main','consolation');
  if setup_event is null then raise exception'pool_version_mismatch';end if;
  if setup_event::text is distinct from c->>'setupEventVersionId'then raise exception'source_changed';end if;
  if setupcode is distinct from'Graduated (1-in-'||ratio_value::text||')'then raise exception'setup_method_conflict';end if;
  if fee not between 500 and 100000000 or mod(fee,500)<>0 then raise exception'unsupported_payout_domain';end if;
  if source_value->>'eventClientRowId'is distinct from event_client_row::text or(source_value->>'poolSlot')::smallint is distinct from slot_value then raise exception'custom_intent_required';end if;
  if not exists(select 1 from app.setup_custom_payout_intents_v2 i join app.setup_custom_payout_batches_v2 b
    on b.id=i.batch_id and b.tournament_id=i.tournament_id and b.setup_revision_id=i.setup_revision_id
   where i.tournament_id=p_tournament_id and i.setup_revision_id=setup_revision and i.setup_event_version_id=setup_event
    and i.scope='q'and i.pool_slot=slot_value and i.ratio_denominator=ratio_value
    and i.amount_method='graduated-custom-ratio-largest-remainder-5usd-v3'and i.original_intent=p_request->'intent')then raise exception'custom_intent_required';end if;
  response:=jsonb_build_object('status','q_policy_published','policyId',rid,'poolVersionId',pid);
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm in('invalid_request','source_changed','pool_version_mismatch','policy_frozen','entries_locked','collection_or_consent_already_started','setup_method_conflict','unsupported_payout_domain','custom_intent_required')then sqlerrm else'invalid_request'end;
  response:=jsonb_build_object('status','rejected','code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(oid,p_tournament_id,p_actor_id,'q_operating_v5',coalesce(pid,p_tournament_id),h,p_operation_id,case when code is null then'accepted'else'rejected'end,response,clock_timestamp());
 if code is null then
  insert into app.q_operating_policies_v2(id,tournament_id,event_id,pool_version_id,method,ratio,schedule_id,disclosure_reference,actor_id,operation_receipt_id,published_at)
  values(rid,p_tournament_id,(c->>'eventId')::uuid,pid,'q-custom-graduated-policy-v5',ratio_value,'graduated-custom-ratio-largest-remainder-5usd-v3',p_request->>'disclosureReference',p_actor_id,oid,clock_timestamp());
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(p_tournament_id,p_actor_id,oid,'q_operating_v5',case when code is null then rid else p_tournament_id end,case when code is null then'q_custom_policy_frozen_v5'else'q_custom_policy_rejected_v5'end,response);
 return response;
end$$;

create function app.get_q_custom_policy_reconciliation_v5_impl(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid,p_request jsonb)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare r app.operation_receipts%rowtype;h text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director')then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('q_operating_v5',p_actor_id,p_tournament_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into r from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if not found then return jsonb_build_object('authorized',true,'result',null);end if;
 if r.tournament_id=p_tournament_id and r.operation_type='q_operating_v5'and r.request_hash=h then return jsonb_build_object('authorized',true,'result',r.response_payload);end if;
 return jsonb_build_object('authorized',true,'result',jsonb_build_object('status','rejected','code','idempotency_conflict'));
end$$;

revoke all on function app.save_q_custom_policy_v5_impl(uuid,uuid,jsonb,uuid),app.get_q_custom_policy_reconciliation_v5_impl(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
create function public.save_q_custom_policy_v5(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid)
returns jsonb language sql security definer set search_path=''as $$select app.save_q_custom_policy_v5_impl(p_actor_id,p_tournament_id,p_request,p_operation_id);$$;
create function public.get_q_custom_policy_reconciliation_v5(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid,p_request jsonb)
returns jsonb language sql stable security definer set search_path=''as $$select app.get_q_custom_policy_reconciliation_v5_impl(p_actor_id,p_tournament_id,p_operation_id,p_request);$$;
revoke all on function public.save_q_custom_policy_v5(uuid,uuid,jsonb,uuid),public.get_q_custom_policy_reconciliation_v5(uuid,uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.save_q_custom_policy_v5(uuid,uuid,jsonb,uuid),public.get_q_custom_policy_reconciliation_v5(uuid,uuid,uuid,jsonb)to service_role;

-- Clone the current V4 calculator and make only the custom method branch call
-- the V3 amount engine. All paid-only, election, allocation, backfill and cash
-- tie guards remain the reviewed V4 implementation.
do $$declare d text;p text;old text;replacement text;begin
 d:=pg_get_functiondef('app.calculate_q_obligations_with_graduated_v4(jsonb)'::regprocedure);
 p:=replace(d,'FUNCTION app.calculate_q_obligations_with_graduated_v4(','FUNCTION app.calculate_q_obligations_with_custom_v5(');
 if p=d then raise exception'Q custom calculator name anchor changed';end if;d:=replace(p,E'\r\n',E'\n');
 old:=$a$elsif pol->>'method'in('acc-weighted-largest-remainder-5usd-v1','graduated-acc-weighted-largest-remainder-5usd-v2')then$a$;
 replacement:=$a$elsif pol->>'method'in('acc-weighted-largest-remainder-5usd-v1','graduated-acc-weighted-largest-remainder-5usd-v2','q-custom-graduated-policy-v5')then$a$;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'Q custom method anchor changed';end if;d:=replace(d,old,replacement);
 old:=$a$if pol->>'scheduleId'is distinct from(pol->>'method')then$a$;
 replacement:=$a$if pol->>'scheduleId'is distinct from(case when pol->>'method'='q-custom-graduated-policy-v5'then'graduated-custom-ratio-largest-remainder-5usd-v3'else pol->>'method'end)then$a$;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'Q custom schedule anchor changed';end if;d:=replace(d,old,replacement);
 old:=$a$if pol->>'method'='graduated-acc-weighted-largest-remainder-5usd-v2'then$a$;
 replacement:=$a$if pol->>'method'='q-custom-graduated-policy-v5'then
    computed:=app.calculate_custom_graduated_amounts_v3(jsonb_build_object('paidCount',n,'feeMinor',fee,'ratio',ratio));
   elsif pol->>'method'='graduated-acc-weighted-largest-remainder-5usd-v2'then$a$;
 if(length(d)-length(replace(d,old,'')))/length(old)<>1 then raise exception'Q custom amount anchor changed';end if;execute replace(d,old,replacement);
end$$;
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.calculate_q_obligations_v2(jsonb)'::regprocedure);
 p:=replace(d,'FUNCTION app.calculate_q_obligations_v2(','FUNCTION app.calculate_q_obligations_pre_custom_v5(');
 if p=d then raise exception'Q custom legacy dispatcher anchor changed';end if;execute p;
end$$;
create or replace function app.calculate_q_obligations_v2(w jsonb)returns jsonb language plpgsql immutable set search_path=''as $$begin
 if jsonb_typeof(w->'policies')='array'and exists(select 1 from jsonb_array_elements(w->'policies')p where p->>'method'='q-custom-graduated-policy-v5')then return app.calculate_q_obligations_with_custom_v5(w);end if;
 return app.calculate_q_obligations_pre_custom_v5(w);
end$$;
revoke all on function app.calculate_q_obligations_with_custom_v5(jsonb),app.calculate_q_obligations_pre_custom_v5(jsonb),app.calculate_q_obligations_v2(jsonb)from public,anon,authenticated,service_role;

-- Preserve the exact legacy workspace output when no custom method exists.
-- For V5 only, the digest additionally commits the immutable setup intent.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('public.get_q_operating_workspace_v2(uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION public.get_q_operating_workspace_v2(','FUNCTION app.get_q_operating_workspace_pre_custom_v5(');
 if p=d then raise exception'Q custom workspace clone anchor changed';end if;execute p;
end$$;
create or replace function public.get_q_operating_workspace_v2(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare base jsonb;bindings jsonb;event_id uuid;custom_count integer;begin
 base:=app.get_q_operating_workspace_pre_custom_v5(p_actor_id,p_tournament_id);if base is null then return null;end if;
 select count(*)into custom_count from jsonb_array_elements(base->'policies')p where p->>'method'='q-custom-graduated-policy-v5';
 if custom_count=0 then return base;end if;
 event_id:=(base->'membership'->>'eventId')::uuid;bindings:=app.custom_q_policy_bindings_v5(p_tournament_id,event_id);
 if jsonb_array_length(bindings)<>custom_count then base:=jsonb_set(base,'{blockers}',coalesce(base->'blockers','[]'::jsonb)||'"custom_policy_binding_unavailable"'::jsonb);end if;
 return jsonb_set(base,'{sourceDigest}',to_jsonb(encode(extensions.digest(convert_to(jsonb_build_object('kind','q-custom-workspace-source-v5','baseSourceDigest',base->>'sourceDigest','customPolicyBindings',bindings)::text,'utf8'),'sha256'),'hex')));
end$$;
revoke all on function app.get_q_operating_workspace_pre_custom_v5(uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.get_q_operating_workspace_v2(uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_q_operating_workspace_v2(uuid,uuid)to service_role;

-- The immutable Q review stores this full source manifest. Custom policy and
-- intent evidence therefore remain auditable instead of being represented by
-- a caller-supplied digest alone. A current source containing any pool refund
-- is blocked as a whole; the legacy no-custom branch remains byte-equivalent.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.q_obligation_sources_v2(uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION app.q_obligation_sources_v2(','FUNCTION app.q_obligation_sources_pre_custom_v5(');
 if p=d then raise exception'Q custom source clone anchor changed';end if;execute p;
end$$;
create function app.project_q_custom_source_v5(base jsonb,bindings jsonb,custom_count integer)
returns jsonb language plpgsql immutable set search_path=''as $$
declare manifest jsonb;blocks jsonb;begin
 if jsonb_typeof(base)is distinct from'object'or jsonb_typeof(bindings)is distinct from'array'or custom_count is null or custom_count<1 then return null;end if;
 blocks:=coalesce(base->'blockers','[]'::jsonb);
 if jsonb_typeof(blocks)is distinct from'array'then blocks:='["source_blocked"]'::jsonb;end if;
 if jsonb_array_length(bindings)<>custom_count then blocks:=blocks||'"custom_policy_binding_unavailable"'::jsonb;end if;
 if jsonb_typeof(base->'obligations')='array'then
  if exists(select 1 from jsonb_array_elements(base->'obligations')item where item->>'kind'='refund')then blocks:=blocks||jsonb_build_array('q_no_eligible_recipients');end if;
  if exists(select 1 from jsonb_array_elements(base->'obligations')item where item->>'kind'is null or item->>'kind'not in('award','refund'))then blocks:=blocks||jsonb_build_array('source_blocked');end if;
 elsif jsonb_array_length(blocks)=0 then blocks:=blocks||jsonb_build_array('source_blocked');end if;
 manifest:=(base->'manifest')||jsonb_build_object('calculatorVersion','q-unpaid-dispatch-v5','customAlgorithmVersion','graduated-custom-ratio-largest-remainder-5usd-v3','refundPolicy','no-pool-refunds-v1','customPolicyBindings',bindings);
 return jsonb_build_object('eventId',base->'eventId','sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),
  'manifest',manifest,'obligations',case when jsonb_array_length(blocks)=0 then base->'obligations'else'null'::jsonb end,'blockers',blocks);
end$$;
create or replace function app.q_obligation_sources_v2(actor uuid,tid uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare base jsonb;workspace jsonb;bindings jsonb;event_id uuid;custom_count integer;begin
 base:=app.q_obligation_sources_pre_custom_v5(actor,tid);if base is null then return null;end if;
 workspace:=base#>'{manifest,operatingWorkspace}';
 select count(*)into custom_count from jsonb_array_elements(workspace->'policies')p where p->>'method'='q-custom-graduated-policy-v5';
 if custom_count=0 then return base;end if;
 event_id:=(base->>'eventId')::uuid;bindings:=app.custom_q_policy_bindings_v5(tid,event_id);
 return app.project_q_custom_source_v5(base,bindings,custom_count);
end$$;
revoke all on function app.q_obligation_sources_pre_custom_v5(uuid,uuid),app.project_q_custom_source_v5(jsonb,jsonb,integer),app.q_obligation_sources_v2(uuid,uuid)from public,anon,authenticated,service_role;

commit;
