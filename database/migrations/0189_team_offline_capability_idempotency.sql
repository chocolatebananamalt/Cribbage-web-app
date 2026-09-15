-- A lost capability-issuance response must be safe to retry after either team
-- submits. Bind the capability once, then resolve exact retries from that
-- immutable record before consulting mutable game or score state.
create or replace function public.issue_event_team_offline_capability_v2(
  p_actor_id uuid,p_session_binding_id text,p_game_id uuid,p_capability_id uuid,p_device_key_id uuid,p_public_jwk jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  game app.event_team_games%rowtype;
  entry_id uuid;
  side_value text;
  expires timestamptz:=clock_timestamp()+interval '20 hours';
  request_hash text;
  receipt_id uuid:=extensions.gen_random_uuid();
  response jsonb;
  prior app.event_team_offline_capabilities%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_game_id is null
     or p_capability_id is null or p_device_key_id is null then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('team-offline-capability:'||p_capability_id::text,0)
  );
  select * into prior from app.event_team_offline_capabilities where id=p_capability_id;
  if found then
    if prior.actor_profile_id is distinct from p_actor_id
       or prior.session_binding_id is distinct from p_session_binding_id
       or prior.device_key_id is distinct from p_device_key_id
       or prior.team_game_id is distinct from p_game_id
       or prior.public_jwk is distinct from p_public_jwk then
      return jsonb_build_object('status','rejected','code','idempotency_conflict');
    end if;
    return jsonb_build_object(
      'status','issued','version',1,
      'capabilityId',prior.id,'deviceKeyId',prior.device_key_id,
      'verifiedActorId',prior.actor_profile_id,'sessionBindingId',prior.session_binding_id,
      'tournamentId',prior.tournament_id,'eventId',prior.event_id,'gameId',prior.team_game_id,
      'assignedSide',prior.assigned_side,'submissionSlot',prior.submission_slot,
      'expectedGameVersion',prior.expected_game_version,
      'capabilityExpiresAtMs',floor(extract(epoch from prior.expires_at)*1000)::bigint
    );
  end if;

  if length(coalesce(p_session_binding_id,''))<8 or p_public_jwk->>'kty'<>'EC'
     or p_public_jwk->>'crv'<>'P-256' or p_public_jwk?'d' then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;

  select * into game from app.event_team_games where id=p_game_id for update;
  if not found or game.state not in('pending','submitted')
     or not exists(select 1 from app.event_team_starts start_record where start_record.event_id=game.event_id) then
    return jsonb_build_object('status','rejected','code','game_not_available');
  end if;
  select entry.id,case when entry.id=game.side_a_team_entry_id then 'a' else 'b' end
    into entry_id,side_value
    from app.event_team_entries entry
    join app.event_team_members member on member.team_id=entry.team_id
    join lateral(
      select * from app.event_team_entry_versions version
      where version.team_entry_id=entry.id order by version.version desc limit 1
    ) current_version on true
    where entry.id in(game.side_a_team_entry_id,game.side_b_team_entry_id)
      and member.profile_id=p_actor_id and current_version.scorecard_type='digital'
      and current_version.designated_scorer_profile_id=p_actor_id limit 1;
  if entry_id is null or exists(
    select 1 from app.event_team_score_submissions submission
    where submission.team_game_id=game.id and submission.side=side_value
  ) then
    return jsonb_build_object('status','rejected','code','not_authorized');
  end if;

  request_hash:=encode(extensions.digest(convert_to(jsonb_build_array(
    'issue_event_team_offline_capability_v2',p_actor_id,p_session_binding_id,p_game_id,
    p_capability_id,p_device_key_id,p_public_jwk
  )::text,'utf8'),'sha256'),'hex');
  response:=jsonb_build_object(
    'status','issued','version',1,'capabilityId',p_capability_id,'deviceKeyId',p_device_key_id,
    'verifiedActorId',p_actor_id,'sessionBindingId',p_session_binding_id,
    'tournamentId',game.tournament_id,'eventId',game.event_id,'gameId',game.id,
    'assignedSide',side_value,'submissionSlot',case when side_value='a' then 1 else 2 end,
    'expectedGameVersion',game.version,
    'capabilityExpiresAtMs',floor(extract(epoch from expires)*1000)::bigint
  );
  insert into app.operation_receipts(
    id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,
    client_operation_id,outcome,response_payload,applied_at
  ) values(
    receipt_id,p_actor_id,game.tournament_id,'issue_event_team_offline_capability_v2',
    p_capability_id,request_hash,p_capability_id,'accepted',response,clock_timestamp()
  );
  insert into app.event_team_offline_capabilities(
    id,tournament_id,event_id,team_game_id,actor_profile_id,nonce,capability_digest,
    expires_at,session_binding_id,device_key_id,public_jwk,assigned_side,submission_slot,
    expected_game_version
  ) values(
    p_capability_id,game.tournament_id,game.event_id,game.id,p_actor_id,p_device_key_id::text,
    request_hash,expires,p_session_binding_id,p_device_key_id,p_public_jwk,side_value,
    case when side_value='a' then 1 else 2 end,game.version
  );
  insert into app.audit_events(
    tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state
  ) values(
    game.tournament_id,p_actor_id,receipt_id,'event_team_game',game.id,
    'team_offline_capability_issued',jsonb_build_object(
      'capabilityId',p_capability_id,'deviceKeyId',p_device_key_id,
      'side',side_value,'expiresAt',expires
    )
  );
  return response;
end $$;
revoke all on function public.issue_event_team_offline_capability_v2(uuid,text,uuid,uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.issue_event_team_offline_capability_v2(uuid,text,uuid,uuid,uuid,jsonb)
  to service_role;

notify pgrst,'reload schema';
