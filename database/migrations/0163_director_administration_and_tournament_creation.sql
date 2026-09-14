-- Platform-scoped director approval and self-service draft creation. Browser
-- roles never execute these functions directly: the application verifies the
-- session, supplies its subject, and calls through its server-only secret key.

alter table app.tournaments
  add column creator_profile_id uuid references app.profiles(id) on delete restrict,
  add column planned_start_date date;

update app.tournaments set creator_profile_id = director_profile_id
where creator_profile_id is null;

create or replace function app.default_tournament_creator()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.creator_profile_id is null then new.creator_profile_id := new.director_profile_id; end if;
  return new;
end;
$$;
revoke all on function app.default_tournament_creator() from public, anon, authenticated;
create trigger tournaments_default_creator before insert on app.tournaments
for each row execute function app.default_tournament_creator();
alter table app.tournaments alter column creator_profile_id set not null;
create index tournaments_creator_profile_id_idx on app.tournaments(creator_profile_id);
create index tournaments_planned_start_date_idx on app.tournaments(planned_start_date);

create table app.platform_administrators (
  profile_id uuid primary key references app.profiles(id) on delete restrict,
  administrator_type text not null check (administrator_type in ('app_owner','acc_administrator')),
  granted_by_profile_id uuid references app.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table app.platform_administrators enable row level security;
alter table app.platform_administrators force row level security;
revoke all on table app.platform_administrators from public, anon, authenticated;
create index platform_administrators_granted_by_idx on app.platform_administrators(granted_by_profile_id);

create table app.director_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  applicant_profile_id uuid not null references app.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  decided_by_profile_id uuid references app.profiles(id) on delete restrict,
  decided_at timestamptz,
  decision_note text check (decision_note is null or length(trim(decision_note)) between 1 and 500),
  acc_verified boolean not null default false,
  check ((status = 'pending' and decided_by_profile_id is null and decided_at is null)
    or (status in ('approved','rejected') and decided_by_profile_id is not null and decided_at is not null))
);
alter table app.director_applications enable row level security;
alter table app.director_applications force row level security;
revoke all on table app.director_applications from public, anon, authenticated;
create unique index director_applications_one_pending_idx
  on app.director_applications(applicant_profile_id) where status = 'pending';
create index director_applications_applicant_idx on app.director_applications(applicant_profile_id);
create index director_applications_decider_idx on app.director_applications(decided_by_profile_id);
create index director_applications_status_idx on app.director_applications(status, submitted_at);

create table app.director_authorizations (
  profile_id uuid primary key references app.profiles(id) on delete restrict,
  status text not null check (status in ('approved','suspended')),
  acc_verified boolean not null default false,
  decided_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  source_application_id uuid references app.director_applications(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
alter table app.director_authorizations enable row level security;
alter table app.director_authorizations force row level security;
revoke all on table app.director_authorizations from public, anon, authenticated;
create index director_authorizations_decider_idx on app.director_authorizations(decided_by_profile_id);
create index director_authorizations_application_idx on app.director_authorizations(source_application_id);
create index director_authorizations_status_idx on app.director_authorizations(status);

create table app.platform_operation_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_type text not null,
  target_id uuid not null,
  request_hash text not null check (length(request_hash) = 64),
  client_operation_id uuid not null,
  outcome text not null check (outcome in ('accepted','rejected')),
  response_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (actor_profile_id, client_operation_id)
);
alter table app.platform_operation_receipts enable row level security;
alter table app.platform_operation_receipts force row level security;
revoke all on table app.platform_operation_receipts from public, anon, authenticated;
create trigger platform_operation_receipts_immutable before update or delete on app.platform_operation_receipts
for each row execute function app.reject_immutable_history();
create index platform_operation_receipts_actor_idx on app.platform_operation_receipts(actor_profile_id);
create index platform_operation_receipts_target_idx on app.platform_operation_receipts(target_id);

create table app.platform_audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid references app.profiles(id) on delete restrict,
  operation_receipt_id uuid references app.platform_operation_receipts(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
alter table app.platform_audit_events enable row level security;
alter table app.platform_audit_events force row level security;
revoke all on table app.platform_audit_events from public, anon, authenticated;
create trigger platform_audit_events_immutable before update or delete on app.platform_audit_events
for each row execute function app.reject_immutable_history();
create index platform_audit_events_actor_idx on app.platform_audit_events(actor_profile_id);
create index platform_audit_events_receipt_idx on app.platform_audit_events(operation_receipt_id);
create index platform_audit_events_entity_idx on app.platform_audit_events(entity_type, entity_id);

create or replace function app.is_platform_administrator(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from app.platform_administrators where profile_id = p_profile_id)
$$;
revoke all on function app.is_platform_administrator(uuid) from public, anon, authenticated;

create or replace function public.get_director_access_workspace_v1(p_actor_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when coalesce((select auth.jwt()->>'role'), '') = 'service_role'
    and p_actor_id is not null and exists(select 1 from app.profiles where id = p_actor_id)
  then jsonb_build_object(
    'canCreateTournament', coalesce(authz.status = 'approved', false),
    'isPlatformAdmin', administrator.profile_id is not null,
    'administratorType', administrator.administrator_type,
    'directorStatus', authz.status,
    'accVerified', coalesce(authz.acc_verified, false),
    'pendingApplicationId', pending_request.id
  ) else null end
  from (select p_actor_id as profile_id) actor
  left join app.platform_administrators administrator on administrator.profile_id = actor.profile_id
  left join app.director_authorizations authz on authz.profile_id = actor.profile_id
  left join lateral (
    select id from app.director_applications
    where applicant_profile_id = actor.profile_id and status = 'pending'
    order by submitted_at desc limit 1
  ) pending_request on true
$$;

create or replace function public.submit_director_application_v1(
  p_actor_id uuid, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_hash text; v_existing app.platform_operation_receipts%rowtype; v_application uuid;
  v_receipt uuid; v_response jsonb; v_code text;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode='P0001', message='server-only director application';
  end if;
  if p_actor_id is null or p_operation_id is null or not exists(select 1 from app.profiles where id=p_actor_id) then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'submit_director_application_v1',p_actor_id::text,p_operation_id::text
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_existing from app.platform_operation_receipts
    where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type='submit_director_application_v1' and v_existing.request_hash=v_hash then
      return v_existing.response_payload;
    end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict');
  end if;
  if exists(select 1 from app.director_authorizations where profile_id=p_actor_id) then
    v_code := 'existing_authorization';
  else
    select id into v_application from app.director_applications
      where applicant_profile_id=p_actor_id and status='pending' order by submitted_at desc limit 1;
    if found then v_code := 'application_pending'; end if;
  end if;
  if v_code is not null then
    v_response := jsonb_build_object('status','rejected','code',v_code);
  else
    insert into app.director_applications(applicant_profile_id) values(p_actor_id) returning id into v_application;
    v_response := jsonb_build_object('status','application_submitted','applicationId',v_application);
  end if;
  insert into app.platform_operation_receipts(actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload)
  values(p_actor_id,'submit_director_application_v1',coalesce(v_application,p_actor_id),v_hash,p_operation_id,
    case when v_code is null then 'accepted' else 'rejected' end,v_response) returning id into v_receipt;
  insert into app.platform_audit_events(actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(p_actor_id,v_receipt,'director_application',coalesce(v_application,p_actor_id),
    case when v_code is null then 'director_application_submitted' else 'director_application_rejected' end,v_response);
  return v_response;
end;
$$;

create or replace function public.get_platform_director_admin_workspace_v1(p_actor_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when coalesce((select auth.jwt()->>'role'), '') = 'service_role'
    and app.is_platform_administrator(p_actor_id)
  then jsonb_build_object(
    'administratorType',(select administrator_type from app.platform_administrators where profile_id=p_actor_id),
    'applications',coalesce((select jsonb_agg(jsonb_build_object(
      'applicationId',request_row.id,'applicantProfileId',request_row.applicant_profile_id,
      'displayName',profile.display_name,'status',request_row.status,
      'submittedAt',request_row.submitted_at,'decidedAt',request_row.decided_at,
      'decisionNote',request_row.decision_note,'accVerified',request_row.acc_verified
    ) order by case request_row.status when 'pending' then 1 else 2 end, request_row.submitted_at desc)
      from app.director_applications request_row join app.profiles profile on profile.id=request_row.applicant_profile_id), '[]'::jsonb),
    'authorizations',coalesce((select jsonb_agg(jsonb_build_object(
      'profileId',authz.profile_id,'displayName',profile.display_name,
      'status',authz.status,'accVerified',authz.acc_verified,
      'version',authz.version,'updatedAt',authz.updated_at
    ) order by lower(profile.display_name),authz.profile_id)
      from app.director_authorizations authz join app.profiles profile on profile.id=authz.profile_id), '[]'::jsonb)
  ) else null end
$$;

create or replace function public.review_director_application_v1(
  p_actor_id uuid, p_application_id uuid, p_decision text, p_acc_verified boolean,
  p_note text, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_admin_type text; v_application app.director_applications%rowtype; v_hash text;
  v_existing app.platform_operation_receipts%rowtype; v_receipt uuid; v_response jsonb; v_code text;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode='P0001', message='server-only director review';
  end if;
  select administrator_type into v_admin_type from app.platform_administrators where profile_id=p_actor_id;
  if p_actor_id is null or p_application_id is null or p_operation_id is null
    or p_decision not in ('approve','reject') or p_acc_verified is null
    or (p_note is not null and (length(trim(p_note)) < 1 or length(trim(p_note)) > 500)) then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  if v_admin_type is null then return jsonb_build_object('status','rejected','code','not_platform_admin'); end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'review_director_application_v1',p_actor_id::text,p_application_id::text,p_decision,p_acc_verified,coalesce(trim(p_note),''),p_operation_id::text
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_existing from app.platform_operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type='review_director_application_v1' and v_existing.request_hash=v_hash then return v_existing.response_payload; end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict');
  end if;
  select * into v_application from app.director_applications where id=p_application_id for update;
  if not found then v_code := 'application_unavailable';
  elsif v_application.applicant_profile_id=p_actor_id then v_code := 'self_review_denied';
  elsif v_application.status<>'pending' then v_code := 'application_already_decided';
  elsif p_acc_verified and v_admin_type<>'acc_administrator' then v_code := 'acc_verification_requires_acc_admin';
  end if;
  if v_code is null then
    update app.director_applications set status=case p_decision when 'approve' then 'approved' else 'rejected' end,
      decided_by_profile_id=p_actor_id,decided_at=now(),decision_note=nullif(trim(p_note),''),
      acc_verified=case when p_decision='approve' then p_acc_verified else false end
    where id=p_application_id;
    if p_decision='approve' then
      insert into app.director_authorizations(profile_id,status,acc_verified,decided_by_profile_id,source_application_id)
      values(v_application.applicant_profile_id,'approved',p_acc_verified,p_actor_id,p_application_id)
      on conflict(profile_id) do update set status='approved',acc_verified=excluded.acc_verified,
        decided_by_profile_id=excluded.decided_by_profile_id,source_application_id=excluded.source_application_id,
        version=app.director_authorizations.version+1,updated_at=now();
    end if;
    v_response := jsonb_build_object('status','application_reviewed','applicationId',p_application_id,
      'decision',p_decision,'accVerified',case when p_decision='approve' then p_acc_verified else false end);
  else v_response := jsonb_build_object('status','rejected','code',v_code); end if;
  insert into app.platform_operation_receipts(actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload)
  values(p_actor_id,'review_director_application_v1',p_application_id,v_hash,p_operation_id,
    case when v_code is null then 'accepted' else 'rejected' end,v_response) returning id into v_receipt;
  insert into app.platform_audit_events(actor_profile_id,operation_receipt_id,entity_type,entity_id,action,
    before_state,after_state) values(p_actor_id,v_receipt,'director_application',p_application_id,
    case when v_code is null then 'director_application_reviewed' else 'director_application_review_rejected' end,
    to_jsonb(v_application),v_response);
  return v_response;
end;
$$;

create or replace function public.set_director_authorization_status_v1(
  p_actor_id uuid, p_profile_id uuid, p_status text, p_note text, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_before app.director_authorizations%rowtype; v_hash text; v_existing app.platform_operation_receipts%rowtype;
  v_receipt uuid; v_response jsonb; v_code text;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode='P0001', message='server-only director authorization';
  end if;
  if p_actor_id is null or p_profile_id is null or p_operation_id is null or p_status not in ('approved','suspended')
    or p_note is null or length(trim(p_note)) not between 1 and 500 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  if not app.is_platform_administrator(p_actor_id) then return jsonb_build_object('status','rejected','code','not_platform_admin'); end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'set_director_authorization_status_v1',p_actor_id::text,p_profile_id::text,p_status,trim(p_note),p_operation_id::text
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_existing from app.platform_operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type='set_director_authorization_status_v1' and v_existing.request_hash=v_hash then return v_existing.response_payload; end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict');
  end if;
  select * into v_before from app.director_authorizations where profile_id=p_profile_id for update;
  if not found then v_code := 'authorization_unavailable';
  elsif p_profile_id=p_actor_id then v_code := 'self_status_change_denied';
  elsif v_before.status=p_status then v_code := 'status_unchanged';
  end if;
  if v_code is null then
    update app.director_authorizations set status=p_status,decided_by_profile_id=p_actor_id,
      version=version+1,updated_at=now() where profile_id=p_profile_id;
    v_response := jsonb_build_object('status','director_authorization_updated','profileId',p_profile_id,
      'directorStatus',p_status,'version',v_before.version+1);
  else v_response := jsonb_build_object('status','rejected','code',v_code); end if;
  insert into app.platform_operation_receipts(actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload)
  values(p_actor_id,'set_director_authorization_status_v1',p_profile_id,v_hash,p_operation_id,
    case when v_code is null then 'accepted' else 'rejected' end,v_response) returning id into v_receipt;
  insert into app.platform_audit_events(actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
  values(p_actor_id,v_receipt,'director_authorization',p_profile_id,
    case when v_code is null then 'director_authorization_updated' else 'director_authorization_update_rejected' end,
    to_jsonb(v_before),v_response);
  return v_response;
end;
$$;

create or replace function public.create_tournament_draft_v1(
  p_actor_id uuid, p_name text, p_planned_start_date date, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_name text := trim(p_name); v_hash text; v_existing app.operation_receipts%rowtype;
  v_tournament_id uuid := extensions.gen_random_uuid(); v_receipt uuid; v_response jsonb; v_code text;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode='P0001', message='server-only tournament creation';
  end if;
  if p_actor_id is null or p_operation_id is null or p_planned_start_date is null
    or v_name is null or length(v_name) not between 1 and 200 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'create_tournament_draft_v1',p_actor_id::text,v_name,p_planned_start_date::text,p_operation_id::text
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type='create_tournament_draft_v1' and v_existing.request_hash=v_hash then return v_existing.response_payload; end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict');
  end if;
  if not exists(select 1 from app.director_authorizations where profile_id=p_actor_id and status='approved') then
    return jsonb_build_object('status','rejected','code','director_approval_required');
  end if;
  if exists(select 1 from app.tournaments where creator_profile_id=p_actor_id and lower(name)=lower(v_name)
    and planned_start_date=p_planned_start_date and status<>'archived') then
    return jsonb_build_object('status','rejected','code','duplicate_tournament');
  end if;
  insert into app.tournaments(id,director_profile_id,creator_profile_id,name,status,registration_status,planned_start_date)
  values(v_tournament_id,p_actor_id,p_actor_id,v_name,'draft','open',p_planned_start_date);
  insert into app.tournament_roles(tournament_id,profile_id,role) values(v_tournament_id,p_actor_id,'director');
  v_response := jsonb_build_object('status','tournament_created','tournamentId',v_tournament_id,
    'tournamentName',v_name,'tournamentDate',to_char(p_planned_start_date,'MM-DD-YYYY'));
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,
    client_operation_id,outcome,response_payload,applied_at)
  values(v_tournament_id,p_actor_id,'create_tournament_draft_v1',v_tournament_id,v_hash,p_operation_id,
    'accepted',v_response,now()) returning id into v_receipt;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(v_tournament_id,p_actor_id,v_receipt,'tournament',v_tournament_id,'tournament_draft_created',v_response);
  return v_response;
end;
$$;

-- Drafts show their planned date until the director saves a richer setup
-- revision, after which that setup remains authoritative.
create or replace function public.list_actor_tournament_workspaces_v1(p_actor_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with authorized as (
    select tournament.id as tournament_id,
      coalesce(latest_setup.tournament_name,tournament.name) as tournament_name,
      tournament.status as tournament_status,effective_role.role as effective_role,
      coalesce(to_char(latest_setup.starts_at,'MM-DD-YYYY'),to_char(tournament.planned_start_date,'MM-DD-YYYY'),'') as tournament_date,
      coalesce(latest_setup.starts_at,tournament.planned_start_date::timestamp) as tournament_starts_at
    from app.tournaments tournament
    join lateral (
      select candidate.role from (
        select role_assignment.role,case role_assignment.role when 'director' then 1 when 'co_director' then 2 when 'judge' then 3 when 'cross_checker' then 4 when 'player' then 5 when 'viewer' then 6 else 8 end priority
        from app.tournament_roles role_assignment where role_assignment.tournament_id=tournament.id
          and role_assignment.profile_id=p_actor_id and role_assignment.role in ('director','co_director','cross_checker','judge','player','viewer')
        union all select 'player',7 where exists(select 1 from app.event_participants participant
          where participant.tournament_id=tournament.id and participant.profile_id=p_actor_id and participant.status='checked_in')
      ) candidate order by candidate.priority limit 1
    ) effective_role on true
    left join lateral(select revision.tournament_name,revision.starts_at from app.tournament_setup_revisions revision
      where revision.tournament_id=tournament.id order by revision.version desc limit 1) latest_setup on true
    where coalesce((select auth.jwt()->>'role'),'')='service_role' and p_actor_id is not null
      and tournament.status in ('draft','open','pending_finalization','finalized')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'tournamentId',authorized.tournament_id,'tournamentName',authorized.tournament_name,
    'tournamentDate',authorized.tournament_date,'tournamentStatus',authorized.tournament_status,
    'effectiveRole',authorized.effective_role
  ) order by case authorized.tournament_status when 'open' then 1 when 'pending_finalization' then 2 when 'draft' then 3 when 'finalized' then 4 else 5 end,
    authorized.tournament_starts_at desc nulls last,lower(authorized.tournament_name),authorized.tournament_id),'[]'::jsonb)
  from authorized
$$;

revoke all on function public.get_director_access_workspace_v1(uuid) from public, anon, authenticated;
revoke all on function public.submit_director_application_v1(uuid,uuid) from public, anon, authenticated;
revoke all on function public.get_platform_director_admin_workspace_v1(uuid) from public, anon, authenticated;
revoke all on function public.review_director_application_v1(uuid,uuid,text,boolean,text,uuid) from public, anon, authenticated;
revoke all on function public.set_director_authorization_status_v1(uuid,uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.create_tournament_draft_v1(uuid,text,date,uuid) from public, anon, authenticated;
revoke all on function public.list_actor_tournament_workspaces_v1(uuid) from public, anon, authenticated;
grant execute on function public.get_director_access_workspace_v1(uuid) to service_role;
grant execute on function public.submit_director_application_v1(uuid,uuid) to service_role;
grant execute on function public.get_platform_director_admin_workspace_v1(uuid) to service_role;
grant execute on function public.review_director_application_v1(uuid,uuid,text,boolean,text,uuid) to service_role;
grant execute on function public.set_director_authorization_status_v1(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.create_tournament_draft_v1(uuid,text,date,uuid) to service_role;
grant execute on function public.list_actor_tournament_workspaces_v1(uuid) to service_role;

notify pgrst, 'reload schema';
