-- Director-controlled cash/check acceptance. Future provider methods are not
-- represented here, so they cannot be accidentally enabled for the pilot.

create table app.tournament_payment_method_config_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  version integer not null check (version > 0),
  cash_enabled boolean not null,
  check_enabled boolean not null,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
  unique (tournament_id,version),
  check (cash_enabled or check_enabled)
);
alter table app.tournament_payment_method_config_versions enable row level security;
alter table app.tournament_payment_method_config_versions force row level security;
revoke all on table app.tournament_payment_method_config_versions from public,anon,authenticated;
create trigger tournament_payment_method_config_immutable before update or delete on app.tournament_payment_method_config_versions
for each row execute function app.reject_immutable_history();
create index tournament_payment_method_config_actor_idx on app.tournament_payment_method_config_versions(actor_profile_id);
create index tournament_payment_method_config_receipt_idx on app.tournament_payment_method_config_versions(operation_receipt_id,tournament_id);

create or replace function app.enforce_october_registration_payment_method()
returns trigger language plpgsql set search_path='' as $$
declare v_cash boolean:=true; v_check boolean:=true;
begin
  if new.status in('pending_review','needs_review') then
    select config.cash_enabled,config.check_enabled into v_cash,v_check
    from app.tournament_payment_method_config_versions config where config.tournament_id=new.tournament_id
    order by config.version desc limit 1;
    if (new.intended_payment_method='cash' and not v_cash) or (new.intended_payment_method='check' and not v_check)
       or new.intended_payment_method not in('cash','check') then
      raise exception 'payment method is not accepted for this tournament';
    end if;
  end if;
  return new;
end $$;
revoke all on function app.enforce_october_registration_payment_method() from public,anon,authenticated;

create or replace function app.enforce_october_received_payment_method()
returns trigger language plpgsql set search_path='' as $$
declare v_cash boolean:=true; v_check boolean:=true;
begin
  if new.event_type='received' then
    select config.cash_enabled,config.check_enabled into v_cash,v_check
    from app.tournament_payment_method_config_versions config where config.tournament_id=new.tournament_id
    order by config.version desc limit 1;
    if (new.payment_method='cash' and not v_cash) or (new.payment_method='check' and not v_check)
       or new.payment_method not in('cash','check') then
      raise exception 'payment method is not accepted for this tournament';
    end if;
  end if;
  return new;
end $$;
revoke all on function app.enforce_october_received_payment_method() from public,anon,authenticated;

create or replace function public.get_tournament_payment_method_configuration(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when auth.uid() is not null and exists(
    select 1 from app.tournament_roles role where role.tournament_id=p_tournament_id
      and role.profile_id=auth.uid() and role.role in('director','co_director')
  ) then coalesce((
    select jsonb_build_object('tournamentId',p_tournament_id,'version',config.version,
      'cashEnabled',config.cash_enabled,'checkEnabled',config.check_enabled,'canConfigure',tournament.status in('draft','open'))
    from app.tournament_payment_method_config_versions config
    join app.tournaments tournament on tournament.id=config.tournament_id
    where config.tournament_id=p_tournament_id order by config.version desc limit 1
  ),(select jsonb_build_object('tournamentId',p_tournament_id,'version',0,'cashEnabled',true,'checkEnabled',true,'canConfigure',tournament.status in('draft','open')) from app.tournaments tournament where tournament.id=p_tournament_id)) else null end
$$;
revoke all on function public.get_tournament_payment_method_configuration(uuid) from public,anon;
grant execute on function public.get_tournament_payment_method_configuration(uuid) to authenticated;

create or replace function public.get_public_registration_payment_options_v1(p_link_id uuid,p_digest bytea)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'tournamentName',tournament.name,
    'acceptedMethods',jsonb_build_array() || case when coalesce(config.cash_enabled,true) then '"cash"'::jsonb else '[]'::jsonb end
      || case when coalesce(config.check_enabled,true) then '"check"'::jsonb else '[]'::jsonb end
  )
  from app.tournament_registration_links link
  join app.tournament_registration_link_heads head on head.tournament_id=link.tournament_id and head.registration_link_id=link.id
  join app.tournaments tournament on tournament.id=link.tournament_id
  left join lateral(select item.cash_enabled,item.check_enabled from app.tournament_payment_method_config_versions item where item.tournament_id=link.tournament_id order by item.version desc limit 1)config on true
  where link.id=p_link_id and app.fixed_32_byte_equal(link.token_digest,p_digest)
    and link.lifecycle_state='issued' and link.enabled and link.expires_at>now()
    and tournament.registration_status='open' and tournament.status in('draft','open')
$$;
revoke all on function public.get_public_registration_payment_options_v1(uuid,bytea) from public,anon,authenticated;
grant execute on function public.get_public_registration_payment_options_v1(uuid,bytea) to service_role;

create or replace function public.set_tournament_payment_method_configuration(
  p_tournament_id uuid,p_expected_version integer,p_cash_enabled boolean,p_check_enabled boolean,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_status text; v_current integer; v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid; v_response jsonb;
begin
  if v_actor is null or p_tournament_id is null or p_expected_version is null or p_expected_version<0
    or p_cash_enabled is null or p_check_enabled is null or not(p_cash_enabled or p_check_enabled) or p_idempotency_key is null
  then return jsonb_build_object('status','rejected','code','invalid_request','tournamentId',p_tournament_id); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('set_tournament_payment_method_configuration',p_tournament_id::text,p_expected_version,p_cash_enabled,p_check_enabled,p_idempotency_key::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_idempotency_key::text,0));
  select status into v_status from app.tournaments where id=p_tournament_id for update;
  if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable','tournamentId',p_tournament_id); end if;
  if not exists(select 1 from app.tournament_roles role where role.tournament_id=p_tournament_id and role.profile_id=v_actor and role.role in('director','co_director'))
  then return jsonb_build_object('status','rejected','code','not_director','tournamentId',p_tournament_id); end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=v_actor and client_operation_id=p_idempotency_key;
  if found then
    if v_existing.request_hash=v_hash then return v_existing.response_payload; end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict','tournamentId',p_tournament_id);
  end if;
  if v_status not in('draft','open') then return jsonb_build_object('status','rejected','code','tournament_unavailable','tournamentId',p_tournament_id); end if;
  select coalesce(max(version),0) into v_current from app.tournament_payment_method_config_versions where tournament_id=p_tournament_id;
  if v_current<>p_expected_version then return jsonb_build_object('status','rejected','code','stale_configuration','tournamentId',p_tournament_id); end if;
  v_response:=jsonb_build_object('status','payment_methods_configured','tournamentId',p_tournament_id,'version',v_current+1,'cashEnabled',p_cash_enabled,'checkEnabled',p_check_enabled);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament_id,v_actor,'set_tournament_payment_method_configuration',p_tournament_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.tournament_payment_method_config_versions(tournament_id,version,cash_enabled,check_enabled,actor_profile_id,operation_receipt_id)
  values(p_tournament_id,v_current+1,p_cash_enabled,p_check_enabled,v_actor,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(p_tournament_id,v_actor,v_receipt,'tournament_payment_method_configuration',p_tournament_id,'payment_methods_configured',v_response);
  return v_response;
end;
$$;
revoke all on function public.set_tournament_payment_method_configuration(uuid,integer,boolean,boolean,uuid) from public,anon;
grant execute on function public.set_tournament_payment_method_configuration(uuid,integer,boolean,boolean,uuid) to authenticated;
