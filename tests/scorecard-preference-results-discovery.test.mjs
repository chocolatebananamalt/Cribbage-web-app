import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isScorecardPreferenceRequest, isAcceptedScorecardPreference, isRejectedScorecardPreference } from "../src/lib/api/scorecard-preference.ts";
import { isTournamentResultEventSummary } from "../src/lib/api/result-event-summary.ts";

const rosterEntryId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000002";
const operationId = "30000000-0000-4000-8000-000000000003";
const request = { rosterEntryId, expectedVersion: 1, scorecardType: "paper", reason: "", idempotencyKey: operationId };

test("scorecard preference request and outcomes use exact request-bound codecs", () => {
  assert.equal(isScorecardPreferenceRequest(request), true);
  assert.equal(isScorecardPreferenceRequest({ ...request, scorecardType: "linked" }), false);
  assert.equal(isScorecardPreferenceRequest({ ...request, extra: true }), false);
  assert.equal(isAcceptedScorecardPreference({ status: "scorecard_preference_updated", rosterEntryId, scorecardType: "paper", version: 2 }, request), true);
  assert.equal(isAcceptedScorecardPreference({ status: "scorecard_preference_updated", rosterEntryId, scorecardType: "paper", version: 3 }, request), false);
  assert.equal(isRejectedScorecardPreference({ status: "rejected", code: "stale_preference_version", rosterEntryId }, rosterEntryId), true);
});

test("results event summary is exact, bounded, and tournament-bound", () => {
  const summary = { tournamentId: rosterEntryId, tournamentName: "October Pilot", events: [{ eventId, name: "Main", participantCount: 20 }] };
  assert.equal(isTournamentResultEventSummary(summary), true);
  assert.equal(isTournamentResultEventSummary({ ...summary, extra: true }), false);
  assert.equal(isTournamentResultEventSummary({ ...summary, events: [{ ...summary.events[0], participantCount: -1 }] }), false);
});

test("0146 is audited, versioned, pre-close, service-only, and never infers scorecard type from account linkage", () => {
  const sql = readFileSync("database/migrations/0146_scorecard_preference_and_results_discovery.sql", "utf8");
  assert.match(sql, /roster_scorecard_preference_events/);
  assert.match(sql, /unique \(roster_entry_id, version\)/);
  assert.match(sql, /scorecard_preference_version<>p_expected_version/);
  assert.match(sql, /registration_status='open'/);
  assert.match(sql, /initial_seating_already_published/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /get_tournament_result_events_v1/);
  assert.match(sql, /role in\('viewer','player','cross_checker','director','co_director'\)/);
  assert.match(sql, /grant execute on function public\.get_tournament_result_events_v1\(uuid,uuid\) to service_role/);
  assert.match(sql, /'profileLinked',l\.profile_id is not null,'scorecardType',r\.scorecard_type/);
  const fixture = readFileSync("tests/scorecard-preference-results-discovery.sql", "utf8");
  assert.match(fixture, /exact preference retry changed its response/);
  assert.match(fixture, /changed preference retry was not rejected/);
  assert.match(fixture, /unauthorized preference update was not rejected/);
  assert.match(fixture, /closed registration preference update was not rejected/);
  assert.match(fixture, /unauthorized result discovery was exposed/);
  assert.match(fixture, /exact CSV retry changed its response/);
  assert.match(fixture, /changed CSV retry was not rejected/);
});

test("results navigation is visible to signed-in tournament readers while settlement stays director-only", () => {
  const page = readFileSync("src/app/tournament/[tournamentId]/results/page.tsx", "utf8");
  const home = readFileSync("src/app/tournament/[tournamentId]/page.tsx", "utf8");
  assert.match(page, /viewer", "player", "cross_checker", "director", "co_director/);
  assert.match(page, /getTournamentResultEventSummary/);
  assert.match(page, /Open Post-event Draft/);
  assert.match(page, /access\.role === "director" \|\| access\.role === "co_director"/);
  assert.match(home, /canViewResults \? <Link[^\n]*Tournament Results/);
});
