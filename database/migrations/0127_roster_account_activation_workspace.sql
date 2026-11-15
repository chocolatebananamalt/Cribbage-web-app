-- Private operational read model for the witnessed roster/account activation
-- ceremony. It exposes the selected roster label and lifecycle IDs to a
-- current director or co-director, but never the credential digest, salt, or
-- expected witness phrase.

create or replace function public.get_roster_account_activation_workspace_v1(
  p_actor_id uuid,
  p_tournament_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform app.roster_account_activation_service_only();
  if p_actor_id is null or p_tournament_id is null or not exists (
    select 1 from app.tournament_roles role_row
    where role_row.tournament_id = p_tournament_id
      and role_row.profile_id = p_actor_id
      and role_row.role in ('director', 'co_director')
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'tournamentName', tournament.name,
    'rosterEntries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rosterEntryId', roster.id,
        'displayName', roster.claimed_display_name,
        'activation', case when live_activation.id is null then null else jsonb_build_object(
          'activationId', live_activation.id,
          'state', case when live_activation.expires_at <= now() then 'expired' else live_activation.state end,
          'expiresAt', live_activation.expires_at
        ) end
      ) order by roster.claimed_normalized_name, roster.id)
      from app.tournament_roster_entries roster
      left join lateral (
        select activation.id, activation.state, activation.expires_at
        from app.roster_account_activations activation
        where activation.tournament_id = roster.tournament_id
          and activation.roster_entry_id = roster.id
          and activation.state in ('issued', 'pending')
        order by activation.issued_at desc, activation.id
        limit 1
      ) live_activation on true
      where roster.tournament_id = tournament.id
        and not exists (
          select 1 from app.roster_account_links link_row
          where link_row.tournament_id = roster.tournament_id
            and link_row.roster_entry_id = roster.id
        )
    ), '[]'::jsonb),
    'pendingRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'requestId', request_row.id,
        'activationId', activation.id,
        'rosterEntryId', roster.id,
        'rosterDisplayName', roster.claimed_display_name,
        'requestedAt', request_row.requested_at,
        'expiresAt', activation.expires_at,
        'canApprove', request_row.profile_id <> p_actor_id
      ) order by request_row.requested_at, request_row.id)
      from app.roster_account_activation_requests request_row
      join app.roster_account_activations activation
        on activation.id = request_row.activation_id
        and activation.tournament_id = request_row.tournament_id
      join app.tournament_roster_entries roster
        on roster.id = activation.roster_entry_id
        and roster.tournament_id = activation.tournament_id
      where request_row.tournament_id = tournament.id
        and request_row.state = 'pending'
        and activation.state = 'pending'
        and activation.expires_at > now()
    ), '[]'::jsonb)
  ) into v_result
  from app.tournaments tournament
  where tournament.id = p_tournament_id
    and tournament.status in ('draft', 'open');

  return v_result;
end;
$$;

revoke all on function public.get_roster_account_activation_workspace_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_roster_account_activation_workspace_v1(uuid, uuid)
  to service_role;
