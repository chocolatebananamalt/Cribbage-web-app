-- LOCAL CANDIDATE, applied after setup-event-links-v1.sql in disposable tests only.
begin;
create table app.setup_event_link_activation_reservations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null references app.tournaments(id),
 setup_revision_id uuid not null,expected_version integer not null,link_version_id uuid not null,
 association_hash text not null check(association_hash~'^[a-f0-9]{64}$'),request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 request_payload jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(link_version_id,tournament_id,setup_revision_id)references app.setup_event_link_versions_v1(id,tournament_id,setup_revision_id)
);
create table app.setup_event_link_activation_versions_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null references app.tournaments(id),setup_revision_id uuid not null,
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,operation_receipt_id uuid not null,link_version_id uuid not null,
 association_hash text not null,activation_response jsonb not null,created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,setup_revision_id),unique(actor_id,operation_id),unique(id,tournament_id),
 foreign key(link_version_id,tournament_id,setup_revision_id)references app.setup_event_link_versions_v1(id,tournament_id,setup_revision_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 foreign key(actor_id,operation_id)references app.setup_event_link_activation_reservations_v1(actor_id,operation_id)
);
create table app.consolation_main_event_bindings_v1(
 tournament_id uuid not null references app.tournaments(id),consolation_event_id uuid primary key,main_event_id uuid not null,
 activation_link_version_id uuid not null,main_setup_event_version_id uuid not null,consolation_setup_event_version_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),check(main_event_id<>consolation_event_id),
 foreign key(activation_link_version_id,tournament_id)references app.setup_event_link_activation_versions_v1(id,tournament_id),
 foreign key(consolation_event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(main_event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(main_setup_event_version_id)references app.tournament_setup_event_versions(id),
 foreign key(consolation_setup_event_version_id)references app.tournament_setup_event_versions(id)
);
do $$declare n text;begin
 foreach n in array array['setup_event_link_activation_reservations_v1','setup_event_link_activation_versions_v1','consolation_main_event_bindings_v1']loop
  execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
 end loop;
end$$;
create index consolation_main_event_bindings_parent_v1 on app.consolation_main_event_bindings_v1(tournament_id,main_event_id);

do $$declare d text;p text;r text;begin
 d:=pg_get_functiondef('public.activate_tournament_setup_v2_legacy(uuid,uuid,uuid,integer,uuid)'::regprocedure);
 p:=replace(d,'FUNCTION public.activate_tournament_setup_v2_legacy(','FUNCTION app.activate_setup_preserved_v1(');if p=d then raise exception'Activation clone header changed';end if;execute p;
 if position('v_main_count <> 1'in d)=0 then raise exception'Activation cardinality anchor changed';end if;
 r:=replace(replace(d,'v_main_count <> 1','v_main_count < 1'),'FUNCTION public.activate_tournament_setup_v2_legacy(','FUNCTION app.activate_linked_setup_core_v1(');execute r;
end$$;
revoke all on function app.activate_setup_preserved_v1(uuid,uuid,uuid,integer,uuid),app.activate_linked_setup_core_v1(uuid,uuid,uuid,integer,uuid)from public,anon,authenticated,service_role;

create or replace function public.activate_tournament_setup_v2_legacy(p_actor_id uuid,p_tournament_id uuid,p_setup_revision_id uuid,p_expected_version integer,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare v app.setup_event_link_versions_v1%rowtype;r app.setup_event_link_activation_reservations_v1%rowtype;
begin
 select*into v from app.setup_event_link_versions_v1 where tournament_id=p_tournament_id and setup_revision_id=p_setup_revision_id;
 if found then
  select*into r from app.setup_event_link_activation_reservations_v1 where actor_id=p_actor_id and operation_id=p_idempotency_key;
  if not found or r.tournament_id is distinct from p_tournament_id or r.setup_revision_id is distinct from p_setup_revision_id or r.expected_version is distinct from p_expected_version or r.link_version_id is distinct from v.id or r.association_hash is distinct from v.association_hash or not v.complete then return jsonb_build_object('status','rejected','code','association_pin_required');end if;
  return app.activate_linked_setup_core_v1(p_actor_id,p_tournament_id,p_setup_revision_id,p_expected_version,p_idempotency_key);
 end if;
 return app.activate_setup_preserved_v1(p_actor_id,p_tournament_id,p_setup_revision_id,p_expected_version,p_idempotency_key);
end$$;

-- Backstop every legacy/current insertion path. It only verifies its own mapping;
-- complete graph FK rows are inserted by the outer transaction after the loop.
create function app.require_linked_setup_activation_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare v app.setup_event_link_versions_v1%rowtype;r app.setup_event_link_activation_reservations_v1%rowtype;o app.operation_receipts%rowtype;
begin
 select*into v from app.setup_event_link_versions_v1 where tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 if not found then return new;end if;
 select*into o from app.operation_receipts where id=new.operation_receipt_id and tournament_id=new.tournament_id and actor_profile_id=new.actor_profile_id and operation_type='activate_tournament_setup_v2'and outcome='accepted';
 if not found then raise exception'association_pin_required';end if;
 select*into r from app.setup_event_link_activation_reservations_v1 where actor_id=new.actor_profile_id and operation_id=o.client_operation_id;
 if not found or r.tournament_id is distinct from new.tournament_id or r.setup_revision_id is distinct from new.setup_revision_id or r.link_version_id is distinct from v.id or r.association_hash is distinct from v.association_hash or r.expected_version is distinct from v.setup_version or not v.complete then raise exception'association_pin_required';end if;
 return new;
end$$;
revoke all on function app.require_linked_setup_activation_v1()from public,anon,authenticated,service_role;
create trigger aaa_setup_event_links_activation_v1 before insert on app.tournament_setup_activations for each row execute function app.require_linked_setup_activation_v1();

-- Check only a new activation against the exact immutable linked revision.
-- Preserve Main order, each assigned child block's order, then all other rows.
create function app.linked_setup_sequence_valid_v1(tid uuid,rid uuid,lid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 with rows as (
  select e.id,e.ordinal,e.event_kind,m.ordinal as main_ordinal
  from app.tournament_setup_event_versions e
  left join app.setup_event_link_edges_v1 edge on edge.link_version_id=lid and edge.tournament_id=tid and edge.setup_revision_id=rid and edge.consolation_setup_event_version_id=e.id
  left join app.tournament_setup_event_versions m on m.id=edge.main_setup_event_version_id and m.tournament_id=tid and m.setup_revision_id=rid and m.event_kind='main'
  where e.tournament_id=tid and e.setup_revision_id=rid
 )
 select coalesce(bool_and(event_kind<>'consolation' or main_ordinal is not null),false)
  and array_agg(id order by ordinal,id)=array_agg(id order by case when event_kind in('main','consolation')then 0 else 1 end,case when event_kind='main'then ordinal when event_kind='consolation'then main_ordinal else ordinal end,case when event_kind='main'then 0 else 1 end,ordinal,id)
 from rows
$$;
revoke all on function app.linked_setup_sequence_valid_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;
create function public.finalize_linked_tournament_setup_v1(p_actor_id uuid,p_tournament_id uuid,p_envelope jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare req jsonb;op uuid;rid uuid;expected integer;ah text;h text;pins jsonb;v app.setup_event_link_versions_v1%rowtype;prior app.operation_receipts%rowtype;
 old app.setup_event_link_activation_versions_v1%rowtype;result jsonb;response jsonb;rec app.operation_receipts%rowtype;aid uuid:=extensions.gen_random_uuid();needed integer;actual integer;code text;materialized jsonb;team_ids jsonb;enabled jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role'or p_actor_id is null or p_tournament_id is null or jsonb_typeof(p_envelope)is distinct from'object'or not(p_envelope?&array['request','associationHash'])or exists(select 1 from jsonb_object_keys(p_envelope)k where k<>all(array['request','associationHash']))then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 req:=p_envelope->'request';ah:=p_envelope->>'associationHash';
 if jsonb_typeof(req)is distinct from'object'or not(req?&array['setupRevisionId','expectedVersion','confirmed','idempotencyKey'])or exists(select 1 from jsonb_object_keys(req)k where k<>all(array['setupRevisionId','expectedVersion','confirmed','idempotencyKey','declarationPins']))or req->'confirmed'is distinct from'true'::jsonb or jsonb_typeof(req->'expectedVersion')is distinct from'number'or coalesce(req->>'expectedVersion','')!~'^[1-9][0-9]*$'or jsonb_typeof(p_envelope->'associationHash')is distinct from'string'or ah!~'^[a-f0-9]{64}$'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 begin rid:=app.parse_setup_uuid(req->>'setupRevisionId');op:=app.parse_setup_uuid(req->>'idempotencyKey');expected:=(req->>'expectedVersion')::integer;exception when others then return jsonb_build_object('status','rejected','code','invalid_request');end;
 if rid is null or op is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||op::text,0));
 perform 1 from app.tournaments where id=p_tournament_id for update;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director'))then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('finalize_linked_tournament_setup_v1',p_actor_id,p_tournament_id,p_envelope)::text,'utf8'),'sha256'),'hex');
 select*into old from app.setup_event_link_activation_versions_v1 where actor_id=p_actor_id and operation_id=op;
 if found then
  if old.tournament_id=p_tournament_id and exists(select 1 from app.setup_event_link_activation_reservations_v1 r where r.actor_id=p_actor_id and r.operation_id=op and r.request_hash=h)then return old.activation_response;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 select*into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=op;
 if found then
  if prior.operation_type='finalize_linked_tournament_setup_v1'and prior.tournament_id=p_tournament_id and prior.request_hash=h then return prior.response_payload;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 select*into v from app.setup_event_link_versions_v1 where tournament_id=p_tournament_id and setup_revision_id=rid;
 if not found or v.setup_version is distinct from expected or v.association_hash is distinct from ah or not v.complete or rid is distinct from(select id from app.tournament_setup_revisions where tournament_id=p_tournament_id order by version desc limit 1)then return jsonb_build_object('status','rejected','code','association_changed');end if;
 begin
  if not app.linked_setup_sequence_valid_v1(p_tournament_id,rid,v.id)then raise exception'linked_activation_rejected:invalid_event_sequence';end if;
  insert into app.setup_event_link_activation_reservations_v1(actor_id,operation_id,tournament_id,setup_revision_id,expected_version,link_version_id,association_hash,request_hash,request_payload)values(p_actor_id,op,p_tournament_id,rid,expected,v.id,ah,h,p_envelope);
  select count(*)into needed from app.tournament_setup_event_versions where tournament_id=p_tournament_id and setup_revision_id=rid and event_kind in('main','consolation')and entry_fee_cents>0;
  if needed>0 then
   pins:=req->'declarationPins';
   if jsonb_typeof(pins)is distinct from'array'then raise exception'linked_activation_rejected:declaration_pins_required';end if;
   result:=public.finalize_tournament_setup_pinned_v2(p_actor_id,p_tournament_id,rid,expected,true,pins,op);
  else
   if req?'declarationPins'and req->'declarationPins'is distinct from'[]'::jsonb then raise exception'linked_activation_rejected:declaration_pins_changed';end if;
   result:=public.activate_tournament_setup_before_pins_0289(p_actor_id,p_tournament_id,rid,expected,op);
  end if;
  if result->>'status'is distinct from'tournament_setup_activated'then raise exception'linked_activation_rejected:%',coalesce(result->>'code','operation_unavailable');end if;
  select*into rec from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=op and tournament_id=p_tournament_id and operation_type='activate_tournament_setup_v2'and outcome='accepted';
  if rec.id is null or (result->>'setupRevisionId')::uuid is distinct from rid or (result->>'setupVersion')::integer is distinct from expected then raise exception'linked_activation_rejected:operation_unavailable';end if;
  actual:=(select count(*)from app.tournament_setup_activations where tournament_id=p_tournament_id and setup_revision_id=rid and operation_receipt_id=rec.id);
  if actual<>(select count(*)from app.tournament_setup_event_versions where tournament_id=p_tournament_id and setup_revision_id=rid)then raise exception'linked_activation_rejected:operation_unavailable';end if;
  -- These operations belong to the same transaction as activation and its acknowledgment.
  materialized:=public.materialize_tournament_setup_side_pools_v1(p_actor_id,p_tournament_id,rid);
  if materialized->>'status' is distinct from 'setup_side_pools_materialized' then raise exception 'linked_activation_rejected:%',coalesce(materialized->>'code','operation_unavailable');end if;
  select jsonb_agg(e->'eventId' order by ord) into team_ids from jsonb_array_elements(result->'events')with ordinality t(e,ord) where e->>'format' in('doubles','canadian_doubles');
  if team_ids is not null then
   enabled:=public.enable_supported_team_scoring_v1(p_actor_id,p_tournament_id,team_ids,op);
   if enabled->>'status' is distinct from 'supported_team_scoring_enabled' then raise exception 'linked_activation_rejected:%',coalesce(enabled->>'code','operation_unavailable');end if;
   result:=jsonb_set(result,'{events}',(select jsonb_agg(case when e->>'format' in('doubles','canadian_doubles')then e||jsonb_build_object('scoringMethod','digital')else e end order by ord)from jsonb_array_elements(result->'events')with ordinality t(e,ord)));
  end if;
  insert into app.tournament_setup_finalization_confirmations(tournament_id,setup_revision_id,actor_profile_id,activation_receipt_id)values(p_tournament_id,rid,p_actor_id,rec.id)on conflict(tournament_id)do nothing;
  update app.tournaments set registration_status='open'where id=p_tournament_id and status='open';
  result:=result||jsonb_build_object('registrationState','open');response:=jsonb_build_object('status','linked_setup_activated','result',result,'associationHash',ah);
  insert into app.setup_event_link_activation_versions_v1(id,tournament_id,setup_revision_id,actor_id,operation_id,operation_receipt_id,link_version_id,association_hash,activation_response)values(aid,p_tournament_id,rid,p_actor_id,op,rec.id,v.id,ah,response);
  insert into app.consolation_main_event_bindings_v1(tournament_id,consolation_event_id,main_event_id,activation_link_version_id,main_setup_event_version_id,consolation_setup_event_version_id)
   select p_tournament_id,c.event_id,m.event_id,aid,e.main_setup_event_version_id,e.consolation_setup_event_version_id
   from app.setup_event_link_edges_v1 e join app.tournament_setup_activations m on m.tournament_id=e.tournament_id and m.setup_revision_id=e.setup_revision_id and m.setup_event_version_id=e.main_setup_event_version_id
   join app.tournament_setup_activations c on c.tournament_id=e.tournament_id and c.setup_revision_id=e.setup_revision_id and c.setup_event_version_id=e.consolation_setup_event_version_id where e.link_version_id=v.id;
  if (select count(*)from app.consolation_main_event_bindings_v1 where activation_link_version_id=aid)<>(select count(*)from app.setup_event_link_edges_v1 where link_version_id=v.id)then raise exception'linked_activation_rejected:operation_unavailable';end if;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,rec.id,'setup_event_links',aid,'setup_event_links_activated',jsonb_build_object('associationHash',ah,'setupRevisionId',rid));
  return response;
 exception when raise_exception then
  if sqlerrm not like'linked_activation_rejected:%'then raise;end if;code:=split_part(sqlerrm,':',2);if code='operation_unavailable'then raise;end if;
  response:=jsonb_build_object('status','rejected','code',code);
 end;
 insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(p_actor_id,p_tournament_id,'finalize_linked_tournament_setup_v1',p_tournament_id,h,op,'rejected',response,clock_timestamp());return response;
end$$;
revoke all on function public.finalize_linked_tournament_setup_v1(uuid,uuid,jsonb)from public,anon,authenticated;
grant execute on function public.finalize_linked_tournament_setup_v1(uuid,uuid,jsonb)to service_role;

-- A selector, not an eligibility decision. No name/order/other-Main fallback.
create function app.linked_consolation_main_event_v1(tid uuid,eid uuid)returns uuid
language sql stable security definer set search_path=''as $$
 select b.main_event_id from app.consolation_main_event_bindings_v1 b
 join app.events m on m.id=b.main_event_id and m.tournament_id=b.tournament_id and m.event_type='main'and m.operational_state='active'
 join app.events c on c.id=b.consolation_event_id and c.tournament_id=b.tournament_id and c.event_type='consolation'and c.operational_state='active'
 where b.tournament_id=tid and b.consolation_event_id=eid
$$;
revoke all on function app.linked_consolation_main_event_v1(uuid,uuid)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;

