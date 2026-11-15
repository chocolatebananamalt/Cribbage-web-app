-- Setup-centered official management, State/Territory-aware tournament time
-- zones, and the simplified sanctioning-rate adjustment contract.
-- Apply only through the reviewed disposable-database → production change path.

alter table app.tournament_setup_revisions
  add column state_territory text not null default ''
    check (length(state_territory) <= 80);

-- Preserve every prior setup revision exactly as historical evidence. Existing
-- rows receive the empty default and remain readable; a director must save a
-- new revision to choose State/Territory before a later finalization.

create or replace function app.inherit_tournament_state_territory()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_value text:=current_setting('app.setup_state_territory',true); v_prior text;
begin
  if v_value is not null then new.state_territory:=trim(v_value); return new; end if;
  select state_territory into v_prior from app.tournament_setup_revisions
  where tournament_id=new.tournament_id and version<new.version order by version desc limit 1;
  new.state_territory:=coalesce(v_prior,new.state_territory,'');
  return new;
end $$;
revoke all on function app.inherit_tournament_state_territory() from public,anon,authenticated;
create trigger tournament_setup_revision_state_territory_inheritance
before insert on app.tournament_setup_revisions
for each row execute function app.inherit_tournament_state_territory();

-- The existing writer remains the sole owner of events, contacts, and setup
-- revision sequencing. This adapter adds a required State/Territory without
-- reinterpreting any older revision.
alter function public.save_tournament_setup_version(uuid,integer,jsonb,uuid)
  rename to save_tournament_setup_version_before_state_territory;
create function public.save_tournament_setup_version(
  p_tournament_id uuid,p_expected_version integer,p_payload jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_state text; v_result jsonb;
begin
  if coalesce(jsonb_typeof(p_payload),'')<>'object'
    or jsonb_typeof(p_payload->'stateTerritory')<>'string'
    or not(p_payload ?& array['tournamentName','city','venue','stateTerritory','startsAt','endsAt','timezone','tournamentDirectorPublicName','tournamentContactPhone','tournamentContactEmail','tournamentMailingAddress','mainSanctioningFeeRateCents','consolationSanctioningFeeRateCents','mainSanctioningFeeOverrideReason','mainSanctioningFeeOverrideReference','consolationSanctioningFeeOverrideReason','consolationSanctioningFeeOverrideReference','officials','events'])
    or exists(select 1 from jsonb_object_keys(p_payload) key where key<>all(array['tournamentName','city','venue','stateTerritory','startsAt','endsAt','timezone','tournamentDirectorPublicName','tournamentContactPhone','tournamentContactEmail','tournamentMailingAddress','mainSanctioningFeeRateCents','consolationSanctioningFeeRateCents','mainSanctioningFeeOverrideReason','mainSanctioningFeeOverrideReference','consolationSanctioningFeeOverrideReason','consolationSanctioningFeeOverrideReference','officials','events'])) then
    return jsonb_build_object('status','rejected','code','invalid_setup_payload');
  end if;
  v_state:=trim(p_payload->>'stateTerritory');
  if v_state<>all(array[
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
    'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
    'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri',
    'Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina',
    'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
    'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming',
    'District of Columbia','Puerto Rico','U.S. Virgin Islands','American Samoa','Guam','Northern Mariana Islands'
  ]) then return jsonb_build_object('status','rejected','code','invalid_setup_payload'); end if;
  perform set_config('app.setup_state_territory',v_state,true);
  v_result:=public.save_tournament_setup_version_before_state_territory(p_tournament_id,p_expected_version,p_payload-'stateTerritory',p_idempotency_key);
  return v_result;
end $$;
revoke all on function public.save_tournament_setup_version_before_state_territory(uuid,integer,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.save_tournament_setup_version(uuid,integer,jsonb,uuid) from public,anon;
grant execute on function public.save_tournament_setup_version(uuid,integer,jsonb,uuid) to authenticated;

alter function public.get_tournament_setup_workspace(uuid)
  rename to get_tournament_setup_workspace_before_state_territory;
create function public.get_tournament_setup_workspace(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb; v_current jsonb; v_state text;
begin
  v_base:=public.get_tournament_setup_workspace_before_state_territory(p_tournament_id);
  if v_base is null then return null; end if;
  v_current:=v_base->'current';
  if v_current='null'::jsonb then return v_base; end if;
  select state_territory into v_state from app.tournament_setup_revisions where tournament_id=p_tournament_id order by version desc limit 1;
  return jsonb_set(v_base,'{current}',v_current||jsonb_build_object('stateTerritory',coalesce(v_state,'')),false);
end $$;
revoke all on function public.get_tournament_setup_workspace_before_state_territory(uuid) from public,anon,authenticated;
revoke all on function public.get_tournament_setup_workspace(uuid) from public,anon;
grant execute on function public.get_tournament_setup_workspace(uuid) to authenticated;

-- Finalization remains impossible until a director has made the State/Territory
-- choice that gives the selected local time an unambiguous operational context.
alter function public.activate_tournament_setup_v2(uuid,uuid,uuid,integer,uuid)
  rename to activate_tournament_setup_v2_before_state_territory;
create function public.activate_tournament_setup_v2(p_actor_id uuid,p_tournament_id uuid,p_setup_revision_id uuid,p_expected_version integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from app.tournament_setup_revisions revision
    where revision.id=p_setup_revision_id and revision.tournament_id=p_tournament_id
      and revision.version=p_expected_version and length(trim(revision.state_territory))>0) then
    return jsonb_build_object('status','rejected','code','missing_state_territory');
  end if;
  return public.activate_tournament_setup_v2_before_state_territory(p_actor_id,p_tournament_id,p_setup_revision_id,p_expected_version,p_idempotency_key);
end $$;
revoke all on function public.activate_tournament_setup_v2_before_state_territory(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.activate_tournament_setup_v2(uuid,uuid,uuid,integer,uuid) from public,anon;
grant execute on function public.activate_tournament_setup_v2(uuid,uuid,uuid,integer,uuid) to service_role;

create table app.tournament_setup_official_nominations(
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  role text not null check(role in('co_director','cross_checker','judge')),
  first_name text check(first_name is null or length(trim(first_name)) between 1 and 80),
  last_name text check(last_name is null or length(trim(last_name)) between 1 and 80),
  email_normalized text check(email_normalized is null or email_normalized~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  acc_number text check(acc_number is null or acc_number~'^[A-Z]{2}[0-9]+Y?$'),
  acc_identity_key text check(acc_identity_key is null or acc_identity_key~'^[A-Z]{2}[0-9]+$'),
  status text not null check(status in('pending','active','delivery_failed','removed','expired')),
  invitation_secret_hash text,
  invitation_expires_at timestamptz not null,
  invitation_delivered_at timestamptz,
  accepted_profile_id uuid references app.profiles(id) on delete restrict,
  created_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  source text not null default 'setup' check(source in('setup','legacy')),
  created_at timestamptz not null default clock_timestamp(),
  removed_at timestamptz,
  unique(id,tournament_id)
);

-- The prior setup snapshot supported four co-directors. Official assignment is
-- now independent of that immutable snapshot and capped at twelve per role.
-- The new nomination writer below owns the co-director capacity guard.
drop trigger if exists tournament_co_director_capacity on app.tournament_roles;
alter table app.tournament_setup_official_nominations enable row level security;
alter table app.tournament_setup_official_nominations force row level security;
revoke all on table app.tournament_setup_official_nominations from public,anon,authenticated;
create unique index tournament_setup_official_nominations_active_email_role_idx
  on app.tournament_setup_official_nominations(tournament_id,role,email_normalized)
  where status in('pending','active','delivery_failed');
create unique index tournament_setup_official_nominations_active_profile_role_idx
  on app.tournament_setup_official_nominations(tournament_id,role,accepted_profile_id)
  where status='active' and accepted_profile_id is not null;

create or replace function app.tournament_setup_official_expiry_v1(p_tournament_id uuid)
returns timestamptz language sql stable security definer set search_path='' as $$
  select ((revision.ends_at::timestamp::date+1)::timestamp at time zone revision.timezone_name)
  from app.tournament_setup_revisions revision
  where revision.tournament_id=p_tournament_id and length(trim(revision.state_territory))>0
  order by revision.version desc limit 1
$$;
revoke all on function app.tournament_setup_official_expiry_v1(uuid) from public,anon,authenticated;

-- Existing active officials keep their authority and appear in the new Setup
-- summaries. Older records did not collect first/last name or ACC #, so those
-- values remain blank rather than fabricated; all new nominations require the
-- complete four-field identity.
insert into app.tournament_setup_official_nominations(
  tournament_id,role,first_name,last_name,email_normalized,acc_number,acc_identity_key,
  status,invitation_expires_at,accepted_profile_id,created_by_profile_id,source
)
select roles.tournament_id,roles.role,null,null,lower(users.email),null,null,
  'active',coalesce(app.tournament_setup_official_expiry_v1(roles.tournament_id),clock_timestamp()),
  roles.profile_id,tournament.director_profile_id,'legacy'
from app.tournament_roles roles
join app.tournaments tournament on tournament.id=roles.tournament_id
left join auth.users users on users.id=roles.profile_id
where roles.role in('co_director','cross_checker','judge')
  and not exists(
    select 1 from app.tournament_setup_official_nominations nomination
    where nomination.tournament_id=roles.tournament_id
      and nomination.role=roles.role
      and nomination.accepted_profile_id=roles.profile_id
      and nomination.status='active'
  );

create or replace function app.setup_official_is_primary_director_v1(p_actor_id uuid,p_tournament_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p_actor_id is not null and exists(select 1 from app.tournaments t where t.id=p_tournament_id and t.director_profile_id=p_actor_id)
    and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role='director')
$$;
revoke all on function app.setup_official_is_primary_director_v1(uuid,uuid) from public,anon,authenticated;

create function public.get_tournament_setup_officials_v1(p_actor_id uuid,p_tournament_id uuid,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' or p_role not in('co_director','cross_checker','judge') or not app.setup_official_is_primary_director_v1(p_actor_id,p_tournament_id) then return null; end if;
  update app.tournament_setup_official_nominations set status='expired'
  where tournament_id=p_tournament_id and role=p_role and status in('pending','delivery_failed') and invitation_expires_at<=clock_timestamp();
  return jsonb_build_object('tournamentName',(select name from app.tournaments where id=p_tournament_id),'role',p_role,'canManage',true,'capacity',12,
    'entries',coalesce((select jsonb_agg(jsonb_build_object('nominationId',n.id,'firstName',n.first_name,'lastName',n.last_name,'email',n.email_normalized,'accNumber',n.acc_number,'status',case when n.status='active' then 'registered_approved' when n.status='pending' then 'invitation_email_sent' else 'delivery_unavailable' end,'profileId',n.accepted_profile_id) order by lower(n.last_name),lower(n.first_name),n.id) from app.tournament_setup_official_nominations n where n.tournament_id=p_tournament_id and n.role=p_role and n.status in('pending','active','delivery_failed')),'[]'::jsonb));
end $$;
revoke all on function public.get_tournament_setup_officials_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_tournament_setup_officials_v1(uuid,uuid,text) to service_role;

create function public.nominate_tournament_setup_official_v1(p_actor_id uuid,p_tournament_id uuid,p_role text,p_first_name text,p_last_name text,p_email text,p_acc_number text,p_secret text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(coalesce(p_email,''))); v_acc text:=upper(regexp_replace(trim(coalesce(p_acc_number,'')),'[[:space:]]+','','g')); v_expiry timestamptz; v_profile uuid; v_id uuid:=extensions.gen_random_uuid(); v_hash text; v_receipt uuid; v_response jsonb; v_existing app.operation_receipts%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_role not in('co_director','cross_checker','judge') or length(trim(coalesce(p_first_name,''))) not between 1 and 80 or length(trim(coalesce(p_last_name,''))) not between 1 and 80 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or v_acc !~ '^[A-Z]{2}[0-9]+Y?$' or p_operation_id is null or length(coalesce(p_secret,''))<32 then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  if not app.setup_official_is_primary_director_v1(p_actor_id,p_tournament_id) then return jsonb_build_object('status','rejected','code','not_primary_director'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('setup-official:'||p_tournament_id::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('nominate_tournament_setup_official_v1',p_actor_id::text,p_tournament_id::text,p_role,trim(p_first_name),trim(p_last_name),v_email,v_acc,p_operation_id::text)::text,'utf8'),'sha256'),'hex');
  if found then if v_existing.request_hash=v_hash then return v_existing.response_payload; end if; return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
  select app.tournament_setup_official_expiry_v1(p_tournament_id) into v_expiry; if v_expiry is null or v_expiry<=clock_timestamp() then return jsonb_build_object('status','rejected','code','saved_setup_end_required'); end if;
  if (select count(*) from app.tournament_setup_official_nominations n where n.tournament_id=p_tournament_id and n.role=p_role and n.status in('pending','active','delivery_failed'))>=12 then return jsonb_build_object('status','rejected','code','official_capacity_reached'); end if;
  if exists(select 1 from app.tournament_setup_official_nominations n where n.tournament_id=p_tournament_id and n.role=p_role and n.email_normalized=v_email and n.status in('pending','active','delivery_failed')) then return jsonb_build_object('status','rejected','code','duplicate_official'); end if;
  select id into v_profile from auth.users where lower(email)=v_email; if v_profile=p_actor_id then return jsonb_build_object('status','rejected','code','self_assignment_forbidden'); end if;
  -- Assignment never grants authority merely because an address already has an
  -- account. The exact address must complete the sent secure sign-in first.
  insert into app.tournament_setup_official_nominations(id,tournament_id,role,first_name,last_name,email_normalized,acc_number,acc_identity_key,status,invitation_secret_hash,invitation_expires_at,created_by_profile_id) values(v_id,p_tournament_id,p_role,trim(p_first_name),trim(p_last_name),v_email,v_acc,regexp_replace(v_acc,'Y$',''),'pending',encode(extensions.digest(convert_to(p_secret,'utf8'),'sha256'),'hex'),v_expiry,p_actor_id);
  v_response:=jsonb_build_object('status','official_pending_email','nominationId',v_id);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_tournament_id,p_actor_id,'nominate_tournament_setup_official_v1',v_id,v_hash,p_operation_id,'accepted',v_response,clock_timestamp()) returning id into v_receipt;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'tournament_setup_official',v_id,'tournament_setup_official_nominated',v_response);
  return v_response;
end $$;
revoke all on function public.nominate_tournament_setup_official_v1(uuid,uuid,text,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.nominate_tournament_setup_official_v1(uuid,uuid,text,text,text,text,text,text,uuid) to service_role;

create function public.record_tournament_setup_official_invitation_delivery_v1(p_actor_id uuid,p_tournament_id uuid,p_nomination_id uuid,p_operation_id uuid,p_delivered boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row app.tournament_setup_official_nominations%rowtype; v_response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or not app.setup_official_is_primary_director_v1(p_actor_id,p_tournament_id) then return jsonb_build_object('status','rejected','code','not_primary_director'); end if;
  select * into v_row from app.tournament_setup_official_nominations where id=p_nomination_id and tournament_id=p_tournament_id for update; if not found or v_row.status not in('pending','delivery_failed') then return jsonb_build_object('status','rejected','code','nomination_unavailable'); end if;
  update app.tournament_setup_official_nominations set status=case when p_delivered then 'pending' else 'delivery_failed' end, invitation_delivered_at=case when p_delivered then clock_timestamp() else null end where id=v_row.id;
  v_response:=jsonb_build_object('status',case when p_delivered then 'invitation_email_sent' else 'delivery_unavailable' end,'nominationId',v_row.id);
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,'tournament_setup_official',v_row.id,case when p_delivered then 'tournament_setup_official_email_sent' else 'tournament_setup_official_email_failed' end,v_response);
  return v_response;
end $$;
revoke all on function public.record_tournament_setup_official_invitation_delivery_v1(uuid,uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.record_tournament_setup_official_invitation_delivery_v1(uuid,uuid,uuid,uuid,boolean) to service_role;

create function public.manage_tournament_setup_official_v1(p_actor_id uuid,p_tournament_id uuid,p_nomination_id uuid,p_action text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row app.tournament_setup_official_nominations%rowtype; v_response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_action not in('remove','restore') or not app.setup_official_is_primary_director_v1(p_actor_id,p_tournament_id) then return jsonb_build_object('status','rejected','code','not_primary_director'); end if;
  select * into v_row from app.tournament_setup_official_nominations where id=p_nomination_id and tournament_id=p_tournament_id for update; if not found then return jsonb_build_object('status','rejected','code','nomination_unavailable'); end if;
  if p_action='remove' then update app.tournament_setup_official_nominations set status='removed',removed_at=clock_timestamp() where id=v_row.id; delete from app.tournament_roles where tournament_id=p_tournament_id and profile_id=v_row.accepted_profile_id and role=v_row.role; v_response:=jsonb_build_object('status','official_removed','nominationId',v_row.id);
  elsif v_row.accepted_profile_id is null then return jsonb_build_object('status','rejected','code','secure_sign_in_required');
  else update app.tournament_setup_official_nominations set status='active',removed_at=null where id=v_row.id; insert into app.tournament_roles(tournament_id,profile_id,role) values(p_tournament_id,v_row.accepted_profile_id,v_row.role) on conflict do nothing; v_response:=jsonb_build_object('status','official_restored','nominationId',v_row.id); end if;
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,'tournament_setup_official',v_row.id,case when p_action='remove' then 'tournament_setup_official_removed' else 'tournament_setup_official_restored' end,v_response);
  return v_response;
end $$;
revoke all on function public.manage_tournament_setup_official_v1(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.manage_tournament_setup_official_v1(uuid,uuid,uuid,text,uuid) to service_role;

-- Kept out of the ordinary director UI: a platform administrator may perform
-- a rare emergency removal/restoration only with a written reason, exact
-- operation idempotency, and an immutable authority-marked audit event.
create function public.emergency_manage_tournament_setup_official_v1(p_actor_id uuid,p_tournament_id uuid,p_nomination_id uuid,p_action text,p_reason text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row app.tournament_setup_official_nominations%rowtype; v_response jsonb; v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_action not in('remove','restore') or p_operation_id is null or length(trim(coalesce(p_reason,''))) not between 1 and 1000 or not app.is_platform_administrator(p_actor_id) then return jsonb_build_object('status','rejected','code','not_platform_administrator'); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('emergency_manage_tournament_setup_official_v1',p_actor_id::text,p_tournament_id::text,p_nomination_id::text,p_action,trim(p_reason),p_operation_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then if v_existing.request_hash=v_hash then return v_existing.response_payload; end if; return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
  select * into v_row from app.tournament_setup_official_nominations where id=p_nomination_id and tournament_id=p_tournament_id for update;
  if not found then return jsonb_build_object('status','rejected','code','nomination_unavailable'); end if;
  if p_action='remove' then
    update app.tournament_setup_official_nominations set status='removed',removed_at=clock_timestamp() where id=v_row.id;
    delete from app.tournament_roles where tournament_id=p_tournament_id and profile_id=v_row.accepted_profile_id and role=v_row.role;
  elsif v_row.accepted_profile_id is null then
    return jsonb_build_object('status','rejected','code','secure_sign_in_required');
  else
    update app.tournament_setup_official_nominations set status='active',removed_at=null where id=v_row.id;
    insert into app.tournament_roles(tournament_id,profile_id,role) values(p_tournament_id,v_row.accepted_profile_id,v_row.role) on conflict(tournament_id,profile_id,role) do nothing;
  end if;
  v_response:=jsonb_build_object('status',case when p_action='remove' then 'official_removed' else 'official_restored' end,'nominationId',v_row.id,'authority','platform_emergency_override','reason',trim(p_reason));
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_tournament_id,p_actor_id,'emergency_manage_tournament_setup_official_v1',v_row.id,v_hash,p_operation_id,'accepted',v_response,clock_timestamp()) returning id into v_receipt;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,v_receipt,'tournament_setup_official',v_row.id,'tournament_setup_official_emergency_'||p_action,v_response);
  return v_response;
end $$;
revoke all on function public.emergency_manage_tournament_setup_official_v1(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.emergency_manage_tournament_setup_official_v1(uuid,uuid,uuid,text,text,uuid) to service_role;

create function public.accept_tournament_setup_official_nomination_v1(p_actor_id uuid,p_secret text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row app.tournament_setup_official_nominations%rowtype; v_email text; v_response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or length(coalesce(p_secret,''))<32 then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  select lower(email) into v_email from auth.users where id=p_actor_id; if v_email is null then return jsonb_build_object('status','rejected','code','authentication_required'); end if;
  select * into v_row from app.tournament_setup_official_nominations where invitation_secret_hash=encode(extensions.digest(convert_to(p_secret,'utf8'),'sha256'),'hex') for update; if not found then return jsonb_build_object('status','rejected','code','nomination_unavailable'); end if;
  if v_row.status not in('pending','delivery_failed') or v_row.invitation_expires_at<=clock_timestamp() then return jsonb_build_object('status','rejected','code','invitation_expired'); end if;
  if v_row.email_normalized<>v_email then return jsonb_build_object('status','rejected','code','invitation_email_mismatch'); end if;
  update app.tournament_setup_official_nominations set status='active',accepted_profile_id=p_actor_id,invitation_secret_hash=null where id=v_row.id;
  update app.profiles set display_name=trim(v_row.first_name||' '||v_row.last_name) where id=p_actor_id and lower(trim(display_name))='tournament participant';
  insert into app.tournament_roles(tournament_id,profile_id,role) values(v_row.tournament_id,p_actor_id,v_row.role) on conflict do nothing;
  v_response:=jsonb_build_object('status','official_accepted','tournamentId',v_row.tournament_id,'nominationId',v_row.id);
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state) values(v_row.tournament_id,p_actor_id,'tournament_setup_official',v_row.id,'tournament_setup_official_accepted',v_response);
  return v_response;
end $$;
revoke all on function public.accept_tournament_setup_official_nomination_v1(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.accept_tournament_setup_official_nomination_v1(uuid,text,uuid) to service_role;

-- The user-facing API has one clear capability list while legacy callers may
-- continue to consume the highest priority display role.
create function public.get_tournament_roles_v1(p_tournament_id uuid)
returns text[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(role order by case role when 'director' then 1 when 'co_director' then 2 when 'judge' then 3 when 'cross_checker' then 4 when 'player' then 5 else 6 end),array[]::text[])
  from app.tournament_roles where tournament_id=p_tournament_id and profile_id=auth.uid()
$$;
revoke all on function public.get_tournament_roles_v1(uuid) from public,anon;
grant execute on function public.get_tournament_roles_v1(uuid) to authenticated;

-- The Setup reader deliberately exposes legacy assignments without inventing
-- missing identity values. New entries always carry all four required fields.
create or replace function public.get_tournament_setup_officials_v1(p_actor_id uuid,p_tournament_id uuid,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_can_manage boolean; v_can_view boolean;
begin
  v_can_manage:=app.setup_official_is_primary_director_v1(p_actor_id,p_tournament_id);
  v_can_view:=v_can_manage or exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role='co_director');
  if coalesce(auth.role(),'')<>'service_role' or p_role not in('co_director','cross_checker','judge') or not v_can_view then return null; end if;
  update app.tournament_setup_official_nominations set status='expired'
  where tournament_id=p_tournament_id and role=p_role and status in('pending','delivery_failed') and invitation_expires_at<=clock_timestamp();
  return jsonb_build_object(
    'tournamentName',(select name from app.tournaments where id=p_tournament_id),
    'role',p_role,'canManage',v_can_manage,'capacity',12,
    'entries',coalesce((select jsonb_agg(jsonb_build_object(
      'nominationId',n.id,
      'displayName',coalesce(nullif(trim(concat_ws(' ',n.first_name,n.last_name)),''),'Existing official'),
      'firstName',coalesce(n.first_name,''),'lastName',coalesce(n.last_name,''),
      'email',coalesce(n.email_normalized,''),'accNumber',coalesce(n.acc_number,''),
      'status',case when n.status='active' then 'registered_approved' when n.status='pending' then 'invitation_email_sent' else 'delivery_unavailable' end,
      'profileId',n.accepted_profile_id
    ) order by lower(coalesce(n.last_name,n.first_name,'')),lower(coalesce(n.first_name,'')),n.id)
    from app.tournament_setup_official_nominations n
    where n.tournament_id=p_tournament_id and n.role=p_role and n.status in('pending','active','delivery_failed')),'[]'::jsonb)
  );
end $$;
revoke all on function public.get_tournament_setup_officials_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_tournament_setup_officials_v1(uuid,uuid,text) to service_role;

-- Record email-provider acceptance separately from nomination creation so a
-- UI never reports an email as sent merely because a draft row exists.
create or replace function public.record_tournament_setup_official_invitation_delivery_v1(p_actor_id uuid,p_tournament_id uuid,p_nomination_id uuid,p_operation_id uuid,p_delivered boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row app.tournament_setup_official_nominations%rowtype; v_response jsonb; v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_operation_id is null or not app.setup_official_is_primary_director_v1(p_actor_id,p_tournament_id) then return jsonb_build_object('status','rejected','code','not_primary_director'); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('record_tournament_setup_official_invitation_delivery_v1',p_actor_id::text,p_tournament_id::text,p_nomination_id::text,p_delivered,p_operation_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then if v_existing.request_hash=v_hash then return v_existing.response_payload; end if; return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
  select * into v_row from app.tournament_setup_official_nominations where id=p_nomination_id and tournament_id=p_tournament_id for update;
  if not found or v_row.status not in('pending','delivery_failed') then return jsonb_build_object('status','rejected','code','nomination_unavailable'); end if;
  update app.tournament_setup_official_nominations set status=case when p_delivered then 'pending' else 'delivery_failed' end,invitation_delivered_at=case when p_delivered then clock_timestamp() else null end where id=v_row.id;
  v_response:=jsonb_build_object('status',case when p_delivered then 'invitation_email_sent' else 'delivery_unavailable' end,'nominationId',v_row.id);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_tournament_id,p_actor_id,'record_tournament_setup_official_invitation_delivery_v1',v_row.id,v_hash,p_operation_id,'accepted',v_response,clock_timestamp()) returning id into v_receipt;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,v_receipt,'tournament_setup_official',v_row.id,case when p_delivered then 'tournament_setup_official_email_sent' else 'tournament_setup_official_email_failed' end,v_response);
  return v_response;
end $$;
revoke all on function public.record_tournament_setup_official_invitation_delivery_v1(uuid,uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.record_tournament_setup_official_invitation_delivery_v1(uuid,uuid,uuid,uuid,boolean) to service_role;

create or replace function public.manage_tournament_setup_official_v1(p_actor_id uuid,p_tournament_id uuid,p_nomination_id uuid,p_action text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row app.tournament_setup_official_nominations%rowtype; v_response jsonb; v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_action not in('remove','restore') or p_operation_id is null or not app.setup_official_is_primary_director_v1(p_actor_id,p_tournament_id) then return jsonb_build_object('status','rejected','code','not_primary_director'); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('manage_tournament_setup_official_v1',p_actor_id::text,p_tournament_id::text,p_nomination_id::text,p_action,p_operation_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then if v_existing.request_hash=v_hash then return v_existing.response_payload; end if; return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
  select * into v_row from app.tournament_setup_official_nominations where id=p_nomination_id and tournament_id=p_tournament_id for update;
  if not found then return jsonb_build_object('status','rejected','code','nomination_unavailable'); end if;
  if p_action='remove' then
    if v_row.status in('removed','expired') then return jsonb_build_object('status','rejected','code','nomination_unavailable'); end if;
    update app.tournament_setup_official_nominations set status='removed',removed_at=clock_timestamp() where id=v_row.id;
    delete from app.tournament_roles where tournament_id=p_tournament_id and profile_id=v_row.accepted_profile_id and role=v_row.role;
    v_response:=jsonb_build_object('status','official_removed','nominationId',v_row.id);
  elsif v_row.accepted_profile_id is null then
    return jsonb_build_object('status','rejected','code','secure_sign_in_required');
  else
    update app.tournament_setup_official_nominations set status='active',removed_at=null where id=v_row.id;
    insert into app.tournament_roles(tournament_id,profile_id,role) values(p_tournament_id,v_row.accepted_profile_id,v_row.role) on conflict(tournament_id,profile_id,role) do nothing;
    v_response:=jsonb_build_object('status','official_restored','nominationId',v_row.id);
  end if;
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(p_tournament_id,p_actor_id,'manage_tournament_setup_official_v1',v_row.id,v_hash,p_operation_id,'accepted',v_response,clock_timestamp()) returning id into v_receipt;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(p_tournament_id,p_actor_id,v_receipt,'tournament_setup_official',v_row.id,case when p_action='remove' then 'tournament_setup_official_removed' else 'tournament_setup_official_restored' end,v_response);
  return v_response;
end $$;
revoke all on function public.manage_tournament_setup_official_v1(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.manage_tournament_setup_official_v1(uuid,uuid,uuid,text,uuid) to service_role;

-- A magic email is the bearer credential. The callback carries only the opaque
-- nomination UUID and the server also requires the signed-in exact email.
create function public.accept_tournament_setup_official_nomination_by_id_v1(p_actor_id uuid,p_nomination_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row app.tournament_setup_official_nominations%rowtype; v_email text; v_response jsonb; v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_nomination_id is null or p_operation_id is null then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('accept_tournament_setup_official_nomination_by_id_v1',p_actor_id::text,p_nomination_id::text,p_operation_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then if v_existing.request_hash=v_hash then return v_existing.response_payload; end if; return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
  select lower(email) into v_email from auth.users where id=p_actor_id; if v_email is null then return jsonb_build_object('status','rejected','code','authentication_required'); end if;
  select * into v_row from app.tournament_setup_official_nominations where id=p_nomination_id for update;
  if not found then return jsonb_build_object('status','rejected','code','nomination_unavailable'); end if;
  if v_row.status not in('pending','delivery_failed') or v_row.invitation_expires_at<=clock_timestamp() then return jsonb_build_object('status','rejected','code','invitation_expired'); end if;
  if v_row.email_normalized<>v_email then return jsonb_build_object('status','rejected','code','invitation_email_mismatch'); end if;
  update app.tournament_setup_official_nominations set status='active',accepted_profile_id=p_actor_id,invitation_secret_hash=null where id=v_row.id;
  update app.profiles set display_name=trim(v_row.first_name||' '||v_row.last_name) where id=p_actor_id and lower(trim(display_name))='tournament participant';
  insert into app.tournament_roles(tournament_id,profile_id,role) values(v_row.tournament_id,p_actor_id,v_row.role) on conflict(tournament_id,profile_id,role) do nothing;
  v_response:=jsonb_build_object('status','official_accepted','tournamentId',v_row.tournament_id,'nominationId',v_row.id);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(v_row.tournament_id,p_actor_id,'accept_tournament_setup_official_nomination_by_id_v1',v_row.id,v_hash,p_operation_id,'accepted',v_response,clock_timestamp()) returning id into v_receipt;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
    values(v_row.tournament_id,p_actor_id,v_receipt,'tournament_setup_official',v_row.id,'tournament_setup_official_accepted',v_response);
  return v_response;
end $$;
revoke all on function public.accept_tournament_setup_official_nomination_by_id_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.accept_tournament_setup_official_nomination_by_id_v1(uuid,uuid,uuid) to service_role;

notify pgrst,'reload schema';
