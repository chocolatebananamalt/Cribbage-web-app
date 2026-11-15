import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("database/migrations/0147_active_game_progression.sql");

test("progression is schedule-backed, participant-scoped, and advances only on authoritative evidence", () => {
  assert.match(migration, /create or replace function app\.game_is_authoritatively_resolved_v1/);
  assert.match(migration, /state in\('verified','corrected'\)/);
  assert.match(migration, /device_recovery_is_approved/);
  assert.match(migration, /paper_game_completion_is_approved/);
  assert.match(migration, /create or replace function app\.participant_game_progression_v1/);
  assert.match(migration, /app\.event_schedule_games/);
  assert.match(migration, /p_participant_id in\(earlier\.side_a_participant_id,earlier\.side_b_participant_id\)/);
  assert.match(migration, /earlier\.event_id=target\.event_id/);
  assert.match(migration, /earlier_round\.round_number,earlier\.match_instance,earlier_schedule\.import_row_number,earlier\.id/);
  assert.match(migration, /from target_rows having count\(\*\)=1/);
});

test("online submission serializes progression and preserves exact receipt replay before gating", () => {
  const writer = migration.slice(migration.indexOf("create or replace function public.submit_game_score"), migration.indexOf("alter function public.issue_offline_submission_capability_v1"));
  assert.ok(writer.indexOf("from app.operation_receipts") < writer.indexOf("participant_game_progression_v1"));
  assert.match(writer, /active-game:/);
  assert.match(writer, /future_game_locked/);
  assert.match(writer, /future_game_submission_rejected/);
  assert.match(writer, /submit_game_score_pre_progression_v1/);
  assert.match(writer, /is distinct from 'current'/);
});

test("direct confirmation is progression-wrapped and preserves terminal replay before gating", () => {
  const confirmation = migration.slice(migration.indexOf("create or replace function public.confirm_game_score"), migration.indexOf("alter function public.issue_offline_submission_capability_v1"));
  assert.ok(confirmation.indexOf("from app.operation_receipts") < confirmation.indexOf("participant_game_progression_v1"));
  assert.match(confirmation, /confirm_game_score_pre_progression_v1/);
  assert.match(confirmation, /game_progression_locked/);
  assert.match(confirmation, /future_game_confirmation_rejected/);
});

test("offline capability and replay enforce current-game progression and preserve terminal replay", () => {
  const capability = migration.slice(migration.indexOf("create or replace function public.issue_offline_submission_capability_v1"), migration.indexOf("alter function public.replay_offline_submission_v1"));
  const replay = migration.slice(migration.indexOf("create or replace function public.replay_offline_submission_v1"), migration.indexOf("alter function public.get_assigned_game_context"));
  assert.ok(capability.indexOf("offline_score_capabilities") < capability.indexOf("participant_game_progression_v1"));
  assert.ok(replay.indexOf("offline_score_replay_receipts") < replay.indexOf("participant_game_progression_v1"));
  assert.match(replay, /record_offline_submission_rejection_v1/);
  assert.match(replay, /active-game:/);
  assert.match(migration, /record_offline_submission_rejection_v1\([\s\S]*p_capability_id uuid/);
  assert.match(migration, /capability\.actor_profile_id=p_actor_id[\s\S]*capability\.session_binding_id=p_session_binding_id[\s\S]*capability\.device_key_id=p_device_key_id/);
  assert.match(migration, /capability\.tournament_id=p_tournament_id[\s\S]*capability\.event_id=p_event_id[\s\S]*capability\.canonical_game_id=p_game_id/);
  assert.match(migration, /v_prior\.capability_id is not distinct from v_bound_capability_id/);
  assert.match(migration, /values\(p_queue_id,p_client_operation_id,v_bound_capability_id/);
  assert.doesNotMatch(migration, /values\(p_queue_id,p_client_operation_id,p_capability_id/);
  assert.match(capability, /is distinct from 'current'/);
  assert.match(replay, /is distinct from 'current'/);
  assert.doesNotMatch(migration, /grant execute[^;]+pre_progression[^;]+authenticated/i);
  assert.match(read("src/app/api/v1/offline-score-replay/route.ts"), /p_capability_id: raw\.capabilityId/);
});

test("offline writers acquire identity locks before active-game and game-row locks", () => {
  const capability = migration.slice(migration.indexOf("create or replace function public.issue_offline_submission_capability_v1"), migration.indexOf("alter function public.record_offline_submission_rejection_v1"));
  const replay = migration.slice(migration.indexOf("create or replace function public.replay_offline_submission_v1"), migration.indexOf("alter function public.get_assigned_game_context"));
  assert.ok(capability.indexOf("p_actor_id::text||':'||p_session_binding_id::text||':'||p_game_id::text") < capability.indexOf("'active-game:'"));
  assert.ok(replay.indexOf("p_queue_id::text") < replay.indexOf("p_actor_id::text||':'||p_client_operation_id::text"));
  assert.ok(replay.indexOf("p_actor_id::text||':'||p_client_operation_id::text") < replay.indexOf("p_capability_id::text"));
  assert.ok(replay.indexOf("p_capability_id::text") < replay.indexOf("'active-game:'"));
});

test("assigned-game readers and UI expose current, upcoming locked, and completed states", () => {
  const context = read("src/lib/games/assigned-game-context-decision.ts");
  const games = read("src/lib/games/my-games-decision.ts");
  const list = read("src/app/tournament/[tournamentId]/games/page.tsx");
  const page = read("src/app/tournament/[tournamentId]/game/[gameId]/page.tsx");
  assert.match(migration, /'progressionStatus'/);
  assert.match(migration, /'upcoming_locked'/);
  assert.match(context, /"current" \| "upcoming" \| "completed"/);
  assert.match(games, /"upcoming_locked"/);
  assert.match(list, /Upcoming Games/);
  assert.match(list, /aria-disabled="true"/);
  assert.match(page, /locked until your earlier scheduled game is authoritatively verified or corrected/);
});

test("rollback fixture proves future rejection and exact idempotent replay", () => {
  const fixture = read("tests/active-game-progression.sql");
  assert.match(fixture, /expected one current and one upcoming game/);
  assert.match(fixture, /future game submission was not rejected/);
  assert.match(fixture, /future-game rejection did not replay exactly/);
  assert.match(fixture, /missing or non-exact schedule target must fail closed/);
  assert.match(fixture, /foreign capability was attached to attacker rejection/);
  assert.match(fixture, /rightful owner could not bind capability after poisoning attempt/);
  assert.match(fixture, /rollback;/);
});
