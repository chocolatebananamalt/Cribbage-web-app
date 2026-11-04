-- LOCAL ONLY. Bind each reviewed event declaration to the confirmed activation
-- request. Historical accepted/rejected operation receipts remain replayable.
begin;
create table app.event_prize_activation_pin_reservations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,tournament_id uuid not null references app.tournaments(id),
 setup_revision_id uuid not null,expected_version integer not null,pins jsonb not null check(jsonb_typeof(pins)='array'),request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(setup_revision_id,tournament_id)references app.tournament_setup_revisions(id,tournament_id)
);
alter table app.event_prize_activation_pin_reservations_v1 enable row level security;
alter table app.event_prize_activation_pin_reservations_v1 force row level security;
revoke all on app.event_prize_activation_pin_reservations_v1 from public,anon,authenticated,service_role;
create trigger event_prize_activation_pin_reservations_immutable_v1 before update or delete on app.event_prize_activation_pin_reservations_v1 for each row execute function app.reject_immutable_history();
create index event_prize_activation_pin_reservations_tournament_v1 on app.event_prize_activation_pin_reservations_v1(tournament_id,setup_revision_id);

-- Return NULL for any incomplete, stale or unsupported declaration set.
create function app.current_event_prize_activation_pins_v1(tid uuid,rid uuid,expected integer)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare result jsonb;needed integer;
begin
 if not exists(select 1 from app.tournament_setup_revisions r where r.id=rid and r.tournament_id=tid and r.version=expected and r.id=(select x.id from app.tournament_setup_revisions x where x.tournament_id=tid order by x.version desc limit 1)) then return null;end if;
 select count(*)into needed from app.tournament_setup_event_versions e where e.tournament_id=tid and e.setup_revision_id=rid and e.event_kind in('main','consolation') and e.entry_fee_cents>0;
 if needed<1 or needed>32 then return null;end if;
 if exists(select 1 from app.tournament_setup_event_versions e where e.tournament_id=tid and e.setup_revision_id=rid and e.event_kind in('main','consolation') and e.entry_fee_cents>0 and (not app.event_prize_settings_supported_v2(app.event_prize_settings_v2(tid,e.client_row_id)) or not exists(select 1 from app.setup_prize_schedule_versions_v2 v where v.tournament_id=tid and v.client_row_id=e.client_row_id and v.id=(select latest.id from app.setup_prize_schedule_versions_v2 latest where latest.tournament_id=tid and latest.client_row_id=e.client_row_id order by latest.version desc limit 1) and v.settings_fingerprint=app.event_prize_settings_digest_v2(app.event_prize_settings_v2(tid,e.client_row_id))))) then return null;end if;
 select jsonb_agg(jsonb_build_object('clientRowId',e.client_row_id,'declarationId',v.id,'settingsFingerprint',v.settings_fingerprint)order by e.client_row_id)into result from app.tournament_setup_event_versions e join lateral(select * from app.setup_prize_schedule_versions_v2 d where d.tournament_id=tid and d.client_row_id=e.client_row_id order by d.version desc limit 1)v on true where e.tournament_id=tid and e.setup_revision_id=rid and e.event_kind in('main','consolation') and e.entry_fee_cents>0;
 if jsonb_array_length(result)<>needed then return null;end if;return result;
end$$;
revoke all on function app.current_event_prize_activation_pins_v1(uuid,uuid,integer)from public,anon,authenticated,service_role;

-- Every activation insertion is guarded, including old single-event and
-- amendment APIs. No operation may bind a V2 declaration without its exact
-- reserved request; unimplemented pinned amendments remain safely blocked.
create function app.require_event_prize_activation_pins_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare receipt app.operation_receipts%rowtype;reservation app.event_prize_activation_pin_reservations_v1%rowtype;setup app.tournament_setup_event_versions%rowtype;expected jsonb;
begin
 perform 1 from app.tournaments t where t.id=new.tournament_id for update;
 if not exists(select 1 from app.setup_prize_schedule_versions_v2 where tournament_id=new.tournament_id) then return new;end if;
 select * into receipt from app.operation_receipts where id=new.operation_receipt_id and tournament_id=new.tournament_id and actor_profile_id=new.actor_profile_id and operation_type='activate_tournament_setup_v2' and outcome='accepted';
 if not found then raise exception 'declaration_pins_required';end if;
 select * into reservation from app.event_prize_activation_pin_reservations_v1 where actor_id=new.actor_profile_id and operation_id=receipt.client_operation_id and tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 if not found then raise exception 'declaration_pins_required';end if;
 expected:=app.current_event_prize_activation_pins_v1(new.tournament_id,new.setup_revision_id,reservation.expected_version);
 if expected is null or reservation.pins is distinct from expected then raise exception 'declaration_pins_changed';end if;
 select * into setup from app.tournament_setup_event_versions where id=new.setup_event_version_id and tournament_id=new.tournament_id and setup_revision_id=new.setup_revision_id;
 if not found then raise exception 'declaration_pins_changed';end if;
 if setup.event_kind in('main','consolation') and setup.entry_fee_cents>0 and not exists(select 1 from jsonb_array_elements(expected)p where p->>'clientRowId'=setup.client_row_id::text)then raise exception 'declaration_pins_changed';end if;
 return new;
end$$;
revoke all on function app.require_event_prize_activation_pins_v1()from public,anon,authenticated,service_role;
create trigger aaa_event_prize_activation_pins_v1 before insert on app.tournament_setup_activations for each row execute function app.require_event_prize_activation_pins_v1();

do $$declare d text;c text;begin
 d:=pg_get_functiondef('public.activate_tournament_setup_v2(uuid,uuid,uuid,integer,uuid)'::regprocedure);
 c:=replace(d,'FUNCTION public.activate_tournament_setup_v2(','FUNCTION public.activate_tournament_setup_before_pins_0289(');
 if c=d then raise exception 'activation clone anchor changed';end if;execute c;
end$$;
revoke all on function public.activate_tournament_setup_before_pins_0289(uuid,uuid,uuid,integer,uuid)from public,anon,authenticated,service_role;
-- Historical renamed entry points retained service-role EXECUTE after rename.
-- Their owner can still call them through the guarded wrapper; a service
-- caller must not bypass declaration pins by invoking an older entry point.
revoke all on function public.activate_tournament_setup_v2_legacy(uuid,uuid,uuid,integer,uuid),public.activate_tournament_setup_v2_before_state_territory(uuid,uuid,uuid,integer,uuid),public.activate_tournament_setup_v2_before_optional_contact(uuid,uuid,uuid,integer,uuid)from public,anon,authenticated,service_role;

-- Unpinned entry points may only replay a pre-existing exact core receipt.
create or replace function public.activate_tournament_setup_v2(p_actor_id uuid,p_tournament_id uuid,p_setup_revision_id uuid,p_expected_version integer,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare h text;prior app.operation_receipts%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
 perform 1 from app.tournaments t where t.id=p_tournament_id for update;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('activate_tournament_setup_v2',p_actor_id::text,p_tournament_id::text,p_setup_revision_id::text,p_expected_version)::text,'utf8'),'sha256'),'hex');
 select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
 if found and prior.operation_type='activate_tournament_setup_v2' and prior.tournament_id=p_tournament_id and prior.request_hash=h then return public.activate_tournament_setup_before_pins_0289(p_actor_id,p_tournament_id,p_setup_revision_id,p_expected_version,p_idempotency_key);end if;
 if exists(select 1 from app.setup_prize_schedule_versions_v2 where tournament_id=p_tournament_id)then return jsonb_build_object('status','rejected','code','declaration_pins_required');end if;
 return public.activate_tournament_setup_before_pins_0289(p_actor_id,p_tournament_id,p_setup_revision_id,p_expected_version,p_idempotency_key);
end$$;

create function public.finalize_tournament_setup_pinned_v2(actor uuid,tid uuid,rid uuid,expected integer,confirmed boolean,pins jsonb,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare h text;core_hash text;reservation app.event_prize_activation_pin_reservations_v1%rowtype;prior app.operation_receipts%rowtype;current_pins jsonb;result jsonb;receipt uuid;response jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' or actor is null or tid is null or rid is null or op is null or expected is null or expected<1 or confirmed is distinct from true or jsonb_typeof(pins)is distinct from'array' or jsonb_array_length(pins)>32 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||op::text,0));
 perform 1 from app.tournaments t where t.id=tid for update;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 if not exists(select 1 from app.tournament_roles r where r.tournament_id=tid and r.profile_id=actor and r.role in('director','co_director'))then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('finalize_tournament_setup_pinned_v2',actor,tid,rid,expected,confirmed,pins)::text,'utf8'),'sha256'),'hex');
 core_hash:=encode(extensions.digest(convert_to(jsonb_build_array('activate_tournament_setup_v2',actor::text,tid::text,rid::text,expected)::text,'utf8'),'sha256'),'hex');
 select * into reservation from app.event_prize_activation_pin_reservations_v1 where actor_id=actor and operation_id=op;
 if found then
  if reservation.tournament_id<>tid or reservation.setup_revision_id<>rid or reservation.expected_version<>expected or reservation.request_hash<>h or reservation.pins is distinct from pins then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select * into prior from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
  if found then
   if prior.tournament_id<>tid or prior.operation_type<>'activate_tournament_setup_v2' or prior.request_hash<>core_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
   if prior.response_payload->>'status'='tournament_setup_activated' then return prior.response_payload||jsonb_build_object('registrationState','open');end if;
   return prior.response_payload;
  end if;
 else
  if exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 end if;
 current_pins:=app.current_event_prize_activation_pins_v1(tid,rid,expected);
 if current_pins is null or pins is distinct from current_pins then return jsonb_build_object('status','rejected','code','declaration_pins_changed');end if;
 if reservation.actor_id is null then insert into app.event_prize_activation_pin_reservations_v1(actor_id,operation_id,tournament_id,setup_revision_id,expected_version,pins,request_hash)values(actor,op,tid,rid,expected,pins,h);end if;
 result:=public.activate_tournament_setup_before_pins_0289(actor,tid,rid,expected,op);
 if result->>'status'<>'tournament_setup_activated'then return result;end if;
 select id into receipt from app.operation_receipts where actor_profile_id=actor and tournament_id=tid and client_operation_id=op and operation_type='activate_tournament_setup_v2' order by applied_at desc limit 1;
 if receipt is null then raise exception 'activation receipt unavailable';end if;
 insert into app.tournament_setup_finalization_confirmations(tournament_id,setup_revision_id,actor_profile_id,activation_receipt_id)values(tid,rid,actor,receipt)on conflict(tournament_id)do nothing;
 update app.tournaments set registration_status='open' where id=tid and status='open';
 response:=result||jsonb_build_object('registrationState','open');
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)select tid,actor,receipt,'tournament_setup_finalization',rid,'tournament_setup_finalized_and_registration_opened',response where not exists(select 1 from app.audit_events a where a.operation_receipt_id=receipt and a.action='tournament_setup_finalized_and_registration_opened');
 return response;
end$$;
revoke all on function public.finalize_tournament_setup_pinned_v2(uuid,uuid,uuid,integer,boolean,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.finalize_tournament_setup_pinned_v2(uuid,uuid,uuid,integer,boolean,jsonb,uuid)to service_role;
create function public.get_event_prize_pinned_activation_capability_v1(actor uuid,tid uuid)returns jsonb
language sql stable security definer set search_path=''as $$
 select case when coalesce(auth.role(),'')='service_role' and exists(select 1 from app.tournament_roles r where r.tournament_id=tid and r.profile_id=actor and r.role in('director','co_director')) then jsonb_build_object('available',true,'protocol','event-prize-pins-v1','hasV2Bindings',exists(select 1 from app.event_prize_schedule_bindings_v2 b join app.events e on e.id=b.event_id and e.tournament_id=b.tournament_id where b.tournament_id=tid and e.operational_state='active')) else null end
$$;
revoke all on function public.get_event_prize_pinned_activation_capability_v1(uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_event_prize_pinned_activation_capability_v1(uuid,uuid)to service_role;
commit;
