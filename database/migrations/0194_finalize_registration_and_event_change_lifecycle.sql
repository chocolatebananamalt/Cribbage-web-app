-- A tournament draft is privately editable. One explicit primary-director
-- operation finalizes the complete setup and opens registration. Event changes
-- after that point are append-only retire/replace operations, never deletes.

alter table app.events
  add column operational_state text not null default 'active'
  check (operational_state in ('active','retired','replaced'));

create index events_operational_state_idx on app.events(tournament_id, operational_state);

create table app.tournament_setup_finalization_confirmations (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  setup_revision_id uuid not null,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  activation_receipt_id uuid not null references app.operation_receipts(id) on delete restrict,
  confirmed_at timestamptz not null default clock_timestamp(),
  unique (tournament_id),
  unique (activation_receipt_id),
  foreign key (setup_revision_id, tournament_id)
    references app.tournament_setup_revisions(id, tournament_id) on delete restrict
);
alter table app.tournament_setup_finalization_confirmations enable row level security;
alter table app.tournament_setup_finalization_confirmations force row level security;
revoke all on table app.tournament_setup_finalization_confirmations from public, anon, authenticated;
create trigger tournament_setup_finalization_confirmations_immutable
before update or delete on app.tournament_setup_finalization_confirmations
for each row execute function app.reject_immutable_history();

create table app.event_change_operations (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  original_event_id uuid not null,
  replacement_event_id uuid,
  operation_kind text not null check (operation_kind in ('retire','replace')),
  reason text not null check (length(trim(reason)) between 1 and 500),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  actor_authority text not null check (actor_authority in ('primary_director','platform_emergency_override')),
  operation_receipt_id uuid not null references app.operation_receipts(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (original_event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  foreign key (replacement_event_id, tournament_id) references app.events(id, tournament_id) on delete restrict,
  check ((operation_kind = 'retire' and replacement_event_id is null)
    or (operation_kind = 'replace' and replacement_event_id is not null)),
  unique (original_event_id),
  unique (operation_receipt_id)
);
alter table app.event_change_operations enable row level security;
alter table app.event_change_operations force row level security;
revoke all on table app.event_change_operations from public, anon, authenticated;
create trigger event_change_operations_immutable before update or delete on app.event_change_operations
for each row execute function app.reject_immutable_history();
create index event_change_operations_tournament_idx on app.event_change_operations(tournament_id, created_at desc);

-- Draft creation used to set registration open even though no setup had been
-- finalized. New drafts and safe existing drafts are closed until finalization.
update app.tournaments tournament
set registration_status = 'closed'
where tournament.status = 'draft'
  and tournament.registration_status = 'open'
  and not exists (select 1 from app.tournament_setup_activations activation where activation.tournament_id = tournament.id)
  and not exists (select 1 from app.tournament_roster_entries roster where roster.tournament_id = tournament.id);

create or replace function public.create_tournament_draft_v1(
  p_actor_id uuid, p_name text, p_planned_start_date date, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_name text := trim(p_name); v_hash text; v_existing app.operation_receipts%rowtype;
  v_tournament_id uuid := extensions.gen_random_uuid(); v_receipt uuid; v_response jsonb; v_code text;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then raise exception using errcode='P0001', message='server-only tournament creation'; end if;
  if p_actor_id is null or p_operation_id is null or p_planned_start_date is null or v_name is null or length(v_name) not between 1 and 200 then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array('create_tournament_draft_v1',p_actor_id::text,v_name,p_planned_start_date::text,p_operation_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then if v_existing.operation_type='create_tournament_draft_v1' and v_existing.request_hash=v_hash then return v_existing.response_payload; end if; return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
  if not exists(select 1 from app.director_authorizations where profile_id=p_actor_id and status='approved') then return jsonb_build_object('status','rejected','code','director_approval_required'); end if;
  if exists(select 1 from app.tournaments where creator_profile_id=p_actor_id and lower(name)=lower(v_name) and planned_start_date=p_planned_start_date and status<>'archived') then return jsonb_build_object('status','rejected','code','duplicate_tournament'); end if;
  insert into app.tournaments(id,director_profile_id,creator_profile_id,name,status,registration_status,planned_start_date) values(v_tournament_id,p_actor_id,p_actor_id,v_name,'draft','closed',p_planned_start_date);
  insert into app.tournament_roles(tournament_id,profile_id,role) values(v_tournament_id,p_actor_id,'director');
  v_response := jsonb_build_object('status','tournament_created','tournamentId',v_tournament_id,'tournamentName',v_name,'tournamentDate',to_char(p_planned_start_date,'MM-DD-YYYY'));
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_tournament_id,p_actor_id,'create_tournament_draft_v1',v_tournament_id,v_hash,p_operation_id,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(v_tournament_id,p_actor_id,v_receipt,'tournament',v_tournament_id,'tournament_draft_created',v_response);
  return v_response;
end;
$$;

-- The browser uses this wrapper, rather than the historic activation function,
-- to bind the explicit confirmation to the same atomic finalization operation.
create function public.finalize_tournament_setup_and_open_registration_v1(
  p_actor_id uuid, p_tournament_id uuid, p_setup_revision_id uuid,
  p_expected_version integer, p_confirmed boolean, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_receipt_id uuid; v_response jsonb;
begin
  if p_confirmed is distinct from true then return jsonb_build_object('status','rejected','code','confirmation_required'); end if;
  v_result := public.activate_tournament_setup_v2(p_actor_id,p_tournament_id,p_setup_revision_id,p_expected_version,p_idempotency_key);
  if v_result->>'status' <> 'tournament_setup_activated' then return v_result; end if;
  select id into v_receipt_id from app.operation_receipts where actor_profile_id=p_actor_id and tournament_id=p_tournament_id and client_operation_id=p_idempotency_key and operation_type='activate_tournament_setup_v2' order by applied_at desc limit 1;
  if v_receipt_id is null then raise exception using errcode='P0001',message='activation receipt unavailable'; end if;
  insert into app.tournament_setup_finalization_confirmations(tournament_id,setup_revision_id,actor_profile_id,activation_receipt_id)
  values(p_tournament_id,p_setup_revision_id,p_actor_id,v_receipt_id)
  on conflict (tournament_id) do nothing;
  update app.tournaments set registration_status='open' where id=p_tournament_id and status='open';
  v_response := v_result || jsonb_build_object('registrationState','open');
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  select p_tournament_id,p_actor_id,v_receipt_id,'tournament_setup_finalization',p_setup_revision_id,'tournament_setup_finalized_and_registration_opened',v_response
  where not exists(select 1 from app.audit_events audit where audit.operation_receipt_id=v_receipt_id and audit.action='tournament_setup_finalized_and_registration_opened');
  return v_response;
end;
$$;
revoke all on function public.finalize_tournament_setup_and_open_registration_v1(uuid,uuid,uuid,integer,boolean,uuid) from public,anon,authenticated;
grant execute on function public.finalize_tournament_setup_and_open_registration_v1(uuid,uuid,uuid,integer,boolean,uuid) to service_role;

-- Registration links and public claims have a database guard in addition to
-- the screen/route guard; an unfinalized draft is never publicly registerable.
alter function public.issue_registration_link_v2(uuid,uuid,uuid,bytea,bytea,timestamptz,integer,integer,uuid) rename to issue_registration_link_v2_legacy;
create function public.issue_registration_link_v2(p_actor_id uuid,p_tournament_id uuid,p_link_id uuid,p_salt bytea,p_digest bytea,p_expires_at timestamptz,p_max_claims integer,p_max_claims_per_hour integer,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
  if not exists(select 1 from app.tournament_setup_activations where tournament_id=p_tournament_id)
    or not exists(select 1 from app.tournaments where id=p_tournament_id and status='open' and registration_status='open') then
    return jsonb_build_object('status','rejected','code','registration_not_open');
  end if;
  return public.issue_registration_link_v2_legacy(p_actor_id,p_tournament_id,p_link_id,p_salt,p_digest,p_expires_at,p_max_claims,p_max_claims_per_hour,p_operation_id);
end $$;
alter function public.rotate_registration_link_v2(uuid,uuid,uuid,integer,uuid,bytea,bytea,timestamptz,integer,integer,uuid) rename to rotate_registration_link_v2_legacy;
create function public.rotate_registration_link_v2(p_actor_id uuid,p_tournament_id uuid,p_expected_link_id uuid,p_expected_version integer,p_link_id uuid,p_salt bytea,p_digest bytea,p_expires_at timestamptz,p_max_claims integer,p_max_claims_per_hour integer,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
  if not exists(select 1 from app.tournament_setup_activations where tournament_id=p_tournament_id)
    or not exists(select 1 from app.tournaments where id=p_tournament_id and status='open' and registration_status='open') then
    return jsonb_build_object('status','rejected','code','registration_not_open');
  end if;
  return public.rotate_registration_link_v2_legacy(p_actor_id,p_tournament_id,p_expected_link_id,p_expected_version,p_link_id,p_salt,p_digest,p_expires_at,p_max_claims,p_max_claims_per_hour,p_operation_id);
end $$;
revoke all on function public.issue_registration_link_v2_legacy(uuid,uuid,uuid,bytea,bytea,timestamptz,integer,integer,uuid) from public,anon,authenticated;
revoke all on function public.rotate_registration_link_v2_legacy(uuid,uuid,uuid,integer,uuid,bytea,bytea,timestamptz,integer,integer,uuid) from public,anon,authenticated;
revoke all on function public.issue_registration_link_v2(uuid,uuid,uuid,bytea,bytea,timestamptz,integer,integer,uuid) from public,anon,authenticated;
revoke all on function public.rotate_registration_link_v2(uuid,uuid,uuid,integer,uuid,bytea,bytea,timestamptz,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.issue_registration_link_v2(uuid,uuid,uuid,bytea,bytea,timestamptz,integer,integer,uuid) to service_role;
grant execute on function public.rotate_registration_link_v2(uuid,uuid,uuid,integer,uuid,bytea,bytea,timestamptz,integer,integer,uuid) to service_role;

alter function public.submit_registration_claim_v3(uuid,bytea,text,text,text,text,text,uuid) rename to submit_registration_claim_v3_legacy;
create function public.submit_registration_claim_v3(p_link_id uuid,p_digest bytea,p_display_name text,p_email text,p_acc_number text,p_intended_payment_method text,p_scorecard_type text,p_client_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tournament_id uuid;
begin
  select link.tournament_id into v_tournament_id from app.tournament_registration_links link where link.id=p_link_id and app.fixed_32_byte_equal(link.token_digest,p_digest);
  if not found or not exists(select 1 from app.tournament_setup_activations where tournament_id=v_tournament_id)
    or not exists(select 1 from app.tournaments where id=v_tournament_id and status='open' and registration_status='open') then return jsonb_build_object('status','unavailable'); end if;
  return public.submit_registration_claim_v3_legacy(p_link_id,p_digest,p_display_name,p_email,p_acc_number,p_intended_payment_method,p_scorecard_type,p_client_operation_id);
end $$;
revoke all on function public.submit_registration_claim_v3_legacy(uuid,bytea,text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.submit_registration_claim_v3(uuid,bytea,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.submit_registration_claim_v3(uuid,bytea,text,text,text,text,text,uuid) to service_role;

alter function public.get_public_registration_payment_options_v1(uuid,bytea) rename to get_public_registration_payment_options_v1_legacy;
create function public.get_public_registration_payment_options_v1(p_link_id uuid,p_digest bytea)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_tournament_id uuid;
begin
  select link.tournament_id into v_tournament_id from app.tournament_registration_links link
    where link.id=p_link_id and app.fixed_32_byte_equal(link.token_digest,p_digest);
  if not found or not exists(select 1 from app.tournament_setup_activations where tournament_id=v_tournament_id)
    or not exists(select 1 from app.tournaments where id=v_tournament_id and status='open' and registration_status='open') then return null; end if;
  return public.get_public_registration_payment_options_v1_legacy(p_link_id,p_digest);
end $$;
revoke all on function public.get_public_registration_payment_options_v1_legacy(uuid,bytea) from public,anon,authenticated;
revoke all on function public.get_public_registration_payment_options_v1(uuid,bytea) from public,anon,authenticated;
grant execute on function public.get_public_registration_payment_options_v1(uuid,bytea) to service_role;

alter function public.get_registration_link_redemption_material_v2(uuid) rename to get_registration_link_redemption_material_v2_legacy;
create function public.get_registration_link_redemption_material_v2(p_link_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_tournament_id uuid;
begin
  select tournament_id into v_tournament_id from app.tournament_registration_links where id=p_link_id;
  if not found or not exists(select 1 from app.tournament_setup_activations where tournament_id=v_tournament_id)
    or not exists(select 1 from app.tournaments where id=v_tournament_id and status='open' and registration_status='open') then return null; end if;
  return public.get_registration_link_redemption_material_v2_legacy(p_link_id);
end $$;
revoke all on function public.get_registration_link_redemption_material_v2_legacy(uuid) from public,anon,authenticated;
revoke all on function public.get_registration_link_redemption_material_v2(uuid) from public,anon,authenticated;
grant execute on function public.get_registration_link_redemption_material_v2(uuid) to service_role;

create or replace function app.require_active_event_for_enrollment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from app.events event_row where event_row.id=new.event_id and event_row.tournament_id=new.tournament_id and event_row.operational_state='active') then
    raise exception using errcode='P0001',message='event is retired';
  end if;
  return new;
end $$;
revoke all on function app.require_active_event_for_enrollment() from public,anon,authenticated;
create trigger event_participants_require_active_event before insert on app.event_participants
for each row execute function app.require_active_event_for_enrollment();

alter function public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid)
  rename to start_event_play_v1_legacy;
create or replace function public.start_event_play_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_schedule_publication_id uuid,
  p_participant_snapshot_digest text,p_expected_participant_count integer,
  p_expected_game_count integer,p_confirmed boolean,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from app.events where id=p_event_id and tournament_id=p_tournament_id and operational_state='active') then
    return jsonb_build_object('status','rejected','code','event_retired');
  end if;
  -- Delegate every established scheduling, attendance, and idempotency guard.
  return public.start_event_play_v1_legacy(p_actor_id,p_tournament_id,p_event_id,p_schedule_publication_id,p_participant_snapshot_digest,p_expected_participant_count,p_expected_game_count,p_confirmed,p_idempotency_key);
end $$;
revoke all on function public.start_event_play_v1_legacy(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) from public,anon,authenticated;
revoke all on function public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) from public,anon,authenticated;
grant execute on function public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) to service_role;

create function public.get_event_change_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when p_actor_id is not null and p_tournament_id is not null and (
    app.is_platform_administrator(p_actor_id) or exists(
      select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
        and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')
    )
  ) then jsonb_build_object(
    'tournamentName',tournament.name,
    'canManage',tournament.director_profile_id=p_actor_id or app.is_platform_administrator(p_actor_id),
    'events',coalesce((select jsonb_agg(jsonb_build_object(
      'eventId',event_row.id,'name',event_row.name,'eventType',event_row.event_type,
      'format',event_row.format,'operationalState',event_row.operational_state,
      'participantCount',(select count(*) from app.event_participants participant where participant.event_id=event_row.id),
      'hasStarted',exists(select 1 from app.event_play_starts started where started.event_id=event_row.id)
        or exists(select 1 from app.event_team_starts team_started where team_started.event_id=event_row.id),
      'replacementEventId',change_row.replacement_event_id,'reason',change_row.reason
    ) order by setup_event.ordinal,event_row.id)
    from app.tournament_setup_activations activation
    join app.events event_row on event_row.id=activation.event_id and event_row.tournament_id=activation.tournament_id
    join app.tournament_setup_event_versions setup_event on setup_event.id=activation.setup_event_version_id and setup_event.tournament_id=activation.tournament_id
    left join app.event_change_operations change_row on change_row.original_event_id=event_row.id
    where activation.tournament_id=tournament.id),'[]'::jsonb)
  ) else null end
  from app.tournaments tournament where tournament.id=p_tournament_id
$$;
revoke all on function public.get_event_change_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_change_workspace_v1(uuid,uuid) to service_role;

create function public.change_event_lifecycle_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_action text,p_reason text,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tournament app.tournaments%rowtype; v_event app.events%rowtype; v_hash text;
  v_existing app.operation_receipts%rowtype; v_receipt_id uuid:=extensions.gen_random_uuid();
  v_change_id uuid:=extensions.gen_random_uuid(); v_replacement_id uuid:=extensions.gen_random_uuid();
  v_ruleset_id uuid:=extensions.gen_random_uuid(); v_response jsonb; v_authority text; v_replacement_name text;
  v_base app.tournament_setup_revisions%rowtype; v_revision_id uuid:=extensions.gen_random_uuid();
  v_setup_event app.tournament_setup_event_versions%rowtype; v_copy_setup_event_id uuid;
  v_replacement_setup_event_id uuid; v_activation_id uuid:=extensions.gen_random_uuid();
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null
    or p_action not in('retire','replace') or length(trim(coalesce(p_reason,''))) not between 1 and 500 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('change_event_lifecycle_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_action,trim(p_reason))::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  select * into v_tournament from app.tournaments where id=p_tournament_id for update;
  if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable'); end if;
  if v_tournament.status <> 'open' or v_tournament.registration_status <> 'open'
    or not exists(select 1 from app.tournament_setup_finalization_confirmations where tournament_id=p_tournament_id) then
    return jsonb_build_object('status','rejected','code','registration_not_open');
  end if;
  if p_actor_id=v_tournament.director_profile_id then v_authority:='primary_director';
  elsif app.is_platform_administrator(p_actor_id) then v_authority:='platform_emergency_override';
  else return jsonb_build_object('status','rejected','code','primary_director_required'); end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then if v_existing.request_hash=v_hash and v_existing.operation_type='change_event_lifecycle_v1' then return v_existing.response_payload; end if; return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
  select * into v_event from app.events where id=p_event_id and tournament_id=p_tournament_id for update;
  if not found then return jsonb_build_object('status','rejected','code','event_unavailable'); end if;
  if v_event.operational_state<>'active' then return jsonb_build_object('status','rejected','code','event_already_changed'); end if;
  if exists(select 1 from app.event_play_starts where event_id=p_event_id)
    or exists(select 1 from app.event_team_starts where event_id=p_event_id) then return jsonb_build_object('status','rejected','code','event_already_started'); end if;
  if p_action='replace' then
    v_replacement_name:=left(v_event.name || ' (Replacement)',200);
    if exists(select 1 from app.events where tournament_id=p_tournament_id and lower(name)=lower(v_replacement_name)) then
      return jsonb_build_object('status','rejected','code','replacement_name_conflict');
    end if;
    select * into v_base from app.tournament_setup_revisions
      where tournament_id=p_tournament_id order by version desc limit 1 for update;
    if not found then return jsonb_build_object('status','rejected','code','setup_unavailable'); end if;
    v_response:=jsonb_build_object('status','event_replaced','eventId',p_event_id,
      'replacementEventId',v_replacement_id,'operationId',v_change_id,
      'replacementSetupRevisionId',v_revision_id);
    insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(v_receipt_id,p_actor_id,p_tournament_id,'change_event_lifecycle_v1',v_change_id,v_hash,p_operation_id,'accepted',v_response,clock_timestamp());
    -- A replacement gets its own immutable setup snapshot. The director can
    -- review/edit that draft through the established amendment workflow before
    -- enrolling anyone; historical activation rows remain untouched.
    insert into app.tournament_setup_revisions(
      id,tournament_id,version,tournament_name,city,venue,starts_at,ends_at,timezone_name,
      contact_details,sanctioning_fee_cents,actor_profile_id,operation_receipt_id,
      tournament_contact_phone,tournament_contact_email,tournament_mailing_address
    ) values (
      v_revision_id,p_tournament_id,v_base.version+1,v_base.tournament_name,v_base.city,v_base.venue,
      v_base.starts_at,v_base.ends_at,v_base.timezone_name,v_base.contact_details,v_base.sanctioning_fee_cents,
      p_actor_id,v_receipt_id,v_base.tournament_contact_phone,v_base.tournament_contact_email,v_base.tournament_mailing_address
    );
    insert into app.tournament_setup_official_versions(tournament_id,setup_revision_id,profile_id,role)
      select p_tournament_id,v_revision_id,profile_id,role
      from app.tournament_setup_official_versions where setup_revision_id=v_base.id;
    for v_setup_event in select * from app.tournament_setup_event_versions
      where setup_revision_id=v_base.id order by ordinal
    loop
      v_copy_setup_event_id:=extensions.gen_random_uuid();
      insert into app.tournament_setup_event_versions(
        id,tournament_id,setup_revision_id,client_row_id,ordinal,event_kind,display_name,starts_at,timezone_name,
        style_code,format_code,game_count,entry_fee_cents,fee_includes_note,payout_note,qualification_note,
        eligibility_note,muggins_status,source_status
      ) values (
        v_copy_setup_event_id,p_tournament_id,v_revision_id,v_setup_event.client_row_id,v_setup_event.ordinal,
        v_setup_event.event_kind,v_setup_event.display_name,v_setup_event.starts_at,v_setup_event.timezone_name,
        v_setup_event.style_code,v_setup_event.format_code,v_setup_event.game_count,v_setup_event.entry_fee_cents,
        v_setup_event.fee_includes_note,v_setup_event.payout_note,v_setup_event.qualification_note,
        v_setup_event.eligibility_note,v_setup_event.muggins_status,v_setup_event.source_status
      );
      insert into app.tournament_setup_q_pool_versions(
        tournament_id,setup_revision_id,setup_event_version_id,slot,pool_type_code,entry_fee_cents,note,source_status
      ) select p_tournament_id,v_revision_id,v_copy_setup_event_id,slot,pool_type_code,entry_fee_cents,note,source_status
        from app.tournament_setup_q_pool_versions where setup_event_version_id=v_setup_event.id;
      if v_setup_event.id=(select setup_event_version_id from app.tournament_setup_activations
          where event_id=p_event_id and tournament_id=p_tournament_id) then
        v_replacement_setup_event_id:=v_copy_setup_event_id;
      end if;
    end loop;
    if v_replacement_setup_event_id is null then raise exception using errcode='P0001',message='replacement source unavailable'; end if;
    insert into app.ruleset_versions(id,tournament_id,name,format,source_reference,effective_on,approved_at)
      select v_ruleset_id,p_tournament_id,left(source.name || ' replacement ' || left(v_replacement_id::text,8),200),
        source.format,source.source_reference,source.effective_on,source.approved_at
      from app.ruleset_versions source where source.id=v_event.ruleset_version_id and source.tournament_id=p_tournament_id;
    if not found then raise exception using errcode='P0001',message='ruleset unavailable'; end if;
    insert into app.events(id,tournament_id,ruleset_version_id,name,event_type,format,scoring_method,operational_state)
      values(v_replacement_id,p_tournament_id,v_ruleset_id,v_replacement_name,v_event.event_type,v_event.format,v_event.scoring_method,'active');
    insert into app.tournament_setup_activations(
      id,tournament_id,setup_revision_id,setup_event_version_id,ruleset_version_id,event_id,actor_profile_id,operation_receipt_id
    ) values(v_activation_id,p_tournament_id,v_revision_id,v_replacement_setup_event_id,v_ruleset_id,v_replacement_id,p_actor_id,v_receipt_id);
  else v_replacement_id:=null; end if;
  update app.events set operational_state=case when p_action='replace' then 'replaced' else 'retired' end where id=p_event_id;
  if p_action='retire' then
    v_response:=jsonb_build_object('status','event_retired','eventId',p_event_id,'replacementEventId',null,'operationId',v_change_id);
    insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
    values(v_receipt_id,p_actor_id,p_tournament_id,'change_event_lifecycle_v1',v_change_id,v_hash,p_operation_id,'accepted',v_response,clock_timestamp());
  end if;
  insert into app.event_change_operations(id,tournament_id,original_event_id,replacement_event_id,operation_kind,reason,actor_profile_id,actor_authority,operation_receipt_id)
  values(v_change_id,p_tournament_id,p_event_id,v_replacement_id,p_action,trim(p_reason),p_actor_id,v_authority,v_receipt_id);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
  values(p_tournament_id,p_actor_id,v_receipt_id,'event_change',v_change_id,'event_'||p_action||'d',jsonb_build_object('eventId',p_event_id,'state','active'),v_response);
  return v_response;
exception when others then
  if sqlstate='P0001' then return jsonb_build_object('status','rejected','code','operation_unavailable'); end if;
  raise;
end $$;
revoke all on function public.change_event_lifecycle_v1(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.change_event_lifecycle_v1(uuid,uuid,uuid,text,text,uuid) to service_role;

notify pgrst, 'reload schema';
