-- October pilot active-game progression. Published future games remain visible,
-- but only a participant's earliest unresolved game in each event can accept a
-- new digital submission or receive an offline capability/replay.

create or replace function app.game_is_authoritatively_resolved_v1(p_game_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select game.state in('verified','corrected')
      or exists(select 1 from app.device_failure_recoveries recovery
        where recovery.canonical_game_id=game.id and app.device_recovery_is_approved(recovery.id))
      or exists(select 1 from app.paper_game_completions completion
        where completion.canonical_game_id=game.id and app.paper_game_completion_is_approved(completion.id))
    from app.canonical_games game where game.id=p_game_id),false)
$$;
revoke all on function app.game_is_authoritatively_resolved_v1(uuid) from public,anon,authenticated;

create or replace function app.participant_game_progression_v1(p_game_id uuid,p_participant_id uuid)
returns text language sql stable security definer set search_path='' as $$
  with target_rows as(
    select game.id,game.tournament_id,game.event_id,round_row.round_number,game.match_instance,schedule.import_row_number
    from app.canonical_games game
    join app.rounds round_row on round_row.id=game.round_id and round_row.tournament_id=game.tournament_id and round_row.event_id=game.event_id
    join app.event_schedule_games schedule on schedule.canonical_game_id=game.id and schedule.tournament_id=game.tournament_id and schedule.event_id=game.event_id
    where game.id=p_game_id and p_participant_id in(game.side_a_participant_id,game.side_b_participant_id)
  ), target as(
    select min(id::text)::uuid id,min(tournament_id::text)::uuid tournament_id,min(event_id::text)::uuid event_id,
      min(round_number) round_number,min(match_instance) match_instance,min(import_row_number) import_row_number
    from target_rows having count(*)=1
  )
  select case when app.game_is_authoritatively_resolved_v1(target.id) then 'completed'
    when not exists(
      select 1 from app.canonical_games earlier
      join app.rounds earlier_round on earlier_round.id=earlier.round_id and earlier_round.tournament_id=earlier.tournament_id and earlier_round.event_id=earlier.event_id
      join app.event_schedule_games earlier_schedule on earlier_schedule.canonical_game_id=earlier.id
        and earlier_schedule.tournament_id=earlier.tournament_id and earlier_schedule.event_id=earlier.event_id
      where earlier.tournament_id=target.tournament_id and earlier.event_id=target.event_id
        and p_participant_id in(earlier.side_a_participant_id,earlier.side_b_participant_id)
        and not app.game_is_authoritatively_resolved_v1(earlier.id)
        and (earlier_round.round_number,earlier.match_instance,earlier_schedule.import_row_number,earlier.id)
          <(target.round_number,target.match_instance,target.import_row_number,target.id)
    ) then 'current' else 'upcoming' end from target
$$;
revoke all on function app.participant_game_progression_v1(uuid,uuid) from public,anon,authenticated;

alter function public.submit_game_score(uuid,uuid,smallint,text,integer,uuid) set schema app;
alter function app.submit_game_score(uuid,uuid,smallint,text,integer,uuid) rename to submit_game_score_pre_progression_v1;
revoke all on function app.submit_game_score_pre_progression_v1(uuid,uuid,smallint,text,integer,uuid) from public,anon,authenticated;

create or replace function public.submit_game_score(p_game_id uuid,p_submission_id uuid,p_submission_slot smallint,p_winner_side text,p_margin integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_game app.canonical_games%rowtype; v_participant uuid; v_existing app.operation_receipts%rowtype;
  v_hash text; v_response jsonb; v_receipt uuid;
begin
  if v_actor is null then return app.submit_game_score_pre_progression_v1(p_game_id,p_submission_id,p_submission_slot,p_winner_side,p_margin,p_idempotency_key); end if;
  v_hash:=encode(extensions.digest(convert_to(concat_ws('|','submit_game_score',p_game_id::text,p_submission_id::text,p_submission_slot::text,p_winner_side,p_margin::text,p_idempotency_key::text),'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_idempotency_key::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=v_actor and client_operation_id=p_idempotency_key;
  if found then return app.submit_game_score_pre_progression_v1(p_game_id,p_submission_id,p_submission_slot,p_winner_side,p_margin,p_idempotency_key); end if;
  select * into v_game from app.canonical_games where id=p_game_id;
  select participant.id into v_participant from app.event_participants participant
    where participant.id=case when p_submission_slot=1 then v_game.side_a_participant_id else v_game.side_b_participant_id end
      and participant.profile_id=v_actor and participant.event_id=v_game.event_id and participant.tournament_id=v_game.tournament_id;
  if v_participant is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('active-game:'||v_game.event_id::text||':'||v_participant::text,0));
    if app.participant_game_progression_v1(p_game_id,v_participant) is distinct from 'current' then
      v_response:=jsonb_build_object('status','rejected','code','future_game_locked','game_id',p_game_id);
      insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
        values(v_actor,v_game.tournament_id,'submit_game_score',p_game_id,v_hash,p_idempotency_key,'rejected',v_response,clock_timestamp()) returning id into v_receipt;
      insert into app.operation_conflicts(actor_profile_id,game_id,operation_type,attempted_idempotency_key,attempted_request_hash,reason_code)
        values(v_actor,p_game_id,'submit_game_score',p_idempotency_key,v_hash,'future_game_locked');
      insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state)
        values(v_game.tournament_id,v_actor,p_game_id,v_receipt,'canonical_game',p_game_id,'future_game_submission_rejected',v_response);
      return v_response;
    end if;
  end if;
  return app.submit_game_score_pre_progression_v1(p_game_id,p_submission_id,p_submission_slot,p_winner_side,p_margin,p_idempotency_key);
end $$;
revoke all on function public.submit_game_score(uuid,uuid,smallint,text,integer,uuid) from public,anon;
grant execute on function public.submit_game_score(uuid,uuid,smallint,text,integer,uuid) to authenticated;

alter function public.confirm_game_score(uuid,uuid,uuid) set schema app;
alter function app.confirm_game_score(uuid,uuid,uuid) rename to confirm_game_score_pre_progression_v1;
revoke all on function app.confirm_game_score_pre_progression_v1(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.confirm_game_score(p_game_id uuid,p_submission_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_game app.canonical_games%rowtype;v_participant uuid;v_existing app.operation_receipts%rowtype;v_hash text;v_response jsonb;v_receipt uuid;v_progress text;
begin
  if v_actor is null then return app.confirm_game_score_pre_progression_v1(p_game_id,p_submission_id,p_idempotency_key);end if;
  v_hash:=encode(extensions.digest(convert_to(concat_ws('|','confirm_game_score',p_game_id::text,p_submission_id::text,p_idempotency_key::text),'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_idempotency_key::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=v_actor and client_operation_id=p_idempotency_key;
  if found then return app.confirm_game_score_pre_progression_v1(p_game_id,p_submission_id,p_idempotency_key);end if;
  select game.* into v_game from app.canonical_games game where game.id=p_game_id;
  select submission.submitter_participant_id into v_participant from app.score_submissions submission
    where submission.id=p_submission_id and submission.canonical_game_id=p_game_id and submission.submitter_profile_id=v_actor;
  if v_participant is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('active-game:'||v_game.event_id::text||':'||v_participant::text,0));
    v_progress:=app.participant_game_progression_v1(p_game_id,v_participant);
    if v_progress is null or v_progress='upcoming' then
      v_response:=jsonb_build_object('status','rejected','code','game_progression_locked','game_id',p_game_id);
      insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
      values(v_actor,v_game.tournament_id,'confirm_game_score',p_game_id,v_hash,p_idempotency_key,'rejected',v_response,clock_timestamp()) returning id into v_receipt;
      insert into app.operation_conflicts(actor_profile_id,game_id,operation_type,attempted_idempotency_key,attempted_request_hash,reason_code)
      values(v_actor,p_game_id,'confirm_game_score',p_idempotency_key,v_hash,'game_progression_locked');
      insert into app.audit_events(tournament_id,actor_profile_id,canonical_game_id,operation_receipt_id,entity_type,entity_id,action,after_state)
      values(v_game.tournament_id,v_actor,p_game_id,v_receipt,'canonical_game',p_game_id,'future_game_confirmation_rejected',v_response);
      return v_response;
    end if;
  end if;
  return app.confirm_game_score_pre_progression_v1(p_game_id,p_submission_id,p_idempotency_key);
end $$;
revoke all on function public.confirm_game_score(uuid,uuid,uuid) from public,anon;
grant execute on function public.confirm_game_score(uuid,uuid,uuid) to authenticated;

alter function public.issue_offline_submission_capability_v1(uuid,uuid,uuid,uuid,uuid,jsonb) set schema app;
alter function app.issue_offline_submission_capability_v1(uuid,uuid,uuid,uuid,uuid,jsonb) rename to issue_offline_submission_capability_pre_progression_v1;
revoke all on function app.issue_offline_submission_capability_pre_progression_v1(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
create or replace function public.issue_offline_submission_capability_v1(p_actor_id uuid,p_session_binding_id uuid,p_game_id uuid,p_capability_id uuid,p_device_key_id uuid,p_public_jwk jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_participant uuid; v_event uuid;
begin
  if exists(select 1 from app.offline_score_capabilities capability where capability.id=p_capability_id
      or (capability.actor_profile_id=p_actor_id and capability.session_binding_id=p_session_binding_id and capability.canonical_game_id=p_game_id and capability.operation_kind='submission')) then
    return app.issue_offline_submission_capability_pre_progression_v1(p_actor_id,p_session_binding_id,p_game_id,p_capability_id,p_device_key_id,p_public_jwk);
  end if;
  select participant.id,game.event_id into v_participant,v_event from app.canonical_games game
    join app.event_participants participant on participant.id in(game.side_a_participant_id,game.side_b_participant_id)
      and participant.profile_id=p_actor_id and participant.status='checked_in'
    where game.id=p_game_id;
  if v_participant is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_session_binding_id::text||':'||p_game_id::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('active-game:'||v_event::text||':'||v_participant::text,0));
    if app.participant_game_progression_v1(p_game_id,v_participant) is distinct from 'current' then
      return jsonb_build_object('status','rejected','code','future_game_locked');
    end if;
  end if;
  return app.issue_offline_submission_capability_pre_progression_v1(p_actor_id,p_session_binding_id,p_game_id,p_capability_id,p_device_key_id,p_public_jwk);
end $$;
revoke all on function public.issue_offline_submission_capability_v1(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.issue_offline_submission_capability_v1(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;

alter function public.record_offline_submission_rejection_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) set schema app;
alter function app.record_offline_submission_rejection_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) rename to record_offline_submission_rejection_pre_capability_v1;
revoke all on function app.record_offline_submission_rejection_pre_capability_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) from public,anon,authenticated;

create or replace function public.record_offline_submission_rejection_v1(
  p_actor_id uuid,p_session_binding_id uuid,p_queue_id uuid,p_client_operation_id uuid,
  p_capability_id uuid,p_device_key_id uuid,p_tournament_id uuid,p_event_id uuid,p_game_id uuid,
  p_submission_id uuid,p_payload_digest text,p_signature text,p_reason_code text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_prior app.offline_score_replay_receipts%rowtype;v_response jsonb;v_bound_capability_id uuid;
begin
  if p_actor_id is null or p_session_binding_id is null or p_queue_id is null or p_client_operation_id is null
    or p_capability_id is null or p_device_key_id is null or p_game_id is null or p_submission_id is null
    or p_payload_digest !~ '^[0-9a-f]{64}$' or length(p_signature) not between 1 and 256
    or p_reason_code not in('capability_unavailable','scope_mismatch','invalid_signature') then return null;end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_queue_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_client_operation_id::text,0));
  -- An unavailable or foreign capability must never be attached to this
  -- actor's rejection receipt. In particular, doing so would consume the
  -- unique capability receipt slot and deny its rightful owner a replay.
  if p_reason_code<>'capability_unavailable' then
    select capability.id into v_bound_capability_id
    from app.offline_score_capabilities capability
    where capability.id=p_capability_id
      and capability.actor_profile_id=p_actor_id
      and capability.session_binding_id=p_session_binding_id
      and capability.device_key_id=p_device_key_id
      and capability.tournament_id=p_tournament_id
      and capability.event_id=p_event_id
      and capability.canonical_game_id=p_game_id
      and capability.operation_kind='submission';
  end if;
  if v_bound_capability_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_bound_capability_id::text,0));
  end if;
  select * into v_prior from app.offline_score_replay_receipts where queue_id=p_queue_id
    or(actor_profile_id=p_actor_id and client_operation_id=p_client_operation_id)
    or(v_bound_capability_id is not null and capability_id=v_bound_capability_id)
    order by(queue_id=p_queue_id)desc limit 1;
  if found then
    if v_prior.queue_id=p_queue_id and v_prior.actor_profile_id=p_actor_id and v_prior.client_operation_id=p_client_operation_id
      and v_prior.capability_id is not distinct from v_bound_capability_id
      and v_prior.payload_digest=p_payload_digest and v_prior.signature=p_signature
    then return v_prior.response_payload;end if;
    insert into app.offline_score_replay_conflicts(queue_id,actor_profile_id,canonical_game_id,attempted_payload_digest,prior_receipt_id,reason_code)
    values(p_queue_id,p_actor_id,p_game_id,p_payload_digest,v_prior.id,'changed_replay');
    return jsonb_build_object('version',1,'queueId',p_queue_id,'clientOperationId',p_client_operation_id,'kind','submission','gameId',p_game_id,'submissionId',p_submission_id,'payloadDigest',p_payload_digest,'disposition','conflict');
  end if;
  if(select count(*) from app.offline_score_replay_receipts r where r.actor_profile_id=p_actor_id and r.applied_at>now()-interval '1 minute')>=30 then return jsonb_build_object('status','rate_limited');end if;
  v_response:=jsonb_build_object('version',1,'queueId',p_queue_id,'clientOperationId',p_client_operation_id,'kind','submission','gameId',p_game_id,'submissionId',p_submission_id,'payloadDigest',p_payload_digest,'disposition','rejected');
  insert into app.offline_score_replay_receipts(queue_id,client_operation_id,capability_id,device_key_id,actor_profile_id,session_binding_id,tournament_id,event_id,canonical_game_id,submission_id,payload_digest,signature,disposition,reason_code,response_payload)
  values(p_queue_id,p_client_operation_id,v_bound_capability_id,p_device_key_id,p_actor_id,p_session_binding_id,p_tournament_id,p_event_id,p_game_id,p_submission_id,p_payload_digest,p_signature,'rejected',p_reason_code,v_response);
  return v_response;
end $$;
revoke all on function public.record_offline_submission_rejection_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_offline_submission_rejection_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) to service_role;

alter function public.replay_offline_submission_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,integer,uuid,smallint,text,integer,text,text) set schema app;
alter function app.replay_offline_submission_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,integer,uuid,smallint,text,integer,text,text) rename to replay_offline_submission_pre_progression_v1;
revoke all on function app.replay_offline_submission_pre_progression_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,integer,uuid,smallint,text,integer,text,text) from public,anon,authenticated;
create or replace function public.replay_offline_submission_v1(p_actor_id uuid,p_session_binding_id uuid,p_queue_id uuid,p_client_operation_id uuid,p_capability_id uuid,p_device_key_id uuid,p_tournament_id uuid,p_event_id uuid,p_game_id uuid,p_assigned_side text,p_expected_game_version integer,p_submission_id uuid,p_submission_slot smallint,p_winner_side text,p_margin integer,p_payload_digest text,p_signature text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_participant uuid;
begin
  -- A prior receipt is delegated first so exact replay survives progression;
  -- the core also turns changed reuse into its immutable conflict response.
  if exists(select 1 from app.offline_score_replay_receipts receipt where receipt.queue_id=p_queue_id
      or (receipt.actor_profile_id=p_actor_id and receipt.client_operation_id=p_client_operation_id)
      or receipt.capability_id=p_capability_id) then
    return app.replay_offline_submission_pre_progression_v1(p_actor_id,p_session_binding_id,p_queue_id,p_client_operation_id,p_capability_id,p_device_key_id,p_tournament_id,p_event_id,p_game_id,p_assigned_side,p_expected_game_version,p_submission_id,p_submission_slot,p_winner_side,p_margin,p_payload_digest,p_signature);
  end if;
  select participant.id into v_participant from app.canonical_games game
    join app.event_participants participant on participant.id=case when p_submission_slot=1 then game.side_a_participant_id else game.side_b_participant_id end
      and participant.profile_id=p_actor_id and participant.status='checked_in'
    where game.id=p_game_id and game.tournament_id=p_tournament_id and game.event_id=p_event_id;
  if v_participant is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_queue_id::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_client_operation_id::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_capability_id::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('active-game:'||p_event_id::text||':'||v_participant::text,0));
    if app.participant_game_progression_v1(p_game_id,v_participant) is distinct from 'current' then
      return public.record_offline_submission_rejection_v1(p_actor_id,p_session_binding_id,p_queue_id,p_client_operation_id,p_capability_id,p_device_key_id,p_tournament_id,p_event_id,p_game_id,p_submission_id,p_payload_digest,p_signature,'scope_mismatch');
    end if;
  end if;
  return app.replay_offline_submission_pre_progression_v1(p_actor_id,p_session_binding_id,p_queue_id,p_client_operation_id,p_capability_id,p_device_key_id,p_tournament_id,p_event_id,p_game_id,p_assigned_side,p_expected_game_version,p_submission_id,p_submission_slot,p_winner_side,p_margin,p_payload_digest,p_signature);
end $$;
revoke all on function public.replay_offline_submission_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,integer,uuid,smallint,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.replay_offline_submission_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,integer,uuid,smallint,text,integer,text,text) to service_role;

alter function public.get_assigned_game_context(uuid) set schema app;
alter function app.get_assigned_game_context(uuid) rename to get_assigned_game_context_pre_progression_v1;
revoke all on function app.get_assigned_game_context_pre_progression_v1(uuid) from public,anon,authenticated;
create or replace function public.get_assigned_game_context(p_game_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with base as(select app.get_assigned_game_context_pre_progression_v1(p_game_id) payload), participant as(
    select item.id from app.canonical_games game join app.event_participants item
      on item.id in(game.side_a_participant_id,game.side_b_participant_id) and item.profile_id=(select auth.uid())
    where game.id=p_game_id)
  select case when payload is null then null else payload||jsonb_build_object(
    'progressionStatus',app.participant_game_progression_v1(p_game_id,participant.id),
    'canEnter',app.participant_game_progression_v1(p_game_id,participant.id)='current'
      and payload->'ownSubmission'='null'::jsonb and payload->>'state' in('pending','submitted'),
    'canConfirm',case when app.participant_game_progression_v1(p_game_id,participant.id)='current'
      then (payload->>'canConfirm')::boolean else false end) end
  from base left join participant on true
$$;
revoke all on function public.get_assigned_game_context(uuid) from public,anon;
grant execute on function public.get_assigned_game_context(uuid) to authenticated;

alter function public.get_my_assigned_games_v1(uuid) set schema app;
alter function app.get_my_assigned_games_v1(uuid) rename to get_my_assigned_games_pre_progression_v1;
revoke all on function app.get_my_assigned_games_pre_progression_v1(uuid) from public,anon,authenticated;
create or replace function public.get_my_assigned_games_v1(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with base as(select app.get_my_assigned_games_pre_progression_v1(p_tournament_id) payload)
  select case when payload is null then null else jsonb_set(payload,'{games}',coalesce((
    select jsonb_agg(item.game||jsonb_build_object('progressionStatus',progress.status,'nextAction',
      case when progress.status='upcoming' then 'upcoming_locked' else item.game->>'nextAction' end,
      'canConfirm',case when progress.status='current' then (item.game->>'canConfirm')::boolean else false end)
      order by (item.game->>'eventName'),(item.game->>'gameNumber')::integer,(item.game->>'matchInstance')::integer)
    from jsonb_array_elements(payload->'games') item(game)
    join app.canonical_games game on game.id=(item.game->>'gameId')::uuid
    join app.event_participants participant on participant.id in(game.side_a_participant_id,game.side_b_participant_id)
      and participant.profile_id=(select auth.uid())
    cross join lateral(select app.participant_game_progression_v1(game.id,participant.id) status) progress
  ),'[]'::jsonb),false) end from base
$$;
revoke all on function public.get_my_assigned_games_v1(uuid) from public,anon;
grant execute on function public.get_my_assigned_games_v1(uuid) to authenticated;

notify pgrst,'reload schema';
