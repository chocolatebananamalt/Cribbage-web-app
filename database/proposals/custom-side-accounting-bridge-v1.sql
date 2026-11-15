-- UNEXECUTED LOCAL CUSTOM-SIDE OPERATING/ACCOUNTING BRIDGE CANDIDATE.
-- Side only. Satellite and combined Q/Side final accounting remain unsupported.
-- This publishes a distinct immutable custom Side amount policy, binds it to
-- the exact versioned setup intent and lets the existing V3 paid-card unpaid
-- recipient review consume the resulting amount source. No payment is made.
--
-- The V3 amount kernel is the persisted intent contract. It is materially
-- different from the restricted workbook Side comparison; this proposal does
-- not adopt the workbook distribution or claim equivalence to it.
-- Required order: migrations through 0264, then custom-graduated-amounts-v3.sql,
-- custom-payout-intent-journal-v2.sql and custom-pool-setup-save-v3.sql.
begin;

-- Preserve the historical V2 method and its 2..100 domain. Only the new,
-- explicitly named method admits the technical PostgreSQL positive-int range.
alter table app.side_pool_graduated_policies_v2 drop constraint side_pool_graduated_policies_v2_method_check;
alter table app.side_pool_graduated_policies_v2 drop constraint side_pool_graduated_policies_v2_ratio_check;
alter table app.side_pool_graduated_policies_v2 add constraint side_pool_graduated_method_v4_check check(method in(
 'graduated-acc-weighted-largest-remainder-5usd-v2','side-custom-graduated-policy-v4'));
alter table app.side_pool_graduated_policies_v2 add constraint side_pool_graduated_ratio_v4_check check(
 (method='graduated-acc-weighted-largest-remainder-5usd-v2'and ratio between 2 and 100)or
 (method='side-custom-graduated-policy-v4'and ratio between 1 and 2147483647));

-- Strengthen the trigger installed by custom-pool-setup-save-v3. A matching
-- number alone must never let the legacy V2 writer reinterpret a custom row.
create or replace function app.guard_custom_side_policy_v3()returns trigger
language plpgsql security definer set search_path=''as $$
declare ratio integer;begin
 select s.custom_ratio_denominator_v3 into ratio from app.tournament_setup_side_pool_materializations m
 join app.tournament_setup_side_pool_versions s on s.id=m.setup_side_pool_version_id and s.tournament_id=m.tournament_id
 where m.pool_id=new.pool_id and m.tournament_id=new.tournament_id and m.event_id=new.event_id;
 if ratio is not null then
  if tg_table_name<>'side_pool_graduated_policies_v2'then raise exception'custom_side_requires_graduated_policy_v4';end if;
  if new.method is distinct from'side-custom-graduated-policy-v4'then raise exception'custom_side_requires_graduated_policy_v4';end if;
  if new.ratio is distinct from ratio then raise exception'custom_side_ratio_mismatch_v3';end if;
  if not exists(select 1 from app.operation_receipts o where o.id=new.operation_receipt_id and o.tournament_id=new.tournament_id
   and o.actor_profile_id=new.actor_id and o.operation_type='side_pool_custom_operating_v4'and o.outcome='accepted')then raise exception'custom_side_policy_receipt_required_v4';end if;
 end if;
 return new;
end$$;
revoke all on function app.guard_custom_side_policy_v3()from public,anon,authenticated,service_role;

-- Reconstruct authority from the materialized pool, setup Side row, exact
-- setup intent, definition and accepted policy receipt.
create function app.custom_side_policy_binding_v4(tid uuid,eid uuid,pool uuid)
returns jsonb language sql stable security definer set search_path=''as $$
select jsonb_build_object(
 'kind','custom-side-policy-binding-v4','policyId',p.id,'operationReceiptId',p.operation_receipt_id,
 'poolId',p.pool_id,'method',p.method,'ratio',p.ratio,
 'amountMethod','graduated-custom-ratio-largest-remainder-5usd-v3',
 'definitionVersionId',p.definition_version_id,'definition',to_jsonb(d),
 'disclosureReference',p.disclosure_reference,'policyActorId',p.actor_id,
 'policyOperationId',o.client_operation_id,'policyRequestHash',o.request_hash,
 'materializationId',m.id,'materializationReceiptId',m.operation_receipt_id,
 'setupSidePoolVersionId',s.id,'setupRevisionId',s.setup_revision_id,
 'setupEventVersionId',s.setup_event_version_id,'eventClientRowId',e.client_row_id,
 'poolSlot',s.slot,'customRatio',s.custom_ratio_denominator_v3,'payoutType',s.payout_type,
 'setupBatchId',i.batch_id,'setupActorId',b.actor_id,'setupOperationId',b.operation_id,
 'setupRequestHash',b.request_hash,'originalIntent',i.original_intent,
 'baseSetupRevisionId',b.base_setup_revision_id,'baseSetupVersion',b.base_setup_version,
 'baseSourceDigest',b.base_source_digest)
from app.side_pool_graduated_policies_v2 p
join app.operation_receipts o on o.id=p.operation_receipt_id and o.tournament_id=p.tournament_id
 and o.operation_type='side_pool_custom_operating_v4'and o.outcome='accepted'
join app.event_side_pool_definition_versions d on d.id=p.definition_version_id and d.pool_id=p.pool_id
 and d.tournament_id=p.tournament_id and d.event_id=p.event_id
join app.tournament_setup_side_pool_materializations m on m.pool_id=p.pool_id and m.tournament_id=p.tournament_id and m.event_id=p.event_id
join app.tournament_setup_side_pool_versions s on s.id=m.setup_side_pool_version_id and s.tournament_id=m.tournament_id
join app.tournament_setup_event_versions e on e.id=s.setup_event_version_id and e.tournament_id=s.tournament_id and e.setup_revision_id=s.setup_revision_id
join app.setup_custom_payout_intents_v2 i on i.tournament_id=s.tournament_id and i.setup_revision_id=s.setup_revision_id
 and i.setup_event_version_id=s.setup_event_version_id and i.scope='side'and i.pool_slot=s.slot
 and i.ratio_denominator=p.ratio and i.amount_method='graduated-custom-ratio-largest-remainder-5usd-v3'
join app.setup_custom_payout_batches_v2 b on b.id=i.batch_id and b.tournament_id=i.tournament_id and b.setup_revision_id=i.setup_revision_id
where p.tournament_id=tid and p.event_id=eid and p.pool_id=pool
 and p.method='side-custom-graduated-policy-v4'and s.custom_ratio_denominator_v3=p.ratio and s.payout_type is null;
$$;
revoke all on function app.custom_side_policy_binding_v4(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create function app.save_side_custom_policy_v4_impl(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_request jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=''as $$
declare prior app.operation_receipts%rowtype;s app.tournament_setup_side_pool_versions%rowtype;
 e app.tournament_setup_event_versions%rowtype;d app.event_side_pool_definition_versions%rowtype;
 intent jsonb;source_value jsonb;h text;response jsonb;code text;
 ratio_value integer;setup_side_id uuid;definition_id uuid;
 rid uuid:=extensions.gen_random_uuid();oid uuid:=extensions.gen_random_uuid();
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'or p_actor_id is null or p_tournament_id is null or p_event_id is null or p_pool_id is null or p_operation_id is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform 1 from app.tournaments where id=p_tournament_id and status in('draft','open')for no key update;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')for update;if not found then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('event-start:'||p_event_id::text,0));
 perform 1 from app.event_side_pools where id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id for update;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('side_pool_custom_operating_v4',p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if prior.tournament_id=p_tournament_id and prior.target_id=p_pool_id and prior.operation_type='side_pool_custom_operating_v4'and prior.request_hash=h then return prior.response_payload;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 begin
  if jsonb_typeof(p_request)is distinct from'object'or(select count(*)from jsonb_object_keys(p_request))<>9
   or not(p_request?&array['action','setupSidePoolVersionId','definitionVersionId','method','ratio','amountMethod','disclosureReference','disclosed','intent'])
   or p_request->>'action'is distinct from'publish'or p_request->>'method'is distinct from'side-custom-graduated-policy-v4'
   or p_request->>'amountMethod'is distinct from'graduated-custom-ratio-largest-remainder-5usd-v3'or p_request->'disclosed'is distinct from'true'::jsonb
   or jsonb_typeof(p_request->'setupSidePoolVersionId')is distinct from'string'or coalesce(p_request->>'setupSidePoolVersionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or jsonb_typeof(p_request->'definitionVersionId')is distinct from'string'or coalesce(p_request->>'definitionVersionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or jsonb_typeof(p_request->'ratio')is distinct from'number'or coalesce(p_request->>'ratio','')!~'^[1-9][0-9]*$'or(p_request->>'ratio')::numeric>2147483647
   or jsonb_typeof(p_request->'disclosureReference')is distinct from'string'or length(trim(p_request->>'disclosureReference'))not between 1 and 500
   or p_request->>'disclosureReference'<>trim(p_request->>'disclosureReference')or p_request->>'disclosureReference'~'[[:cntrl:]]'
   or jsonb_typeof(p_request->'intent')is distinct from'object'then raise exception'invalid_request';end if;
  ratio_value:=(p_request->>'ratio')::integer;setup_side_id:=(p_request->>'setupSidePoolVersionId')::uuid;definition_id:=(p_request->>'definitionVersionId')::uuid;
  intent:=p_request->'intent';source_value:=intent->'source';
  if(select count(*)from jsonb_object_keys(intent))<>4 or not(intent?&array['kind','scope','ratioDenominator','source'])
   or intent->>'kind'is distinct from'custom-payout-intent-v1'or intent->>'scope'is distinct from'side'
   or intent->'ratioDenominator'is distinct from p_request->'ratio'or jsonb_typeof(source_value)is distinct from'object'
   or(select count(*)from jsonb_object_keys(source_value))<>6
   or not(source_value?&array['tournamentId','eventClientRowId','setupRevisionId','setupVersion','poolSlot','sourceDigest'])
   or source_value->>'tournamentId'is distinct from p_tournament_id::text
   or coalesce(source_value->>'eventClientRowId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or jsonb_typeof(source_value->'setupVersion')is distinct from'number'or coalesce(source_value->>'setupVersion','')!~'^(0|[1-9][0-9]*)$'
   or(source_value->>'setupVersion')::numeric>2147483647
   or((source_value->>'setupVersion')='0'and source_value->'setupRevisionId'is distinct from'null'::jsonb)
   or((source_value->>'setupVersion')<>'0'and coalesce(source_value->>'setupRevisionId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
   or jsonb_typeof(source_value->'poolSlot')is distinct from'number'or coalesce(source_value->>'poolSlot','')!~'^[1-6]$'
   or coalesce(source_value->>'sourceDigest','')!~'^[a-f0-9]{64}$'then raise exception'invalid_request';end if;
  select side.*into s from app.tournament_setup_side_pool_materializations m
   join app.tournament_setup_side_pool_versions side on side.id=m.setup_side_pool_version_id and side.tournament_id=m.tournament_id
   where m.pool_id=p_pool_id and m.tournament_id=p_tournament_id and m.event_id=p_event_id and side.id=setup_side_id;
  if s.id is null then raise exception'setup_pool_mismatch';end if;
  select*into e from app.tournament_setup_event_versions where id=s.setup_event_version_id and tournament_id=s.tournament_id and setup_revision_id=s.setup_revision_id;
  if e.id is null or e.event_kind not in('main','consolation')then raise exception'unsupported_scope';end if;
  select*into d from app.event_side_pool_definition_versions where pool_id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
  if d.id is null or d.id<>definition_id or not d.active then raise exception'definition_changed';end if;
  if s.custom_ratio_denominator_v3 is distinct from ratio_value or s.payout_type is not null then raise exception'setup_method_conflict';end if;
  if d.entry_fee_minor not between 500 and 100000000 or mod(d.entry_fee_minor,500)<>0 then raise exception'unsupported_payout_domain';end if;
  if source_value->>'eventClientRowId'is distinct from e.client_row_id::text or(source_value->>'poolSlot')::smallint is distinct from s.slot then raise exception'custom_intent_required';end if;
  if not exists(select 1 from app.setup_custom_payout_intents_v2 i join app.setup_custom_payout_batches_v2 b
    on b.id=i.batch_id and b.tournament_id=i.tournament_id and b.setup_revision_id=i.setup_revision_id
   where i.tournament_id=p_tournament_id and i.setup_revision_id=s.setup_revision_id and i.setup_event_version_id=s.setup_event_version_id
    and i.scope='side'and i.pool_slot=s.slot and i.ratio_denominator=ratio_value
    and i.amount_method='graduated-custom-ratio-largest-remainder-5usd-v3'and i.original_intent=p_request->'intent')then raise exception'custom_intent_required';end if;
  if exists(select 1 from app.side_pool_graduated_policies_v2 where pool_id=p_pool_id)then raise exception'policy_frozen';end if;
  if app.event_play_state_v1(p_event_id)in('in_progress','completed','finalized')or exists(select 1 from app.event_side_pool_election_versions where pool_id=p_pool_id)then raise exception'collection_or_play_started';end if;
  response:=jsonb_build_object('status','side_custom_policy_published_v4','policyId',rid,'poolId',p_pool_id,'setupSidePoolVersionId',s.id,'definitionVersionId',d.id,'ratio',ratio_value,'amountMethod','graduated-custom-ratio-largest-remainder-5usd-v3','moneyMoved',false);
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm in('invalid_request','setup_pool_mismatch','unsupported_scope','definition_changed','setup_method_conflict','unsupported_payout_domain','custom_intent_required','policy_frozen','collection_or_play_started')then sqlerrm else'invalid_request'end;
  response:=jsonb_build_object('status','rejected','code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(oid,p_tournament_id,p_actor_id,'side_pool_custom_operating_v4',p_pool_id,h,p_operation_id,case when code is null then'accepted'else'rejected'end,response,case when code is null then clock_timestamp()else null end);
 if code is null then
  insert into app.side_pool_graduated_policies_v2(id,pool_id,tournament_id,event_id,definition_version_id,method,ratio,disclosure_reference,actor_id,operation_receipt_id)
  values(rid,p_pool_id,p_tournament_id,p_event_id,d.id,'side-custom-graduated-policy-v4',ratio_value,p_request->>'disclosureReference',p_actor_id,oid);
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(p_tournament_id,p_actor_id,oid,'side_pool_custom_operating_v4',case when code is null then rid else p_pool_id end,case when code is null then'side_custom_policy_frozen_v4'else'side_custom_policy_rejected_v4'end,response);
 return response;
end$$;

create function app.get_side_custom_policy_reconciliation_v4_impl(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_operation_id uuid,p_request jsonb)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare r app.operation_receipts%rowtype;h text;begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))or not exists(select 1 from app.event_side_pools where id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id)then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('side_pool_custom_operating_v4',p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request)::text,'utf8'),'sha256'),'hex');
 select*into r from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if not found then return jsonb_build_object('authorized',true,'result',null);end if;
 if r.tournament_id=p_tournament_id and r.target_id=p_pool_id and r.operation_type='side_pool_custom_operating_v4'and r.request_hash=h then return jsonb_build_object('authorized',true,'result',r.response_payload);end if;
 return jsonb_build_object('authorized',true,'result',jsonb_build_object('status','rejected','code','idempotency_conflict'));
end$$;
revoke all on function app.save_side_custom_policy_v4_impl(uuid,uuid,uuid,uuid,jsonb,uuid),app.get_side_custom_policy_reconciliation_v4_impl(uuid,uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
create function public.save_side_custom_policy_v4(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_request jsonb,p_operation_id uuid)
returns jsonb language sql security definer set search_path=''as $$select app.save_side_custom_policy_v4_impl(p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request,p_operation_id);$$;
create function public.get_side_custom_policy_reconciliation_v4(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_operation_id uuid,p_request jsonb)
returns jsonb language sql stable security definer set search_path=''as $$select app.get_side_custom_policy_reconciliation_v4_impl(p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_operation_id,p_request);$$;
revoke all on function public.save_side_custom_policy_v4(uuid,uuid,uuid,uuid,jsonb,uuid),public.get_side_custom_policy_reconciliation_v4(uuid,uuid,uuid,uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.save_side_custom_policy_v4(uuid,uuid,uuid,uuid,jsonb,uuid),public.get_side_custom_policy_reconciliation_v4(uuid,uuid,uuid,uuid,uuid,jsonb)to service_role;

-- Preserve an exact clone for every historical policy. The custom clone changes
-- only the amount engine; paid elections, full-funding, supported event and
-- immutable-definition checks remain the V2 source implementation.
do $$declare d text;p text;old text;replacement text;begin
 d:=replace(pg_get_functiondef('app.side_pool_graduated_source_v2(uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n');
 p:=replace(d,'FUNCTION app.side_pool_graduated_source_v2(','FUNCTION app.side_pool_graduated_source_pre_custom_v4(');
 if p=d then raise exception'Side custom legacy source clone anchor changed';end if;execute p;
 p:=replace(d,'FUNCTION app.side_pool_graduated_source_v2(','FUNCTION app.side_pool_graduated_source_with_custom_v4(');
 if p=d then raise exception'Side custom source clone anchor changed';end if;
 old:=$a$calculation:=app.calculate_graduated_pool_amounts_v2(jsonb_build_object('paidCount',paid,'feeMinor',d.entry_fee_minor,'ratio',p.ratio));$a$;
 replacement:=$a$calculation:=case when p.method='side-custom-graduated-policy-v4'then app.calculate_custom_graduated_amounts_v3(jsonb_build_object('paidCount',paid,'feeMinor',d.entry_fee_minor,'ratio',p.ratio))else app.calculate_graduated_pool_amounts_v2(jsonb_build_object('paidCount',paid,'feeMinor',d.entry_fee_minor,'ratio',p.ratio))end;$a$;
 if(length(p)-length(replace(p,old,'')))/length(old)<>1 then raise exception'Side custom amount anchor changed';end if;execute replace(p,old,replacement);
end$$;

create function app.project_side_custom_source_v4(base jsonb,binding jsonb)
returns jsonb language plpgsql immutable set search_path=''as $$
declare manifest jsonb;blocks jsonb;begin
 if jsonb_typeof(base)is distinct from'object'then return null;end if;
 blocks:=coalesce(base->'blockers','[]'::jsonb);if jsonb_typeof(blocks)is distinct from'array'then blocks:='["source_blocked"]'::jsonb;end if;
 if jsonb_typeof(binding)is distinct from'object'or base->'policy'->>'method'is distinct from'side-custom-graduated-policy-v4'or binding->>'policyId'is distinct from base->'policy'->>'id'then blocks:=blocks||jsonb_build_array('custom_policy_binding_unavailable');end if;
 if jsonb_typeof(base->'calculation')is distinct from'object'or base#>>'{calculation,status}'is distinct from'calculated'then blocks:=blocks||jsonb_build_array('unsupported_payout_domain');
 elsif(base->>'paidCount')::integer=0 or(base#>>'{calculation,recipientCount}')::integer=0 then blocks:=blocks||jsonb_build_array('side_no_eligible_recipients');end if;
 manifest:=(base->'manifest')||jsonb_build_object('sourceVersion','side-custom-amount-source-v4','customAlgorithmVersion','graduated-custom-ratio-largest-remainder-5usd-v3','refundPolicy','no-pool-refunds-v1','customPolicyBinding',coalesce(binding,'null'::jsonb),'blockers',blocks);
 return(base-'sourceDigest'-'manifest'-'blockers'-'calculation')||jsonb_build_object(
  'sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),'manifest',manifest,'blockers',blocks,
  'calculation',case when jsonb_array_length(blocks)=0 then base->'calculation'else'null'::jsonb end);
end$$;
create or replace function app.side_pool_graduated_source_v2(tid uuid,eid uuid,pool uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare p app.side_pool_graduated_policies_v2%rowtype;base jsonb;binding jsonb;begin
 select*into p from app.side_pool_graduated_policies_v2 where pool_id=pool and tournament_id=tid and event_id=eid;
 if p.id is null or p.method<>'side-custom-graduated-policy-v4'then return app.side_pool_graduated_source_pre_custom_v4(tid,eid,pool);end if;
 base:=app.side_pool_graduated_source_with_custom_v4(tid,eid,pool);if base is null then return null;end if;
 binding:=app.custom_side_policy_binding_v4(tid,eid,pool);
 return app.project_side_custom_source_v4(base,binding);
end$$;
revoke all on function app.side_pool_graduated_source_pre_custom_v4(uuid,uuid,uuid),app.side_pool_graduated_source_with_custom_v4(uuid,uuid,uuid),app.project_side_custom_source_v4(jsonb,jsonb),app.side_pool_graduated_source_v2(uuid,uuid,uuid)from public,anon,authenticated,service_role;

-- V9 consumes the shared V3 Side source. Keep standalone unpaid Side review,
-- but prevent this new method from silently becoming combined/final accounting.
-- The legacy-only branch returns the original V9 source byte-for-byte.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.prize_accounting_source_v9(uuid,uuid,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION app.prize_accounting_source_v9(','FUNCTION app.prize_accounting_source_pre_custom_side_v4(');
 if p=d then raise exception'Side custom V9 source clone anchor changed';end if;execute p;
end$$;
create or replace function app.prize_accounting_source_v9(actor uuid,tid uuid,eid uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare base jsonb;blocks jsonb;manifest jsonb;begin
 base:=app.prize_accounting_source_pre_custom_side_v4(actor,tid,eid);if base is null then return null;end if;
 if not exists(select 1 from app.side_pool_graduated_policies_v2 where tournament_id=tid and event_id=eid and method='side-custom-graduated-policy-v4')then return base;end if;
 blocks:=coalesce(base->'blockers','[]'::jsonb);if jsonb_typeof(blocks)is distinct from'array'then blocks:='["source_blocked"]'::jsonb;end if;
 blocks:=blocks||jsonb_build_array('custom_side_combined_accounting_unsupported');
 manifest:=coalesce(base->'manifest','{}'::jsonb)||jsonb_build_object('customSideAccountingMode','standalone-unpaid-review-only-v4','blocks',blocks);
 return(base-'sourceDigest'-'manifest'-'blockers'-'facts')||jsonb_build_object(
  'sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),'manifest',manifest,'blockers',blocks,'facts','null'::jsonb);
end$$;
revoke all on function app.prize_accounting_source_pre_custom_side_v4(uuid,uuid,uuid),app.prize_accounting_source_v9(uuid,uuid,uuid)from public,anon,authenticated,service_role;

commit;
