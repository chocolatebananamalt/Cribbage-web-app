-- Rollback-only hosted proof. Requires a published Standard Singles event with
-- a linked checked-in player who has at least two unresolved scheduled games.
begin;

do $$
begin
  if app.participant_game_progression_v1('ffffffff-ffff-4fff-8fff-ffffffffffff','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') is not null then
    raise exception 'missing or non-exact schedule target must fail closed';
  end if;
end $$;

do $$
declare
  actor uuid; participant uuid; current_game uuid; future_game uuid; slot smallint;
  current_status text; future_status text; rejected jsonb; replay jsonb;
  operation_id uuid:='a1470000-0000-4000-8000-000000000001';
  submission_id uuid:='a1470000-0000-4000-8000-000000000002';
begin
  select candidate.profile_id,candidate.id into actor,participant
  from app.event_participants candidate
  where candidate.profile_id is not null and candidate.status='checked_in'
    and (select count(*) from app.canonical_games game join app.event_schedule_games schedule on schedule.canonical_game_id=game.id
      where candidate.id in(game.side_a_participant_id,game.side_b_participant_id)
        and game.event_id=candidate.event_id and not app.game_is_authoritatively_resolved_v1(game.id))>=2
  order by candidate.id limit 1;
  if actor is null then raise exception 'fixture requires a linked player with two unresolved scheduled games'; end if;

  select game.id into current_game from app.canonical_games game
  join app.rounds round_row on round_row.id=game.round_id
  join app.event_schedule_games schedule on schedule.canonical_game_id=game.id
  where participant in(game.side_a_participant_id,game.side_b_participant_id)
    and game.event_id=(select event_id from app.event_participants where id=participant)
    and not app.game_is_authoritatively_resolved_v1(game.id)
  order by round_row.round_number,game.match_instance,schedule.import_row_number,game.id limit 1;
  select game.id,case when game.side_a_participant_id=participant then 1 else 2 end into future_game,slot
  from app.canonical_games game join app.rounds round_row on round_row.id=game.round_id
  join app.event_schedule_games schedule on schedule.canonical_game_id=game.id
  where participant in(game.side_a_participant_id,game.side_b_participant_id)
    and game.event_id=(select event_id from app.event_participants where id=participant)
    and not app.game_is_authoritatively_resolved_v1(game.id) and game.id<>current_game
  order by round_row.round_number,game.match_instance,schedule.import_row_number,game.id limit 1;
  current_status:=app.participant_game_progression_v1(current_game,participant);
  future_status:=app.participant_game_progression_v1(future_game,participant);
  if current_status<>'current' or future_status<>'upcoming' then
    raise exception 'expected one current and one upcoming game: % / %',current_status,future_status;
  end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  rejected:=public.submit_game_score(future_game,submission_id,slot,'a',10,operation_id);
  if rejected->>'code'<>'future_game_locked' then raise exception 'future game submission was not rejected: %',rejected; end if;
  replay:=public.submit_game_score(future_game,submission_id,slot,'a',10,operation_id);
  if replay<>rejected then raise exception 'future-game rejection did not replay exactly: % / %',rejected,replay; end if;
end $$;

do $$
declare
  owner_actor uuid; owner_session uuid:='b1470000-0000-4000-8000-000000000001';
  owner_device uuid:='b1470000-0000-4000-8000-000000000002';
  owner_capability uuid:='b1470000-0000-4000-8000-000000000003';
  attacker_actor uuid:='b1470000-0000-4000-8000-000000000004';
  attacker_session uuid:='b1470000-0000-4000-8000-000000000005';
  attacker_device uuid:='b1470000-0000-4000-8000-000000000006';
  game_id uuid; tournament_id uuid; event_id uuid; assigned_side text; submission_slot smallint; game_version integer;
  poisoned jsonb; poison_replay jsonb; rightful jsonb; bound_capability uuid;
  digest text:=repeat('a',64);
begin
  select participant.profile_id,game.id,game.tournament_id,game.event_id,
    case when game.side_a_participant_id=participant.id then 'a' else 'b' end,
    case when game.side_a_participant_id=participant.id then 1 else 2 end,
    game.version
  into owner_actor,game_id,tournament_id,event_id,assigned_side,submission_slot,game_version
  from app.event_participants participant
  join app.canonical_games game on participant.id in(game.side_a_participant_id,game.side_b_participant_id)
  where participant.profile_id is not null and participant.status='checked_in'
  order by game.id limit 1;
  if owner_actor is null then raise exception 'fixture requires a linked checked-in player game'; end if;

  insert into app.offline_device_keys(id,actor_profile_id,session_binding_id,public_jwk,expires_at)
  values(owner_device,owner_actor,owner_session,
    jsonb_build_object('kty','EC','crv','P-256','x',repeat('x',43),'y',repeat('y',43),'ext',true,'key_ops',jsonb_build_array('verify')),
    now()+interval '18 hours');
  insert into app.offline_score_capabilities(id,device_key_id,actor_profile_id,session_binding_id,tournament_id,event_id,canonical_game_id,assigned_side,submission_slot,operation_kind,expected_game_version,expires_at)
  values(owner_capability,owner_device,owner_actor,owner_session,tournament_id,event_id,game_id,assigned_side,submission_slot,'submission',game_version,now()+interval '18 hours');

  poisoned:=public.record_offline_submission_rejection_v1(
    attacker_actor,attacker_session,'b1470000-0000-4000-8000-000000000007','b1470000-0000-4000-8000-000000000008',
    owner_capability,attacker_device,tournament_id,event_id,game_id,'b1470000-0000-4000-8000-000000000009',digest,'foreign-signature','scope_mismatch');
  select capability_id into bound_capability from app.offline_score_replay_receipts
    where queue_id='b1470000-0000-4000-8000-000000000007';
  if bound_capability is not null then raise exception 'foreign capability was attached to attacker rejection'; end if;
  poison_replay:=public.record_offline_submission_rejection_v1(
    attacker_actor,attacker_session,'b1470000-0000-4000-8000-000000000007','b1470000-0000-4000-8000-000000000008',
    owner_capability,attacker_device,tournament_id,event_id,game_id,'b1470000-0000-4000-8000-000000000009',digest,'foreign-signature','scope_mismatch');
  if poison_replay<>poisoned then raise exception 'unbound poisoning rejection did not replay exactly'; end if;

  rightful:=public.record_offline_submission_rejection_v1(
    owner_actor,owner_session,'b1470000-0000-4000-8000-000000000010','b1470000-0000-4000-8000-000000000011',
    owner_capability,owner_device,tournament_id,event_id,game_id,'b1470000-0000-4000-8000-000000000012',digest,'owner-signature','invalid_signature');
  select capability_id into bound_capability from app.offline_score_replay_receipts
    where queue_id='b1470000-0000-4000-8000-000000000010';
  if bound_capability is distinct from owner_capability then
    raise exception 'rightful owner could not bind capability after poisoning attempt: %',rightful;
  end if;
end $$;

rollback;
