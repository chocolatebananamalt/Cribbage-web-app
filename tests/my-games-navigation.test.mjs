import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isMyGamesWorkspace } from "../src/lib/games/my-games-decision.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const tournamentId = "10000000-0000-4000-8000-000000000001";
const game = {
  gameId: "20000000-0000-4000-8000-000000000002",
  eventId: "30000000-0000-4000-8000-000000000003",
  eventName: "Main",
  gameNumber: 3,
  matchInstance: 1,
  state: "pending",
  playerSide: "a",
  playerTableSeat: "A-7",
  playerVerificationId: "A-7",
  opponentName: "Sample Opponent",
  opponentTableSeat: "A-8",
  opponentVerificationId: "A-8",
  ownSubmitted: false,
  ownConfirmed: false,
  canConfirm: false,
  nextAction: "enter_result",
};

test("my-games response validator is exact and tournament bound", () => {
  const workspace = { tournamentId, tournamentName: "October Trial", tournamentDate: "10-03-2026", games: [game] };
  assert.equal(isMyGamesWorkspace(workspace, tournamentId), true);
  assert.equal(isMyGamesWorkspace({ ...workspace, tournamentId: game.gameId }, tournamentId), false);
  assert.equal(isMyGamesWorkspace({ ...workspace, games: [{ ...game, state: "invented" }] }, tournamentId), false);
  assert.equal(isMyGamesWorkspace({ ...workspace, games: [{ ...game, extra: true }] }, tournamentId), false);
  assert.equal(isMyGamesWorkspace({ ...workspace, games: [{ ...game, playerTableSeat: "A7" }] }, tournamentId), false);
  assert.equal(isMyGamesWorkspace({ ...workspace, games: [{ ...game, gameId: "not-a-uuid" }] }, tournamentId), false);
  assert.equal(isMyGamesWorkspace({ ...workspace, games: [{ ...game, canConfirm: true }] }, tournamentId), false);
  assert.equal(isMyGamesWorkspace({ ...workspace, tournamentDate: "October 3" }, tournamentId), false);
  assert.equal(isMyGamesWorkspace({ ...workspace, games: [{ ...game, nextAction: "view_scorecard" }] }, tournamentId), false);
  assert.equal(isMyGamesWorkspace({ ...workspace, games: [{ ...game, state: "submitted", ownSubmitted: false, nextAction: "wait_opponent_entry" }] }, tournamentId), false);
  assert.equal(isMyGamesWorkspace({ ...workspace, games: [{ ...game, state: "confirmation_pending", ownSubmitted: true, canConfirm: true, nextAction: "review_confirm" }] }, tournamentId), true);
});

test("database reader binds identity to auth.uid and returns only published assigned games", () => {
  const sql = read("database/migrations/0118_player_assigned_games_reader.sql")
    + read("database/migrations/0119_player_games_action_and_access_repair.sql")
    + read("database/migrations/0120_published_player_games_only.sql")
    + read("database/migrations/0121_draft_official_player_games_empty_state.sql");
  assert.match(sql, /select auth\.uid\(\)/);
  assert.doesNotMatch(sql, /p_actor_id/);
  assert.match(sql, /player\.profile_id = a\.profile_id/);
  assert.match(sql, /player\.id in \(cg\.side_a_participant_id, cg\.side_b_participant_id\)/);
  assert.match(sql, /t\.id = p_tournament_id/);
  assert.match(sql, /from public, anon/);
  assert.match(sql, /grant execute[\s\S]*to authenticated/);
  assert.match(sql, /ownSubmitted/);
  assert.match(sql, /wait_opponent_confirmation/);
  assert.match(sql, /select 'player', 7/);
  assert.match(sql, /app\.event_schedule_games/);
  assert.match(sql, /revoke all on function app\.get_my_assigned_games_unfiltered_core_v1\(uuid\)/);
});

test("tournament and my-games pages expose usable navigation without internal ids", () => {
  const tournament = read("src/app/tournament/[tournamentId]/page.tsx");
  const page = read("src/app/tournament/[tournamentId]/games/page.tsx");
  assert.match(tournament, />My Games</);
  assert.match(page, /Current Games/);
  assert.match(page, /Completed Games/);
  assert.match(page, /Open Game/);
  assert.match(page, /Waiting for opponent entry/);
  assert.match(page, /Waiting for opponent confirmation/);
  assert.match(page, /View Scorecard/);
  assert.match(page, /scorecard\?event=/);
});
