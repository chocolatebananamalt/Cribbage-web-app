import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("paper-inclusive standings preserve the protected preliminary boundary", () => {
  const sql = read("database/migrations/0126_paper_inclusive_qualification_preview.sql");
  assert.match(sql, /left join app\.tournament_roster_entries roster/);
  assert.match(sql, /coalesce\(nullif\(trim\(roster\.claimed_display_name\), ''\), nullif\(trim\(profile\.display_name\), ''\)\)/);
  assert.match(sql, /game\.state in \('verified', 'corrected'\)/);
  assert.match(sql, /schedule_published/);
  assert.match(sql, /scheduledScorecardsComplete/);
  assert.match(sql, /revoke all on function public\.get_preliminary_event_standings\(uuid, uuid\)[\s\S]*from public, anon/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*\bto anon\b/);
  assert.doesNotMatch(sql, /insert into|update app\.|delete from/);
});

test("results page renders only a provisional qualification preview", () => {
  const page = read("src/app/tournament/[tournamentId]/results/page.tsx");
  assert.match(page, /buildPreliminaryQualification/);
  assert.match(page, /Qualification Preview/);
  assert.match(page, /Provisional High Non-Qualifier/);
  assert.match(page, /Unresolved cutoff tie/);
  assert.match(page, /head-to-head results if available/);
  assert.match(page, /Every scheduled matchup has verified or corrected scorecards/);
  assert.match(page, /does not show a winner or runner-up/);
  assert.match(page, /does not calculate MRPs, Q-pools, or payouts/);
  assert.doesNotMatch(page, /Official Qualifier|Final Results/);
});

test("an incomplete event names the unmet condition instead of only saying it is in progress", () => {
  const page = read("src/app/tournament/[tournamentId]/results/page.tsx");
  const client = read("src/app/tournament/[tournamentId]/results/qualification-finalization-client.tsx");
  const contract = read("src/lib/results/preliminary-standings-contract.ts");
  // The reason list has to stay aligned with the conditions `complete` is built from.
  assert.match(contract, /rows\.every\(\(row\) => row\.verifiedGames === configuredGameCount\)/);
  assert.match(page, /const completionBlockedReason = standings\.scheduledScorecardsComplete \? null/);
  assert.match(page, /The schedule for this event is not published yet/);
  assert.match(page, /This event has no configured games-per-player count/);
  assert.match(page, /No player is enrolled in this event yet/);
  assert.match(page, /Republish the schedule on the Game schedule screen\./);
  assert.match(page, /still have no verified or corrected scorecard/);
  assert.match(page, /Every scheduled matchup is already resolved, so playing on will not close this gap\./);
  assert.match(page, /const finalizeBlockedReason = completionBlockedReason/);
  assert.match(page, /tied on the ranking, and a tie has to be resolved before the qualifying ranking can be locked\./);
  assert.match(page, /\{completionBlockedReason \? <p className="auth-note">\{completionBlockedReason\}<\/p> : null\}/);
  assert.match(page, /blockedReason=\{finalizeBlockedReason\}/);
  assert.match(client, /blockedReason: string \| null;/);
  assert.match(client, /\{blockedReason \?\? "Resolve every completion notice and ranking tie before finalizing\."\}/);
  // The shortfall sentence must name the players, not just a count.
  assert.match(page, /\$\{row\.displayName\} has \$\{row\.verifiedGames\}/);
});
