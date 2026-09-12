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
