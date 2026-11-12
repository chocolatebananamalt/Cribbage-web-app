-- LOCAL ONLY. Explicit new fee intent; old rows remain unknown (NULL).
-- No historical update, backfill or human privilege. One service-only read probe.
begin;
alter table app.tournament_setup_event_versions add column free_entry boolean;

-- Owner-approved app input floor, not an ACC sanctioning or entry-fee rule.
create function app.setup_paid_fee_minimum_v1(p_kind text)returns integer
language sql immutable set search_path=''as $$select case when p_kind='main'then 300 else 100 end;$$;
revoke all on function app.setup_paid_fee_minimum_v1(text)from public,anon,authenticated,service_role;

create function app.valid_setup_fee_intent_v1(e jsonb)returns boolean
language plpgsql immutable set search_path=''as $$
declare fee numeric;begin
 if jsonb_typeof(e->'entryFeeCents')is distinct from'number'
  or e->>'entryFeeCents'!~'^(0|[1-9][0-9]*)$'
  or(e?'freeEntry'and jsonb_typeof(e->'freeEntry')is distinct from'boolean')then return false;end if;
 fee:=(e->>'entryFeeCents')::numeric;
 return fee<=100000000 and(case when e->'freeEntry'='true'::jsonb then fee=0
  else fee>=app.setup_paid_fee_minimum_v1(e->>'eventKind')end);
exception when others then return false;end$$;
revoke all on function app.valid_setup_fee_intent_v1(jsonb)from public,anon,authenticated,service_role;

-- Only exact carry-forward rows from accepted replacement/amendment operations
-- may preserve an earlier fee/unknown marker. Ordinary draft saves never qualify.
create function app.setup_fee_clone_source_v1(e app.tournament_setup_event_versions)returns uuid
language sql stable security definer set search_path=''as $$
 select old.id from app.tournament_setup_revisions rev
 join app.operation_receipts receipt on receipt.id=rev.operation_receipt_id and receipt.tournament_id=rev.tournament_id
 join app.tournament_setup_revisions prior on prior.tournament_id=rev.tournament_id and prior.version=rev.version-1
 join app.tournament_setup_event_versions old on old.setup_revision_id=prior.id and old.client_row_id=e.client_row_id
 where rev.id=e.setup_revision_id and rev.tournament_id=e.tournament_id and receipt.outcome='accepted'
  and ((receipt.operation_type='change_event_lifecycle_v1'and receipt.response_payload->>'replacementSetupRevisionId'=rev.id::text)
   or(receipt.operation_type='append_tournament_setup_events_v1'and receipt.response_payload->>'setupRevisionId'=rev.id::text))
  and (to_jsonb(old)-array['id','setup_revision_id','free_entry'])=(to_jsonb(e)-array['id','setup_revision_id','free_entry'])
 limit 1;
$$;
revoke all on function app.setup_fee_clone_source_v1(app.tournament_setup_event_versions)from public,anon,authenticated,service_role;

create function app.guard_setup_fee_intent_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare source_id uuid;event_row app.tournament_setup_event_versions%rowtype;begin
 if tg_table_name='event_side_pool_definition_versions'then
  -- Retirement preserves an existing fee as history; it cannot create an
  -- enabled pool or change its amount, name or category.
  if not new.active and exists(select 1 from app.event_side_pool_definition_versions prior_definition
   join app.operation_receipts r on r.id=new.operation_receipt_id and r.tournament_id=new.tournament_id
   where prior_definition.pool_id=new.pool_id and prior_definition.tournament_id=new.tournament_id and prior_definition.event_id=new.event_id
    and prior_definition.version=new.version-1 and prior_definition.category_code=new.category_code and prior_definition.display_name=new.display_name
    and prior_definition.entry_fee_minor=new.entry_fee_minor and r.target_id=new.pool_id and r.response_payload->>'poolId'=new.pool_id::text and r.response_payload->>'eventId'=new.event_id::text and r.response_payload->>'version'=new.version::text and r.operation_type='retire_event_side_pool_v1'and r.outcome='accepted')then return new;end if;
  if new.entry_fee_minor<500 or mod(new.entry_fee_minor,500)<>0 then raise exception 'invalid side pools';end if;
 elsif tg_table_name='tournament_setup_event_versions'then
  source_id:=app.setup_fee_clone_source_v1(new);
  if source_id is not null then
   select free_entry into new.free_entry from app.tournament_setup_event_versions where id=source_id;
   return new;
  end if;
  if not app.valid_setup_fee_intent_v1(jsonb_build_object('eventKind',new.event_kind,'entryFeeCents',new.entry_fee_cents,'freeEntry',coalesce(new.free_entry,false)))then
   raise exception 'invalid setup event';end if;
 else
  select *into event_row from app.tournament_setup_event_versions where id=new.setup_event_version_id and tournament_id=new.tournament_id;
  source_id:=app.setup_fee_clone_source_v1(event_row);
  if source_id is not null then
   if tg_table_name='tournament_setup_q_pool_versions'and exists(select 1 from app.tournament_setup_q_pool_versions p where p.setup_event_version_id=source_id and p.slot=new.slot and p.pool_type_code=new.pool_type_code and p.entry_fee_cents=new.entry_fee_cents and p.note=new.note and p.source_status=new.source_status)then return new;end if;
   if tg_table_name='tournament_setup_side_pool_versions'and exists(select 1 from app.tournament_setup_side_pool_versions p where p.setup_event_version_id=source_id and p.slot=new.slot and p.pool_type_code=new.pool_type_code and p.entry_fee_cents=new.entry_fee_cents and p.note=new.note and p.source_status=new.source_status)then return new;end if;
  end if;
  if new.entry_fee_cents<500 or mod(new.entry_fee_cents,500)<>0 then
   if tg_table_name='tournament_setup_q_pool_versions'then raise exception 'invalid setup q pool';else raise exception 'invalid side pools';end if;
  end if;
 end if;
 return new;
end$$;
revoke all on function app.guard_setup_fee_intent_v1()from public,anon,authenticated,service_role;
create trigger setup_event_fee_intent_v1 before insert on app.tournament_setup_event_versions for each row execute function app.guard_setup_fee_intent_v1();
create trigger setup_q_fee_intent_v1 before insert on app.tournament_setup_q_pool_versions for each row execute function app.guard_setup_fee_intent_v1();
create trigger setup_side_fee_intent_v1 before insert on app.tournament_setup_side_pool_versions for each row execute function app.guard_setup_fee_intent_v1();
create trigger operational_side_fee_intent_v1 before insert on app.event_side_pool_definition_versions for each row execute function app.guard_setup_fee_intent_v1();

-- Keep freeEntry in the original hashed request. Accepted historical retries
-- return before the new event/pool validation, exactly as before.
do $patch$
declare d text;p text;a text;signature text;begin
 foreach signature in array array[
  'public.save_tournament_setup_version_legacy(uuid,integer,jsonb,uuid)',
  'public.append_tournament_setup_events_v1(uuid,uuid,uuid,integer,jsonb,uuid)'
 ]loop
  d:=pg_get_functiondef(signature::regprocedure);
  a:='''gameCount'',''entryFeeCents'',''feeIncludesNote'',''payoutNote'',''qualificationNote'',''eligibilityNote'',''mugginsStatus'',''qPools'''||chr(10)||'      ]);';
  if position(a in d)=0 then raise exception 'Reviewed fee allowed-keys anchor changed: %',signature;end if;
  p:=replace(d,a,'''gameCount'',''entryFeeCents'',''feeIncludesNote'',''payoutNote'',''qualificationNote'',''eligibilityNote'',''mugginsStatus'',''qPools'',''freeEntry'''||chr(10)||'      ]);');
  a:='or jsonb_typeof(v_event->''entryFeeCents'') <> ''number''';
  if position(a in p)=0 then raise exception 'Reviewed fee validation anchor changed';end if;
  p:=replace(p,a,a||' or app.valid_setup_fee_intent_v1(v_event) is distinct from true');
  a:='or (v_pool->>''entryFeeCents'')::numeric > 100000000';
  if position(a in p)=0 then raise exception 'Reviewed Q fee validation anchor changed';end if;
  p:=replace(p,a,a||' or (v_pool->>''entryFeeCents'')::numeric < 500 or mod((v_pool->>''entryFeeCents'')::numeric,500)<>0');
  if signature like '%_legacy(%'then
   a:='payout_note,qualification_note,eligibility_note,muggins_status)'||chr(10)||'      values(v_event_id';
   if position(a in p)=0 then raise exception 'Reviewed save fee column anchor changed';end if;
   p:=replace(p,a,'payout_note,qualification_note,eligibility_note,muggins_status,free_entry)'||chr(10)||'      values(v_event_id');
   a:='v_event->>''eligibilityNote'',v_event->>''mugginsStatus'');';
   if position(a in p)=0 then raise exception 'Reviewed save fee value anchor changed';end if;
   p:=replace(p,a,'v_event->>''eligibilityNote'',v_event->>''mugginsStatus'',coalesce((v_event->>''freeEntry'')::boolean,false));');
  else
   a:='eligibility_note,muggins_status'||chr(10)||'      ) values (';
   if position(a in p)=0 then raise exception 'Reviewed append fee column anchor changed';end if;
   p:=replace(p,a,'eligibility_note,muggins_status,free_entry'||chr(10)||'      ) values (');
   a:='v_event->>''eligibilityNote'',v_event->>''mugginsStatus'''||chr(10)||'      );';
   if position(a in p)=0 then raise exception 'Reviewed append fee value anchor changed';end if;
   p:=replace(p,a,'v_event->>''eligibilityNote'',v_event->>''mugginsStatus'',coalesce((v_event->>''freeEntry'')::boolean,false)'||chr(10)||'      );');
  end if;
  execute p;
 end loop;
end $patch$;

-- Read-only replay preflight for the service-owned amendment API. A true result
-- is not authorization to alter the request: the writer still checks its hash.
create function public.has_accepted_setup_amendment_operation_v1(
 p_actor_id uuid,p_tournament_id uuid,p_operation_type text,p_operation_id uuid
)returns boolean language sql stable security definer set search_path=''as $$
 select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')='service_role'
  and p_actor_id is not null and p_tournament_id is not null and p_operation_id is not null
  and p_operation_type='append_tournament_setup_events_v1'
  and exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))
  and exists(select 1 from app.operation_receipts r where r.actor_profile_id=p_actor_id and r.tournament_id=p_tournament_id
   and r.client_operation_id=p_operation_id and r.operation_type=p_operation_type and r.outcome='accepted'
   and r.response_payload->>'status'='tournament_setup_amended'and r.target_id::text=r.response_payload->>'amendmentId');
$$;
revoke all on function public.has_accepted_setup_amendment_operation_v1(uuid,uuid,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.has_accepted_setup_amendment_operation_v1(uuid,uuid,text,uuid)to service_role;

-- Existing accepted operational Side requests return before this new check.
do $patch$
declare d text;a text;begin
 d:=pg_get_functiondef('public.add_event_side_pool_v1(uuid,uuid,uuid,uuid,text,text,integer,uuid)'::regprocedure);
 a:='if not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id) then';
 if position(a in d)=0 then raise exception 'Reviewed operational Side fee anchor changed';end if;
 execute replace(d,a,'if p_entry_fee_minor is null or p_entry_fee_minor<500 or mod(p_entry_fee_minor,500)<>0 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if; '||a);
end $patch$;

-- New Side definitions use the same positive $5-unit fee rule. Preserve the
-- existing immutable-configuration recovery branch before checking new fees.
do $patch$
declare d text;a text;begin
 d:=pg_get_functiondef('public.configure_tournament_setup_side_pools_v1(uuid,uuid,uuid,jsonb)'::regprocedure);
 a:='v_receipt:=v_revision.operation_receipt_id;';
 if position(a in d)=0 then raise exception 'Reviewed Side new-fee anchor changed';end if;
 execute replace(d,a,'if exists(select 1 from jsonb_array_elements(p_events)e cross join lateral jsonb_array_elements(e->''sidePools'')p where (p->>''entryFeeCents'')::numeric<500 or mod((p->>''entryFeeCents'')::numeric,500)<>0)then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_side_pool'');end if; '||a);
end $patch$;

-- Existing OID and ACL stay; each latest event receives only its new marker.
do $patch$
declare d text;a text;begin
 d:=pg_get_functiondef('public.get_tournament_setup_workspace(uuid)'::regprocedure);
 a:='return jsonb_set(v_base,''{current}'',v_current||jsonb_build_object(';
 if position(a in d)=0 then raise exception 'Reviewed fee workspace anchor changed';end if;
 execute replace(d,a,'v_current:=jsonb_set(v_current,''{events}'',(select coalesce(jsonb_agg(case when s.free_entry is null then e else e||jsonb_build_object(''freeEntry'',s.free_entry)end order by n),''[]''::jsonb)from jsonb_array_elements(v_current->''events'')with ordinality x(e,n)join app.tournament_setup_event_versions s on s.setup_revision_id=(v_current->>''revisionId'')::uuid and s.tournament_id=p_tournament_id and s.client_row_id=(e->>''clientRowId'')::uuid),false); '||a);
end $patch$;
notify pgrst,'reload schema';
commit;

