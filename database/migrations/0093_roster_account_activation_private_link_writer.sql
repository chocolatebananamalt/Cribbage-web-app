-- The existing browser-facing roster-link writer derives its actor from an
-- authenticated browser JWT. Witnessed approval instead runs server-side, so
-- this private equivalent accepts only a server-verified actor and is never
-- granted to browser roles.

create function app.link_roster_account_service_v1(
  p_actor_id uuid, p_tournament_id uuid, p_roster_entry_id uuid, p_profile_id uuid,
  p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_status text; v_existing app.operation_receipts%rowtype; v_receipt_id uuid;
  v_link_id uuid := extensions.gen_random_uuid(); v_hash text; v_response jsonb;
begin
  perform app.roster_account_activation_service_only();
  if p_actor_id is null or p_tournament_id is null or p_roster_entry_id is null
    or p_profile_id is null or p_operation_id is null then
    raise exception using errcode = 'P0001', message = 'invalid private roster link';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'link_roster_entry_to_account_service_v1', p_actor_id::text, p_tournament_id::text,
    p_roster_entry_id::text, p_profile_id::text, p_operation_id::text
  )::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'roster-account-link:' || p_tournament_id::text || ':' || p_roster_entry_id::text, 0));
  select status into v_status from app.tournaments where id = p_tournament_id for update;
  if not found or v_status not in ('draft', 'open') then
    raise exception using errcode = 'P0001', message = 'tournament unavailable';
  end if;
  if not exists (select 1 from app.tournament_roles where tournament_id = p_tournament_id
    and profile_id = p_actor_id and role in ('director', 'co_director')) then
    raise exception using errcode = 'P0001', message = 'director role required';
  end if;
  if p_actor_id = p_profile_id then
    raise exception using errcode = 'P0001', message = 'independent linker required';
  end if;
  select * into v_existing from app.operation_receipts where actor_profile_id = p_actor_id
    and client_operation_id = p_operation_id for update;
  if found then
    if v_existing.request_hash = v_hash and v_existing.operation_type = 'link_roster_entry_to_account_service_v1'
      then return v_existing.response_payload;
    end if;
    raise exception using errcode = 'P0001', message = 'private link idempotency conflict';
  end if;
  if not exists (select 1 from app.tournament_roster_entries where id = p_roster_entry_id
    and tournament_id = p_tournament_id for update)
    or not exists (select 1 from app.profiles where id = p_profile_id)
    or exists (select 1 from app.roster_account_links where tournament_id = p_tournament_id
      and (roster_entry_id = p_roster_entry_id or profile_id = p_profile_id)) then
    raise exception using errcode = 'P0001', message = 'private roster link unavailable';
  end if;
  v_response := jsonb_build_object('status', 'roster_account_linked', 'linkId', v_link_id,
    'rosterEntryId', p_roster_entry_id, 'profileLinked', true, 'eventEnrolled', false,
    'roleGranted', false, 'checkedIn', false, 'seatAssigned', false);
  insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
    values(p_actor_id, p_tournament_id, 'link_roster_entry_to_account_service_v1', p_roster_entry_id,
      v_hash, p_operation_id, 'accepted', v_response, now()) returning id into v_receipt_id;
  insert into app.roster_account_links(id, tournament_id, roster_entry_id, profile_id, actor_profile_id, operation_receipt_id)
    values(v_link_id, p_tournament_id, p_roster_entry_id, p_profile_id, p_actor_id, v_receipt_id);
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
    values(p_tournament_id, p_actor_id, v_receipt_id, 'roster_account_link', v_link_id,
      'roster_account_linked', v_response);
  return v_response;
end;
$$;

revoke all on function app.link_roster_account_service_v1(uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
