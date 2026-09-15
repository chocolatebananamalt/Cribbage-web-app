-- Signed, session-bound offline queue for Digital team scorecards. The queue
-- shares the browser contract with singles but keeps separate database state.

alter table app.event_team_offline_capabilities
  add column session_binding_id text,
  add column device_key_id uuid,
  add column public_jwk jsonb,
  add column assigned_side text check(assigned_side in('a','b')),
  add column submission_slot smallint check(submission_slot in(1,2)),
  add column expected_game_version integer check(expected_game_version>0);
alter table app.event_team_offline_replays
  add column queue_id uuid,
  add column device_key_id uuid,
  add column signature text,
  add column disposition text check(disposition in('accepted','rejected','quarantined','conflict')),
  add column response_payload jsonb;
alter table app.event_team_offline_capabilities drop constraint if exists event_team_offline_capabilities_team_game_id_actor_profile_id_key;
alter table app.event_team_offline_replays add constraint event_team_offline_replays_queue_actor_unique unique(queue_id,actor_profile_id);

create or replace function public.issue_event_team_offline_capability_v2(
  p_actor_id uuid,p_session_binding_id text,p_game_id uuid,p_capability_id uuid,p_device_key_id uuid,p_public_jwk jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare game app.event_team_games%rowtype; entry_id uuid; side_value text; expires timestamptz:=clock_timestamp()+interval '20 hours';
  request_hash text; receipt_id uuid:=extensions.gen_random_uuid(); response jsonb; prior app.event_team_offline_capabilities%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or length(coalesce(p_session_binding_id,''))<8
    or p_public_jwk->>'kty'<>'EC' or p_public_jwk->>'crv'<>'P-256' or p_public_jwk?'d' then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  select * into game from app.event_team_games where id=p_game_id for update;
  if not found or game.state not in('pending','submitted') or not exists(select 1 from app.event_team_starts start_record where start_record.event_id=game.event_id) then
    return jsonb_build_object('status','rejected','code','game_not_available');
  end if;
  select entry.id,case when entry.id=game.side_a_team_entry_id then 'a' else 'b' end into entry_id,side_value
    from app.event_team_entries entry join app.event_team_members member on member.team_id=entry.team_id
    join lateral(select * from app.event_team_entry_versions version where version.team_entry_id=entry.id order by version.version desc limit 1) current_version on true
    where entry.id in(game.side_a_team_entry_id,game.side_b_team_entry_id) and member.profile_id=p_actor_id
      and current_version.scorecard_type='digital' and current_version.designated_scorer_profile_id=p_actor_id limit 1;
  if entry_id is null or exists(select 1 from app.event_team_score_submissions submission where submission.team_game_id=game.id and submission.side=side_value) then
    return jsonb_build_object('status','rejected','code','not_authorized');
  end if;
  select * into prior from app.event_team_offline_capabilities where id=p_capability_id;
  if found then
    if prior.actor_profile_id<>p_actor_id or prior.session_binding_id<>p_session_binding_id or prior.device_key_id<>p_device_key_id or prior.team_game_id<>p_game_id or prior.public_jwk<>p_public_jwk then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
    expires:=prior.expires_at;
  else
    request_hash:=encode(extensions.digest(convert_to(jsonb_build_array('issue_event_team_offline_capability_v2',p_actor_id,p_session_binding_id,p_game_id,p_capability_id,p_device_key_id,p_public_jwk)::text,'utf8'),'sha256'),'hex');
    insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(receipt_id,p_actor_id,game.tournament_id,'issue_event_team_offline_capability_v2',p_capability_id,request_hash,p_capability_id,'accepted','{}'::jsonb,clock_timestamp());
    insert into app.event_team_offline_capabilities(id,tournament_id,event_id,team_game_id,actor_profile_id,nonce,capability_digest,expires_at,session_binding_id,device_key_id,public_jwk,assigned_side,submission_slot,expected_game_version)
      values(p_capability_id,game.tournament_id,game.event_id,game.id,p_actor_id,p_device_key_id::text,request_hash,expires,p_session_binding_id,p_device_key_id,p_public_jwk,side_value,case when side_value='a' then 1 else 2 end,game.version);
    insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
      values(game.tournament_id,p_actor_id,receipt_id,'event_team_game',game.id,'team_offline_capability_issued',jsonb_build_object('capabilityId',p_capability_id,'deviceKeyId',p_device_key_id,'side',side_value,'expiresAt',expires));
  end if;
  return jsonb_build_object('status','issued','version',1,'capabilityId',p_capability_id,'deviceKeyId',p_device_key_id,'verifiedActorId',p_actor_id,'sessionBindingId',p_session_binding_id,'tournamentId',game.tournament_id,'eventId',game.event_id,'gameId',game.id,'assignedSide',side_value,'submissionSlot',case when side_value='a' then 1 else 2 end,'expectedGameVersion',game.version,'capabilityExpiresAtMs',floor(extract(epoch from expires)*1000)::bigint);
end $$;
revoke all on function public.issue_event_team_offline_capability_v2(uuid,text,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.issue_event_team_offline_capability_v2(uuid,text,uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.get_event_team_offline_capability_v2(p_actor_id uuid,p_session_binding_id text,p_capability_id uuid,p_queue_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select case when coalesce(auth.role(),'')='service_role' and capability.actor_profile_id=p_actor_id and capability.session_binding_id=p_session_binding_id then jsonb_build_object(
  'capabilityId',capability.id,'deviceKeyId',capability.device_key_id,'verifiedActorId',capability.actor_profile_id,'sessionBindingId',capability.session_binding_id,
  'tournamentId',capability.tournament_id,'eventId',capability.event_id,'gameId',capability.team_game_id,'assignedSide',capability.assigned_side,
  'submissionSlot',capability.submission_slot,'expectedGameVersion',capability.expected_game_version,'capabilityExpiresAtMs',floor(extract(epoch from capability.expires_at)*1000)::bigint,
  'publicJwk',capability.public_jwk,'priorReceipt',(select jsonb_build_object('version',1,'queueId',replay.queue_id,'clientOperationId',replay.client_operation_id,'kind','submission','gameId',replay.team_game_id,'submissionId',replay.replayed_submission_id,'payloadDigest',replay.payload_digest,'disposition',replay.disposition) from app.event_team_offline_replays replay where replay.queue_id=p_queue_id and replay.actor_profile_id=p_actor_id)
) else null end from app.event_team_offline_capabilities capability where capability.id=p_capability_id
$$;
revoke all on function public.get_event_team_offline_capability_v2(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_team_offline_capability_v2(uuid,text,uuid,uuid) to service_role;

create or replace function public.replay_event_team_offline_score_v2(
  p_actor_id uuid,p_session_binding_id text,p_queue_id uuid,p_client_operation_id uuid,p_capability_id uuid,p_device_key_id uuid,
  p_tournament_id uuid,p_event_id uuid,p_game_id uuid,p_assigned_side text,p_expected_game_version integer,
  p_submission_id uuid,p_submission_slot integer,p_winner_side text,p_margin integer,p_payload_digest text,p_signature text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare capability app.event_team_offline_capabilities%rowtype; game app.event_team_games%rowtype; prior app.event_team_offline_replays%rowtype; result jsonb; disposition_value text;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_assigned_side not in('a','b') or p_winner_side not in('a','b') or p_margin not between 1 and 121 or p_submission_slot not in(1,2) or p_payload_digest!~'^[0-9a-f]{64}$' or length(coalesce(p_signature,''))<16 then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-offline-replay:'||p_queue_id::text,0));
  select * into prior from app.event_team_offline_replays where queue_id=p_queue_id and actor_profile_id=p_actor_id;
  if found then
    if prior.client_operation_id<>p_client_operation_id or prior.payload_digest<>p_payload_digest or prior.signature<>p_signature then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
    return jsonb_build_object('status','team_offline_replayed','disposition',prior.disposition);
  end if;
  select * into capability from app.event_team_offline_capabilities where id=p_capability_id and actor_profile_id=p_actor_id for update;
  select * into game from app.event_team_games where id=p_game_id and tournament_id=p_tournament_id and event_id=p_event_id for update;
  if capability.id is null or game.id is null or capability.session_binding_id<>p_session_binding_id or capability.device_key_id<>p_device_key_id or capability.team_game_id<>p_game_id or capability.assigned_side<>p_assigned_side or capability.submission_slot<>p_submission_slot or capability.expected_game_version<>p_expected_game_version then disposition_value:='rejected';
  elsif capability.expires_at<clock_timestamp() or game.version<>p_expected_game_version or game.state not in('pending','submitted') then disposition_value:='quarantined';
  else
    result:=public.submit_event_team_score_v1(p_actor_id,p_tournament_id,p_game_id,p_submission_id,p_winner_side,p_margin,p_client_operation_id);
    disposition_value:=case when result->>'status'='team_score_submitted' then 'accepted' when result->>'code'='idempotency_conflict' then 'conflict' else 'quarantined' end;
  end if;
  insert into app.event_team_offline_replays(id,tournament_id,event_id,team_game_id,capability_id,actor_profile_id,client_operation_id,payload_digest,replayed_submission_id,queue_id,device_key_id,signature,disposition,response_payload)
    values(extensions.gen_random_uuid(),p_tournament_id,p_event_id,p_game_id,p_capability_id,p_actor_id,p_client_operation_id,p_payload_digest,p_submission_id,p_queue_id,p_device_key_id,p_signature,disposition_value,coalesce(result,jsonb_build_object('status','rejected','code','offline_scope_or_version_mismatch')));
  return jsonb_build_object('status','team_offline_replayed','disposition',disposition_value);
end $$;
revoke all on function public.replay_event_team_offline_score_v2(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,integer,uuid,integer,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.replay_event_team_offline_score_v2(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,integer,uuid,integer,text,integer,text,text) to service_role;

notify pgrst,'reload schema';
