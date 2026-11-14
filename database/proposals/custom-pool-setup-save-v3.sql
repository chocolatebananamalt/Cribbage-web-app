-- Local proposal: Q/Side draft persistence only. No public capability/grant.
-- Depends on 0290 and the three existing Custom Q V2 proposals. Legacy
-- functions/amount methods and historical rows are retained unchanged.
begin;
alter table app.tournament_setup_side_pool_versions add column custom_ratio_denominator_v3 integer
 check(custom_ratio_denominator_v3 is null or custom_ratio_denominator_v3>0);

-- Protected full-request reservation, not a session-setting claim, is the
-- authority for a Side row's new numeric intent inside this exact transaction.
create function app.reserved_custom_side_ratio_v3(tid uuid,rid uuid,row_id uuid,slot_no integer)returns integer
language plpgsql security definer set search_path=''as $$
declare request_value jsonb;intent jsonb;ratio integer;n integer;pool jsonb;
begin
 select r.request_payload into request_value from app.tournament_setup_revisions rev
 join app.operation_receipts receipt on receipt.id=rev.operation_receipt_id
 join app.setup_custom_q_save_reservations_v2 r on r.actor_id=rev.actor_profile_id and r.operation_id=receipt.client_operation_id
 where rev.tournament_id=tid and rev.id=rid and r.tournament_id=tid and receipt.tournament_id=tid
 and receipt.actor_profile_id=rev.actor_profile_id and receipt.outcome='accepted'and receipt.operation_type='save_tournament_setup_version'
 and r.request_payload#>>'{request,expectedVersion}'=(rev.version-1)::text;
 if request_value is null then return null;end if;
 select count(*),min(value::text)::jsonb into n,intent from jsonb_array_elements(request_value->'customPayouts')
 where value->>'scope'='side'and value#>>'{source,eventClientRowId}'=row_id::text and value#>>'{source,poolSlot}'=slot_no::text;
 if n=0 then return null;end if;
 if n<>1 then raise exception'duplicate_custom_side_intent';end if;
 ratio:=(intent->>'ratioDenominator')::integer;
 select value#>array['sidePools',(slot_no-1)::text] into pool from jsonb_array_elements(request_value#>'{request,payload,events}')
 where value->>'clientRowId'=row_id::text and value->>'formatCode'='standard_singles'and value->>'eventKind'in('main','consolation','satellite');
 if ratio<=0 or pool is null or(pool?'payoutType'and pool->>'payoutType'is distinct from'graduated-1-in-'||ratio::text)
 then raise exception'invalid_custom_side_intent';end if;
 return ratio;
end$$;
revoke all on function app.reserved_custom_side_ratio_v3(uuid,uuid,uuid,integer)from public,anon,authenticated,service_role;

create function app.set_custom_side_ratio_v3()returns trigger
language plpgsql security definer set search_path=''as $$
declare row_id uuid;ratio integer;
begin
 select client_row_id into row_id from app.tournament_setup_event_versions
 where id=new.setup_event_version_id and tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 ratio:=app.reserved_custom_side_ratio_v3(new.tournament_id,new.setup_revision_id,row_id,new.slot);
 if ratio is not null then
  -- No surrogate preset. The new field and immutable intent are explicit.
  new.payout_type:=null;new.custom_ratio_denominator_v3:=ratio;
 elsif new.custom_ratio_denominator_v3 is not null then raise exception'custom_side_requires_full_reservation';end if;
 return new;
end$$;
revoke all on function app.set_custom_side_ratio_v3()from public,anon,authenticated,service_role;
-- PostgreSQL fires same-kind triggers alphabetically; run after original type
-- copy-forward so an old preset cannot override this explicit new intent.
create trigger zz_custom_side_ratio_v3 before insert on app.tournament_setup_side_pool_versions
 for each row execute function app.set_custom_side_ratio_v3();

-- Preserve the original configurator and linked writer. The private new clones
-- differ only at the guarded missing-type branch and Side stage call.
do $$declare d text;patched text;anchor text;
begin
 d:=replace(pg_get_functiondef('app.linked_setup_configure_sides_v1(uuid,uuid,uuid,jsonb)'::regprocedure),E'\r\n',E'\n');
 anchor:='elsif not coalesce(pre_rollout,false) and existing_count=0 then';
 if strpos(d,anchor)=0 then raise exception'custom_side_configurator_anchor_changed';end if;
 patched:=replace(d,'FUNCTION app.linked_setup_configure_sides_v1(','FUNCTION app.configure_custom_pool_sides_v3(');
 if patched=d then raise exception'custom_side_configurator_name_changed';end if;
 patched:=replace(patched,anchor,'elsif not coalesce(pre_rollout,false) and existing_count=0 and app.reserved_custom_side_ratio_v3(tid,rid,(ev->>''clientRowId'')::uuid,s) is null then');
 execute patched;
 d:=replace(pg_get_functiondef('public.save_linked_tournament_setup_v1(uuid,jsonb)'::regprocedure),E'\r\n',E'\n');
 anchor:='app.linked_setup_configure_sides_v1(';
 if strpos(d,anchor)=0 then raise exception'custom_side_linked_stage_anchor_changed';end if;
 patched:=replace(d,'FUNCTION public.save_linked_tournament_setup_v1(','FUNCTION app.save_linked_custom_pool_setup_v3(');
 if patched=d then raise exception'custom_side_linked_name_changed';end if;
 patched:=replace(patched,anchor,'app.configure_custom_pool_sides_v3(');
 execute patched;
end$$;
revoke all on function app.configure_custom_pool_sides_v3(uuid,uuid,uuid,jsonb),app.save_linked_custom_pool_setup_v3(uuid,jsonb)from public,anon,authenticated,service_role;

-- Until a separately reviewed operational policy is published, legacy fixed
-- Side policy must not interpret an explicit custom row as an untyped pool.
create function app.guard_custom_side_policy_v3()returns trigger
language plpgsql security definer set search_path=''as $$
declare ratio integer;
begin
 select s.custom_ratio_denominator_v3 into ratio from app.tournament_setup_side_pool_materializations m
 join app.tournament_setup_side_pool_versions s on s.id=m.setup_side_pool_version_id and s.tournament_id=m.tournament_id
 where m.pool_id=new.pool_id and m.tournament_id=new.tournament_id and m.event_id=new.event_id;
 if ratio is not null then
  if tg_table_name<>'side_pool_graduated_policies_v2'then raise exception'custom_side_requires_graduated_policy_v3';end if;
  if new.ratio is distinct from ratio then raise exception'custom_side_ratio_mismatch_v3';end if;
 end if;
 return new;
end$$;
revoke all on function app.guard_custom_side_policy_v3()from public,anon,authenticated,service_role;
create trigger custom_side_policy_v3 before insert on app.side_pool_graduated_policies_v2
 for each row execute function app.guard_custom_side_policy_v3();
create trigger custom_side_legacy_policy_v3 before insert on app.event_side_pool_policy_versions
 for each row execute function app.guard_custom_side_policy_v3();

-- A fresh editor must recover explicit numeric intent from durable rows, not
-- infer it from the display name or reuse a previous source/operation pin.
create function app.get_custom_pool_setup_workspace_v3(tid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare b jsonb;rid uuid;retained jsonb;intents jsonb;sides jsonb;
begin
 b:=app.get_custom_q_setup_base_v2(tid);
 if b->'base'is null then return b;end if;
 rid:=(b#>>'{base,setupRevisionId}')::uuid;
 select request_payload into retained from app.setup_custom_payout_batches_v2 where tournament_id=tid and setup_revision_id=rid;
 select coalesce(jsonb_agg(i.original_intent order by e.ordinal,i.scope,i.pool_slot),'[]'::jsonb)into intents
 from app.setup_custom_payout_intents_v2 i join app.tournament_setup_event_versions e
 on e.id=i.setup_event_version_id and e.tournament_id=i.tournament_id and e.setup_revision_id=i.setup_revision_id
 where i.tournament_id=tid and i.setup_revision_id=rid;
 if jsonb_array_length(intents)>0 and retained is null then return jsonb_build_object('status','blocked','code','custom_side_source_mismatch');end if;
 if exists(select 1 from app.tournament_setup_side_pool_versions s where s.tournament_id=tid and s.setup_revision_id=rid and s.custom_ratio_denominator_v3 is not null
 and not exists(select 1 from app.setup_custom_payout_intents_v2 i where i.tournament_id=tid and i.setup_revision_id=rid and i.setup_event_version_id=s.setup_event_version_id and i.scope='side'and i.pool_slot=s.slot and i.ratio_denominator=s.custom_ratio_denominator_v3))
 or exists(select 1 from app.setup_custom_payout_intents_v2 i where i.tournament_id=tid and i.setup_revision_id=rid and i.scope='side'
 and not exists(select 1 from app.tournament_setup_side_pool_versions s where s.tournament_id=tid and s.setup_revision_id=rid and s.setup_event_version_id=i.setup_event_version_id and s.slot=i.pool_slot and s.custom_ratio_denominator_v3=i.ratio_denominator and s.payout_type is null))
 then return jsonb_build_object('status','blocked','code','custom_side_source_mismatch');end if;
 select coalesce(jsonb_agg(jsonb_build_object('setupSidePoolVersionId',s.id,'eventClientRowId',e.client_row_id,'slot',s.slot,'payoutType',s.payout_type,'customRatio',s.custom_ratio_denominator_v3)order by e.ordinal,s.slot),'[]'::jsonb)into sides
 from app.tournament_setup_side_pool_versions s join app.tournament_setup_event_versions e
 on e.id=s.setup_event_version_id and e.tournament_id=s.tournament_id and e.setup_revision_id=s.setup_revision_id
 where s.tournament_id=tid and s.setup_revision_id=rid;
 return jsonb_build_object('status','available','capability',false,'scope','draft-q-side-only','base',b->'base',
 'currentSetup',public.get_tournament_setup_workspace(tid)->'current','retainedEnvelope',retained,'customPayouts',intents,'sidePayouts',sides,
 'newEditRequiresFreshBaseAndOperation',true,'policyPublished',false,'moneyMoved',false);
end$$;
revoke all on function app.get_custom_pool_setup_workspace_v3(uuid)from public,anon,authenticated,service_role;

create function app.save_custom_pool_setup_draft_v3(p_tournament_id uuid,p_envelope jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;prior app.setup_custom_q_save_reservations_v2%rowtype;
 req jsonb;payload jsonb;intents jsonb;i jsonb;s jsonb;e jsonb;p jsonb;base jsonb;base_reply jsonb;
 expected integer;ratio integer;slot integer;n integer;event_id uuid;seen text[]:=array[]::text[];k text;
 linked jsonb;response jsonb;rev app.tournament_setup_revisions%rowtype;rec app.operation_receipts%rowtype;batch_id uuid;code text;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 -- Only identify the exact operation before reserving; all substantive
 -- rejections after this point are bound to this complete original envelope.
 begin
  if jsonb_typeof(p_envelope)is distinct from'object'or jsonb_typeof(p_envelope->'request')is distinct from'object'or coalesce(p_envelope#>>'{request,idempotencyKey}','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then raise exception'invalid operation';end if;
  op:=(p_envelope#>>'{request,idempotencyKey}')::uuid;
 exception when others then return jsonb_build_object('status','rejected','code','invalid_request');end;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(a::text||':'||op::text,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 perform 1 from app.tournaments where id=p_tournament_id for update nowait;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('setup-custom-payouts-v2',a,p_tournament_id,op,p_envelope)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.setup_custom_q_save_reservations_v2 where actor_id=a and operation_id=op;
 if found then
  if prior.tournament_id is distinct from p_tournament_id or prior.request_hash is distinct from h or prior.request_payload is distinct from p_envelope then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select response_payload into response from app.setup_custom_q_save_outcomes_v2 where actor_id=a and operation_id=op;
  if response is null then raise exception'custom Q reservation missing atomic outcome';end if;
  return response;
 end if;
 if exists(select 1 from app.operation_receipts where actor_profile_id=a and client_operation_id=op)
 or exists(select 1 from app.setup_event_link_save_reservations_v1 where actor_id=a and operation_id=op)
 or exists(select 1 from app.setup_custom_payout_batches_v2 where actor_id=a and operation_id=op)then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 insert into app.setup_custom_q_save_reservations_v2(actor_id,operation_id,tournament_id,request_payload,request_hash)values(a,op,p_tournament_id,p_envelope,h);
 begin
  if not(p_envelope?&array['kind','base','request','choices','customPayouts'])or exists(select 1 from jsonb_object_keys(p_envelope)x where x<>all(array['kind','base','request','choices','customPayouts']))or p_envelope->>'kind'is distinct from'setup-custom-payouts-v2'then raise exception'custom_q_rejected:invalid_request';end if;
  req:=p_envelope->'request';payload:=req->'payload';intents:=p_envelope->'customPayouts';
  if not(req?&array['expectedVersion','payload','idempotencyKey'])or exists(select 1 from jsonb_object_keys(req)x where x<>all(array['expectedVersion','payload','idempotencyKey']))or jsonb_typeof(req->'expectedVersion')is distinct from'number'or coalesce(req->>'expectedVersion','')!~'^(0|[1-9][0-9]*)$'or jsonb_typeof(payload)is distinct from'object'or jsonb_typeof(payload->'events')is distinct from'array'or not app.valid_setup_event_links_v1(payload->'events',p_envelope->'choices')or jsonb_typeof(intents)is distinct from'array'then raise exception'custom_q_rejected:invalid_request';end if;
  expected:=(req->>'expectedVersion')::integer;
  if jsonb_array_length(intents)not between 0 and 288 then raise exception'custom_q_rejected:invalid_request';end if;
  base_reply:=app.get_custom_q_setup_base_v2(p_tournament_id);
  if base_reply->>'status'='retry_exact'then raise exception using errcode='55P03',message='custom source busy';end if;
  base:=base_reply->'base';
  if base is null or expected is distinct from(base->>'setupVersion')::integer then raise exception'custom_q_rejected:stale_version';end if;
  if p_envelope->'base'is distinct from base then raise exception'custom_q_rejected:source_changed';end if;
  -- Q and explicit Side intents. Typed presets remain unchanged. A Satellite
  -- custom-looking ratio is explicitly unsupported, not treated as Q policy.
  for e in select value from jsonb_array_elements(payload->'events')loop
   if coalesce(e->>'clientRowId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then raise exception'custom_q_rejected:invalid_event';end if;
   if jsonb_typeof(e->'sidePools')is distinct from'array'or jsonb_typeof(e->'qPools')is distinct from'array'then raise exception'custom_q_rejected:invalid_event';end if;
   for p in select value from jsonb_array_elements(e->'sidePools')loop
    if p?'payoutType'and p->>'payoutType'not in('graduated-1-in-4','graduated-1-in-6','graduated-1-in-8','graduated-1-in-10')then raise exception'custom_q_rejected:invalid_side_type';end if;
   end loop;
   if e->>'eventKind'='satellite'and app.custom_payout_classification_text_v2(e->>'payoutNote')~*'^1\s+in\s'and app.custom_payout_classification_text_v2(e->>'payoutNote')not in('1 in 4','1 in 5','1 in 6')then raise exception'custom_q_rejected:satellite_custom_unsupported';end if;
  end loop;
  for i in select value from jsonb_array_elements(intents)loop
   if jsonb_typeof(i)is distinct from'object'or not(i?&array['kind','scope','ratioDenominator','source'])or exists(select 1 from jsonb_object_keys(i)x where x<>all(array['kind','scope','ratioDenominator','source']))or i->>'kind'is distinct from'custom-payout-intent-v1'or coalesce(i->>'scope','')not in('q','side')then raise exception'custom_q_rejected:non_q_intent_unsupported';end if;
   s:=i->'source';
   if jsonb_typeof(s)is distinct from'object'or not(s?&array['tournamentId','eventClientRowId','setupRevisionId','setupVersion','poolSlot','sourceDigest'])or exists(select 1 from jsonb_object_keys(s)x where x<>all(array['tournamentId','eventClientRowId','setupRevisionId','setupVersion','poolSlot','sourceDigest']))
    or s->'tournamentId'is distinct from base->'tournamentId'or s->'setupRevisionId'is distinct from base->'setupRevisionId'or s->'setupVersion'is distinct from base->'setupVersion'or s->'sourceDigest'is distinct from base->'sourceDigest'
    or jsonb_typeof(s->'poolSlot')is distinct from'number'or coalesce(s->>'poolSlot','')!~'^[1-6]$'or(i->>'scope'='q'and coalesce(s->>'poolSlot','')!~'^[12]$')or coalesce(s->>'eventClientRowId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or jsonb_typeof(i->'ratioDenominator')is distinct from'number'or coalesce(i->>'ratioDenominator','')!~'^[1-9][0-9]*$'then raise exception'custom_q_rejected:invalid_intent';end if;
   ratio:=(i->>'ratioDenominator')::integer;slot:=(s->>'poolSlot')::integer;k:=(s->>'eventClientRowId')||':'||(i->>'scope')||':'||slot::text;
   if k=any(seen)then raise exception'custom_q_rejected:duplicate_intent';end if;seen:=array_append(seen,k);
   select count(*),min(value::text)::jsonb into n,e from jsonb_array_elements(payload->'events')where value->>'clientRowId'=s->>'eventClientRowId';
   if n<>1 then raise exception'custom_q_rejected:invalid_intent';end if;
   if i->>'scope'='q'then
    if e->>'eventKind'not in('main','consolation')or e#>>array['qPools',(slot-1)::text,'poolTypeCode']is distinct from'Graduated (1-in-'||ratio::text||')'then raise exception'custom_q_rejected:invalid_intent';end if;
   else
    p:=e#>array['sidePools',(slot-1)::text];
    if e->>'eventKind'not in('main','consolation','satellite')or e->>'formatCode'is distinct from'standard_singles'or p is null or (p?'payoutType'and p->>'payoutType'is distinct from'graduated-1-in-'||ratio::text)then raise exception'custom_q_rejected:invalid_side_intent';end if;
   end if;
  end loop;
  for e in select value from jsonb_array_elements(payload->'events')loop
   for p,slot in select value,ordinality::integer from jsonb_array_elements(e->'qPools')with ordinality loop
    if app.custom_payout_classification_text_v2(p->>'poolTypeCode')~*'^Graduated\s*\(1-in-'and app.custom_payout_classification_text_v2(p->>'poolTypeCode')not in('Graduated (1-in-4)','Graduated (1-in-6)','Graduated (1-in-8)','Graduated (1-in-10)')and not((e->>'clientRowId')||':q:'||slot::text=any(seen))then raise exception'custom_q_rejected:missing_intent';end if;
   end loop;
   for p,slot in select value,ordinality::integer from jsonb_array_elements(e->'sidePools')with ordinality loop
    if not(p?'payoutType')and not((e->>'clientRowId')||':side:'||slot::text=any(seen))then raise exception'custom_q_rejected:missing_side_intent';end if;
   end loop;
  end loop;
  linked:=app.save_linked_custom_pool_setup_v3(p_tournament_id,jsonb_build_object('kind','setup-event-links-v1','request',req,'choices',p_envelope->'choices'));
  if linked->>'status'is distinct from'linked_setup_saved'then raise exception'custom_q_rejected:%',coalesce(linked->>'code','core_unavailable');end if;
  select*into rev from app.tournament_setup_revisions where tournament_id=p_tournament_id and id=(linked#>>'{result,revisionId}')::uuid;
  select*into rec from app.operation_receipts where id=rev.operation_receipt_id;
  if rev.id is null or rev.version<>expected+1 or rev.actor_profile_id is distinct from a or rec.actor_profile_id is distinct from a or rec.client_operation_id is distinct from op or rec.tournament_id is distinct from p_tournament_id or rec.outcome is distinct from'accepted'or rec.operation_type is distinct from'save_tournament_setup_version'then raise exception'custom_q_rejected:core_unavailable';end if;
  insert into app.setup_custom_payout_batches_v2(tournament_id,setup_revision_id,base_setup_revision_id,base_setup_version,base_source_digest,actor_id,operation_id,core_receipt_id,request_payload,request_hash)
   values(p_tournament_id,rev.id,(base->>'setupRevisionId')::uuid,expected,base->>'sourceDigest',a,op,rec.id,p_envelope,h)returning id into batch_id;
  for i in select value from jsonb_array_elements(intents)loop
   s:=i->'source';select id into event_id from app.tournament_setup_event_versions where tournament_id=p_tournament_id and setup_revision_id=rev.id and client_row_id=(s->>'eventClientRowId')::uuid and event_kind in('main','consolation','satellite');
   if event_id is null then raise exception'custom_q_rejected:core_unavailable';end if;
   if i->>'scope'='q'and not exists(select 1 from app.tournament_setup_q_pool_versions q where q.tournament_id=p_tournament_id and q.setup_revision_id=rev.id and q.setup_event_version_id=event_id and q.slot=(s->>'poolSlot')::smallint and q.pool_type_code='Graduated (1-in-'||(i->>'ratioDenominator')||')')then raise exception'custom_q_rejected:core_unavailable';end if;
   if i->>'scope'='side'and not exists(select 1 from app.tournament_setup_side_pool_versions q where q.tournament_id=p_tournament_id and q.setup_revision_id=rev.id and q.setup_event_version_id=event_id and q.slot=(s->>'poolSlot')::smallint and q.custom_ratio_denominator_v3=(i->>'ratioDenominator')::integer)then raise exception'custom_q_rejected:core_unavailable';end if;
   insert into app.setup_custom_payout_intents_v2(batch_id,tournament_id,setup_revision_id,setup_event_version_id,scope,pool_slot,ratio_denominator,amount_method,original_intent)
   values(batch_id,p_tournament_id,rev.id,event_id,i->>'scope',(s->>'poolSlot')::smallint,(i->>'ratioDenominator')::integer,'graduated-custom-ratio-largest-remainder-5usd-v3',i);
  end loop;
  response:=jsonb_build_object('status','custom_pool_setup_draft_saved_v3','scope','draft-q-side-only','batchId',batch_id,'fullRequestHash',h,'envelope',p_envelope,'linked',linked,'operatingPolicyPublished',false,'moneyMoved',false);
 exception
  when raise_exception then
   if sqlerrm not like'custom_q_rejected:%'then raise;end if;
   response:=jsonb_build_object('status','rejected','code',split_part(sqlerrm,':',2));
  when invalid_text_representation or numeric_value_out_of_range then response:=jsonb_build_object('status','rejected','code','invalid_request');
 end;
 -- Both accepted core/journal and rejection outcome commit with the original
 -- full-envelope reservation; any unhandled error rolls back everything.
 if response->>'status'='rejected' then
  -- The rolled-back core subtransaction must not leave this actor/op reusable
  -- through an older save endpoint that knows only the global receipt table.
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(a,p_tournament_id,'save_custom_q_setup_draft_v2',p_tournament_id,h,op,'rejected',response,clock_timestamp());
 end if;
 insert into app.setup_custom_q_save_outcomes_v2(actor_id,operation_id,response_payload)values(a,op,response);
 return response;
exception when lock_not_available then
 -- Outer subtransaction rolls back reservation/core/journal/receipt/outcome.
 -- Busy is nonterminal: keep the original operation and retry it exactly.
 return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;

revoke all on function app.save_custom_pool_setup_draft_v3(uuid,jsonb)from public,anon,authenticated,service_role;
create function app.reconcile_custom_pool_setup_draft_v3(tid uuid,envelope jsonb)returns jsonb
language sql security definer set search_path=''as $$select app.reconcile_custom_q_setup_draft_v2(tid,envelope)$$;
revoke all on function app.reconcile_custom_pool_setup_draft_v3(uuid,jsonb)from public,anon,authenticated,service_role;
do $$declare signature text;begin
 foreach signature in array array[
 'app.reserved_custom_side_ratio_v3(uuid,uuid,uuid,integer)',
 'app.set_custom_side_ratio_v3()',
 'app.configure_custom_pool_sides_v3(uuid,uuid,uuid,jsonb)',
 'app.save_linked_custom_pool_setup_v3(uuid,jsonb)',
 'app.guard_custom_side_policy_v3()',
 'app.get_custom_pool_setup_workspace_v3(uuid)',
 'app.save_custom_pool_setup_draft_v3(uuid,jsonb)',
 'app.reconcile_custom_pool_setup_draft_v3(uuid,jsonb)'
 ]loop execute format('alter function %s owner to postgres',signature);end loop;
end$$;
commit;
