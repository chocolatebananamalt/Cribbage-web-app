import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("event start is append-only, version-bound, role-bound, and gates every score evidence path", () => {
  const sql = read("database/migrations/0164_event_play_start_lifecycle.sql");
  assert.match(sql, /create table app\.event_play_starts/);
  assert.match(sql, /event_play_starts_immutable/);
  assert.match(sql, /role_row\.role in\('director','co_director'\)/);
  assert.match(sql, /stale_roster_or_schedule/);
  for (const table of ["score_submissions", "score_confirmations", "paper_game_completions", "device_failure_recoveries"])
    assert.match(sql, new RegExp(`${table}_require_event_start`));
  assert.match(sql, /legacy_scoring_backfill/);
  assert.match(sql, /where exists\([\s\S]*score_submissions/);
});

test("operations UI exposes explicit start, live preliminary state, side pools, and audited statuses", () => {
  const schedule = read("src/app/tournament/[tournamentId]/schedule/schedule-client.tsx");
  const standings = read("src/app/tournament/[tournamentId]/results/live-standings-refresh.tsx");
  const sidePools = read("src/app/tournament/[tournamentId]/side-pools/side-pools-client.tsx");
  const statuses = read("src/app/tournament/[tournamentId]/participant-status/participant-status-client.tsx");
  assert.match(schedule, /`Start \$\{activeEvent\.name\}`/);
  assert.match(schedule, /participantCount/);
  assert.match(schedule, /gameCount/);
  assert.match(standings, /10_000/);
  assert.match(standings, /Last updated/);
  assert.match(standings, /Offline/);
  for (const category of ["10", "20", "50", "100"]) assert.match(sidePools, new RegExp(`"${category}"`));
  for (const action of ["Mark absent", "Withdraw", "Disqualify", "Reinstate"])
    assert.match(statuses, new RegExp(action));
});

test("the historical four-pool and paper-team foundation remains separate from Q pools", () => {
  const sql = read("database/migrations/0165_side_pools_and_team_foundation.sql");
  assert.match(sql, /event_side_pool_definition_versions/);
  assert.match(sql, /event_side_pool_election_versions/);
  assert.match(sql, /event_side_pool_payout_versions/);
  assert.match(sql, /category_code in\('10','20','50','100'\)/);
  assert.match(sql, /event_team_members/);
  assert.match(sql, /scorecard_type='paper'/);
  assert.match(sql, /digital_scoring_enabled=false/);
  assert.doesNotMatch(sql, /grant execute on function public\..*team/i);
});

test("satellite discovery covers every configured event without MRP or Main-Consy qualification claims", () => {
  const sql = read("database/migrations/0167_all_event_results_discovery.sql");
  const page = read("src/app/tournament/[tournamentId]/results/page.tsx");
  assert.match(sql, /join app\.events event_row/);
  assert.match(page, /Not applicable—Satellite event/);
  assert.match(page, /never qualify a player for Main or Consolation/);
  assert.match(page, /at least twelve months/);
  assert.match(page, /Automatic ACC submission remains disabled/);
});
