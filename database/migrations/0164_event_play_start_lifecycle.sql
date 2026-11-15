-- Event play is a distinct, explicit, append-only operation. Publishing a
-- schedule creates games, but those games remain locked until an authorized
-- official starts this event against the exact roster and schedule snapshot.

create or replace function app.event_participant_snapshot_digest_v1(p_event_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select encode(extensions.digest(convert_to(coalesce(string_agg(
    participant.id::text || ':' || participant.roster_entry_id::text || ':' ||
      coalesce(seating.verification_id, participant.table_seat, '') || ':' || participant.status,
    '|' order by participant.id), ''), 'utf8'), 'sha256'), 'hex')
  from app.event_participants participant
  left join app.initial_seating_assignments seating
    on seating.tournament_id=participant.tournament_id
   and seating.roster_entry_id=participant.roster_entry_id
  where participant.event_id=p_event_id
$$;
revoke all on function app.event_participant_snapshot_digest_v1(uuid) from public,anon,authenticated;

create table app.event_play_starts(
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  schedule_publication_id uuid not null,
  participant_snapshot_digest text not null check(participant_snapshot_digest ~ '^[0-9a-f]{64}$'),
  participant_count integer not null check(participant_count between 2 and 10000),
  game_count smallint not null check(game_count between 1 and 99),
  schedule_match_count integer not null check(schedule_match_count between 1 and 5000),
  started_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid,
  start_source text not null check(start_source in('official','legacy_scoring_backfill')),
  started_at timestamptz not null default clock_timestamp(),
  foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
  foreign key(schedule_publication_id,tournament_id,event_id)
    references app.event_schedule_publications(id,tournament_id,event_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id)
    references app.operation_receipts(id,tournament_id) on delete restrict,
  check((start_source='official' and operation_receipt_id is not null)
    or (start_source='legacy_scoring_backfill' and operation_receipt_id is null)),
  unique(event_id),
  unique(schedule_publication_id),
  unique(operation_receipt_id),
  unique(id,tournament_id,event_id)
);
alter table app.event_play_starts enable row level security;
alter table app.event_play_starts force row level security;
revoke all on table app.event_play_starts from public,anon,authenticated;
create trigger event_play_starts_immutable before update or delete on app.event_play_starts
for each row execute function app.reject_immutable_history();
create index event_play_starts_tournament_idx on app.event_play_starts(tournament_id,event_id);
create index event_play_starts_actor_idx on app.event_play_starts(started_by_profile_id);

-- Preserve live events during rollout. A schedule with no scoring evidence is
-- intentionally not backfilled and remains Ready to Start.
insert into app.event_play_starts(tournament_id,event_id,schedule_publication_id,
  participant_snapshot_digest,participant_count,game_count,schedule_match_count,
  started_by_profile_id,start_source,started_at)
select publication.tournament_id,publication.event_id,publication.id,
  app.event_participant_snapshot_digest_v1(publication.event_id),publication.participant_count,
  publication.game_count,publication.match_count,publication.actor_profile_id,
  'legacy_scoring_backfill',publication.published_at
from app.event_schedule_publications publication
where exists(
  select 1 from app.event_schedule_games scheduled
  join app.canonical_games game on game.id=scheduled.canonical_game_id
  where scheduled.publication_id=publication.id and (
    game.state<>'pending'
    or exists(select 1 from app.score_submissions submission where submission.canonical_game_id=game.id)
    or exists(select 1 from app.score_confirmations confirmation where confirmation.canonical_game_id=game.id)
    or exists(select 1 from app.card_scorelines scoreline where scoreline.canonical_game_id=game.id)
    or exists(select 1 from app.paper_game_completions completion where completion.canonical_game_id=game.id)
    or exists(select 1 from app.device_failure_recoveries recovery where recovery.canonical_game_id=game.id)
  )
);

create or replace function app.event_play_state_v1(p_event_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select case
    when exists(select 1 from app.standard_singles_settlement_final_versions final where final.event_id=p_event_id)
      then 'finalized'
    when exists(select 1 from app.event_play_starts started where started.event_id=p_event_id)
      and exists(select 1 from app.event_schedule_games scheduled where scheduled.event_id=p_event_id)
      and not exists(select 1 from app.event_schedule_games scheduled
        where scheduled.event_id=p_event_id
          and not app.game_is_authoritatively_resolved_v1(scheduled.canonical_game_id))
      then 'completed'
    when exists(select 1 from app.event_play_starts started where started.event_id=p_event_id)
      then 'in_progress'
    when exists(select 1 from app.event_schedule_publications publication where publication.event_id=p_event_id)
      and exists(select 1 from app.events event_row join app.tournaments tournament on tournament.id=event_row.tournament_id
        where event_row.id=p_event_id and tournament.status='open' and tournament.registration_status='closed')
      and not exists(select 1 from app.event_participants participant
        where participant.event_id=p_event_id and participant.status<>'checked_in')
      and not exists(select 1 from app.event_participants participant
        left join app.initial_seating_assignments seating on seating.tournament_id=participant.tournament_id and seating.roster_entry_id=participant.roster_entry_id
        where participant.event_id=p_event_id and coalesce(seating.verification_id,participant.table_seat) is null)
      and (select count(*) from app.event_participants participant where participant.event_id=p_event_id)
        =(select publication.participant_count from app.event_schedule_publications publication where publication.event_id=p_event_id)
      and (select count(*) from app.event_schedule_games scheduled where scheduled.event_id=p_event_id)
        =(select publication.match_count from app.event_schedule_publications publication where publication.event_id=p_event_id)
      then 'ready_to_start'
    else 'preparing' end
$$;
revoke all on function app.event_play_state_v1(uuid) from public,anon,authenticated;

create or replace function public.start_event_play_v1(
  p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_schedule_publication_id uuid,
  p_participant_snapshot_digest text,p_expected_participant_count integer,
  p_expected_game_count integer,p_confirmed boolean,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_hash text;v_existing app.operation_receipts%rowtype;v_publication app.event_schedule_publications%rowtype;
  v_actual_participants integer;v_actual_games integer;v_actual_matches integer;v_actual_digest text;
  v_receipt_id uuid:=extensions.gen_random_uuid();v_start_id uuid:=extensions.gen_random_uuid();v_response jsonb;
begin
  if p_actor_id is null or p_tournament_id is null or p_event_id is null
    or p_schedule_publication_id is null or p_idempotency_key is null or p_confirmed is distinct from true
    or p_participant_snapshot_digest !~ '^[0-9a-f]{64}$'
    or p_expected_participant_count not between 2 and 10000
    or p_expected_game_count not between 1 and 99 then
    return jsonb_build_object('status','rejected','code','invalid_start_request');
  end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('start_event_play_v1',p_actor_id::text,
    p_tournament_id::text,p_event_id::text,p_schedule_publication_id::text,p_participant_snapshot_digest,
    p_expected_participant_count,p_expected_game_count,p_confirmed)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-start:'||p_event_id::text,0));

  perform 1 from app.tournaments tournament where tournament.id=p_tournament_id and tournament.status='open' for update;
  if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
  perform 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
    and role_row.profile_id=p_actor_id and role_row.role in('director','co_director') for update;
  if not found then return jsonb_build_object('status','rejected','code','not_director');end if;

  select * into v_existing from app.operation_receipts
  where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then
    if v_existing.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
    return v_existing.response_payload;
  end if;

  if exists(select 1 from app.event_play_starts started where started.event_id=p_event_id) then
    return jsonb_build_object('status','rejected','code','event_already_started');
  end if;
  if not exists(select 1 from app.tournaments tournament where tournament.id=p_tournament_id and tournament.registration_status='closed') then
    return jsonb_build_object('status','rejected','code','registration_open');
  end if;
  select * into v_publication from app.event_schedule_publications publication
    where publication.id=p_schedule_publication_id and publication.tournament_id=p_tournament_id
      and publication.event_id=p_event_id for update;
  if not found then return jsonb_build_object('status','rejected','code','schedule_unavailable');end if;

  select count(*) into v_actual_participants from app.event_participants participant
    where participant.tournament_id=p_tournament_id and participant.event_id=p_event_id;
  select count(*) into v_actual_games from app.rounds round_row
    where round_row.tournament_id=p_tournament_id and round_row.event_id=p_event_id;
  select count(*) into v_actual_matches from app.event_schedule_games scheduled
    where scheduled.publication_id=p_schedule_publication_id;
  v_actual_digest:=app.event_participant_snapshot_digest_v1(p_event_id);
  if v_actual_participants<>p_expected_participant_count or v_actual_participants<>v_publication.participant_count
    or v_actual_games<>p_expected_game_count or v_actual_games<>v_publication.game_count
    or v_actual_matches<>v_publication.match_count or v_actual_digest<>p_participant_snapshot_digest then
    return jsonb_build_object('status','rejected','code','stale_roster_or_schedule');
  end if;
  if exists(select 1 from app.event_participants participant
      left join app.initial_seating_assignments seating on seating.tournament_id=participant.tournament_id
        and seating.roster_entry_id=participant.roster_entry_id
      where participant.event_id=p_event_id and (participant.status<>'checked_in'
        or coalesce(seating.verification_id,participant.table_seat) is null)) then
    return jsonb_build_object('status','rejected','code','attendance_or_seating_incomplete');
  end if;
  if exists(select 1 from app.event_schedule_games scheduled join app.canonical_games game on game.id=scheduled.canonical_game_id
      where scheduled.event_id=p_event_id and (game.state<>'pending'
        or exists(select 1 from app.score_submissions submission where submission.canonical_game_id=game.id)
        or exists(select 1 from app.score_confirmations confirmation where confirmation.canonical_game_id=game.id))) then
    return jsonb_build_object('status','rejected','code','unexpected_scoring_activity');
  end if;

  v_response:=jsonb_build_object('status','event_started','eventId',p_event_id,'startId',v_start_id,
    'participantCount',v_actual_participants,'gameCount',v_actual_games,'scheduleMatchCount',v_actual_matches,
    'playState','in_progress');
  insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,
    client_operation_id,outcome,response_payload,applied_at)
  values(v_receipt_id,p_actor_id,p_tournament_id,'start_event_play_v1',v_start_id,v_hash,
    p_idempotency_key,'accepted',v_response,clock_timestamp());
  insert into app.event_play_starts(id,tournament_id,event_id,schedule_publication_id,
    participant_snapshot_digest,participant_count,game_count,schedule_match_count,
    started_by_profile_id,operation_receipt_id,start_source)
  values(v_start_id,p_tournament_id,p_event_id,p_schedule_publication_id,v_actual_digest,
    v_actual_participants,v_actual_games,v_actual_matches,p_actor_id,v_receipt_id,'official');
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(p_tournament_id,p_actor_id,v_receipt_id,'event_play_start',v_start_id,'event_play_started',v_response);
  return v_response;
end $$;
revoke all on function public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid)
  from public,anon,authenticated;
grant execute on function public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid)
  to service_role;

-- The progression helper is the shared server seam for online score entry,
-- confirmation, offline capability issuance, and offline replay.
create or replace function app.participant_game_progression_v1(p_game_id uuid,p_participant_id uuid)
returns text language sql stable security definer set search_path='' as $$
  with target_rows as(
    select game.id,game.tournament_id,game.event_id,round_row.round_number,game.match_instance,schedule.import_row_number
    from app.canonical_games game
    join app.rounds round_row on round_row.id=game.round_id and round_row.tournament_id=game.tournament_id and round_row.event_id=game.event_id
    join app.event_schedule_games schedule on schedule.canonical_game_id=game.id and schedule.tournament_id=game.tournament_id and schedule.event_id=game.event_id
    where game.id=p_game_id and p_participant_id in(game.side_a_participant_id,game.side_b_participant_id)
  ),target as(
    select min(id::text)::uuid id,min(tournament_id::text)::uuid tournament_id,min(event_id::text)::uuid event_id,
      min(round_number) round_number,min(match_instance) match_instance,min(import_row_number) import_row_number
    from target_rows having count(*)=1
  )
  select case
    when not exists(select 1 from app.event_play_starts started where started.event_id=target.event_id) then 'not_started'
    when app.game_is_authoritatively_resolved_v1(target.id) then 'completed'
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

create or replace function app.reject_score_write_before_event_start_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_game_id uuid;v_event_id uuid;
begin
  v_game_id:=new.canonical_game_id;
  select game.event_id into v_event_id from app.canonical_games game where game.id=v_game_id;
  if v_event_id is null or not exists(select 1 from app.event_play_starts started where started.event_id=v_event_id) then
    raise exception using errcode='P0001',message='event not started';
  end if;
  return new;
end $$;
revoke all on function app.reject_score_write_before_event_start_v1() from public,anon,authenticated;
create trigger score_submissions_require_event_start before insert on app.score_submissions
for each row execute function app.reject_score_write_before_event_start_v1();
create trigger score_confirmations_require_event_start before insert on app.score_confirmations
for each row execute function app.reject_score_write_before_event_start_v1();
create trigger paper_game_completions_require_event_start before insert on app.paper_game_completions
for each row execute function app.reject_score_write_before_event_start_v1();
create trigger device_failure_recoveries_require_event_start before insert on app.device_failure_recoveries
for each row execute function app.reject_score_write_before_event_start_v1();

create or replace function public.get_my_assigned_games_v1(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with base as(select app.get_my_assigned_games_pre_progression_v1(p_tournament_id) payload)
  select case when payload is null then null else jsonb_set(payload,'{games}',coalesce((
    select jsonb_agg(item.game||jsonb_build_object('progressionStatus',progress.status,'nextAction',
      case when progress.status='not_started' then 'event_not_started'
        when progress.status='upcoming' then 'upcoming_locked' else item.game->>'nextAction' end,
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

create or replace function public.get_event_schedule_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when p_actor_id is not null and p_tournament_id is not null and exists(
    select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
      and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then jsonb_build_object(
    'tournamentName',tournament.name,
    'registrationClosed',tournament.registration_status='closed',
    'tableCount',(select publication.table_count from app.initial_seating_publications publication where publication.tournament_id=tournament.id),
    'seatsPerTable',(select publication.seats_per_table from app.initial_seating_publications publication where publication.tournament_id=tournament.id),
    'events',coalesce((select jsonb_agg(jsonb_build_object(
      'eventId',event_row.id,'name',event_row.name,'format',event_row.format,'scoringMethod',event_row.scoring_method,
      'gameCount',setup_event.game_count,'participantCount',(select count(*) from app.event_participants participant where participant.event_id=event_row.id),
      'schedulePublished',schedule.id is not null,'schedulePublicationId',schedule.id,
      'participantSnapshotDigest',case when schedule.id is null then null else app.event_participant_snapshot_digest_v1(event_row.id) end,
      'publishedMatchCount',coalesce(schedule.match_count,0),'playState',app.event_play_state_v1(event_row.id),
      'startedAt',started.started_at,'startedBy',started_profile.display_name
    ) order by setup_event.ordinal)
    from app.tournament_setup_activations activation
    join app.events event_row on event_row.id=activation.event_id and event_row.tournament_id=activation.tournament_id
    join app.tournament_setup_event_versions setup_event on setup_event.id=activation.setup_event_version_id and setup_event.tournament_id=activation.tournament_id
    left join app.event_schedule_publications schedule on schedule.event_id=event_row.id
    left join app.event_play_starts started on started.event_id=event_row.id
    left join app.profiles started_profile on started_profile.id=started.started_by_profile_id
    where activation.tournament_id=tournament.id),'[]'::jsonb),
    'participants',coalesce((select jsonb_agg(jsonb_build_object('eventId',participant.event_id,'participantId',participant.id,
      'displayName',coalesce(roster.claimed_display_name,profile.display_name),'verificationId',coalesce(seating.verification_id,participant.table_seat),
      'profileLinked',participant.profile_id is not null) order by participant.event_id,coalesce(seating.verification_id,participant.table_seat))
      from app.event_participants participant
      left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id and roster.tournament_id=participant.tournament_id
      left join app.profiles profile on profile.id=participant.profile_id
      left join app.initial_seating_assignments seating on seating.roster_entry_id=participant.roster_entry_id and seating.tournament_id=participant.tournament_id
      where participant.tournament_id=tournament.id and coalesce(seating.verification_id,participant.table_seat) is not null),'[]'::jsonb),
    'matches',coalesce((select jsonb_agg(jsonb_build_object('eventId',game.event_id,'canonicalGameId',game.id,
      'gameNumber',round_row.round_number,'sideAVerificationId',coalesce(seat_a.verification_id,side_a.table_seat),
      'sideBVerificationId',coalesce(seat_b.verification_id,side_b.table_seat),'sideATableSeat',game.side_a_table_seat_snapshot,
      'sideBTableSeat',game.side_b_table_seat_snapshot,'sideADisplayName',coalesce(roster_a.claimed_display_name,profile_a.display_name),
      'sideBDisplayName',coalesce(roster_b.claimed_display_name,profile_b.display_name),'state',game.state)
      order by game.event_id,round_row.round_number,scheduled.import_row_number)
      from app.event_schedule_games scheduled join app.canonical_games game on game.id=scheduled.canonical_game_id
      join app.rounds round_row on round_row.id=game.round_id join app.event_participants side_a on side_a.id=game.side_a_participant_id
      join app.event_participants side_b on side_b.id=game.side_b_participant_id
      left join app.tournament_roster_entries roster_a on roster_a.id=side_a.roster_entry_id
      left join app.tournament_roster_entries roster_b on roster_b.id=side_b.roster_entry_id
      left join app.profiles profile_a on profile_a.id=side_a.profile_id left join app.profiles profile_b on profile_b.id=side_b.profile_id
      left join app.initial_seating_assignments seat_a on seat_a.tournament_id=side_a.tournament_id and seat_a.roster_entry_id=side_a.roster_entry_id
      left join app.initial_seating_assignments seat_b on seat_b.tournament_id=side_b.tournament_id and seat_b.roster_entry_id=side_b.roster_entry_id
      where scheduled.tournament_id=tournament.id),'[]'::jsonb)
  ) else null end from app.tournaments tournament where tournament.id=p_tournament_id
$$;
revoke all on function public.get_event_schedule_workspace_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_schedule_workspace_v1(uuid,uuid) to service_role;

notify pgrst,'reload schema';
