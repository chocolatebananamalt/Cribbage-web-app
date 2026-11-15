-- Finalizing cross-checking was a judgement call spread over five screens.
--
-- A director had to open Failed-device score recovery, Digital-versus-paper
-- games, Paper-versus-paper games, Independent scorecard corrections and the
-- results screens, hold what each one said in their head, and decide for
-- themselves that nothing was left. The gap matrix in
-- docs/operations/2026-09-17-luke-streamline-and-judge-call-handoff.md records
-- the consequence: "A single Finalize Cross-Checking orchestration" is listed
-- as missing from phase 6, next to paths that all individually exist.
--
-- Nothing here changes any of those paths. This reads the same stores they
-- write, states every condition in one list with its count, and records the
-- director's completion as an operation with a receipt and an audit row, the
-- same way 0224 records an archive. A screen that only flipped a flag would be
-- a claim; a receipt is evidence, and ACC results are reconstructed from
-- evidence.
--
-- Every count is scoped to app.events.operational_state = 'active' (0194).
-- A retired or replaced event keeps its rows forever by design, so counting
-- them would leave a tournament permanently unable to finalize over work that
-- was deliberately abandoned.

create table app.cross_check_finalizations (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  -- The exact condition list as it read at the moment of finalization. Counts
  -- can only be recomputed against today's rows, so without this snapshot there
  -- is no way to show what the director was actually looking at when they
  -- pressed the button.
  conditions_snapshot jsonb not null check (jsonb_typeof(conditions_snapshot) = 'array'),
  operation_receipt_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict,
  -- One finalization per tournament. A second attempt reports the first rather
  -- than stacking a second claim on the same fact.
  unique (tournament_id),
  unique (operation_receipt_id)
);
alter table app.cross_check_finalizations enable row level security;
alter table app.cross_check_finalizations force row level security;
revoke all on table app.cross_check_finalizations from public, anon, authenticated;
create trigger cross_check_finalizations_immutable
before update or delete on app.cross_check_finalizations
for each row execute function app.reject_immutable_history();
create index cross_check_finalizations_actor_idx
  on app.cross_check_finalizations(actor_profile_id);
create index cross_check_finalizations_receipt_scope_idx
  on app.cross_check_finalizations(operation_receipt_id, tournament_id);

-- Sentences are assembled rather than written twice, so "1 dispute is still
-- open" and "3 disputes are still open" cannot drift apart.
create or replace function app.cross_check_count_phrase(p_count integer, p_singular text, p_plural text)
returns text language sql immutable set search_path = '' as $$
  select p_count::text || ' ' || case when p_count = 1 then p_singular else p_plural end
$$;
revoke all on function app.cross_check_count_phrase(integer, text, text) from public, anon, authenticated;

-- One definition of "outstanding", called by both the reader and the writer.
-- If the screen and the guard computed their conditions separately they would
-- eventually disagree, and the disagreement would show up as a button that is
-- enabled and then refuses.
--
-- count is always the number of things still outstanding for that condition,
-- never a total, so `outstanding` is exactly `count > 0` for every entry and a
-- caller can trust that invariant instead of re-deriving it per code.
create or replace function app.cross_check_finalization_conditions_v1(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_status text;
  v_cross_checkers integer := 0;
  v_games integer := 0;
  v_unverified_games integer := 0;
  v_team_games integer := 0;
  v_unverified_team_games integer := 0;
  v_legacy_corrections integer := 0;
  v_independent_corrections integer := 0;
  v_corrections integer := 0;
  v_open_disputes integer := 0;
  v_open_recoveries integer := 0;
  v_open_hybrid_cases integer := 0;
  v_open_paper_completions integer := 0;
  v_placements_without_evidence integer := 0;
  v_satellites_not_complete integer := 0;
  v_status_blocked integer := 0;
  v_no_cross_checkers integer := 0;
begin
  select tournament.status into v_status
  from app.tournaments tournament where tournament.id = p_tournament_id;
  if not found then return null; end if;

  -- Cross-checking belongs to a tournament that is running. Finalizing it on a
  -- draft would record completion of work that has not started, and on an
  -- already finalized or archived tournament it would record it twice.
  if v_status not in ('open', 'pending_finalization') then v_status_blocked := 1; end if;

  -- Authority lands in app.tournament_roles only after the invited official
  -- signs in with the exact invited email (0211). A nomination that is still
  -- pending is not a cross-checker, so counting nominations here would report
  -- coverage the tournament does not have.
  select count(*)::integer into v_cross_checkers
  from app.tournament_roles role_row
  where role_row.tournament_id = p_tournament_id and role_row.role = 'cross_checker';
  if v_cross_checkers = 0 then v_no_cross_checkers := 1; end if;

  -- app.game_is_authoritatively_resolved_v1 (current definition 0169:384) is the
  -- shared "this game is done" predicate, and it is wider than the state column.
  -- An audited operational forfeit (app.operational_game_forfeits) and an
  -- approved device-failure recovery (app.device_failure_recoveries) both leave
  -- app.canonical_games.state at 'pending' forever by design, because no card
  -- was ever verified. Testing the state column directly would count those games
  -- as outstanding for the rest of the tournament, and Finalize Cross-Checking
  -- could then never be pressed on any tournament that had a single forfeit.
  -- 0229 counts readiness with the same helper; the two must agree or Close
  -- Event and Finalize Cross-Checking would disagree about the same game.
  --
  -- The team half below keeps the state test because team games have no forfeit
  -- or recovery path: 0178:370 uses exactly this predicate as the team "done"
  -- test, and there is no app.game_is_authoritatively_resolved_v1 equivalent for
  -- app.event_team_games.
  select count(*)::integer,
         count(*) filter (where not app.game_is_authoritatively_resolved_v1(game.id))::integer
    into v_games, v_unverified_games
  from app.canonical_games game
  join app.events event_row
    on event_row.id = game.event_id and event_row.tournament_id = game.tournament_id
  where game.tournament_id = p_tournament_id and event_row.operational_state = 'active';

  select count(*)::integer,
         count(*) filter (where team_game.state not in ('verified', 'corrected'))::integer
    into v_team_games, v_unverified_team_games
  from app.event_team_games team_game
  join app.events event_row
    on event_row.id = team_game.event_id and event_row.tournament_id = team_game.tournament_id
  where team_game.tournament_id = p_tournament_id and event_row.operational_state = 'active';

  -- Both correction predicates are the ones get_event_finalization_readiness_v1
  -- already uses (0110), with the event filter widened to the tournament. The
  -- two sets are disjoint: a legacy correction lives in app.game_corrections
  -- and an independent one in app.independent_card_correction_lifecycles, so
  -- adding them cannot double count a single correction.
  select count(*)::integer into v_legacy_corrections
  from app.game_corrections correction
  join app.events event_row
    on event_row.id = correction.event_id and event_row.tournament_id = correction.tournament_id
  where correction.tournament_id = p_tournament_id
    and event_row.operational_state = 'active'
    and correction.required_approvals = 1
    and exists (
      select 1 from app.correction_state_events state_event
      where state_event.correction_id = correction.id and state_event.state = 'pending'
    )
    and not exists (
      select 1 from app.correction_state_events state_event
      where state_event.correction_id = correction.id
        and state_event.state in ('approved', 'applied', 'rejected')
    );

  select count(*)::integer into v_independent_corrections
  from app.independent_card_correction_lifecycles correction
  join app.events event_row
    on event_row.id = correction.event_id and event_row.tournament_id = correction.tournament_id
  where correction.tournament_id = p_tournament_id
    and event_row.operational_state = 'active'
    and exists (
      select 1 from app.independent_card_correction_state_events state_event
      where state_event.correction_id = correction.correction_id and state_event.state = 'pending'
    )
    and not exists (
      select 1 from app.independent_card_correction_state_events state_event
      where state_event.correction_id = correction.correction_id
        and state_event.state in ('approved', 'applied', 'rejected')
    );
  v_corrections := v_legacy_corrections + v_independent_corrections;

  select count(*)::integer into v_open_disputes
  from app.event_disputes dispute
  join app.events event_row
    on event_row.id = dispute.event_id and event_row.tournament_id = dispute.tournament_id
  where dispute.tournament_id = p_tournament_id
    and event_row.operational_state = 'active'
    and app.event_dispute_is_open(dispute.id);

  -- The three review queues below all record their state as an append-only
  -- transition list, so the open question is always the highest transition. A
  -- case carrying no transition at all counts as open: the opening operation
  -- writes transition 1 in the same transaction, so the absence would mean the
  -- store is not what this function believes it is, and guessing "resolved"
  -- there would let a real case through.
  select count(*)::integer into v_open_recoveries
  from app.device_failure_recoveries recovery
  join app.events event_row
    on event_row.id = recovery.event_id and event_row.tournament_id = recovery.tournament_id
  where recovery.tournament_id = p_tournament_id
    and event_row.operational_state = 'active'
    and coalesce((
      select state_event.state from app.device_failure_recovery_state_events state_event
      where state_event.recovery_id = recovery.id
      order by state_event.transition_sequence desc limit 1
    ), 'pending_review') in ('pending_review', 'disputed');

  select count(*)::integer into v_open_hybrid_cases
  from app.hybrid_game_cases hybrid_case
  join app.events event_row
    on event_row.id = hybrid_case.event_id and event_row.tournament_id = hybrid_case.tournament_id
  where hybrid_case.tournament_id = p_tournament_id
    and event_row.operational_state = 'active'
    and coalesce((
      select state_event.state from app.hybrid_game_state_events state_event
      where state_event.hybrid_case_id = hybrid_case.id
      order by state_event.transition_sequence desc limit 1
    ), 'pending_review') = 'pending_review';

  select count(*)::integer into v_open_paper_completions
  from app.paper_game_completions completion
  join app.events event_row
    on event_row.id = completion.event_id and event_row.tournament_id = completion.tournament_id
  where completion.tournament_id = p_tournament_id
    and event_row.operational_state = 'active'
    and coalesce((
      select state_event.state from app.paper_game_completion_state_events state_event
      where state_event.completion_id = completion.id
      order by state_event.transition_sequence desc limit 1
    ), 'pending_review') = 'pending_review';

  -- "Cashing scorecards require cross-check" (docs/product/requirements.md:63)
  -- is evidenced only inside the current Satellite result version: each
  -- placement carries a crossCheckEvidence array, and the version carries the
  -- director's cross_check_complete flag. Both are read from the highest
  -- version of each package, because a reopened or corrected package
  -- supersedes rather than replaces its predecessor.
  select coalesce(sum(placement_gap.missing), 0)::integer,
         count(*) filter (where not current_version.cross_check_complete)::integer
    into v_placements_without_evidence, v_satellites_not_complete
  from app.satellite_result_packages package
  join app.events event_row
    on event_row.id = package.event_id and event_row.tournament_id = package.tournament_id
  join lateral (
    select item.* from app.satellite_result_versions item
    where item.package_id = package.id
    order by item.version desc limit 1
  ) current_version on true
  join lateral (
    select count(*)::integer as missing
    from jsonb_array_elements(current_version.placements) placement
    -- CASE, not OR: PostgreSQL may evaluate either arm of an OR first, and
    -- jsonb_array_length raises on a value that is not an array, so the type
    -- test has to be the thing that guards the call rather than sit beside it.
    where case
      when jsonb_typeof(placement->'crossCheckEvidence') = 'array'
        then jsonb_array_length(placement->'crossCheckEvidence') = 0
      else true end
  ) placement_gap on true
  where package.tournament_id = p_tournament_id
    and event_row.operational_state = 'active'
    and event_row.event_type = 'satellite';

  return jsonb_build_array(
    jsonb_build_object(
      'code', 'tournament_not_open_for_cross_check',
      'outstanding', v_status_blocked > 0,
      'count', v_status_blocked,
      'sentence', case when v_status_blocked > 0
        then 'Cross-checking can be finalized only while the tournament is open or pending finalization. This tournament is ' || v_status || '.'
        else 'The tournament status allows cross-checking to be finalized.' end
    ),
    jsonb_build_object(
      'code', 'cross_checkers_not_assigned',
      'outstanding', v_no_cross_checkers > 0,
      'count', v_no_cross_checkers,
      'sentence', case when v_no_cross_checkers > 0
        then 'No cross-checker has been assigned to this tournament.'
        else app.cross_check_count_phrase(v_cross_checkers, 'cross-checker is', 'cross-checkers are') || ' assigned.' end
    ),
    jsonb_build_object(
      'code', 'games_not_verified',
      'outstanding', v_unverified_games > 0,
      'count', v_unverified_games,
      'sentence', case
        when v_unverified_games > 0 then app.cross_check_count_phrase(v_unverified_games, 'game is', 'games are') || ' not verified yet, out of ' || v_games::text || ' scheduled.'
        when v_games = 0 then 'No singles games are scheduled in an active event.'
        else 'All ' || v_games::text || ' scheduled games are verified or corrected.' end
    ),
    jsonb_build_object(
      'code', 'team_games_not_verified',
      'outstanding', v_unverified_team_games > 0,
      'count', v_unverified_team_games,
      'sentence', case
        when v_unverified_team_games > 0 then app.cross_check_count_phrase(v_unverified_team_games, 'team game is', 'team games are') || ' not verified yet, out of ' || v_team_games::text || ' scheduled.'
        when v_team_games = 0 then 'No team games are scheduled in an active event.'
        else 'All ' || v_team_games::text || ' scheduled team games are verified or corrected.' end
    ),
    jsonb_build_object(
      'code', 'corrections_pending',
      'outstanding', v_corrections > 0,
      'count', v_corrections,
      'sentence', case when v_corrections > 0
        then app.cross_check_count_phrase(v_corrections, 'correction is', 'corrections are') || ' still waiting for approval.'
        else 'No correction is waiting for approval.' end
    ),
    jsonb_build_object(
      'code', 'disputes_unresolved',
      'outstanding', v_open_disputes > 0,
      'count', v_open_disputes,
      'sentence', case when v_open_disputes > 0
        then app.cross_check_count_phrase(v_open_disputes, 'dispute is', 'disputes are') || ' still open.'
        else 'No dispute is open.' end
    ),
    jsonb_build_object(
      'code', 'device_recoveries_awaiting_review',
      'outstanding', v_open_recoveries > 0,
      'count', v_open_recoveries,
      'sentence', case when v_open_recoveries > 0
        then app.cross_check_count_phrase(v_open_recoveries, 'failed-device score recovery is', 'failed-device score recoveries are') || ' still waiting for review.'
        else 'No failed-device score recovery is waiting for review.' end
    ),
    jsonb_build_object(
      'code', 'hybrid_cases_awaiting_review',
      'outstanding', v_open_hybrid_cases > 0,
      'count', v_open_hybrid_cases,
      'sentence', case when v_open_hybrid_cases > 0
        then app.cross_check_count_phrase(v_open_hybrid_cases, 'digital-versus-paper game is', 'digital-versus-paper games are') || ' still waiting for review.'
        else 'No digital-versus-paper game is waiting for review.' end
    ),
    jsonb_build_object(
      'code', 'paper_completions_awaiting_review',
      'outstanding', v_open_paper_completions > 0,
      'count', v_open_paper_completions,
      'sentence', case when v_open_paper_completions > 0
        then app.cross_check_count_phrase(v_open_paper_completions, 'paper-versus-paper game is', 'paper-versus-paper games are') || ' still waiting for review.'
        else 'No paper-versus-paper game is waiting for review.' end
    ),
    jsonb_build_object(
      'code', 'cashing_placements_without_cross_check_evidence',
      'outstanding', v_placements_without_evidence > 0,
      'count', v_placements_without_evidence,
      'sentence', case when v_placements_without_evidence > 0
        then app.cross_check_count_phrase(v_placements_without_evidence, 'cashing placement carries', 'cashing placements carry') || ' no cross-check evidence reference.'
        else 'Every recorded cashing placement carries a cross-check evidence reference.' end
    ),
    jsonb_build_object(
      'code', 'satellite_results_not_marked_cross_check_complete',
      'outstanding', v_satellites_not_complete > 0,
      'count', v_satellites_not_complete,
      'sentence', case when v_satellites_not_complete > 0
        then app.cross_check_count_phrase(v_satellites_not_complete, 'Satellite result package is', 'Satellite result packages are') || ' not marked cross-check complete.'
        else 'Every Satellite result package is marked cross-check complete.' end
    )
  );
end;
$$;
revoke all on function app.cross_check_finalization_conditions_v1(uuid) from public, anon, authenticated;

-- The reader. Returns null for anyone who is not a director or co-director of
-- this tournament, which is what get_event_finalization_readiness_v1 does and
-- what lets the page answer 404 rather than leak that the tournament exists.
--
-- It returns EVERY condition, met and unmet, because the director's question
-- is "what is left" and a screen that hides the met ones cannot answer it. The
-- separate `outstanding` array carries just the codes that still block, so an
-- empty `outstanding` means ready and no caller has to re-derive readiness by
-- filtering.
create or replace function public.get_cross_check_finalization_workspace_v1(
  p_actor_id uuid, p_tournament_id uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_tournament app.tournaments%rowtype;
  v_conditions jsonb;
  v_outstanding jsonb;
  v_finalization jsonb := null;
  v_prior app.cross_check_finalizations%rowtype;
  v_finalized_by text;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only cross-check finalization workspace';
  end if;
  if p_actor_id is null or p_tournament_id is null then return null; end if;

  select * into v_tournament from app.tournaments where id = p_tournament_id;
  if not found then return null; end if;
  if not exists (
    select 1 from app.tournament_roles role_row
    where role_row.tournament_id = p_tournament_id
      and role_row.profile_id = p_actor_id
      and role_row.role in ('director', 'co_director')
  ) then return null; end if;

  v_conditions := app.cross_check_finalization_conditions_v1(p_tournament_id);
  if v_conditions is null then return null; end if;
  -- WITH ORDINALITY and an explicit ORDER BY: jsonb_agg has no inherent order,
  -- and this list is compared position by position against the condition array
  -- by the client guard, so an unordered aggregate would fail that comparison
  -- intermittently rather than never.
  select coalesce(jsonb_agg(item.value->>'code' order by item.ordinal), '[]'::jsonb) into v_outstanding
  from jsonb_array_elements(v_conditions) with ordinality as item(value, ordinal)
  where (item.value->>'outstanding')::boolean;

  select * into v_prior from app.cross_check_finalizations where tournament_id = p_tournament_id;
  if found then
    select profile.display_name into v_finalized_by
    from app.profiles profile where profile.id = v_prior.actor_profile_id;
    v_finalization := jsonb_build_object(
      'finalizedAt', v_prior.created_at,
      'finalizedBy', coalesce(nullif(trim(v_finalized_by), ''), 'A tournament official'));
  end if;

  return jsonb_build_object(
    'tournamentId', p_tournament_id,
    'tournamentName', v_tournament.name,
    'tournamentStatus', v_tournament.status,
    'conditions', v_conditions,
    'outstanding', v_outstanding,
    'finalization', v_finalization,
    'canFinalize', v_finalization is null and jsonb_array_length(v_outstanding) = 0
  );
end;
$$;

-- The writer. Every condition is recomputed here, inside the transaction, and
-- the answer the screen showed is never trusted: the screen was rendered before
-- the request and a dispute can be opened in between.
--
-- The serialization point is the FOR UPDATE on the tournament row, taken the
-- same way 0224 takes it. That covers exactly one writer and no more:
-- open_event_dispute_v1 locks the same row (0138) to assert the tournament is
-- open, so a dispute cannot be created between the recount and the insert.
-- Corrections, hybrid cases, paper completions and device recoveries do NOT
-- lock the tournament row, so one of those can still be created in that
-- window. Nothing reads the finalization as authority yet and there is no
-- reopen path, so the consequence today is a recorded completion whose live
-- condition list later shows an item outstanding, which the screen displays.
--
-- Deliberately no per-event 'qualification-finalization:' advisory lock, which
-- would close that window for disputes twice over: 0138 takes those BEFORE its
-- tournament row lock, so taking them after ours would invert that order and
-- the two could deadlock on a live tournament.
create or replace function public.finalize_cross_checking_v1(
  p_actor_id uuid, p_tournament_id uuid, p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_existing app.operation_receipts%rowtype;
  v_receipt uuid;
  v_tournament app.tournaments%rowtype;
  v_prior app.cross_check_finalizations%rowtype;
  v_conditions jsonb;
  v_outstanding jsonb;
  v_finalized_at timestamptz := now();
  v_response jsonb;
begin
  if coalesce((select auth.jwt()->>'role'), '') <> 'service_role' then
    raise exception using errcode = 'P0001', message = 'server-only cross-check finalization';
  end if;
  if p_actor_id is null or p_tournament_id is null or p_operation_id is null then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid_request');
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'finalize_cross_checking_v1', p_actor_id::text, p_tournament_id::text, p_operation_id::text
  )::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || p_operation_id::text, 0));
  select * into v_existing from app.operation_receipts
    where actor_profile_id = p_actor_id and client_operation_id = p_operation_id for update;
  if found then
    if v_existing.operation_type = 'finalize_cross_checking_v1' and v_existing.request_hash = v_hash then
      return v_existing.response_payload;
    end if;
    return jsonb_build_object('status', 'rejected', 'code', 'idempotency_conflict');
  end if;

  select * into v_tournament from app.tournaments where id = p_tournament_id for update;
  if not found then
    return jsonb_build_object('status', 'rejected', 'code', 'tournament_unavailable');
  end if;

  -- A co-director runs cross-checking alongside the primary director, which is
  -- the same authority assign_cross_checker_v1 requires (0161). This is not
  -- the archive rule: nothing here leaves anyone's tournament list.
  if not exists (
    select 1 from app.tournament_roles role_row
    where role_row.tournament_id = p_tournament_id
      and role_row.profile_id = p_actor_id
      and role_row.role in ('director', 'co_director')
  ) then
    return jsonb_build_object('status', 'rejected', 'code', 'not_director');
  end if;

  select * into v_prior from app.cross_check_finalizations
    where tournament_id = p_tournament_id for update;
  if found then
    return jsonb_build_object('status', 'already_finalized',
      'tournamentId', p_tournament_id, 'finalizedAt', v_prior.created_at);
  end if;

  v_conditions := app.cross_check_finalization_conditions_v1(p_tournament_id);
  -- WITH ORDINALITY and an explicit ORDER BY: jsonb_agg has no inherent order,
  -- and this list is compared position by position against the condition array
  -- by the client guard, so an unordered aggregate would fail that comparison
  -- intermittently rather than never.
  select coalesce(jsonb_agg(item.value->>'code' order by item.ordinal), '[]'::jsonb) into v_outstanding
  from jsonb_array_elements(v_conditions) with ordinality as item(value, ordinal)
  where (item.value->>'outstanding')::boolean;

  -- A refusal writes no receipt. The client holds one operation id across
  -- retries so a request that may already have applied is never counted twice,
  -- and caching a refusal against that id would make the retry after the
  -- director clears the condition return the stale refusal forever. 0224 takes
  -- the same position on its rejections.
  if jsonb_array_length(v_outstanding) > 0 then
    return jsonb_build_object('status', 'rejected',
      'code', v_outstanding->>0, 'outstanding', v_outstanding);
  end if;

  v_response := jsonb_build_object(
    'status', 'cross_checking_finalized',
    'tournamentId', p_tournament_id,
    'tournamentName', v_tournament.name,
    'finalizedAt', v_finalized_at);

  insert into app.operation_receipts(tournament_id, actor_profile_id, operation_type, target_id,
    request_hash, client_operation_id, outcome, response_payload, applied_at)
  values (p_tournament_id, p_actor_id, 'finalize_cross_checking_v1', p_tournament_id,
    v_hash, p_operation_id, 'accepted', v_response, v_finalized_at)
  returning id into v_receipt;

  insert into app.cross_check_finalizations(tournament_id, actor_profile_id,
    conditions_snapshot, operation_receipt_id, created_at)
  values (p_tournament_id, p_actor_id, v_conditions, v_receipt, v_finalized_at);

  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type,
    entity_id, action, before_state, after_state)
  values (p_tournament_id, p_actor_id, v_receipt, 'tournament', p_tournament_id,
    'cross_checking_finalized',
    jsonb_build_object('status', v_tournament.status),
    v_response || jsonb_build_object('conditions', v_conditions));

  return v_response;
end;
$$;

revoke all on function public.get_cross_check_finalization_workspace_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finalize_cross_checking_v1(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_cross_check_finalization_workspace_v1(uuid, uuid) to service_role;
grant execute on function public.finalize_cross_checking_v1(uuid, uuid, uuid) to service_role;

notify pgrst, 'reload schema';
