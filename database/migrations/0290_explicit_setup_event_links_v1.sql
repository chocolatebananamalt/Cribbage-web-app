-- LOCAL CANDIDATE. No historical row shape is changed. Not a hosted migration.
begin;

create table app.setup_event_link_save_reservations_v1(
 actor_id uuid not null references app.profiles(id), operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id), expected_version integer not null check(expected_version>=0),
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'), request_payload jsonb not null,
 created_at timestamptz not null default clock_timestamp(), primary key(actor_id,operation_id)
);
create table app.setup_event_link_core_calls_v1(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null references app.tournaments(id),
 expected_version integer not null,core_hash text not null check(core_hash~'^[a-f0-9]{64}$'),
 primary key(actor_id,operation_id),foreign key(actor_id,operation_id)references app.setup_event_link_save_reservations_v1(actor_id,operation_id)
);
create table app.setup_event_link_versions_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id),
 setup_revision_id uuid not null,setup_version integer not null check(setup_version>0),
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 association_hash text not null check(association_hash~'^[a-f0-9]{64}$'),choices jsonb not null check(jsonb_typeof(choices)='array'),
 complete boolean not null,save_response jsonb not null,created_at timestamptz not null default clock_timestamp(),
 unique(setup_revision_id),unique(id,tournament_id,setup_revision_id),unique(actor_id,operation_id),
 foreign key(setup_revision_id,tournament_id)references app.tournament_setup_revisions(id,tournament_id),
 foreign key(actor_id,operation_id)references app.setup_event_link_save_reservations_v1(actor_id,operation_id)
);
create table app.setup_event_link_edges_v1(
 link_version_id uuid not null,tournament_id uuid not null,setup_revision_id uuid not null,
 main_setup_event_version_id uuid not null,consolation_setup_event_version_id uuid not null,
 primary key(link_version_id,consolation_setup_event_version_id),
 foreign key(link_version_id,tournament_id,setup_revision_id)references app.setup_event_link_versions_v1(id,tournament_id,setup_revision_id),
 foreign key(main_setup_event_version_id,tournament_id,setup_revision_id)references app.tournament_setup_event_versions(id,tournament_id,setup_revision_id),
 foreign key(consolation_setup_event_version_id,tournament_id,setup_revision_id)references app.tournament_setup_event_versions(id,tournament_id,setup_revision_id),
 check(main_setup_event_version_id<>consolation_setup_event_version_id)
);
do $$declare n text;begin
 foreach n in array array['setup_event_link_save_reservations_v1','setup_event_link_core_calls_v1','setup_event_link_versions_v1','setup_event_link_edges_v1']loop
  execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end$$;
create index setup_event_link_versions_tournament_v1 on app.setup_event_link_versions_v1(tournament_id,setup_version);

create function app.valid_setup_event_links_v1(events jsonb,choices jsonb)returns boolean
language plpgsql immutable set search_path=''as $$
declare e jsonb;c jsonb;k text;child jsonb;ids uuid[]:='{}';mains uuid[]:='{}';children uuid[]:='{}';mid uuid;cid uuid;
begin
 if jsonb_typeof(events)is distinct from'array' or jsonb_array_length(events)>32 or jsonb_typeof(choices)is distinct from'array' or jsonb_array_length(choices)>32 then return false;end if;
 for e in select value from jsonb_array_elements(events)loop
  mid:=app.parse_setup_uuid(e->>'clientRowId');if mid is null or mid=any(ids)or coalesce(e->>'eventKind','')not in('main','consolation','satellite','custom')then return false;end if;ids:=array_append(ids,mid);
 end loop;
 for c in select value from jsonb_array_elements(choices)loop
  if jsonb_typeof(c)is distinct from'object' or not(c?&array['mainClientRowId','consolationClientRowIds'])or exists(select 1 from jsonb_object_keys(c)x where x<>all(array['mainClientRowId','consolationClientRowIds']))or jsonb_typeof(c->'mainClientRowId')is distinct from'string' or jsonb_typeof(c->'consolationClientRowIds')is distinct from'array' or jsonb_array_length(c->'consolationClientRowIds')>32 then return false;end if;
  mid:=app.parse_setup_uuid(c->>'mainClientRowId');if mid is null or mid=any(mains)or not exists(select 1 from jsonb_array_elements(events)x where app.parse_setup_uuid(x->>'clientRowId')=mid and x->>'eventKind'='main')then return false;end if;mains:=array_append(mains,mid);
  for child in select value from jsonb_array_elements(c->'consolationClientRowIds')loop
   if jsonb_typeof(child)is distinct from'string'then return false;end if;cid:=app.parse_setup_uuid(child#>>'{}');
   if cid is null or cid=any(children)or not exists(select 1 from jsonb_array_elements(events)x where app.parse_setup_uuid(x->>'clientRowId')=cid and x->>'eventKind'='consolation')then return false;end if;children:=array_append(children,cid);
  end loop;
 end loop;return true;
exception when others then return false;
end$$;
create function app.complete_setup_event_links_v1(events jsonb,choices jsonb)returns boolean
language sql immutable set search_path=''as $$
 select app.valid_setup_event_links_v1(events,choices)
 and not exists(select 1 from jsonb_array_elements(events)e where e->>'eventKind'='main'and not exists(select 1 from jsonb_array_elements(choices)c where lower(c->>'mainClientRowId')=lower(e->>'clientRowId')))
 and not exists(select 1 from jsonb_array_elements(events)e where e->>'eventKind'='consolation'and not exists(select 1 from jsonb_array_elements(choices)c cross join lateral jsonb_array_elements_text(c->'consolationClientRowIds')child where lower(child)=lower(e->>'clientRowId')))
$$;
revoke all on function app.valid_setup_event_links_v1(jsonb,jsonb),app.complete_setup_event_links_v1(jsonb,jsonb)from public,anon,authenticated,service_role;

-- Clone INSTALLED bodies, including all fee/free-entry fixes, not old source text.
do $$declare d text;preserved text;relaxed text;anchor text:=$a$    if (select count(*) from jsonb_array_elements(p_payload->'events') e where e->>'eventKind' = 'main') > 1
       or (select count(*) from jsonb_array_elements(p_payload->'events') e where e->>'eventKind' = 'consolation') > 1 then
      raise exception using errcode = 'P0001', message = 'invalid setup event';
    end if;$a$;
begin
 anchor:=replace(anchor,E'\r\n',E'\n');
 d:=replace(pg_get_functiondef('public.save_tournament_setup_version_legacy(uuid,integer,jsonb,uuid)'::regprocedure),E'\r\n',E'\n');
 preserved:=replace(d,'FUNCTION public.save_tournament_setup_version_legacy(','FUNCTION app.save_setup_core_preserved_v1(');if preserved=d then raise exception'Legacy setup clone anchor changed';end if;execute preserved;
 if position(anchor in d)=0 then raise exception'Legacy cardinality anchor changed';end if;
 relaxed:=replace(replace(d,anchor,''),'FUNCTION public.save_tournament_setup_version_legacy(','FUNCTION app.save_linked_setup_core_v1(');execute relaxed;
end$$;
revoke all on function app.save_setup_core_preserved_v1(uuid,integer,jsonb,uuid),app.save_linked_setup_core_v1(uuid,integer,jsonb,uuid)from public,anon,authenticated,service_role;

create or replace function public.save_tournament_setup_version_legacy(p_tournament_id uuid,p_expected_version integer,p_payload jsonb,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();r app.setup_event_link_save_reservations_v1%rowtype;b app.setup_event_link_core_calls_v1%rowtype;h text;prior app.operation_receipts%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a::text||':'||p_idempotency_key::text,0));
 h:=encode(extensions.digest(convert_to(jsonb_build_array('save_tournament_setup_version',p_tournament_id::text,p_expected_version,p_payload,p_idempotency_key::text)::text,'utf8'),'sha256'),'hex');
 select*into r from app.setup_event_link_save_reservations_v1 where actor_id=a and operation_id=p_idempotency_key;
 if found then
  if r.tournament_id is distinct from p_tournament_id or r.expected_version is distinct from p_expected_version then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select*into b from app.setup_event_link_core_calls_v1 where actor_id=a and operation_id=p_idempotency_key;
  if found then
   if b.tournament_id is distinct from p_tournament_id or b.expected_version is distinct from p_expected_version or b.core_hash is distinct from h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  else insert into app.setup_event_link_core_calls_v1(actor_id,operation_id,tournament_id,expected_version,core_hash)values(a,p_idempotency_key,p_tournament_id,p_expected_version,h);end if;
  return app.save_linked_setup_core_v1(p_tournament_id,p_expected_version,p_payload,p_idempotency_key);
 end if;
 -- Preserve old accepted AND rejected exact replays, but never downgrade a new head.
 select*into prior from app.operation_receipts where actor_profile_id=a and client_operation_id=p_idempotency_key;
 if found and prior.tournament_id=p_tournament_id and prior.operation_type='save_tournament_setup_version'and prior.request_hash=h then return app.save_setup_core_preserved_v1(p_tournament_id,p_expected_version,p_payload,p_idempotency_key);end if;
 if exists(select 1 from app.setup_event_link_versions_v1 where tournament_id=p_tournament_id)then return jsonb_build_object('status','rejected','code','linked_setup_protocol_required');end if;
 return app.save_setup_core_preserved_v1(p_tournament_id,p_expected_version,p_payload,p_idempotency_key);
end$$;

create function app.guard_legacy_setup_kind_count_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare r app.tournament_setup_revisions%rowtype;o app.operation_receipts%rowtype;
begin
 if new.event_kind not in('main','consolation')then return new;end if;
 select*into r from app.tournament_setup_revisions where id=new.setup_revision_id and tournament_id=new.tournament_id;
 select*into o from app.operation_receipts where id=r.operation_receipt_id and tournament_id=r.tournament_id;
 if exists(select 1 from app.setup_event_link_save_reservations_v1 b join app.setup_event_link_core_calls_v1 c using(actor_id,operation_id)where b.actor_id=r.actor_profile_id and b.operation_id=o.client_operation_id and b.tournament_id=r.tournament_id and b.expected_version=r.version-1 and c.core_hash=o.request_hash)then return new;end if;
 if exists(select 1 from app.tournament_setup_event_versions e where e.setup_revision_id=new.setup_revision_id and e.event_kind=new.event_kind)then raise exception'Legacy setup kind count requires linked protocol';end if;
 return new;
end$$;
revoke all on function app.guard_legacy_setup_kind_count_v1()from public,anon,authenticated,service_role;
create trigger a0_legacy_setup_kind_count_v1 before insert on app.tournament_setup_event_versions for each row execute function app.guard_legacy_setup_kind_count_v1();
drop index app.tournament_setup_event_versions_one_main_idx;
drop index app.tournament_setup_event_versions_one_consolation_idx;
create index tournament_setup_event_versions_kind_v1 on app.tournament_setup_event_versions(setup_revision_id,event_kind);

-- Authenticated atomic wrapper uses owner-private copies, never a service-role claim.
do $$declare x record;d text;c text;begin
 for x in select*from(values
 ('public.bind_side_pool_setup_request_v1(uuid,uuid,uuid,text,jsonb)','public.bind_side_pool_setup_request_v1','app.linked_setup_bind_sides_v1','uuid,uuid,uuid,text,jsonb'),
 ('public.configure_tournament_setup_side_pools_before_type_v1(uuid,uuid,uuid,jsonb)','public.configure_tournament_setup_side_pools_before_type_v1','app.linked_setup_configure_sides_base_v1','uuid,uuid,uuid,jsonb'),
 ('public.configure_tournament_setup_side_pools_v1(uuid,uuid,uuid,jsonb)','public.configure_tournament_setup_side_pools_v1','app.linked_setup_configure_sides_v1','uuid,uuid,uuid,jsonb'),
 ('public.configure_tournament_public_contact_from_setup_v1(uuid,uuid,uuid,text)','public.configure_tournament_public_contact_from_setup_v1','app.linked_setup_configure_contact_v1','uuid,uuid,uuid,text')
 )v(signature,old_name,new_name,args)loop
  d:=pg_get_functiondef(x.signature::regprocedure);c:=replace(d,'FUNCTION '||x.old_name||'(','FUNCTION '||x.new_name||'(');
  if c=d then raise exception'Private helper header anchor changed';end if;
  d:=regexp_replace(c,$rx$coalesce\(auth\.role\(\),\s*''\)\s*<>\s*'service_role'$rx$,'(auth.uid() is null or p_actor_id is distinct from auth.uid())','g');
  if d=c then raise exception'Private helper actor guard anchor changed';end if;
  d:=replace(d,'public.configure_tournament_setup_side_pools_before_type_v1(','app.linked_setup_configure_sides_base_v1(');
  execute d;execute'revoke all on function '||x.new_name||'('||x.args||')from public,anon,authenticated,service_role';
 end loop;
end$$;

create function public.get_setup_event_links_v1(p_tournament_id uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare r uuid;v app.setup_event_link_versions_v1%rowtype;
begin
 if auth.uid()is null or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=auth.uid()and role in('director','co_director'))then return null;end if;
 select id into r from app.tournament_setup_revisions where tournament_id=p_tournament_id order by version desc limit 1;
 select*into v from app.setup_event_link_versions_v1 where tournament_id=p_tournament_id and setup_revision_id=r;
 return jsonb_build_object('available',true,'protocol','setup-event-links-v1','current',case when v.id is null then null else v.save_response->'links'end);
end$$;
revoke all on function public.get_setup_event_links_v1(uuid)from public,anon,service_role;
grant execute on function public.get_setup_event_links_v1(uuid)to authenticated;

create function public.save_linked_tournament_setup_v1(p_tournament_id uuid,p_envelope jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare a uuid:=auth.uid();req jsonb;payload jsonb;choices jsonb;op uuid;expected integer;h text;prior app.operation_receipts%rowtype;old app.setup_event_link_versions_v1%rowtype;
 core jsonb;result jsonb;stage jsonb;rev app.tournament_setup_revisions%rowtype;call app.setup_event_link_core_calls_v1%rowtype;rec app.operation_receipts%rowtype;
 sid uuid:=extensions.gen_random_uuid();ah text;complete boolean;snapshot jsonb;response jsonb;code text;
begin
 if a is null then return jsonb_build_object('status','rejected','code','authentication_required');end if;
 if jsonb_typeof(p_envelope)is distinct from'object'or not(p_envelope?&array['kind','request','choices'])or exists(select 1 from jsonb_object_keys(p_envelope)k where k<>all(array['kind','request','choices']))or p_envelope->>'kind'is distinct from'setup-event-links-v1'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 req:=p_envelope->'request';payload:=req->'payload';choices:=p_envelope->'choices';
 if jsonb_typeof(req)is distinct from'object'or not(req?&array['expectedVersion','payload','idempotencyKey'])or exists(select 1 from jsonb_object_keys(req)k where k<>all(array['expectedVersion','payload','idempotencyKey']))or jsonb_typeof(req->'expectedVersion')is distinct from'number'or jsonb_typeof(req->'idempotencyKey')is distinct from'string'or jsonb_typeof(payload)is distinct from'object'or coalesce(req->>'expectedVersion','')!~'^(0|[1-9][0-9]*)$'or not app.valid_setup_event_links_v1(payload->'events',choices)then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 begin op:=app.parse_setup_uuid(req->>'idempotencyKey');expected:=(req->>'expectedVersion')::integer;exception when others then return jsonb_build_object('status','rejected','code','invalid_request');end;
 if op is null or expected<0 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a::text||':'||op::text,0));
 perform 1 from app.tournaments where id=p_tournament_id for update;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director'))then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('save_linked_tournament_setup_v1',a,p_tournament_id,p_envelope)::text,'utf8'),'sha256'),'hex');
 select*into old from app.setup_event_link_versions_v1 where actor_id=a and operation_id=op;
 if found then
  if old.tournament_id=p_tournament_id and exists(select 1 from app.setup_event_link_save_reservations_v1 where actor_id=a and operation_id=op and request_hash=h)then return old.save_response;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 select*into prior from app.operation_receipts where actor_profile_id=a and client_operation_id=op;
 if found then
  if prior.operation_type='save_linked_tournament_setup_v1'and prior.tournament_id=p_tournament_id and prior.request_hash=h then return prior.response_payload;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 if exists(select 1 from app.tournament_setup_activations where tournament_id=p_tournament_id)or not exists(select 1 from app.tournaments where id=p_tournament_id and status='draft'and registration_status='closed')then return jsonb_build_object('status','rejected','code','setup_lifecycle_closed');end if;
 begin
  -- Do not remove the last Main while dependent event kinds remain. When any
  -- current Main is removed, every remaining Consolation must already be
  -- explicitly assigned in this same revision. Normal partial drafts with an
  -- unchanged Main remain saveable; exact old receipts replay above.
  if coalesce((select max(version)from app.tournament_setup_revisions where tournament_id=p_tournament_id),0)=expected then
   if not exists(select 1 from jsonb_array_elements(payload->'events')e where e->>'eventKind'='main') and exists(select 1 from jsonb_array_elements(payload->'events')e where e->>'eventKind' in('consolation','satellite','custom')) then raise exception'linked_setup_rejected:invalid_event_sequence';end if;
   if exists(select 1 from app.tournament_setup_event_versions old_event where old_event.tournament_id=p_tournament_id and old_event.setup_revision_id=(select id from app.tournament_setup_revisions where tournament_id=p_tournament_id order by version desc limit 1) and old_event.event_kind='main' and not exists(select 1 from jsonb_array_elements(payload->'events')e where e->>'eventKind'='main' and app.parse_setup_uuid(e->>'clientRowId')=old_event.client_row_id))
    and exists(select 1 from jsonb_array_elements(payload->'events')e where e->>'eventKind'='consolation' and not exists(select 1 from jsonb_array_elements(choices)c cross join lateral jsonb_array_elements_text(c->'consolationClientRowIds')child where app.parse_setup_uuid(child)=app.parse_setup_uuid(e->>'clientRowId'))) then raise exception'linked_setup_rejected:dependent_event_removal';end if;
  end if;
  insert into app.setup_event_link_save_reservations_v1(actor_id,operation_id,tournament_id,expected_version,request_hash,request_payload)values(a,op,p_tournament_id,expected,h,p_envelope);
  stage:=app.linked_setup_bind_sides_v1(a,p_tournament_id,op,'setup',req);
  if stage->>'status'is distinct from'bound'then raise exception'linked_setup_rejected:%',coalesce(stage->>'code','operation_unavailable');end if;
  core:=jsonb_set(payload,'{events}',coalesce((select jsonb_agg(e.value-'sidePools'order by e.ordinality)from jsonb_array_elements(payload->'events')with ordinality e(value,ordinality)),'[]'::jsonb));
  result:=public.save_tournament_setup_version(p_tournament_id,expected,core,op);
  if result->>'status'is distinct from'setup_draft_saved'then raise exception'linked_setup_rejected:%',coalesce(result->>'code','operation_unavailable');end if;
  select*into rev from app.tournament_setup_revisions where id=(result->>'revisionId')::uuid and tournament_id=p_tournament_id;
  select*into rec from app.operation_receipts where id=rev.operation_receipt_id;
  select*into call from app.setup_event_link_core_calls_v1 where actor_id=a and operation_id=op;
  if rev.id is null or rev.actor_profile_id is distinct from a or rev.version is distinct from expected+1 or rec.actor_profile_id is distinct from a or rec.client_operation_id is distinct from op or rec.tournament_id is distinct from p_tournament_id or rec.operation_type is distinct from'save_tournament_setup_version'or rec.outcome is distinct from'accepted'or call.actor_id is null or call.tournament_id is distinct from p_tournament_id or call.expected_version is distinct from expected or rec.request_hash is distinct from call.core_hash then raise exception'linked_setup_rejected:operation_unavailable';end if;
  stage:=app.linked_setup_configure_sides_v1(a,p_tournament_id,rev.id,payload->'events');if stage->>'status'is distinct from'setup_side_pools_configured'then raise exception'linked_setup_rejected:%',coalesce(stage->>'code','operation_unavailable');end if;
  stage:=app.linked_setup_configure_contact_v1(a,p_tournament_id,rev.id,payload->>'tournamentDirectorPublicName');if stage->>'status'is distinct from'public_contact_configured'then raise exception'linked_setup_rejected:%',coalesce(stage->>'code','operation_unavailable');end if;
  complete:=app.complete_setup_event_links_v1(payload->'events',choices);
  ah:=encode(extensions.digest(convert_to(jsonb_build_array('setup-event-links-v1',p_tournament_id,rev.id,rev.version,choices,h)::text,'utf8'),'sha256'),'hex');
  snapshot:=jsonb_build_object('protocol','setup-event-links-v1','setupRevisionId',rev.id,'setupVersion',rev.version,'choices',choices,'complete',complete,'associationHash',ah);
  response:=jsonb_build_object('status','linked_setup_saved','result',result,'links',snapshot);
  insert into app.setup_event_link_versions_v1(id,tournament_id,setup_revision_id,setup_version,actor_id,operation_id,association_hash,choices,complete,save_response)values(sid,p_tournament_id,rev.id,rev.version,a,op,ah,choices,complete,response);
  insert into app.setup_event_link_edges_v1(link_version_id,tournament_id,setup_revision_id,main_setup_event_version_id,consolation_setup_event_version_id)
   select sid,p_tournament_id,rev.id,m.id,c.id from jsonb_array_elements(choices)x cross join lateral jsonb_array_elements_text(x->'consolationClientRowIds')child
   join app.tournament_setup_event_versions c on c.setup_revision_id=rev.id and c.tournament_id=p_tournament_id and c.client_row_id=child::uuid and c.event_kind='consolation'
   join app.tournament_setup_event_versions m on m.setup_revision_id=rev.id and m.tournament_id=p_tournament_id and m.client_row_id=(x->>'mainClientRowId')::uuid and m.event_kind='main';
  if (select count(*)from app.setup_event_link_edges_v1 where link_version_id=sid)<>(select coalesce(sum(jsonb_array_length(x->'consolationClientRowIds')),0)from jsonb_array_elements(choices)x)then raise exception'linked_setup_rejected:invalid_links';end if;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,a,rec.id,'setup_event_links',sid,'setup_event_links_saved',snapshot);
  return response;
 exception when raise_exception then
  if sqlerrm not like'linked_setup_rejected:%'then raise;end if;
  code:=split_part(sqlerrm,':',2);
  if code='operation_unavailable'then raise;end if;
  response:=jsonb_build_object('status','rejected','code',code);
 end;
 -- All privileged partial work was rolled back by the subtransaction.
 insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(a,p_tournament_id,'save_linked_tournament_setup_v1',p_tournament_id,h,op,'rejected',response,clock_timestamp());
 return response;
end$$;
revoke all on function public.save_linked_tournament_setup_v1(uuid,jsonb)from public,anon,service_role;
grant execute on function public.save_linked_tournament_setup_v1(uuid,jsonb)to authenticated;

-- Read-only reconciliation proves the complete accepted envelope, including links.
create function public.reconcile_linked_setup_save_v1(p_tournament_id uuid,p_envelope jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare a uuid:=auth.uid();h text;op uuid;answer jsonb;
begin
 if a is null or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=a and role in('director','co_director'))then return null;end if;
 if jsonb_typeof(p_envelope)is distinct from'object'or jsonb_typeof(p_envelope->'request')is distinct from'object'or jsonb_typeof(p_envelope->'request'->'idempotencyKey')is distinct from'string'then return null;end if;
 begin op:=(p_envelope->'request'->>'idempotencyKey')::uuid;exception when invalid_text_representation then return null;end;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('save_linked_tournament_setup_v1',a,p_tournament_id,p_envelope)::text,'utf8'),'sha256'),'hex');
 select v.save_response into answer from app.setup_event_link_versions_v1 v join app.setup_event_link_save_reservations_v1 r using(actor_id,operation_id)
 where v.actor_id=a and v.operation_id=op and v.tournament_id=p_tournament_id and r.tournament_id=p_tournament_id and r.request_hash=h;
 return answer;
end$$;
revoke all on function public.reconcile_linked_setup_save_v1(uuid,jsonb)from public,anon,service_role;
grant execute on function public.reconcile_linked_setup_save_v1(uuid,jsonb)to authenticated;
notify pgrst,'reload schema';
commit;

