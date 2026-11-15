-- UNEXECUTED Q-ONLY draft-save proposal. Depends on the separately reviewed
-- custom-payout-intent-journal-v2.sql and migration0290. NOT activation,
-- disclosure acceptance, operating policy, accounting or payout integration.
-- No exposed endpoint/grants; capability remains false even for its owner.
begin;
create table app.setup_custom_q_save_reservations_v2(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id),request_payload jsonb not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array('setup-custom-payouts-v2',actor_id,tournament_id,operation_id,request_payload)::text,'utf8'),'sha256'),'hex'))
);
create table app.setup_custom_q_save_outcomes_v2(
 actor_id uuid not null,operation_id uuid not null,response_payload jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id)references app.setup_custom_q_save_reservations_v2(actor_id,operation_id)
);
do $$declare n text;begin
 foreach n in array array['setup_custom_q_save_reservations_v2','setup_custom_q_save_outcomes_v2']loop
  execute format('alter table app.%I owner to postgres',n);
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end$$;

-- An old setup writer cannot silently drop the current revision's explicit
-- intents. A new full-envelope save can remove them deliberately by committing
-- an empty intent journal, after which ordinary noncustom saves work again.
create function app.guard_custom_q_setup_intent_carry_v2()returns trigger
language plpgsql security definer set search_path=''as $$
declare previous_id uuid;r app.setup_custom_q_save_reservations_v2%rowtype;receipt app.operation_receipts%rowtype;
begin
 select id into previous_id from app.tournament_setup_revisions where tournament_id=new.tournament_id order by version desc limit 1;
 if previous_id is null or not exists(select 1 from app.setup_custom_payout_batches_v2 b join app.setup_custom_payout_intents_v2 i on i.batch_id=b.id and i.tournament_id=b.tournament_id and i.setup_revision_id=b.setup_revision_id where b.tournament_id=new.tournament_id and b.setup_revision_id=previous_id)then return new;end if;
 select*into receipt from app.operation_receipts where id=new.operation_receipt_id and tournament_id=new.tournament_id;
 select*into r from app.setup_custom_q_save_reservations_v2 where actor_id=new.actor_profile_id and operation_id=receipt.client_operation_id;
 if r.actor_id is null or r.tournament_id is distinct from new.tournament_id or receipt.actor_profile_id is distinct from r.actor_id
  or receipt.outcome is distinct from'accepted'or receipt.operation_type is distinct from'save_tournament_setup_version'
  or r.request_payload#>>'{request,expectedVersion}'is distinct from(new.version-1)::text
 then raise exception'custom_setup_requires_versioned_intent_save';end if;
 return new;
end$$;
revoke all on function app.guard_custom_q_setup_intent_carry_v2()from public,anon,authenticated,service_role;
create trigger custom_q_setup_intent_carry_v2 before insert on app.tournament_setup_revisions for each row execute function app.guard_custom_q_setup_intent_carry_v2();

-- Classification parity with JavaScript String.trim(), without rewriting the
-- retained request or the source advertisements that are actually persisted.
create function app.custom_payout_classification_text_v2(p_text text)returns text
language sql immutable returns null on null input set search_path=''as $$
 select regexp_replace(p_text,U&'^[\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]+|[\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]+$','','g');
$$;
revoke all on function app.custom_payout_classification_text_v2(text)from public,anon,authenticated,service_role;

create function app.get_custom_q_setup_base_v2(p_tournament_id uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$
declare a uuid:=auth.uid();current_setup jsonb;latest_hash text;digest text;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform 1 from app.tournaments where id=p_tournament_id for share nowait;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 current_setup:=public.get_tournament_setup_workspace(p_tournament_id)->'current';
 select b.request_hash into latest_hash from app.setup_custom_payout_batches_v2 b join app.tournament_setup_revisions r on r.id=b.setup_revision_id and r.tournament_id=b.tournament_id where b.tournament_id=p_tournament_id order by r.version desc limit 1;
 digest:=encode(extensions.digest(convert_to(jsonb_build_array('custom-q-setup-base-v2',p_tournament_id,current_setup,latest_hash)::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('capability',false,'scope','draft-q-only','base',jsonb_build_object('tournamentId',p_tournament_id,'setupRevisionId',current_setup->'revisionId','setupVersion',coalesce((current_setup->>'version')::integer,0),'sourceDigest',digest));
exception when lock_not_available then
 return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;

create function app.save_custom_q_setup_draft_v2(p_tournament_id uuid,p_envelope jsonb)returns jsonb
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
  if jsonb_array_length(intents)not between 0 and 64 then raise exception'custom_q_rejected:invalid_request';end if;
  base_reply:=app.get_custom_q_setup_base_v2(p_tournament_id);
  if base_reply->>'status'='retry_exact'then raise exception using errcode='55P03',message='custom source busy';end if;
  base:=base_reply->'base';
  if base is null or expected is distinct from(base->>'setupVersion')::integer then raise exception'custom_q_rejected:stale_version';end if;
  if p_envelope->'base'is distinct from base then raise exception'custom_q_rejected:source_changed';end if;
  -- Q only. Typed Side presets may pass through unchanged. A Satellite
  -- custom-looking ratio is explicitly unsupported, not treated as Q policy.
  for e in select value from jsonb_array_elements(payload->'events')loop
   if coalesce(e->>'clientRowId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then raise exception'custom_q_rejected:invalid_event';end if;
   if jsonb_typeof(e->'sidePools')is distinct from'array'or jsonb_typeof(e->'qPools')is distinct from'array'then raise exception'custom_q_rejected:invalid_event';end if;
   for p in select value from jsonb_array_elements(e->'sidePools')loop
    if coalesce(p->>'payoutType','')not in('graduated-1-in-4','graduated-1-in-6','graduated-1-in-8','graduated-1-in-10')then raise exception'custom_q_rejected:side_custom_unsupported';end if;
   end loop;
   if e->>'eventKind'='satellite'and app.custom_payout_classification_text_v2(e->>'payoutNote')~*'^1\s+in\s'and app.custom_payout_classification_text_v2(e->>'payoutNote')not in('1 in 4','1 in 5','1 in 6')then raise exception'custom_q_rejected:satellite_custom_unsupported';end if;
  end loop;
  for i in select value from jsonb_array_elements(intents)loop
   if jsonb_typeof(i)is distinct from'object'or not(i?&array['kind','scope','ratioDenominator','source'])or exists(select 1 from jsonb_object_keys(i)x where x<>all(array['kind','scope','ratioDenominator','source']))or i->>'kind'is distinct from'custom-payout-intent-v1'or i->>'scope'is distinct from'q'then raise exception'custom_q_rejected:non_q_intent_unsupported';end if;
   s:=i->'source';
   if jsonb_typeof(s)is distinct from'object'or not(s?&array['tournamentId','eventClientRowId','setupRevisionId','setupVersion','poolSlot','sourceDigest'])or exists(select 1 from jsonb_object_keys(s)x where x<>all(array['tournamentId','eventClientRowId','setupRevisionId','setupVersion','poolSlot','sourceDigest']))
    or s->'tournamentId'is distinct from base->'tournamentId'or s->'setupRevisionId'is distinct from base->'setupRevisionId'or s->'setupVersion'is distinct from base->'setupVersion'or s->'sourceDigest'is distinct from base->'sourceDigest'
    or jsonb_typeof(s->'poolSlot')is distinct from'number'or coalesce(s->>'poolSlot','')!~'^[12]$'or coalesce(s->>'eventClientRowId','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or jsonb_typeof(i->'ratioDenominator')is distinct from'number'or coalesce(i->>'ratioDenominator','')!~'^[1-9][0-9]*$'then raise exception'custom_q_rejected:invalid_intent';end if;
   ratio:=(i->>'ratioDenominator')::integer;slot:=(s->>'poolSlot')::integer;k:=(s->>'eventClientRowId')||':'||slot::text;
   if k=any(seen)then raise exception'custom_q_rejected:duplicate_intent';end if;seen:=array_append(seen,k);
   select count(*),min(value::text)::jsonb into n,e from jsonb_array_elements(payload->'events')where value->>'clientRowId'=s->>'eventClientRowId';
   if n<>1 or e->>'eventKind'not in('main','consolation')or e#>>array['qPools',(slot-1)::text,'poolTypeCode']is distinct from'Graduated (1-in-'||ratio::text||')'then raise exception'custom_q_rejected:invalid_intent';end if;
  end loop;
  for e in select value from jsonb_array_elements(payload->'events')loop
   for p,slot in select value,ordinality::integer from jsonb_array_elements(e->'qPools')with ordinality loop
    if app.custom_payout_classification_text_v2(p->>'poolTypeCode')~*'^Graduated\s*\(1-in-'and app.custom_payout_classification_text_v2(p->>'poolTypeCode')not in('Graduated (1-in-4)','Graduated (1-in-6)','Graduated (1-in-8)','Graduated (1-in-10)')and not((e->>'clientRowId')||':'||slot::text=any(seen))then raise exception'custom_q_rejected:missing_intent';end if;
   end loop;
  end loop;
  linked:=public.save_linked_tournament_setup_v1(p_tournament_id,jsonb_build_object('kind','setup-event-links-v1','request',req,'choices',p_envelope->'choices'));
  if linked->>'status'is distinct from'linked_setup_saved'then raise exception'custom_q_rejected:%',coalesce(linked->>'code','core_unavailable');end if;
  select*into rev from app.tournament_setup_revisions where tournament_id=p_tournament_id and id=(linked#>>'{result,revisionId}')::uuid;
  select*into rec from app.operation_receipts where id=rev.operation_receipt_id;
  if rev.id is null or rev.version<>expected+1 or rev.actor_profile_id is distinct from a or rec.actor_profile_id is distinct from a or rec.client_operation_id is distinct from op or rec.tournament_id is distinct from p_tournament_id or rec.outcome is distinct from'accepted'or rec.operation_type is distinct from'save_tournament_setup_version'then raise exception'custom_q_rejected:core_unavailable';end if;
  insert into app.setup_custom_payout_batches_v2(tournament_id,setup_revision_id,base_setup_revision_id,base_setup_version,base_source_digest,actor_id,operation_id,core_receipt_id,request_payload,request_hash)
   values(p_tournament_id,rev.id,(base->>'setupRevisionId')::uuid,expected,base->>'sourceDigest',a,op,rec.id,p_envelope,h)returning id into batch_id;
  for i in select value from jsonb_array_elements(intents)loop
   s:=i->'source';select id into event_id from app.tournament_setup_event_versions where tournament_id=p_tournament_id and setup_revision_id=rev.id and client_row_id=(s->>'eventClientRowId')::uuid and event_kind in('main','consolation');
   if event_id is null or not exists(select 1 from app.tournament_setup_q_pool_versions q where q.tournament_id=p_tournament_id and q.setup_revision_id=rev.id and q.setup_event_version_id=event_id and q.slot=(s->>'poolSlot')::smallint and q.pool_type_code='Graduated (1-in-'||(i->>'ratioDenominator')||')')then raise exception'custom_q_rejected:core_unavailable';end if;
   insert into app.setup_custom_payout_intents_v2(batch_id,tournament_id,setup_revision_id,setup_event_version_id,scope,pool_slot,ratio_denominator,amount_method,original_intent)
   values(batch_id,p_tournament_id,rev.id,event_id,'q',(s->>'poolSlot')::smallint,(i->>'ratioDenominator')::integer,'graduated-custom-ratio-largest-remainder-5usd-v3',i);
  end loop;
  response:=jsonb_build_object('status','custom_q_setup_draft_saved','scope','draft-q-only','batchId',batch_id,'fullRequestHash',h,'envelope',p_envelope,'linked',linked,'operatingPolicyPublished',false,'moneyMoved',false);
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
create function app.reconcile_custom_q_setup_draft_v2(p_tournament_id uuid,p_envelope jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();op uuid;h text;prior app.setup_custom_q_save_reservations_v2%rowtype;response jsonb;
begin
 if a is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 if jsonb_typeof(p_envelope)is distinct from'object'or coalesce(p_envelope#>>'{request,idempotencyKey}','')!~'^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'then return null;end if;
 op:=(p_envelope#>>'{request,idempotencyKey}')::uuid;
 perform 1 from app.tournaments where id=p_tournament_id for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director')order by role for key share nowait;
 if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('setup-custom-payouts-v2',a,p_tournament_id,op,p_envelope)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.setup_custom_q_save_reservations_v2 where actor_id=a and operation_id=op;
 if not found then return null;end if;
 if prior.tournament_id is distinct from p_tournament_id or prior.request_hash is distinct from h or prior.request_payload is distinct from p_envelope then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 select response_payload into response from app.setup_custom_q_save_outcomes_v2 where actor_id=a and operation_id=op;
 -- Unknown or incomplete evidence never becomes a rejected/successful outcome
 -- and cannot authorize client recovery cleanup.
 return response;
exception when lock_not_available then return null;
end$$;
alter function app.guard_custom_q_setup_intent_carry_v2()owner to postgres;
alter function app.custom_payout_classification_text_v2(text)owner to postgres;
alter function app.get_custom_q_setup_base_v2(uuid)owner to postgres;
alter function app.save_custom_q_setup_draft_v2(uuid,jsonb)owner to postgres;
alter function app.reconcile_custom_q_setup_draft_v2(uuid,jsonb)owner to postgres;
revoke all on function app.get_custom_q_setup_base_v2(uuid)from public,anon,authenticated,service_role;
revoke all on function app.save_custom_q_setup_draft_v2(uuid,jsonb)from public,anon,authenticated,service_role;
revoke all on function app.reconcile_custom_q_setup_draft_v2(uuid,jsonb)from public,anon,authenticated,service_role;
-- NO EXECUTE GRANTS. Requires independent static review and disposable real
-- PostgreSQL rollback/replay/race/ACL tests before even a local migration plan.
commit;
