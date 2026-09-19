import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isEventScheduleRequest, isEventScheduleResult, isEventScheduleWorkspace, isEventStartRequest, isEventStartResult, parseScheduleCsv, validateScheduleForEvent } from "../src/lib/api/event-schedule.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const eventId = "10000000-0000-4000-8000-000000000001";
const operationId = "20000000-0000-4000-8000-000000000002";
const matches = [
  { gameNumber: 1, sideAVerificationId: "A-1", sideBVerificationId: "A-2", sideATableSeat: "A-1", sideBTableSeat: "A-2" },
  { gameNumber: 2, sideAVerificationId: "A-1", sideBVerificationId: "A-2", sideATableSeat: "A-2", sideBTableSeat: "A-1" },
];

test("schedule CSV parser accepts exact safe columns and rejects malformed rows", () => {
  const csv = "Game,Player A ID,Player B ID,Player A Table/Seat,Player B Table/Seat\n1,A-1,A-2,A-1,A-2\n2,A-1,A-2,A-2,A-1";
  assert.deepEqual(parseScheduleCsv(csv), { matches, errors: [] });
  assert.equal(parseScheduleCsv("Game,Player A ID\n1,A-1").errors.length, 1);
  assert.equal(parseScheduleCsv("Game,Player A ID,Player B ID,Player A Table/Seat,Player B Table/Seat\n1,A-1,A-1,A-1,A-2").errors.length, 1);
});

test("event validation seats every player each game, allowing one to sit out when the field is odd", () => {
  assert.deepEqual(validateScheduleForEvent(matches, 2, ["A-1", "A-2"]), []);
  assert.match(validateScheduleForEvent([{ ...matches[0], sideBTableSeat: "B-2" }, matches[1]], 2, ["A-1", "A-2"], 2, 2).join(" "), /same table/);
  assert.match(validateScheduleForEvent([{ ...matches[0], sideBTableSeat: "A-3" }, matches[1]], 2, ["A-1", "A-2"], 1, 2).join(" "), /outside the published table plan/);
  assert.match(validateScheduleForEvent(matches.slice(0, 1), 2, ["A-1", "A-2"]).join(" "), /Expected 2 matches/);
  assert.match(validateScheduleForEvent([{ ...matches[0], sideBVerificationId: "A-3" }, matches[1]], 2, ["A-1", "A-2"]).join(" "), /not enrolled/);
  // An odd field is legitimate: exactly one player sits out each game, so three
  // players over two games is one match per game and that is complete.
  assert.deepEqual(validateScheduleForEvent(matches, 2, ["A-1", "A-2", "A-3"]), []);
  // Fewer than two players still cannot be scheduled.
  assert.match(validateScheduleForEvent(matches, 2, ["A-1"])[0], /at least two/);
  // An odd field must still reject a player appearing twice in one game, which
  // is the error that "one player sits out" would otherwise hide.
  const five = ["A-1", "A-2", "A-3", "A-4", "A-5"];
  const seatedTwice = [
    { gameNumber: 1, sideAVerificationId: "A-1", sideBVerificationId: "A-2", sideATableSeat: "A-1", sideBTableSeat: "A-2" },
    { gameNumber: 1, sideAVerificationId: "A-1", sideBVerificationId: "A-3", sideATableSeat: "A-1", sideBTableSeat: "A-3" },
  ];
  assert.match(validateScheduleForEvent(seatedTwice, 1, five).join(" "), /at most once/);
  // And it must still reject a game that is short a match.
  assert.match(validateScheduleForEvent(seatedTwice.slice(0, 1), 1, five).join(" "), /needs 2 matches/);
});

test("request, result, and workspace validators bind exact shapes", () => {
  const request = { eventId, matches, reviewedAndApproved: true, idempotencyKey: operationId };
  assert.equal(isEventScheduleRequest(request), true);
  assert.equal(isEventScheduleRequest({ eventId, matches, idempotencyKey: operationId }), false);
  assert.equal(isEventScheduleRequest({ ...request, reviewedAndApproved: false }), false);
  assert.equal(isEventScheduleRequest({ ...request, extra: true }), false);
  assert.equal(isEventScheduleRequest({ ...request, matches: [] }), false);
  const result = { status: "event_schedule_published", eventId, gameCount: 2, participantCount: 2, matchCount: 2, publicationId: "30000000-0000-4000-8000-000000000003" };
  assert.equal(isEventScheduleResult(result, request), true);
  assert.equal(isEventScheduleResult({ ...result, matchCount: 1 }, request), false);
  const workspace = {
    tournamentName: "October Pilot",
    registrationClosed: true,
    tableCount: 1,
    seatsPerTable: 2,
    events: [{ eventId, name: "Main", format: "standard_singles", scoringMethod: "digital", gameCount: 2, participantCount: 2, schedulePublished: true, schedulePublicationId: result.publicationId, participantSnapshotDigest: "a".repeat(64), publishedMatchCount: 2, playState: "ready_to_start", startedAt: null, startedBy: null }],
    participants: [{ eventId, participantId: "40000000-0000-4000-8000-000000000004", displayName: "Sample One", verificationId: "A-1", profileLinked: true }],
    matches: [{ ...matches[0], eventId, canonicalGameId: "50000000-0000-4000-8000-000000000005", sideADisplayName: "Sample One", sideBDisplayName: "Sample Two", state: "pending" }],
  };
  assert.equal(isEventScheduleWorkspace(workspace), true);
  assert.equal(isEventScheduleWorkspace({ ...workspace, tableCount: null, seatsPerTable: null }), true);
  assert.equal(isEventScheduleWorkspace({ ...workspace, tableCount: 1, seatsPerTable: null }), false);
  assert.equal(isEventScheduleWorkspace({ ...workspace, matches: [{ ...workspace.matches[0], state: "invented" }] }), false);
  const startRequest = { eventId, schedulePublicationId: result.publicationId, participantSnapshotDigest: "a".repeat(64), expectedParticipantCount: 2, expectedGameCount: 2, confirmed: true, idempotencyKey: operationId };
  assert.equal(isEventStartRequest(startRequest), true);
  assert.equal(isEventStartRequest({ ...startRequest, confirmed: false }), false);
  assert.equal(isEventStartRequest({ ...startRequest, participantSnapshotDigest: "short" }), false);
  assert.equal(isEventStartResult({ status: "event_started", eventId, startId: "60000000-0000-4000-8000-000000000006", participantCount: 2, gameCount: 2, scheduleMatchCount: 2, playState: "in_progress" }, startRequest), true);
});

test("event start is append-only, exact-snapshot bound, role protected, and gates every score evidence table", () => {
  const sql = read("database/migrations/0164_event_play_start_lifecycle.sql");
  const route = read("src/app/api/v1/tournaments/[id]/event-start/route.ts");
  const client = read("src/app/tournament/[tournamentId]/schedule/schedule-client.tsx");
  assert.match(sql, /create table app\.event_play_starts/);
  assert.match(sql, /event_play_starts_immutable/);
  assert.match(sql, /registration_status='closed'/);
  assert.match(sql, /role_row\.role in\('director','co_director'\)/);
  assert.match(sql, /stale_roster_or_schedule/);
  assert.match(sql, /participant_snapshot_digest/);
  assert.match(sql, /score_submissions_require_event_start/);
  assert.match(sql, /score_confirmations_require_event_start/);
  assert.match(sql, /paper_game_completions_require_event_start/);
  assert.match(sql, /device_failure_recoveries_require_event_start/);
  assert.match(sql, /then 'not_started'/);
  assert.match(sql, /grant execute on function public\.start_event_play_v1[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.start_event_play_v1\(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid\)\s+to authenticated/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(client, /Final Start Confirmation/);
  assert.match(client, /Start \$\{activeEvent\.name\}/);
  assert.match(client, /registration is closed/);
});

test("migration publishes atomically through service-only RPC and protects schedule assignments", () => {
  const sql = read("database/migrations/0114_director_reviewed_schedule_publication.sql");
  const repair = read("database/migrations/0115_schedule_publication_integrity_repairs.sql");
  const scopeRepair = read("database/migrations/0116_schedule_participant_scope_guard.sql");
  const workspaceRepair = read("database/migrations/0117_schedule_workspace_table_plan.sql");
  const playerGames = read("database/migrations/0118_player_assigned_games_reader.sql");
  const playerGamesRepair = read("database/migrations/0119_player_games_action_and_access_repair.sql");
  const publishedGamesOnly = read("database/migrations/0120_published_player_games_only.sql");
  const draftOfficialEmptyState = read("database/migrations/0121_draft_official_player_games_empty_state.sql");
  const fixture = read("tests/event-schedule-publication.sql");
  assert.match(sql, /create table app\.event_schedule_publications/);
  assert.match(sql, /create table app\.event_schedule_games/);
  assert.match(sql, /create or replace function public\.publish_director_reviewed_event_schedule_v1/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /e\.format = 'standard_singles' and e\.scoring_method = 'digital'/);
  assert.match(sql, /count\(distinct verification_id\) <> v_participant_count/);
  assert.match(sql, /count\(distinct table_seat\) <> v_participant_count/);
  assert.match(sql, /insert into app\.rounds/);
  assert.match(sql, /insert into app\.canonical_games/);
  assert.match(sql, /insert into app\.operation_receipts/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /published schedule assignment is immutable/);
  assert.match(sql, /return v_existing\.response_payload/);
  assert.match(sql, /from public, anon, authenticated;\s+grant execute[\s\S]*to service_role;/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/);
  assert.match(repair, /protect_scheduled_event_participant/);
  assert.match(repair, /published event participant set is immutable/);
  assert.match(repair, /validate_published_schedule_game_capacity/);
  assert.match(repair, /p_reviewed_and_approved is distinct from true/);
  assert.match(repair, /'eventId', cg\.event_id/);
  assert.match(repair, /opponent_roster\.claimed_display_name/);
  assert.match(repair, /event_schedule_games_tournament_event_idx/);
  assert.match(scopeRepair, /where p\.event_id in \(old\.event_id, new\.event_id\)/);
  assert.match(workspaceRepair, /'tableCount'/);
  assert.match(workspaceRepair, /'seatsPerTable'/);
  assert.match(playerGames, /get_my_assigned_games_v1/);
  assert.match(playerGames, /select auth\.uid\(\)/);
  assert.match(playerGames, /player\.profile_id = a\.profile_id/);
  assert.match(playerGames, /grant execute[\s\S]*to authenticated/);
  assert.match(playerGamesRepair, /create or replace function public\.get_tournament_role/);
  assert.match(playerGamesRepair, /ownSubmitted/);
  assert.match(playerGamesRepair, /wait_opponent_confirmation/);
  assert.match(publishedGamesOnly, /app\.event_schedule_games/);
  assert.match(publishedGamesOnly, /get_my_assigned_games_unfiltered_core_v1/);
  assert.match(publishedGamesOnly, /from public, anon, authenticated, service_role/);
  assert.match(draftOfficialEmptyState, /t\.status = 'draft'/);
  assert.match(draftOfficialEmptyState, /'games', '\[\]'::jsonb/);
  assert.match(fixture, /^begin;/m);
  assert.match(fixture, /^rollback;/m);
  assert.match(fixture, /published game assignment remained mutable/);
  assert.match(fixture, /move into published participant set remained possible/);
  assert.match(fixture, /actor-scoped player game reader failed/);
  assert.match(fixture, /actor-specific game action failed/);
  assert.match(fixture, /a2140000-0000-4000-8000-000000000001/);
});

test("route and UI retain the server-only authority and reviewed import boundary", () => {
  const route = read("src/app/api/v1/tournaments/[id]/event-schedule/route.ts");
  const client = read("src/app/tournament/[tournamentId]/schedule/schedule-client.tsx");
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(route, /p_actor_id: subject/);
  assert.match(route, /p_reviewed_and_approved: body\.reviewedAndApproved/);
  assert.doesNotMatch(route, /\.from\(|\.insert\(|\.update\(/);
  assert.match(client, /Choose CSV file/);
  assert.match(client, /Download CSV template/);
  assert.match(client, /I reviewed the complete schedule/);
  assert.match(client, /Retry exact saved publication/);
  assert.match(client, /sessionStorage/);
  assert.match(client, /match\.eventId === eventId/);
  const storage = read("src/lib/client-session-storage.ts");
  assert.match(storage, /"event-roster-enrollment:"/);
  assert.match(storage, /"event-schedule:"/);
});

test("the enrolled player list does not call an unlinked player a paper scorecard", () => {
  const client = read("src/app/tournament/[tournamentId]/schedule/schedule-client.tsx");
  // The workspace returns profileLinked, which is whether an app account is
  // attached, and nothing about the roster's scorecard type. Labelling it
  // Digital/Paper made this page contradict the roster and the participants
  // page for every digital player who has not claimed an account yet.
  assert.doesNotMatch(client, /profileLinked \? "Digital" : "Paper"/);
  assert.match(client, /profileLinked \? "App account linked" : "No app account"/);
});
