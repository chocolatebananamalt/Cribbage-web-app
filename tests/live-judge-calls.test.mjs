import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("database/migrations/0212_transient_judge_calls.sql", "utf8");
const route = fs.readFileSync("src/app/api/v1/tournaments/[id]/judge-calls/route.ts", "utf8");
const playerButton = fs.readFileSync("src/app/tournament/[tournamentId]/game/[gameId]/judge-call-button.tsx", "utf8");
const judgeDesk = fs.readFileSync("src/app/tournament/[tournamentId]/judge-calls/judge-call-client.tsx", "utf8");
const judgeDeskPage = fs.readFileSync("src/app/tournament/[tournamentId]/judge-calls/page.tsx", "utf8");
const workspace = fs.readFileSync("src/app/tournament/[tournamentId]/page.tsx", "utf8");

test("live Judge Calls are transient, role-scoped, conflict-safe, and support singles plus teams", () => {
  for (const token of [
    "create table app.active_judge_calls", "game_kind text not null check (game_kind in ('singles','team'))",
    "app.canonical_games", "app.event_team_games", "app.event_team_members", "app.event_team_starts",
    "app.event_play_state_v1(v_game.event_id)<>'in_progress'", "app.participant_game_progression_v1(p_game_id,participant.id)='current'", "role='judge'",
    "judge_is_player", "cardinality(accepted_judge_profile_ids) between 0 and 2",
    "two_judges_already_assigned", "delete from app.active_judge_calls where game_id=p_game_id",
  ]) assert.match(migration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table app\.active_judge_calls from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.open_live_judge_call_v1[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /insert into app\.audit_events/);
  assert.doesNotMatch(migration, /operation_receipts/);
});

test("Judge Call API requires origin, identity, validated scope, and server-only RPC", () => {
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /isUuid\(id\)/);
  assert.match(route, /isLiveJudgeCallRequest/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(route, /status: 403/);
  assert.match(route, /status: 409/);
});

test("player and Judge interfaces do not record rulings or scores", () => {
  assert.match(playerButton, /Call a Judge/);
  assert.match(playerButton, /Judge Call sent\. Please wait for two Judges to accept\./);
  assert.match(judgeDesk, /Situation Resolved/);
  assert.match(judgeDesk, /Two Judges accepted this call\./);
  assert.match(judgeDeskPage, /No ruling or score is recorded here\./);
  assert.doesNotMatch(playerButton, /ruling/i);
  assert.match(workspace, /Judge Calls/);
});
