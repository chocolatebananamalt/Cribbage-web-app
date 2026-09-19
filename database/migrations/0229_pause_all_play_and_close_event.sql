-- Two controls the event play lifecycle has never had, both from the gap matrix
-- line in docs/operations/2026-09-17-luke-streamline-and-judge-call-handoff.md:
-- "Global pause/resume ... and explicit Close Event -> cross-check transition
-- remain incomplete."
--
-- Today a director who needs the room to stop scoring has nothing to press. The
-- only levers that exist are destructive: close registration, which is already
-- closed by this point, or cancel the event. And an event that has finished play
-- stays indistinguishable from one still running, so a late or mistaken entry
-- lands in a scorecard the cross-checkers have already started working from.
--
-- Everything here is additive. No function a director depends on today is
-- rewritten, and in particular submit_game_score is untouched: it is the hot
-- path every player is using right now, and a regression there loses real
-- scores. Pause and close are recorded as their own append-only history and
-- enforced at the API route, which is a real limitation and is written down as
-- one rather than papered over.
--
-- Both tables are append-only in the same sense app.event_play_starts is: a row
-- records that something happened at a point in time, the immutability trigger
-- refuses update and delete, and current state is the newest row. Sequence
-- numbers rather than timestamps decide which row is newest, because
-- clock_timestamp() can tie inside one busy second and a tie here would flip an
-- event between paused and running at random.

create table app.event_play_pauses(
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  sequence_number bigint generated always as identity,
  action text not null check(action in('paused','resumed')),
  reason text not null check(length(reason) between 1 and 1000),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id)
    references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(operation_receipt_id),
  unique(sequence_number)
);
alter table app.event_play_pauses enable row level security;
alter table app.event_play_pauses force row level security;
revoke all on table app.event_play_pauses from public,anon,authenticated;
create trigger event_play_pauses_immutable before update or delete on app.event_play_pauses
for each row execute function app.reject_immutable_history();
create index event_play_pauses_event_idx on app.event_play_pauses(event_id,sequence_number desc);

-- Closing is separate history from pausing rather than a third action on one
-- table. They answer different questions, they have different reversal rules,
-- and a director can legitimately close an event that is currently paused.
create table app.event_play_closes(
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  sequence_number bigint generated always as identity,
  action text not null check(action in('closed','reopened')),
  reason text not null check(length(reason) between 1 and 1000),
  scheduled_game_count integer not null check(scheduled_game_count >= 0),
  resolved_game_count integer not null check(resolved_game_count >= 0),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
  foreign key(operation_receipt_id,tournament_id)
    references app.operation_receipts(id,tournament_id) on delete restrict,
  unique(operation_receipt_id),
  unique(sequence_number),
  check(resolved_game_count <= scheduled_game_count)
);
alter table app.event_play_closes enable row level security;
alter table app.event_play_closes force row level security;
revoke all on table app.event_play_closes from public,anon,authenticated;
create trigger event_play_closes_immutable before update or delete on app.event_play_closes
for each row execute function app.reject_immutable_history();
create index event_play_closes_event_idx on app.event_play_closes(event_id,sequence_number desc);

create or replace function app.event_play_pause_state_v1(p_event_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select coalesce((select case when pause_row.action='paused' then 'paused' else 'open' end
    from app.event_play_pauses pause_row where pause_row.event_id=p_event_id
    order by pause_row.sequence_number desc limit 1),'open')
$$;
revoke all on function app.event_play_pause_state_v1(uuid) from public,anon,authenticated;

create or replace function app.event_play_close_state_v1(p_event_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select coalesce((select case when close_row.action='closed' then 'closed' else 'open' end
    from app.event_play_closes close_row where close_row.event_id=p_event_id
    order by close_row.sequence_number desc limit 1),'open')
$$;
revoke all on function app.event_play_close_state_v1(uuid) from public,anon,authenticated;

-- Readiness deliberately reuses app.game_is_authoritatively_resolved_v1, the
-- same predicate app.event_play_state_v1 uses to call an event 'completed'.
-- Re-deriving "verified" here would have produced a second, subtly different
-- definition of done: that helper already counts a corrected game, an approved
-- device-failure recovery and an operational forfeit as resolved, and a
-- hand-rolled check on canonical_games.state would refuse to close an event
-- whose last game was settled by forfeit.
create or replace function app.event_play_close_readiness_v1(p_event_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'scheduledGames',count(*),
    'resolvedGames',count(*) filter(where app.game_is_authoritatively_resolved_v1(scheduled.canonical_game_id)),
    'unresolvedGames',count(*) filter(where not app.game_is_authoritatively_resolved_v1(scheduled.canonical_game_id)))
  from app.event_schedule_games scheduled where scheduled.event_id=p_event_id
$$;
revoke all on function app.event_play_close_readiness_v1(uuid) from public,anon,authenticated;

-- Reopening is allowed only while nothing downstream has been produced from the
-- closed event, the same window shape 0227 describes for an event lifecycle
-- change. Once qualification, a settlement draft, a playoff result or a final
-- settlement version exists, the closed scorecard has already been read and
-- turned into standings and money, and putting the event back into play would
-- leave those artefacts describing a state that no longer holds.
create or replace function app.event_play_reopen_is_safe_v1(p_event_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select not exists(select 1 from app.qualification_result_versions qualification where qualification.event_id=p_event_id)
     and not exists(select 1 from app.standard_singles_settlement_drafts draft where draft.event_id=p_event_id)
     and not exists(select 1 from app.standard_singles_playoff_result_versions playoff where playoff.event_id=p_event_id)
     and not exists(select 1 from app.standard_singles_settlement_final_versions final where final.event_id=p_event_id)
$$;
revoke all on function app.event_play_reopen_is_safe_v1(uuid) from public,anon,authenticated;

create or replace function public.set_event_play_pause_v1(
  p_actor_id uuid, p_tournament_id uuid, p_event_id uuid, p_action text, p_reason text, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
  v_action text := coalesce(p_action, '');
  v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
  v_state text; v_response jsonb;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode='P0001', message='server-only event play pause';
  end if;
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null
     or v_action not in ('pause','resume') or length(v_reason) not between 1 and 1000 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'set_event_play_pause_v1', p_actor_id::text, p_tournament_id::text, p_event_id::text,
    v_action, v_reason, p_operation_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  -- One lock name for pause, resume, close and reopen on the same event. Two
  -- directors on two devices at a lunch break is the ordinary case, not the
  -- exotic one, and without this a pause and a resume can interleave and leave
  -- the newest row contradicting what either director was told.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-play-gate:'||p_event_id::text,0));

  select * into v_existing from app.operation_receipts
    where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type='set_event_play_pause_v1' and v_existing.request_hash=v_hash then
      return v_existing.response_payload;
    end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict');
  end if;

  perform 1 from app.tournaments tournament
    where tournament.id=p_tournament_id and tournament.status='open' for update;
  if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable'); end if;
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
      and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then
    return jsonb_build_object('status','rejected','code','not_director');
  end if;
  if not exists(select 1 from app.events event_row
      where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id) then
    return jsonb_build_object('status','rejected','code','event_unavailable');
  end if;

  -- A team event starts through app.event_team_starts and scores through
  -- app.event_team_score_submissions, neither of which this pause reaches. A
  -- pause row that stops nothing is worse than no button at all, so it is
  -- refused with a code of its own rather than silently accepted.
  if not exists(select 1 from app.event_play_starts started where started.event_id=p_event_id) then
    if exists(select 1 from app.event_team_starts team_started where team_started.event_id=p_event_id) then
      return jsonb_build_object('status','rejected','code','team_event_unsupported');
    end if;
    return jsonb_build_object('status','rejected','code','event_not_started');
  end if;
  if app.event_play_close_state_v1(p_event_id)='closed' then
    return jsonb_build_object('status','rejected','code','event_closed');
  end if;

  v_state := app.event_play_pause_state_v1(p_event_id);
  if v_action='pause' and v_state='paused' then
    return jsonb_build_object('status','already_paused','eventId',p_event_id);
  end if;
  if v_action='resume' and v_state='open' then
    return jsonb_build_object('status','not_paused','eventId',p_event_id);
  end if;

  v_response := jsonb_build_object(
    'status', case when v_action='pause' then 'event_play_paused' else 'event_play_resumed' end,
    'eventId', p_event_id, 'pauseState', case when v_action='pause' then 'paused' else 'open' end);

  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,
    request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament_id,p_actor_id,'set_event_play_pause_v1',p_event_id,
    v_hash,p_operation_id,'accepted',v_response,clock_timestamp())
  returning id into v_receipt;

  insert into app.event_play_pauses(tournament_id,event_id,action,reason,actor_profile_id,operation_receipt_id)
  values(p_tournament_id,p_event_id,case when v_action='pause' then 'paused' else 'resumed' end,
    v_reason,p_actor_id,v_receipt);

  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,
    entity_id,action,before_state,after_state)
  values(p_tournament_id,p_actor_id,v_receipt,'event_play_pause',p_event_id,
    case when v_action='pause' then 'event_play_paused' else 'event_play_resumed' end,
    jsonb_build_object('pauseState',v_state), v_response || jsonb_build_object('reason',v_reason));

  return v_response;
end;
$$;

create or replace function public.close_event_play_v1(
  p_actor_id uuid, p_tournament_id uuid, p_event_id uuid, p_reason text, p_confirmed boolean, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
  v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
  v_readiness jsonb; v_scheduled integer; v_resolved integer; v_unresolved integer; v_response jsonb;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode='P0001', message='server-only close event';
  end if;
  -- start_event_play_v1 requires the same explicit confirmation server side. A
  -- tick that exists only in the browser is not a gate, it is a decoration, and
  -- this operation ends scoring for a whole event.
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null
     or p_confirmed is distinct from true or length(v_reason) not between 1 and 1000 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'close_event_play_v1', p_actor_id::text, p_tournament_id::text, p_event_id::text,
    v_reason, p_confirmed, p_operation_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-play-gate:'||p_event_id::text,0));

  select * into v_existing from app.operation_receipts
    where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type='close_event_play_v1' and v_existing.request_hash=v_hash then
      return v_existing.response_payload;
    end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict');
  end if;

  perform 1 from app.tournaments tournament
    where tournament.id=p_tournament_id and tournament.status='open' for update;
  if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable'); end if;
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
      and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then
    return jsonb_build_object('status','rejected','code','not_director');
  end if;
  if not exists(select 1 from app.events event_row
      where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id) then
    return jsonb_build_object('status','rejected','code','event_unavailable');
  end if;
  if not exists(select 1 from app.event_play_starts started where started.event_id=p_event_id) then
    if exists(select 1 from app.event_team_starts team_started where team_started.event_id=p_event_id) then
      return jsonb_build_object('status','rejected','code','team_event_unsupported');
    end if;
    return jsonb_build_object('status','rejected','code','event_not_started');
  end if;
  if app.event_play_close_state_v1(p_event_id)='closed' then
    return jsonb_build_object('status','already_closed','eventId',p_event_id);
  end if;

  v_readiness := app.event_play_close_readiness_v1(p_event_id);
  v_scheduled := (v_readiness->>'scheduledGames')::integer;
  v_resolved := (v_readiness->>'resolvedGames')::integer;
  v_unresolved := (v_readiness->>'unresolvedGames')::integer;
  if v_scheduled=0 then
    return jsonb_build_object('status','rejected','code','no_scheduled_games');
  end if;
  -- The counts travel with the refusal. A director told only "not ready" has to
  -- go and count forty games by eye to find the two that are still open.
  if v_unresolved>0 then
    return jsonb_build_object('status','rejected','code','games_unresolved',
      'scheduledGames',v_scheduled,'resolvedGames',v_resolved,'unresolvedGames',v_unresolved);
  end if;

  v_response := jsonb_build_object('status','event_play_closed','eventId',p_event_id,
    'closeState','closed','scheduledGames',v_scheduled,'resolvedGames',v_resolved,'unresolvedGames',0);

  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,
    request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament_id,p_actor_id,'close_event_play_v1',p_event_id,
    v_hash,p_operation_id,'accepted',v_response,clock_timestamp())
  returning id into v_receipt;

  insert into app.event_play_closes(tournament_id,event_id,action,reason,scheduled_game_count,
    resolved_game_count,actor_profile_id,operation_receipt_id)
  values(p_tournament_id,p_event_id,'closed',v_reason,v_scheduled,v_resolved,p_actor_id,v_receipt);

  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,
    entity_id,action,before_state,after_state)
  values(p_tournament_id,p_actor_id,v_receipt,'event_play_close',p_event_id,'event_play_closed',
    jsonb_build_object('closeState','open','pauseState',app.event_play_pause_state_v1(p_event_id)),
    v_response || jsonb_build_object('reason',v_reason));

  return v_response;
end;
$$;

create or replace function public.reopen_event_play_v1(
  p_actor_id uuid, p_tournament_id uuid, p_event_id uuid, p_reason text, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
  v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
  v_readiness jsonb; v_response jsonb;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode='P0001', message='server-only reopen event';
  end if;
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null
     or length(v_reason) not between 1 and 1000 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'reopen_event_play_v1', p_actor_id::text, p_tournament_id::text, p_event_id::text,
    v_reason, p_operation_id::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('event-play-gate:'||p_event_id::text,0));

  select * into v_existing from app.operation_receipts
    where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type='reopen_event_play_v1' and v_existing.request_hash=v_hash then
      return v_existing.response_payload;
    end if;
    return jsonb_build_object('status','rejected','code','idempotency_conflict');
  end if;

  perform 1 from app.tournaments tournament
    where tournament.id=p_tournament_id and tournament.status='open' for update;
  if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable'); end if;
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
      and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then
    return jsonb_build_object('status','rejected','code','not_director');
  end if;
  if not exists(select 1 from app.events event_row
      where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id) then
    return jsonb_build_object('status','rejected','code','event_unavailable');
  end if;
  if app.event_play_close_state_v1(p_event_id)<>'closed' then
    return jsonb_build_object('status','not_closed','eventId',p_event_id);
  end if;
  if not app.event_play_reopen_is_safe_v1(p_event_id) then
    return jsonb_build_object('status','rejected','code','downstream_activity');
  end if;

  v_readiness := app.event_play_close_readiness_v1(p_event_id);
  v_response := jsonb_build_object('status','event_play_reopened','eventId',p_event_id,'closeState','open');

  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,
    request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament_id,p_actor_id,'reopen_event_play_v1',p_event_id,
    v_hash,p_operation_id,'accepted',v_response,clock_timestamp())
  returning id into v_receipt;

  insert into app.event_play_closes(tournament_id,event_id,action,reason,scheduled_game_count,
    resolved_game_count,actor_profile_id,operation_receipt_id)
  values(p_tournament_id,p_event_id,'reopened',v_reason,
    (v_readiness->>'scheduledGames')::integer,(v_readiness->>'resolvedGames')::integer,p_actor_id,v_receipt);

  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,
    entity_id,action,before_state,after_state)
  values(p_tournament_id,p_actor_id,v_receipt,'event_play_close',p_event_id,'event_play_reopened',
    jsonb_build_object('closeState','closed'), v_response || jsonb_build_object('reason',v_reason));

  return v_response;
end;
$$;

-- The score-submission route's gate. It returns a single word and nothing else:
-- no event id, no tournament id, no pause reason. The route that calls it runs
-- on the player's own session rather than a secret key, so this is the one
-- function here that authenticated callers may execute, and it is shaped so
-- that executing it tells the caller nothing they could not already learn by
-- trying to submit.
--
-- A game id that does not exist returns null. The route treats that as "not
-- blocked" on purpose: submit_game_score already answers game_not_found, and
-- inventing a second refusal here would give a wrong reason for a real fault.
create or replace function public.get_game_play_gate_v1(p_game_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select case
    when app.event_play_close_state_v1(game.event_id)='closed' then 'closed'
    when app.event_play_pause_state_v1(game.event_id)='paused' then 'paused'
    else 'open' end
  from app.canonical_games game where game.id=p_game_id
$$;

-- Shaped like get_event_schedule_workspace_v1 rather than like 0224: a reader
-- returns null for an actor who is not a director here, because the page that
-- calls it turns null into notFound() and a raise would surface as a 503.
create or replace function public.get_event_control_workspace_v1(p_actor_id uuid, p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when p_actor_id is not null and p_tournament_id is not null and exists(
    select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
      and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then jsonb_build_object(
    'tournamentName',tournament.name,
    'tournamentStatus',tournament.status,
    'events',coalesce((select jsonb_agg(jsonb_build_object(
      'eventId',event_row.id,
      'name',event_row.name,
      'format',event_row.format,
      'scoringMethod',event_row.scoring_method,
      'playState',app.event_play_state_v1(event_row.id),
      'started',started.id is not null,
      'teamEvent',team_started.id is not null,
      'pauseState',app.event_play_pause_state_v1(event_row.id),
      'pausedAt',latest_pause.recorded_at,
      'pauseAction',latest_pause.action,
      'pauseReason',latest_pause.reason,
      'pauseActor',pause_actor.display_name,
      'closeState',app.event_play_close_state_v1(event_row.id),
      'closedAt',latest_close.recorded_at,
      'closeAction',latest_close.action,
      'closeReason',latest_close.reason,
      'closeActor',close_actor.display_name,
      'canReopen',app.event_play_reopen_is_safe_v1(event_row.id),
      'readiness',app.event_play_close_readiness_v1(event_row.id)
    ) order by setup_event.ordinal)
    from app.tournament_setup_activations activation
    join app.events event_row on event_row.id=activation.event_id and event_row.tournament_id=activation.tournament_id
    join app.tournament_setup_event_versions setup_event on setup_event.id=activation.setup_event_version_id
      and setup_event.tournament_id=activation.tournament_id
    left join app.event_play_starts started on started.event_id=event_row.id
    left join app.event_team_starts team_started on team_started.event_id=event_row.id
    left join lateral(select pause_row.recorded_at,pause_row.action,pause_row.reason,pause_row.actor_profile_id
      from app.event_play_pauses pause_row where pause_row.event_id=event_row.id
      order by pause_row.sequence_number desc limit 1) latest_pause on true
    left join app.profiles pause_actor on pause_actor.id=latest_pause.actor_profile_id
    left join lateral(select close_row.recorded_at,close_row.action,close_row.reason,close_row.actor_profile_id
      from app.event_play_closes close_row where close_row.event_id=event_row.id
      order by close_row.sequence_number desc limit 1) latest_close on true
    left join app.profiles close_actor on close_actor.id=latest_close.actor_profile_id
    where activation.tournament_id=tournament.id),'[]'::jsonb)
  ) else null end from app.tournaments tournament where tournament.id=p_tournament_id
$$;

revoke all on function public.set_event_play_pause_v1(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.close_event_play_v1(uuid,uuid,uuid,text,boolean,uuid) from public,anon,authenticated;
revoke all on function public.reopen_event_play_v1(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.get_event_control_workspace_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_game_play_gate_v1(uuid) from public,anon;
grant execute on function public.set_event_play_pause_v1(uuid,uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.close_event_play_v1(uuid,uuid,uuid,text,boolean,uuid) to service_role;
grant execute on function public.reopen_event_play_v1(uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.get_event_control_workspace_v1(uuid,uuid) to service_role;
grant execute on function public.get_game_play_gate_v1(uuid) to authenticated,service_role;

notify pgrst,'reload schema';
