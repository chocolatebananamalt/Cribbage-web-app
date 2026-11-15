-- App-facing wrappers for roster-account linking and Standard Singles
-- enrollment. An actionable response must be backed by the exact current
-- official's operation receipt; unreceipted or revoked-role outcomes fail
-- closed as SQL null for the application route.

create or replace function public.link_roster_entry_to_account_v2(
  p_tournament_id uuid, p_roster_entry_id uuid, p_profile_id uuid, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_stored jsonb; v_hash text;
begin
  if auth.uid() is null or not exists (
    select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
      and r.profile_id = auth.uid() and r.role in ('director', 'co_director')
  ) then return null; end if;
  perform public.link_roster_entry_to_account(p_tournament_id, p_roster_entry_id, p_profile_id, p_idempotency_key);
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'link_roster_entry_to_account', p_tournament_id::text, p_roster_entry_id::text,
    p_profile_id::text, p_idempotency_key::text
  )::text, 'utf8'), 'sha256'), 'hex');
  select o.response_payload into v_stored from app.operation_receipts o
  where o.actor_profile_id = auth.uid() and o.tournament_id = p_tournament_id
    and o.operation_type = 'link_roster_entry_to_account' and o.target_id = p_roster_entry_id
    and o.client_operation_id = p_idempotency_key and o.request_hash = v_hash
    and exists (select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
      and r.profile_id = auth.uid() and r.role in ('director', 'co_director'))
  limit 1;
  if v_stored is null then return null; end if;
  return v_stored || jsonb_build_object('tournamentId', p_tournament_id, 'operationId', p_idempotency_key);
end;
$$;

create or replace function public.enroll_linked_roster_entry_in_event_v2(
  p_tournament_id uuid, p_event_id uuid, p_roster_entry_id uuid, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_stored jsonb; v_hash text;
begin
  if auth.uid() is null or not exists (
    select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
      and r.profile_id = auth.uid() and r.role in ('director', 'co_director')
  ) then return null; end if;
  perform public.enroll_linked_roster_entry_in_event(p_tournament_id, p_event_id, p_roster_entry_id, p_idempotency_key);
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'enroll_linked_roster_entry_in_event', p_tournament_id::text, p_event_id::text,
    p_roster_entry_id::text, p_idempotency_key::text
  )::text, 'utf8'), 'sha256'), 'hex');
  select o.response_payload into v_stored from app.operation_receipts o
  where o.actor_profile_id = auth.uid() and o.tournament_id = p_tournament_id
    and o.operation_type = 'enroll_linked_roster_entry_in_event' and o.target_id = p_roster_entry_id
    and o.client_operation_id = p_idempotency_key and o.request_hash = v_hash
    and exists (select 1 from app.tournament_roles r where r.tournament_id = p_tournament_id
      and r.profile_id = auth.uid() and r.role in ('director', 'co_director'))
  limit 1;
  if v_stored is null then return null; end if;
  return v_stored || jsonb_build_object('tournamentId', p_tournament_id, 'operationId', p_idempotency_key);
end;
$$;

revoke all on function public.link_roster_entry_to_account_v2(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.enroll_linked_roster_entry_in_event_v2(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.link_roster_entry_to_account_v2(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.enroll_linked_roster_entry_in_event_v2(uuid, uuid, uuid, uuid) to authenticated;
