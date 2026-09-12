import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isEventRosterEnrollmentRequest,
  isEventRosterEnrollmentResult,
  isEventRosterEnrollmentWorkspace,
  isRejectedEventRosterEnrollment,
} from "../src/lib/api/event-roster-enrollment.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const eventId = "10000000-0000-4000-8000-000000000001";
const rosterA = "20000000-0000-4000-8000-000000000002";
const rosterB = "30000000-0000-4000-8000-000000000003";
const operationId = "40000000-0000-4000-8000-000000000004";
const request = { eventId, rosterEntryIds: [rosterA, rosterB], idempotencyKey: operationId };

test("event roster request requires unique bounded roster UUIDs", () => {
  assert.equal(isEventRosterEnrollmentRequest(request), true);
  assert.equal(isEventRosterEnrollmentRequest({ ...request, rosterEntryIds: [] }), false);
  assert.equal(isEventRosterEnrollmentRequest({ ...request, rosterEntryIds: [rosterA, rosterA] }), false);
  assert.equal(isEventRosterEnrollmentRequest({ ...request, rosterEntryIds: ["paper-player"] }), false);
  assert.equal(isEventRosterEnrollmentRequest({ ...request, extra: true }), false);
});

test("event roster result is request-bound and validates paper and linked participants", () => {
  const result = {
    status: "event_participants_enrolled",
    eventId,
    requestedCount: 2,
    createdCount: 2,
    existingCount: 0,
    participants: [
      { rosterEntryId: rosterA, participantId: "50000000-0000-4000-8000-000000000005", profileLinked: true, verificationId: "A-1" },
      { rosterEntryId: rosterB, participantId: "60000000-0000-4000-8000-000000000006", profileLinked: false, verificationId: null },
    ],
  };
  assert.equal(isEventRosterEnrollmentResult(result, request), true);
  assert.equal(isEventRosterEnrollmentResult({ ...result, eventId: rosterA }, request), false);
  assert.equal(isEventRosterEnrollmentResult({ ...result, createdCount: 1 }, request), false);
  assert.equal(isEventRosterEnrollmentResult({ ...result, participants: [result.participants[0], result.participants[0]] }, request), false);
  assert.equal(isEventRosterEnrollmentResult({ ...result, participants: [{ ...result.participants[0], verificationId: "seat one" }, result.participants[1]] }, request), false);
});

test("event roster workspace permits paper identities but only validated event state", () => {
  const workspace = {
    tournamentName: "October Pilot",
    registrationClosed: true,
    seatingPublished: true,
    events: [{ eventId, name: "Main Event", eventType: "main", format: "standard_singles", scoringMethod: "digital", participantCount: 1 }],
    roster: [{ rosterEntryId: rosterA, displayName: "Sample Player", checkInState: "checked_in", profileLinked: false, scorecardType: "paper", verificationId: "A-1", enrolledEventIds: [eventId] }],
  };
  assert.equal(isEventRosterEnrollmentWorkspace(workspace), true);
  assert.equal(isEventRosterEnrollmentWorkspace({ ...workspace, roster: [{ ...workspace.roster[0], checkInState: "unknown" }] }), false);
  assert.equal(isEventRosterEnrollmentWorkspace({ ...workspace, events: [{ ...workspace.events[0], scoringMethod: "automatic" }] }), false);
});

test("event roster migration preserves digital identity checks and adds paper participation", () => {
  const sql = read("database/migrations/0113_roster_based_event_enrollment.sql");
  assert.match(sql, /alter column profile_id drop not null/);
  assert.match(sql, /add column roster_entry_id uuid/);
  assert.match(sql, /foreign key \(roster_entry_id, tournament_id\)/);
  assert.match(sql, /check \(profile_id is not null or roster_entry_id is not null\)/);
  assert.match(sql, /unique \(event_id, roster_entry_id\)/);
  assert.match(sql, /create or replace function public\.enroll_roster_entries_in_event_v3/);
  assert.match(sql, /role in \('director', 'co_director'\)/);
  assert.match(sql, /jsonb_array_length\(p_roster_entry_ids\)/);
  assert.match(sql, /v_requested_count > 500/);
  assert.match(sql, /checked in roster required/);
  assert.match(sql, /e\.format = 'standard_singles' and e\.scoring_method = 'digital'/);
  assert.match(sql, /from app\.tournament_setup_activations/);
  assert.match(sql, /left join app\.roster_account_links/);
  assert.match(sql, /insert into app\.event_participants/);
  assert.match(sql, /insert into app\.operation_receipts/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /return v_existing\.response_payload/);
  assert.match(sql, /create or replace function public\.get_event_roster_enrollment_workspace_v3/);
  assert.match(sql, /from public, anon, authenticated;\s+grant execute[\s\S]*to service_role;/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/);
});

test("event roster route is same-origin, subject-bound, service-only, and response-validated", () => {
  const route = read("src/app/api/v1/tournaments/[id]/event-roster-enrollment/route.ts");
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /readLargeJson/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(route, /p_actor_id: subject/);
  assert.match(route, /enroll_roster_entries_in_event_v3/);
  assert.match(route, /get_event_roster_enrollment_workspace_v3/);
  assert.match(route, /isEventRosterEnrollmentResult/);
  assert.match(route, /isRejectedEventRosterEnrollment/);
  assert.doesNotMatch(route, /\.from\(|\.insert\(|\.update\(/);
});

test("event roster UI supports bulk selection and exact unresolved replay", () => {
  const client = read("src/app/tournament/[tournamentId]/participants/participants-client.tsx");
  const page = read("src/app/tournament/[tournamentId]/participants/page.tsx");
  assert.match(client, /Select all not enrolled/);
  assert.match(client, /Paper scorecard/);
  assert.match(client, /App account linked/);
  assert.match(client, /Retry exact saved enrollment/);
  assert.match(client, /sessionStorage/);
  assert.match(page, /Event Participants/);
  assert.match(page, /without app access remains a paper participant/);
});

test("only documented rejection codes are exposed", () => {
  assert.equal(isRejectedEventRosterEnrollment({ status: "rejected", code: "not_checked_in" }), true);
  assert.equal(isRejectedEventRosterEnrollment({ status: "rejected", code: "made_up" }), false);
  assert.equal(isRejectedEventRosterEnrollment({ status: "rejected", code: "not_director", private: true }), false);
});
