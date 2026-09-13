-- Recover an unsynchronized score only from preserved independent evidence.
-- This workflow does not create player submissions or confirmations and does
-- not weaken the ordinary two-submission/two-confirmation invariant.

create table app.device_failure_recoveries (
  id uuid primary key,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  round_id uuid not null,
  case_sequence integer not null check (case_sequence > 0),
  base_game_version integer not null check (base_game_version > 0),
  base_game_state text not null check (base_game_state in ('pending', 'submitted', 'mismatch', 'confirmation_pending')),
  proposed_winner_side text not null check (proposed_winner_side in ('a', 'b')),
  proposed_margin integer not null check (proposed_margin between 1 and 121),
  reporter_profile_id uuid not null references app.profiles(id) on delete restrict,
  reporter_role text not null check (reporter_role = 'cross_checker'),
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (canonical_game_id, tournament_id, event_id)
    references app.canonical_games(id, tournament_id, event_id) on delete restrict,
  foreign key (round_id, tournament_id, event_id)
    references app.rounds(id, tournament_id, event_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (canonical_game_id, case_sequence),
  unique (id, canonical_game_id),
  unique (id, tournament_id, event_id)
);

create table app.device_failure_recovery_evidence (
  id uuid primary key default extensions.gen_random_uuid(),
  recovery_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  source_type text not null check (source_type in ('opponent_device', 'paper_card')),
  source_reference text not null check (length(trim(source_reference)) between 1 and 200),
  claimed_winner_side text not null check (claimed_winner_side in ('a', 'b')),
  claimed_margin integer not null check (claimed_margin between 1 and 121),
  recorded_at timestamptz not null default now(),
  foreign key (recovery_id, canonical_game_id)
    references app.device_failure_recoveries(id, canonical_game_id) on delete restrict,
  foreign key (recovery_id, tournament_id, event_id)
    references app.device_failure_recoveries(id, tournament_id, event_id) on delete restrict,
  unique (recovery_id, source_type, source_reference)
);

create table app.device_failure_recovery_state_events (
  id uuid primary key default extensions.gen_random_uuid(),
  recovery_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  state text not null check (state in ('pending_review', 'disputed', 'approved', 'rejected')),
  transition_sequence integer not null check (transition_sequence > 0),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  actor_role text not null check (actor_role in ('director', 'co_director', 'cross_checker')),
  operation_receipt_id uuid not null,
  before_totals jsonb,
  after_totals jsonb,
  created_at timestamptz not null default now(),
  foreign key (recovery_id, canonical_game_id)
    references app.device_failure_recoveries(id, canonical_game_id) on delete restrict,
  foreign key (recovery_id, tournament_id, event_id)
    references app.device_failure_recoveries(id, tournament_id, event_id) on delete restrict,
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  unique (recovery_id, transition_sequence),
  unique (operation_receipt_id, recovery_id)
);

create table app.device_failure_recovery_projections (
  id uuid primary key default extensions.gen_random_uuid(),
  recovery_id uuid not null,
  tournament_id uuid not null,
  event_id uuid not null,
  canonical_game_id uuid not null,
  participant_id uuid not null,
  opponent_participant_id uuid not null,
  side text not null check (side in ('a', 'b')),
  table_seat_snapshot text not null check (table_seat_snapshot ~ '^[A-Za-z0-9]+-[0-9]+$'),
  is_winner boolean not null,
  margin integer not null check (margin between 1 and 121),
  plus_points integer not null check (plus_points >= 0),
  minus_points integer not null check (minus_points >= 0),
  game_points smallint not null check (game_points in (0, 2, 3)),
  created_at timestamptz not null default now(),
  foreign key (recovery_id, canonical_game_id)
    references app.device_failure_recoveries(id, canonical_game_id) on delete restrict,
  foreign key (recovery_id, tournament_id, event_id)
    references app.device_failure_recoveries(id, tournament_id, event_id) on delete restrict,
  foreign key (participant_id, event_id, tournament_id)
    references app.event_participants(id, event_id, tournament_id) on delete restrict,
  foreign key (opponent_participant_id, event_id, tournament_id)
    references app.event_participants(id, event_id, tournament_id) on delete restrict,
  check (participant_id <> opponent_participant_id),
  check ((is_winner and plus_points = margin and minus_points = 0 and game_points = case when margin >= 31 then 3 else 2 end)
    or (not is_winner and plus_points = 0 and minus_points = margin and game_points = 0)),
  unique (recovery_id, participant_id),
  unique (recovery_id, side)
);

create table app.device_failure_recovery_operation_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  attempted_recovery_id uuid not null,
  attempted_operation_id uuid not null,
  attempted_request_hash text not null check (length(attempted_request_hash) = 64),
  prior_receipt_id uuid references app.operation_receipts(id) on delete restrict,
  reason_code text not null check (reason_code = 'idempotency_conflict'),
  created_at timestamptz not null default now()
);

create index device_failure_recoveries_scope_idx
  on app.device_failure_recoveries(tournament_id, event_id, canonical_game_id);
create index device_failure_recoveries_reporter_idx
  on app.device_failure_recoveries(reporter_profile_id);
create index device_failure_recovery_evidence_scope_idx
  on app.device_failure_recovery_evidence(tournament_id, event_id, canonical_game_id);
create index device_failure_recovery_state_latest_idx
  on app.device_failure_recovery_state_events(recovery_id, transition_sequence desc);
create index device_failure_recovery_state_actor_idx
  on app.device_failure_recovery_state_events(actor_profile_id);
create index device_failure_recovery_projections_scope_idx
  on app.device_failure_recovery_projections(tournament_id, event_id, canonical_game_id);
create index device_failure_recovery_projections_participant_idx
  on app.device_failure_recovery_projections(participant_id, event_id, tournament_id);
create index device_failure_recovery_projections_opponent_idx
  on app.device_failure_recovery_projections(opponent_participant_id, event_id, tournament_id);
create index device_failure_recovery_conflicts_actor_idx
  on app.device_failure_recovery_operation_conflicts(actor_profile_id, created_at desc);
create index device_failure_recovery_conflicts_receipt_idx
  on app.device_failure_recovery_operation_conflicts(prior_receipt_id);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'device_failure_recoveries', 'device_failure_recovery_evidence',
    'device_failure_recovery_state_events', 'device_failure_recovery_projections',
    'device_failure_recovery_operation_conflicts'
  ] loop
    execute format('alter table app.%I enable row level security', table_name);
    execute format('alter table app.%I force row level security', table_name);
    execute format('revoke all on table app.%I from public, anon, authenticated', table_name);
  end loop;
end;
$$;

create trigger device_failure_recoveries_immutable
before update or delete on app.device_failure_recoveries
for each row execute function app.reject_immutable_history();
create trigger device_failure_recovery_evidence_immutable
before update or delete on app.device_failure_recovery_evidence
for each row execute function app.reject_immutable_history();
create trigger device_failure_recovery_state_events_immutable
before update or delete on app.device_failure_recovery_state_events
for each row execute function app.reject_immutable_history();
create trigger device_failure_recovery_projections_immutable
before update or delete on app.device_failure_recovery_projections
for each row execute function app.reject_immutable_history();
create trigger device_failure_recovery_conflicts_immutable
before update or delete on app.device_failure_recovery_operation_conflicts
for each row execute function app.reject_immutable_history();

create or replace function app.recovery_participant_profile_id(
  p_participant_id uuid,
  p_tournament_id uuid,
  p_event_id uuid
) returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(participant.profile_id, roster_link.profile_id)
  from app.event_participants participant
  left join app.roster_account_links roster_link
    on roster_link.tournament_id = participant.tournament_id
    and roster_link.roster_entry_id = participant.roster_entry_id
  where participant.id = p_participant_id
    and participant.tournament_id = p_tournament_id
    and participant.event_id = p_event_id
  limit 1
$$;

create or replace function app.device_recovery_is_approved(p_recovery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select state = 'approved'
    from app.device_failure_recovery_state_events
    where recovery_id = p_recovery_id
    order by transition_sequence desc
    limit 1
  ), false)
$$;

create or replace function app.current_effective_scorelines(
  p_tournament_id uuid,
  p_event_id uuid
) returns table(
  line_id uuid, canonical_game_id uuid, participant_id uuid,
  opponent_participant_id uuid, side text, table_seat_snapshot text,
  is_winner boolean, margin integer, plus_points integer,
  minus_points integer, game_points smallint, recovered boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select scoreline.id, scoreline.canonical_game_id, scoreline.participant_id,
    scoreline.opponent_participant_id, scoreline.side, scoreline.table_seat_snapshot,
    coalesce(correction.adjudicated_is_winner, scoreline.is_winner),
    coalesce(correction.adjudicated_margin, scoreline.margin),
    coalesce(correction.adjudicated_plus_points, scoreline.plus_points),
    coalesce(correction.adjudicated_minus_points, scoreline.minus_points),
    coalesce(correction.adjudicated_game_points, scoreline.game_points), false
  from app.card_scorelines scoreline
  join app.canonical_games game on game.id = scoreline.canonical_game_id
    and game.tournament_id = scoreline.tournament_id
    and game.event_id = scoreline.event_id
  left join lateral (
    select projection.adjudicated_is_winner, projection.adjudicated_margin,
      projection.adjudicated_plus_points, projection.adjudicated_minus_points,
      projection.adjudicated_game_points
    from app.independent_card_correction_projections projection
    join app.independent_card_corrections correction_row
      on correction_row.id = projection.correction_id
      and correction_row.canonical_game_id = scoreline.canonical_game_id
      and correction_row.tournament_id = scoreline.tournament_id
      and correction_row.event_id = scoreline.event_id
    where projection.canonical_scoreline_id = scoreline.id
      and exists (
        select 1 from app.independent_card_correction_state_events state_event
        where state_event.correction_id = correction_row.id
          and state_event.state = 'applied'
      )
    order by correction_row.correction_sequence desc
    limit 1
  ) correction on true
  where scoreline.tournament_id = p_tournament_id
    and scoreline.event_id = p_event_id
    and game.state in ('verified', 'corrected')
  union all
  select projection.id, projection.canonical_game_id, projection.participant_id,
    projection.opponent_participant_id, projection.side,
    projection.table_seat_snapshot, projection.is_winner, projection.margin,
    projection.plus_points, projection.minus_points, projection.game_points, true
  from app.device_failure_recovery_projections projection
  where projection.tournament_id = p_tournament_id
    and projection.event_id = p_event_id
    and app.device_recovery_is_approved(projection.recovery_id)
    and not exists (
      select 1 from app.card_scorelines scoreline
      where scoreline.canonical_game_id = projection.canonical_game_id
    )
$$;

create or replace function app.device_recovery_totals_snapshot(
  p_recovery_id uuid,
  p_include_recovery boolean
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with recovery as (
    select * from app.device_failure_recoveries where id = p_recovery_id
  ), participants as (
    select game.side_a_participant_id as participant_id from recovery
    join app.canonical_games game on game.id = recovery.canonical_game_id
    union all
    select game.side_b_participant_id from recovery
    join app.canonical_games game on game.id = recovery.canonical_game_id
  ), base_lines as (
    select line.* from recovery
    cross join lateral app.current_effective_scorelines(recovery.tournament_id, recovery.event_id) line
  ), included_lines as (
    select participant_id, game_points, plus_points, minus_points, is_winner from base_lines
    union all
    select projection.participant_id, projection.game_points, projection.plus_points,
      projection.minus_points, projection.is_winner
    from app.device_failure_recovery_projections projection
    where p_include_recovery and projection.recovery_id = p_recovery_id
      and not exists (select 1 from base_lines where canonical_game_id = projection.canonical_game_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'participantId', participant.participant_id,
    'gamePoints', coalesce(totals.game_points, 0),
    'plusPoints', coalesce(totals.plus_points, 0),
    'minusPoints', coalesce(totals.minus_points, 0),
    'gamesWon', coalesce(totals.games_won, 0),
    'netSpreadPoints', coalesce(totals.plus_points, 0) - coalesce(totals.minus_points, 0)
  ) order by participant.participant_id), '[]'::jsonb)
  from participants participant
  left join lateral (
    select sum(line.game_points)::integer as game_points,
      sum(line.plus_points)::integer as plus_points,
      sum(line.minus_points)::integer as minus_points,
      count(*) filter (where line.is_winner)::integer as games_won
    from included_lines line where line.participant_id = participant.participant_id
  ) totals on true
$$;

create or replace function app.block_game_history_after_device_recovery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from app.device_failure_recoveries recovery
    where recovery.canonical_game_id = new.canonical_game_id
      and app.device_recovery_is_approved(recovery.id)
  ) then
    raise exception 'approved device recovery blocks fabricated or duplicate game history';
  end if;
  return new;
end;
$$;

create trigger score_submissions_block_approved_device_recovery
before insert on app.score_submissions
for each row execute function app.block_game_history_after_device_recovery();
create trigger score_confirmations_block_approved_device_recovery
before insert on app.score_confirmations
for each row execute function app.block_game_history_after_device_recovery();
create trigger scorelines_block_approved_device_recovery
before insert on app.card_scorelines
for each row execute function app.block_game_history_after_device_recovery();

revoke all on function app.recovery_participant_profile_id(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function app.device_recovery_is_approved(uuid) from public, anon, authenticated;
revoke all on function app.current_effective_scorelines(uuid, uuid) from public, anon, authenticated;
revoke all on function app.device_recovery_totals_snapshot(uuid, boolean) from public, anon, authenticated;
revoke all on function app.block_game_history_after_device_recovery() from public, anon, authenticated;

create or replace function public.create_device_failure_recovery_v1(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_game_id uuid,
  p_recovery_id uuid,
  p_winner_side text,
  p_margin integer,
  p_evidence jsonb,
  p_operation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game app.canonical_games%rowtype;
  v_existing app.operation_receipts%rowtype;
  v_role text;
  v_hash text;
  v_receipt_id uuid;
  v_case_sequence integer;
  v_conflicted boolean;
  v_response jsonb;
  v_error text;
  v_code text;
  v_authorized boolean := false;
  v_side_a_profile_id uuid;
  v_side_b_profile_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only device recovery';
  end if;
  begin
    if p_actor_id is null or p_tournament_id is null or p_game_id is null
       or p_recovery_id is null or p_operation_id is null
       or p_winner_side not in ('a', 'b') or p_margin not between 1 and 121
       or jsonb_typeof(p_evidence) <> 'array'
       or jsonb_array_length(p_evidence) not between 1 and 4 then
      raise exception using errcode = 'P0001', message = 'invalid device recovery request';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_evidence) item
      where jsonb_typeof(item) <> 'object'
        or not (item ?& array['sourceType','sourceReference','winnerSide','margin'])
        or exists (select 1 from jsonb_object_keys(item) key where key not in ('sourceType','sourceReference','winnerSide','margin'))
        or item->>'sourceType' not in ('opponent_device', 'paper_card')
        or item->>'winnerSide' not in ('a', 'b')
        or coalesce(item->>'sourceReference', '') !~ '^[^[:cntrl:]]{1,200}$'
        or coalesce(item->>'margin', '') !~ '^[0-9]{1,3}$'
        or (item->>'margin')::integer not between 1 and 121
    ) or (select count(*) from jsonb_array_elements(p_evidence)) <>
      (select count(distinct (item->>'sourceType', trim(item->>'sourceReference'))) from jsonb_array_elements(p_evidence) item) then
      raise exception using errcode = 'P0001', message = 'invalid recovery evidence';
    end if;

    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'create_device_failure_recovery_v1', p_actor_id, p_tournament_id,
      p_game_id, p_recovery_id, p_winner_side, p_margin, p_evidence
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('device-recovery:' || p_game_id::text, 0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_operation_id::text, 0));

    select role_row.role into v_role from app.tournament_roles role_row
    where role_row.tournament_id = p_tournament_id
      and role_row.profile_id = p_actor_id and role_row.role = 'cross_checker'
    limit 1 for update;
    if v_role is null then raise exception using errcode = 'P0001', message = 'cross checker role required'; end if;
    v_authorized := true;

    select * into v_existing from app.operation_receipts
    where actor_profile_id = p_actor_id and client_operation_id = p_operation_id;
    if found then
      if v_existing.tournament_id <> p_tournament_id
         or v_existing.operation_type <> 'create_device_failure_recovery_v1'
         or v_existing.target_id <> p_recovery_id or v_existing.request_hash <> v_hash then
        insert into app.device_failure_recovery_operation_conflicts(
          tournament_id, actor_profile_id, attempted_recovery_id,
          attempted_operation_id, attempted_request_hash, prior_receipt_id, reason_code
        ) values (p_tournament_id, p_actor_id, p_recovery_id, p_operation_id,
          v_hash, case when v_existing.tournament_id = p_tournament_id then v_existing.id end,
          'idempotency_conflict');
        return jsonb_build_object('status', 'rejected', 'code', 'idempotency_conflict', 'recoveryId', p_recovery_id);
      end if;
      return v_existing.response_payload;
    end if;

    select * into v_game from app.canonical_games game
    where game.id = p_game_id and game.tournament_id = p_tournament_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'game unavailable'; end if;
    if not exists (
      select 1 from app.tournaments tournament_row
      join app.events event_row on event_row.tournament_id = tournament_row.id
      join app.ruleset_versions ruleset on ruleset.id = event_row.ruleset_version_id
        and ruleset.tournament_id = event_row.tournament_id
      where tournament_row.id = p_tournament_id and tournament_row.status = 'open'
        and event_row.id = v_game.event_id and event_row.format = 'standard_singles'
        and event_row.scoring_method = 'digital' and ruleset.format = 'standard_singles'
        and ruleset.approved_at is not null
    ) then raise exception using errcode = 'P0001', message = 'recovery lifecycle unavailable'; end if;
    if v_game.state not in ('pending', 'submitted', 'mismatch', 'confirmation_pending')
       or exists (select 1 from app.card_scorelines where canonical_game_id = p_game_id) then
      raise exception using errcode = 'P0001', message = 'game already authoritative';
    end if;
    v_side_a_profile_id := app.recovery_participant_profile_id(
      v_game.side_a_participant_id, p_tournament_id, v_game.event_id
    );
    v_side_b_profile_id := app.recovery_participant_profile_id(
      v_game.side_b_participant_id, p_tournament_id, v_game.event_id
    );
    if v_side_a_profile_id is null or v_side_b_profile_id is null then
      raise exception using errcode = 'P0001', message = 'participant identity unresolved';
    end if;
    if p_actor_id in (v_side_a_profile_id, v_side_b_profile_id) then
      raise exception using errcode = 'P0001', message = 'self recovery denied';
    end if;
    if exists (
      select 1 from app.device_failure_recoveries recovery
      cross join lateral (
        select state from app.device_failure_recovery_state_events state_event
        where state_event.recovery_id = recovery.id
        order by transition_sequence desc limit 1
      ) latest
      where recovery.canonical_game_id = p_game_id and latest.state <> 'rejected'
    ) then raise exception using errcode = 'P0001', message = 'recovery case already open'; end if;

    select coalesce(max(case_sequence), 0) + 1 into v_case_sequence
    from app.device_failure_recoveries where canonical_game_id = p_game_id;
    select count(distinct (item->>'winnerSide', (item->>'margin')::integer)) <> 1
      or bool_or(item->>'winnerSide' <> p_winner_side or (item->>'margin')::integer <> p_margin)
      into v_conflicted from jsonb_array_elements(p_evidence) item;

    v_response := jsonb_build_object(
      'status', case when v_conflicted then 'disputed' else 'pending_review' end,
      'recoveryId', p_recovery_id, 'gameId', p_game_id,
      'winnerSide', p_winner_side, 'margin', p_margin,
      'evidenceCount', jsonb_array_length(p_evidence),
      'authoritative', false, 'playerSubmissionsCreated', false,
      'playerConfirmationsCreated', false
    );
    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id,
      request_hash, client_operation_id, outcome, response_payload, applied_at
    ) values (p_actor_id, p_tournament_id, 'create_device_failure_recovery_v1',
      p_recovery_id, v_hash, p_operation_id, 'accepted', v_response, now())
    returning id into v_receipt_id;
    insert into app.device_failure_recoveries(
      id, tournament_id, event_id, canonical_game_id, round_id,
      case_sequence, base_game_version, base_game_state,
      proposed_winner_side, proposed_margin, reporter_profile_id,
      reporter_role, operation_receipt_id
    ) values (p_recovery_id, p_tournament_id, v_game.event_id, p_game_id,
      v_game.round_id, v_case_sequence, v_game.version, v_game.state,
      p_winner_side, p_margin, p_actor_id, v_role, v_receipt_id);
    insert into app.device_failure_recovery_evidence(
      recovery_id, tournament_id, event_id, canonical_game_id,
      source_type, source_reference, claimed_winner_side, claimed_margin
    ) select p_recovery_id, p_tournament_id, v_game.event_id, p_game_id,
      item->>'sourceType', trim(item->>'sourceReference'),
      item->>'winnerSide', (item->>'margin')::integer
    from jsonb_array_elements(p_evidence) item;
    insert into app.device_failure_recovery_state_events(
      recovery_id, tournament_id, event_id, canonical_game_id, state,
      transition_sequence, actor_profile_id, actor_role, operation_receipt_id
    ) values (p_recovery_id, p_tournament_id, v_game.event_id, p_game_id,
      case when v_conflicted then 'disputed' else 'pending_review' end,
      1, p_actor_id, v_role, v_receipt_id);
    insert into app.audit_events(
      tournament_id, actor_profile_id, canonical_game_id,
      operation_receipt_id, entity_type, entity_id, action, after_state
    ) values (p_tournament_id, p_actor_id, p_game_id, v_receipt_id,
      'device_failure_recovery', p_recovery_id,
      case when v_conflicted then 'device_recovery_disputed' else 'device_recovery_pending_review' end,
      v_response || jsonb_build_object('evidence', p_evidence));
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'invalid device recovery request' then 'invalid_request'
      when 'invalid recovery evidence' then 'invalid_evidence'
      when 'cross checker role required' then 'not_cross_checker'
      when 'game unavailable' then 'game_unavailable'
      when 'recovery lifecycle unavailable' then 'lifecycle_unavailable'
      when 'game already authoritative' then 'game_already_authoritative'
      when 'participant identity unresolved' then 'participant_identity_unresolved'
      when 'self recovery denied' then 'self_recovery_denied'
      when 'recovery case already open' then 'recovery_case_exists'
      else 'recovery_unavailable'
    end;
    v_response := jsonb_build_object('status', 'rejected', 'code', v_code, 'recoveryId', p_recovery_id);
    if v_authorized and p_operation_id is not null and v_hash is not null
       and not exists (select 1 from app.operation_receipts where actor_profile_id = p_actor_id and client_operation_id = p_operation_id) then
      insert into app.operation_receipts(
        actor_profile_id, tournament_id, operation_type, target_id,
        request_hash, client_operation_id, outcome, response_payload, applied_at
      ) values (p_actor_id, p_tournament_id, 'create_device_failure_recovery_v1',
        coalesce(p_recovery_id, p_game_id), v_hash, p_operation_id,
        'rejected', v_response, now()) returning id into v_receipt_id;
      insert into app.audit_events(
        tournament_id, actor_profile_id, canonical_game_id, operation_receipt_id,
        entity_type, entity_id, action, after_state
      ) values (p_tournament_id, p_actor_id,
        case when v_game.id is not null then p_game_id end, v_receipt_id,
        'device_failure_recovery', coalesce(p_recovery_id, p_game_id),
        'device_recovery_rejected', v_response);
    end if;
    return v_response;
  end;
end;
$$;

create or replace function public.review_device_failure_recovery_v1(
  p_actor_id uuid,
  p_recovery_id uuid,
  p_decision text,
  p_operation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recovery app.device_failure_recoveries%rowtype;
  v_game app.canonical_games%rowtype;
  v_existing app.operation_receipts%rowtype;
  v_latest_state text;
  v_role text;
  v_hash text;
  v_receipt_id uuid;
  v_before_totals jsonb;
  v_after_totals jsonb;
  v_response jsonb;
  v_error text;
  v_code text;
  v_authorized boolean := false;
  v_side_a_profile_id uuid;
  v_side_b_profile_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only device recovery';
  end if;
  begin
    if p_actor_id is null or p_recovery_id is null or p_operation_id is null
       or p_decision not in ('approve', 'reject') then
      raise exception using errcode = 'P0001', message = 'invalid recovery review request';
    end if;
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'review_device_failure_recovery_v1', p_actor_id, p_recovery_id, p_decision
    )::text, 'utf8'), 'sha256'), 'hex');
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('device-recovery-id:' || p_recovery_id::text, 0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_operation_id::text, 0));

    select * into v_recovery from app.device_failure_recoveries where id = p_recovery_id;
    if not found then raise exception using errcode = 'P0001', message = 'recovery case unavailable'; end if;
    select * into v_game from app.canonical_games
    where id = v_recovery.canonical_game_id
      and tournament_id = v_recovery.tournament_id
      and event_id = v_recovery.event_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'recovery scope invalid'; end if;

    select role_row.role into v_role from app.tournament_roles role_row
    where role_row.tournament_id = v_recovery.tournament_id
      and role_row.profile_id = p_actor_id
      and role_row.role in ('director', 'co_director', 'cross_checker')
    order by case role_row.role when 'director' then 1 when 'co_director' then 2 else 3 end
    limit 1 for update;
    if v_role is null then raise exception using errcode = 'P0001', message = 'eligible reviewer required'; end if;
    v_authorized := true;
    v_side_a_profile_id := app.recovery_participant_profile_id(
      v_game.side_a_participant_id, v_recovery.tournament_id, v_recovery.event_id
    );
    v_side_b_profile_id := app.recovery_participant_profile_id(
      v_game.side_b_participant_id, v_recovery.tournament_id, v_recovery.event_id
    );
    if v_side_a_profile_id is null or v_side_b_profile_id is null then
      raise exception using errcode = 'P0001', message = 'participant identity unresolved';
    end if;
    if p_actor_id = v_recovery.reporter_profile_id
       or p_actor_id in (v_side_a_profile_id, v_side_b_profile_id) then
      raise exception using errcode = 'P0001', message = 'independent reviewer required';
    end if;

    select * into v_existing from app.operation_receipts
    where actor_profile_id = p_actor_id and client_operation_id = p_operation_id;
    if found then
      if v_existing.tournament_id <> v_recovery.tournament_id
         or v_existing.operation_type <> 'review_device_failure_recovery_v1'
         or v_existing.target_id <> p_recovery_id or v_existing.request_hash <> v_hash then
        insert into app.device_failure_recovery_operation_conflicts(
          tournament_id, actor_profile_id, attempted_recovery_id,
          attempted_operation_id, attempted_request_hash, prior_receipt_id, reason_code
        ) values (v_recovery.tournament_id, p_actor_id, p_recovery_id,
          p_operation_id, v_hash,
          case when v_existing.tournament_id = v_recovery.tournament_id then v_existing.id end,
          'idempotency_conflict');
        return jsonb_build_object('status', 'rejected', 'code', 'idempotency_conflict', 'recoveryId', p_recovery_id);
      end if;
      return v_existing.response_payload;
    end if;

    select state into v_latest_state from app.device_failure_recovery_state_events
    where recovery_id = p_recovery_id order by transition_sequence desc limit 1;
    if v_latest_state not in ('pending_review', 'disputed') then
      raise exception using errcode = 'P0001', message = 'recovery review closed';
    end if;
    if p_decision = 'approve' and v_latest_state = 'disputed' then
      raise exception using errcode = 'P0001', message = 'disputed evidence cannot approve';
    end if;
    if not exists (select 1 from app.tournaments where id = v_recovery.tournament_id and status = 'open') then
      raise exception using errcode = 'P0001', message = 'recovery lifecycle unavailable';
    end if;
    if p_decision = 'approve' and (
      v_game.version <> v_recovery.base_game_version
      or v_game.state <> v_recovery.base_game_state
      or v_game.state not in ('pending', 'submitted', 'mismatch', 'confirmation_pending')
      or exists (select 1 from app.card_scorelines where canonical_game_id = v_game.id)
      or (select count(*) from app.device_failure_recovery_evidence where recovery_id = p_recovery_id) < 1
      or exists (
        select 1 from app.device_failure_recovery_evidence evidence
        where evidence.recovery_id = p_recovery_id
          and (evidence.claimed_winner_side <> v_recovery.proposed_winner_side
            or evidence.claimed_margin <> v_recovery.proposed_margin)
      )
    ) then raise exception using errcode = 'P0001', message = 'recovery evidence is stale or conflicting'; end if;

    if p_decision = 'approve' then
      v_before_totals := app.device_recovery_totals_snapshot(p_recovery_id, false);
      insert into app.device_failure_recovery_projections(
        recovery_id, tournament_id, event_id, canonical_game_id,
        participant_id, opponent_participant_id, side, table_seat_snapshot,
        is_winner, margin, plus_points, minus_points, game_points
      ) values
      (p_recovery_id, v_recovery.tournament_id, v_recovery.event_id, v_recovery.canonical_game_id,
       v_game.side_a_participant_id, v_game.side_b_participant_id, 'a', v_game.side_a_table_seat_snapshot,
       v_recovery.proposed_winner_side = 'a', v_recovery.proposed_margin,
       case when v_recovery.proposed_winner_side = 'a' then v_recovery.proposed_margin else 0 end,
       case when v_recovery.proposed_winner_side = 'b' then v_recovery.proposed_margin else 0 end,
       case when v_recovery.proposed_winner_side = 'a' then case when v_recovery.proposed_margin >= 31 then 3 else 2 end else 0 end),
      (p_recovery_id, v_recovery.tournament_id, v_recovery.event_id, v_recovery.canonical_game_id,
       v_game.side_b_participant_id, v_game.side_a_participant_id, 'b', v_game.side_b_table_seat_snapshot,
       v_recovery.proposed_winner_side = 'b', v_recovery.proposed_margin,
       case when v_recovery.proposed_winner_side = 'b' then v_recovery.proposed_margin else 0 end,
       case when v_recovery.proposed_winner_side = 'a' then v_recovery.proposed_margin else 0 end,
       case when v_recovery.proposed_winner_side = 'b' then case when v_recovery.proposed_margin >= 31 then 3 else 2 end else 0 end);
      v_after_totals := app.device_recovery_totals_snapshot(p_recovery_id, true);
    end if;

    v_response := jsonb_build_object(
      'status', case when p_decision = 'approve' then 'approved' else 'rejected' end,
      'decision', p_decision, 'recoveryId', p_recovery_id,
      'gameId', v_recovery.canonical_game_id,
      'authoritative', p_decision = 'approve',
      'playerSubmissionsCreated', false, 'playerConfirmationsCreated', false
    );
    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id,
      request_hash, client_operation_id, outcome, response_payload, applied_at
    ) values (p_actor_id, v_recovery.tournament_id,
      'review_device_failure_recovery_v1', p_recovery_id, v_hash,
      p_operation_id, 'accepted', v_response, now()) returning id into v_receipt_id;
    insert into app.device_failure_recovery_state_events(
      recovery_id, tournament_id, event_id, canonical_game_id, state,
      transition_sequence, actor_profile_id, actor_role, operation_receipt_id,
      before_totals, after_totals
    ) values (p_recovery_id, v_recovery.tournament_id, v_recovery.event_id,
      v_recovery.canonical_game_id,
      case when p_decision = 'approve' then 'approved' else 'rejected' end,
      2, p_actor_id, v_role, v_receipt_id, v_before_totals, v_after_totals);
    insert into app.audit_events(
      tournament_id, actor_profile_id, canonical_game_id, operation_receipt_id,
      entity_type, entity_id, action, before_state, after_state
    ) values (v_recovery.tournament_id, p_actor_id, v_recovery.canonical_game_id,
      v_receipt_id, 'device_failure_recovery', p_recovery_id,
      case when p_decision = 'approve' then 'device_recovery_approved' else 'device_recovery_rejected' end,
      jsonb_build_object('status', v_latest_state, 'totals', v_before_totals),
      v_response || jsonb_build_object('totals', v_after_totals));
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'invalid recovery review request' then 'invalid_request'
      when 'recovery case unavailable' then 'recovery_unavailable'
      when 'recovery scope invalid' then 'scope_invalid'
      when 'eligible reviewer required' then 'not_eligible_reviewer'
      when 'participant identity unresolved' then 'participant_identity_unresolved'
      when 'independent reviewer required' then 'reviewer_not_independent'
      when 'recovery review closed' then 'review_closed'
      when 'disputed evidence cannot approve' then 'evidence_disputed'
      when 'recovery lifecycle unavailable' then 'lifecycle_unavailable'
      when 'recovery evidence is stale or conflicting' then 'evidence_stale_or_conflicting'
      else 'review_unavailable'
    end;
    v_response := jsonb_build_object('status', 'rejected', 'code', v_code, 'recoveryId', p_recovery_id);
    if v_authorized and p_operation_id is not null and v_hash is not null
       and not exists (select 1 from app.operation_receipts where actor_profile_id = p_actor_id and client_operation_id = p_operation_id) then
      insert into app.operation_receipts(
        actor_profile_id, tournament_id, operation_type, target_id,
        request_hash, client_operation_id, outcome, response_payload, applied_at
      ) values (p_actor_id, v_recovery.tournament_id,
        'review_device_failure_recovery_v1', p_recovery_id, v_hash,
        p_operation_id, 'rejected', v_response, now()) returning id into v_receipt_id;
      insert into app.audit_events(
        tournament_id, actor_profile_id, canonical_game_id, operation_receipt_id,
        entity_type, entity_id, action, after_state
      ) values (v_recovery.tournament_id, p_actor_id,
        v_recovery.canonical_game_id, v_receipt_id,
        'device_failure_recovery', p_recovery_id,
        'device_recovery_review_rejected', v_response);
    end if;
    return v_response;
  end;
end;
$$;

create or replace function public.get_device_failure_recovery_workspace_v1(
  p_actor_id uuid,
  p_tournament_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_role text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only device recovery';
  end if;
  select role_row.role into v_role from app.tournament_roles role_row
  where role_row.tournament_id = p_tournament_id
    and role_row.profile_id = p_actor_id
    and role_row.role in ('director', 'co_director', 'cross_checker')
  order by case role_row.role when 'director' then 1 when 'co_director' then 2 else 3 end limit 1;
  if v_role is null then return null; end if;
  return (
    select jsonb_build_object(
      'tournamentId', tournament_row.id,
      'tournamentName', tournament_row.name,
      'actorRole', v_role,
      'proposalCandidates', coalesce((
        select jsonb_agg(jsonb_build_object(
          'gameId', game.id, 'eventName', event_row.name,
          'roundNumber', round_row.round_number,
          'matchInstance', game.match_instance, 'gameVersion', game.version,
          'gameState', game.state,
          'sideA', jsonb_build_object('displayName', coalesce(roster_a.claimed_display_name, profile_a.display_name)),
          'sideB', jsonb_build_object('displayName', coalesce(roster_b.claimed_display_name, profile_b.display_name)),
          'survivingClaims', coalesce((select jsonb_agg(jsonb_build_object(
            'sourceType', 'opponent_device', 'sourceReference', submission.id,
            'winnerSide', submission.winner_side, 'margin', submission.margin
          ) order by submission.submitted_at) from app.score_submissions submission
          where submission.canonical_game_id = game.id), '[]'::jsonb)
        ) order by event_row.name, round_row.round_number, game.match_instance)
        from app.canonical_games game
        join app.events event_row on event_row.id = game.event_id and event_row.tournament_id = game.tournament_id
        join app.ruleset_versions ruleset on ruleset.id = event_row.ruleset_version_id
          and ruleset.tournament_id = event_row.tournament_id and ruleset.format = 'standard_singles'
          and ruleset.approved_at is not null
        join app.rounds round_row on round_row.id = game.round_id
        join app.event_participants participant_a on participant_a.id = game.side_a_participant_id
        join app.event_participants participant_b on participant_b.id = game.side_b_participant_id
        left join app.tournament_roster_entries roster_a on roster_a.id = participant_a.roster_entry_id
        left join app.tournament_roster_entries roster_b on roster_b.id = participant_b.roster_entry_id
        left join app.profiles profile_a on profile_a.id = participant_a.profile_id
        left join app.profiles profile_b on profile_b.id = participant_b.profile_id
        where game.tournament_id = p_tournament_id
          and event_row.format = 'standard_singles' and event_row.scoring_method = 'digital'
           and game.state in ('pending', 'submitted', 'mismatch', 'confirmation_pending')
           and not exists (select 1 from app.card_scorelines where canonical_game_id = game.id)
           and app.recovery_participant_profile_id(game.side_a_participant_id, game.tournament_id, game.event_id) is not null
           and app.recovery_participant_profile_id(game.side_b_participant_id, game.tournament_id, game.event_id) is not null
           and p_actor_id is distinct from app.recovery_participant_profile_id(game.side_a_participant_id, game.tournament_id, game.event_id)
          and p_actor_id is distinct from app.recovery_participant_profile_id(game.side_b_participant_id, game.tournament_id, game.event_id)
          and not exists (
            select 1 from app.device_failure_recoveries recovery
            cross join lateral (select state from app.device_failure_recovery_state_events state_event
              where state_event.recovery_id = recovery.id order by transition_sequence desc limit 1) latest
            where recovery.canonical_game_id = game.id and latest.state <> 'rejected'
          ) and v_role = 'cross_checker'
      ), '[]'::jsonb),
      'reviewCases', coalesce((
        select jsonb_agg(jsonb_build_object(
          'recoveryId', recovery.id, 'gameId', recovery.canonical_game_id,
          'eventName', event_row.name, 'roundNumber', round_row.round_number,
          'matchInstance', game.match_instance, 'state', latest.state,
          'winnerSide', recovery.proposed_winner_side, 'margin', recovery.proposed_margin,
          'sideA', jsonb_build_object('displayName', coalesce(roster_a.claimed_display_name, profile_a.display_name)),
          'sideB', jsonb_build_object('displayName', coalesce(roster_b.claimed_display_name, profile_b.display_name)),
          'evidence', coalesce((select jsonb_agg(jsonb_build_object(
            'sourceType', evidence.source_type, 'sourceReference', evidence.source_reference,
            'winnerSide', evidence.claimed_winner_side, 'margin', evidence.claimed_margin
          ) order by evidence.recorded_at, evidence.id)
          from app.device_failure_recovery_evidence evidence where evidence.recovery_id = recovery.id), '[]'::jsonb)
        ) order by event_row.name, round_row.round_number, game.match_instance)
        from app.device_failure_recoveries recovery
        join app.canonical_games game on game.id = recovery.canonical_game_id
        join app.events event_row on event_row.id = recovery.event_id
        join app.rounds round_row on round_row.id = recovery.round_id
        join app.event_participants participant_a on participant_a.id = game.side_a_participant_id
        join app.event_participants participant_b on participant_b.id = game.side_b_participant_id
        left join app.tournament_roster_entries roster_a on roster_a.id = participant_a.roster_entry_id
        left join app.tournament_roster_entries roster_b on roster_b.id = participant_b.roster_entry_id
        left join app.profiles profile_a on profile_a.id = participant_a.profile_id
        left join app.profiles profile_b on profile_b.id = participant_b.profile_id
        cross join lateral (select state from app.device_failure_recovery_state_events state_event
          where state_event.recovery_id = recovery.id order by transition_sequence desc limit 1) latest
        where recovery.tournament_id = p_tournament_id
           and latest.state in ('pending_review', 'disputed')
           and recovery.reporter_profile_id <> p_actor_id
           and app.recovery_participant_profile_id(game.side_a_participant_id, game.tournament_id, game.event_id) is not null
           and app.recovery_participant_profile_id(game.side_b_participant_id, game.tournament_id, game.event_id) is not null
           and p_actor_id is distinct from app.recovery_participant_profile_id(game.side_a_participant_id, game.tournament_id, game.event_id)
          and p_actor_id is distinct from app.recovery_participant_profile_id(game.side_b_participant_id, game.tournament_id, game.event_id)
      ), '[]'::jsonb)
    ) from app.tournaments tournament_row where tournament_row.id = p_tournament_id
  );
end;
$$;

revoke all on function public.create_device_failure_recovery_v1(uuid, uuid, uuid, uuid, text, integer, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.review_device_failure_recovery_v1(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.get_device_failure_recovery_workspace_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_device_failure_recovery_v1(uuid, uuid, uuid, uuid, text, integer, jsonb, uuid) to service_role;
grant execute on function public.review_device_failure_recovery_v1(uuid, uuid, text, uuid) to service_role;
grant execute on function public.get_device_failure_recovery_workspace_v1(uuid, uuid) to service_role;

-- Scorecard and standings read-side updates are appended below after the
-- recovery transaction so only approved projections can affect totals.

create or replace function public.get_player_scorecard(
  p_tournament_id uuid,
  p_event_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tournamentId', tournament_row.id,
    'eventId', event_row.id,
    'tournamentName', tournament_row.name,
    'eventName', event_row.name,
    'player', jsonb_build_object(
      'displayName', player_profile.display_name,
      'verificationId', player_seating.verification_id
    ),
    'lines', scorecard.lines,
    'totals', jsonb_build_object(
      'gamePoints', scorecard.game_points,
      'plusPoints', scorecard.plus_points,
      'minusPoints', scorecard.minus_points,
      'gamesWon', scorecard.games_won,
      'netSpreadPoints', scorecard.plus_points - scorecard.minus_points
    ),
    'pendingGames', pending.pending_games
  )
  from app.tournaments tournament_row
  join app.events event_row on event_row.id = p_event_id
    and event_row.tournament_id = tournament_row.id
  join app.ruleset_versions ruleset on ruleset.id = event_row.ruleset_version_id
    and ruleset.tournament_id = event_row.tournament_id
    and ruleset.format = 'standard_singles' and ruleset.approved_at is not null
  join app.event_participants player_participant
    on player_participant.event_id = event_row.id
    and player_participant.tournament_id = tournament_row.id
    and player_participant.profile_id = auth.uid()
  join app.profiles player_profile on player_profile.id = player_participant.profile_id
  join app.roster_account_links player_link
    on player_link.tournament_id = tournament_row.id
    and player_link.profile_id = player_participant.profile_id
  join app.initial_seating_assignments player_seating
    on player_seating.tournament_id = tournament_row.id
    and player_seating.roster_entry_id = player_link.roster_entry_id
  join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'roundNumber', round_row.round_number,
      'matchInstance', game.match_instance,
      'gamePoints', line.game_points,
      'plusPoints', line.plus_points,
      'minusPoints', line.minus_points,
      'opponentName', coalesce(opponent_roster.claimed_display_name, opponent_profile.display_name),
      'opponentVerificationId', coalesce(opponent_seating.verification_id, opponent.table_seat)
    ) order by round_row.round_number, game.match_instance), '[]'::jsonb) as lines,
    coalesce(sum(line.game_points), 0)::integer as game_points,
    coalesce(sum(line.plus_points), 0)::integer as plus_points,
    coalesce(sum(line.minus_points), 0)::integer as minus_points,
    count(*) filter (where line.is_winner)::integer as games_won
    from app.current_effective_scorelines(tournament_row.id, event_row.id) line
    join app.canonical_games game on game.id = line.canonical_game_id
      and game.tournament_id = tournament_row.id and game.event_id = event_row.id
    join app.rounds round_row on round_row.id = game.round_id
      and round_row.tournament_id = game.tournament_id
      and round_row.event_id = game.event_id
    join app.event_participants opponent on opponent.id = line.opponent_participant_id
      and opponent.tournament_id = tournament_row.id and opponent.event_id = event_row.id
    left join app.roster_account_links opponent_link
      on opponent_link.tournament_id = opponent.tournament_id
      and opponent_link.profile_id = opponent.profile_id
    left join app.tournament_roster_entries opponent_roster
      on opponent_roster.id = coalesce(opponent.roster_entry_id, opponent_link.roster_entry_id)
      and opponent_roster.tournament_id = opponent.tournament_id
    left join app.profiles opponent_profile on opponent_profile.id = opponent.profile_id
    left join app.initial_seating_assignments opponent_seating
      on opponent_seating.tournament_id = opponent.tournament_id
      and opponent_seating.roster_entry_id = coalesce(opponent.roster_entry_id, opponent_link.roster_entry_id)
    where line.participant_id = player_participant.id
  ) scorecard on true
  join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'roundNumber', round_row.round_number,
      'matchInstance', game.match_instance,
      'state', game.state
    ) order by round_row.round_number, game.match_instance), '[]'::jsonb) as pending_games
    from app.canonical_games game
    join app.rounds round_row on round_row.id = game.round_id
      and round_row.tournament_id = game.tournament_id
      and round_row.event_id = game.event_id
    where game.tournament_id = tournament_row.id and game.event_id = event_row.id
      and player_participant.id in (game.side_a_participant_id, game.side_b_participant_id)
      and game.state in ('pending', 'submitted', 'confirmation_pending', 'mismatch')
      and not exists (
        select 1 from app.device_failure_recoveries recovery
        where recovery.canonical_game_id = game.id
          and app.device_recovery_is_approved(recovery.id)
      )
  ) pending on true
  where tournament_row.id = p_tournament_id and auth.uid() is not null
    and event_row.format = 'standard_singles' and event_row.scoring_method = 'digital'
  limit 1
$$;

revoke all on function public.get_player_scorecard(uuid, uuid) from public, anon;
grant execute on function public.get_player_scorecard(uuid, uuid) to authenticated;

create or replace function public.get_preliminary_event_standings(
  p_tournament_id uuid,
  p_event_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with authorized_event as (
    select tournament_row.id as tournament_id, tournament_row.name as tournament_name,
      event_row.id as event_id, event_row.name as event_name,
      coalesce(setup_event.game_count, publication.game_count)::integer as configured_game_count,
      publication.id is not null as schedule_published,
      coalesce(publication.match_count, 0)::integer as scheduled_match_count
    from app.tournaments tournament_row
    join app.events event_row on event_row.tournament_id = tournament_row.id
      and event_row.id = p_event_id
    join app.ruleset_versions ruleset on ruleset.id = event_row.ruleset_version_id
      and ruleset.tournament_id = event_row.tournament_id
      and ruleset.format = 'standard_singles' and ruleset.approved_at is not null
    left join app.tournament_setup_activations activation
      on activation.tournament_id = event_row.tournament_id
      and activation.event_id = event_row.id
    left join app.tournament_setup_event_versions setup_event
      on setup_event.id = activation.setup_event_version_id
      and setup_event.tournament_id = activation.tournament_id
    left join app.event_schedule_publications publication
      on publication.tournament_id = event_row.tournament_id
      and publication.event_id = event_row.id
    where tournament_row.id = p_tournament_id
      and event_row.format = 'standard_singles'
      and event_row.scoring_method = 'digital'
      and (select auth.uid()) is not null
      and exists (
        select 1 from app.tournament_roles role_row
        where role_row.tournament_id = tournament_row.id
          and role_row.profile_id = (select auth.uid())
          and role_row.role in ('director','co_director','player','cross_checker','judge','viewer')
      )
  ), match_evidence as (
    select authorized_event.tournament_id, authorized_event.event_id,
      count(game.id)::integer as persisted_match_count,
      count(game.id) filter (where
        (game.state in ('verified', 'corrected') and
          (select count(*) from app.card_scorelines scoreline
           where scoreline.canonical_game_id = game.id) = 2)
        or exists (
          select 1 from app.device_failure_recoveries recovery
          where recovery.canonical_game_id = game.id
            and app.device_recovery_is_approved(recovery.id)
            and (select count(*) from app.device_failure_recovery_projections projection
              where projection.recovery_id = recovery.id) = 2
        )
      )::integer as resolved_match_count
    from authorized_event
    left join app.canonical_games game
      on game.tournament_id = authorized_event.tournament_id
      and game.event_id = authorized_event.event_id
    group by authorized_event.tournament_id, authorized_event.event_id
  ), totals as (
    select participant.id as participant_id,
      participant.status as participant_status,
      coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), '')) as display_name,
      coalesce(sum(line.game_points), 0)::integer as game_points,
      count(*) filter (where line.is_winner)::integer as games_won,
      coalesce(sum(line.plus_points), 0)::integer as plus_points,
      coalesce(sum(line.minus_points), 0)::integer as minus_points,
      count(line.line_id)::integer as verified_games
    from authorized_event
    join app.event_participants participant
      on participant.tournament_id = authorized_event.tournament_id
      and participant.event_id = authorized_event.event_id
    left join app.tournament_roster_entries roster
      on roster.id = participant.roster_entry_id
      and roster.tournament_id = participant.tournament_id
    left join app.profiles profile on profile.id = participant.profile_id
    left join lateral (
      select effective.*
      from app.current_effective_scorelines(
        authorized_event.tournament_id, authorized_event.event_id
      ) effective where effective.participant_id = participant.id
    ) line on true
    where coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), '')) is not null
    group by participant.id, participant.status,
      coalesce(nullif(trim(roster.claimed_display_name), ''), nullif(trim(profile.display_name), ''))
  ), ranked as (
    select totals.*,
      rank() over (order by game_points desc, games_won desc,
        (plus_points - minus_points) desc, plus_points desc)::integer as numeric_rank,
      count(*) over (partition by game_points, games_won,
        (plus_points - minus_points), plus_points)::integer as tied_count
    from totals
  )
  select jsonb_build_object(
    'tournamentId', authorized_event.tournament_id,
    'eventId', authorized_event.event_id,
    'tournamentName', authorized_event.tournament_name,
    'eventName', authorized_event.event_name,
    'status', 'preliminary',
    'configuredGameCount', authorized_event.configured_game_count,
    'schedulePublished', authorized_event.schedule_published,
    'scheduledMatchCount', authorized_event.scheduled_match_count,
    'persistedMatchCount', evidence.persisted_match_count,
    'resolvedMatchCount', evidence.resolved_match_count,
    'scheduledScorecardsComplete', authorized_event.schedule_published
      and authorized_event.configured_game_count is not null
      and authorized_event.scheduled_match_count > 0
      and evidence.persisted_match_count = authorized_event.scheduled_match_count
      and evidence.resolved_match_count = authorized_event.scheduled_match_count
      and exists (select 1 from totals)
      and not exists (select 1 from totals item
        where item.verified_games <> authorized_event.configured_game_count),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'participantId', row_data.participant_id,
      'displayName', row_data.display_name,
      'participantStatus', row_data.participant_status,
      'verifiedGames', row_data.verified_games,
      'gamePoints', row_data.game_points,
      'gamesWon', row_data.games_won,
      'plusPoints', row_data.plus_points,
      'minusPoints', row_data.minus_points,
      'netSpreadPoints', row_data.plus_points - row_data.minus_points,
      'numericRank', row_data.numeric_rank,
      'tied', row_data.tied_count > 1
    ) order by row_data.numeric_rank, row_data.display_name, row_data.participant_id)
    from ranked row_data), '[]'::jsonb)
  )
  from authorized_event
  join match_evidence evidence on evidence.tournament_id = authorized_event.tournament_id
    and evidence.event_id = authorized_event.event_id
$$;

revoke all on function public.get_preliminary_event_standings(uuid, uuid) from public, anon;
grant execute on function public.get_preliminary_event_standings(uuid, uuid) to authenticated;

-- Present an approved recovery as completed in My Games without changing the
-- canonical game state or inventing player history.
create or replace function public.get_my_assigned_games_v1(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with raw as (
    select app.get_my_assigned_games_unfiltered_core_v1(p_tournament_id) as payload
  ), draft_official as (
    select jsonb_build_object(
      'tournamentId', tournament_row.id,
      'tournamentName', tournament_row.name,
      'tournamentDate', coalesce(to_char(latest.starts_at, 'MM-DD-YYYY'), ''),
      'games', '[]'::jsonb
    ) as payload
    from app.tournaments tournament_row
    left join lateral (
      select revision.starts_at from app.tournament_setup_revisions revision
      where revision.tournament_id = tournament_row.id
      order by revision.version desc limit 1
    ) latest on true
    where tournament_row.id = p_tournament_id and tournament_row.status = 'draft'
      and (select auth.uid()) is not null
      and exists (select 1 from app.tournament_roles role_row
        where role_row.tournament_id = tournament_row.id
          and role_row.profile_id = (select auth.uid())
          and role_row.role in ('director','co_director','cross_checker','judge','viewer'))
  ), effective as (
    select coalesce(raw.payload, draft_official.payload) as payload
    from raw left join draft_official on true
  )
  select case when payload is null then null else jsonb_set(
    payload, '{games}', coalesce((
      select jsonb_agg(
        case when exists (
          select 1 from app.device_failure_recoveries recovery
          where recovery.canonical_game_id = (item.game->>'gameId')::uuid
            and app.device_recovery_is_approved(recovery.id)
        ) then item.game || jsonb_build_object(
          'state', 'recovered', 'nextAction', 'view_scorecard', 'canConfirm', false
        ) else item.game end
        order by item.ordinality
      )
      from jsonb_array_elements(payload->'games') with ordinality as item(game, ordinality)
      where exists (select 1 from app.event_schedule_games scheduled
        where scheduled.tournament_id = p_tournament_id
          and scheduled.event_id = (item.game->>'eventId')::uuid
          and scheduled.canonical_game_id = (item.game->>'gameId')::uuid)
    ), '[]'::jsonb), false
  ) end from effective
$$;
revoke all on function public.get_my_assigned_games_v1(uuid) from public, anon;
grant execute on function public.get_my_assigned_games_v1(uuid) to authenticated;
