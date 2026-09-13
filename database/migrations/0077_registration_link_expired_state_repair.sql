-- A link is only meaningfully "expired" while it would otherwise be usable.
-- Once registration or its tournament is closed, the director-facing state
-- must fail closed instead of suggesting the expired link is actionable.

create or replace function public.get_registration_link_state_v2(
  p_actor_id uuid,
  p_tournament_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_head app.tournament_registration_link_heads%rowtype;
  v_link app.tournament_registration_links%rowtype;
  v_tournament app.tournaments%rowtype;
  v_state text;
begin
  perform app.registration_v2_service_only();
  if p_actor_id is null or p_tournament_id is null then
    raise exception using errcode = 'P0001', message = 'invalid registration lifecycle request';
  end if;
  if not exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = p_actor_id
      and r.role in ('director', 'co_director')
  ) then
    raise exception using errcode = 'P0001', message = 'director role required';
  end if;
  select * into v_tournament from app.tournaments where id = p_tournament_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'registration lifecycle unavailable';
  end if;
  select * into v_head from app.tournament_registration_link_heads where tournament_id = p_tournament_id;
  if not found then return jsonb_build_object('status', 'none'); end if;
  select * into v_link from app.tournament_registration_links
  where id = v_head.registration_link_id and tournament_id = p_tournament_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'registration lifecycle unavailable';
  end if;
  v_state := case
    when v_head.state = 'open' and v_link.lifecycle_state = 'issued' and v_link.enabled
      and v_link.expires_at > now() and v_tournament.status in ('draft', 'open')
      and v_tournament.registration_status = 'open' then 'open'
    when v_head.state = 'open' and v_link.lifecycle_state = 'issued' and v_link.enabled
      and v_link.expires_at <= now() and v_tournament.status in ('draft', 'open')
      and v_tournament.registration_status = 'open' then 'expired'
    else 'closed'
  end;
  return jsonb_build_object(
    'status', v_state,
    'linkId', v_link.id,
    'issuedAt', v_link.issued_at,
    'expiresAt', v_link.expires_at,
    'maxClaims', v_link.max_claims,
    'maxClaimsPerHour', v_link.max_claims_per_hour,
    'version', v_head.version
  );
end;
$$;

revoke all on function public.get_registration_link_state_v2(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_registration_link_state_v2(uuid, uuid) to service_role;
