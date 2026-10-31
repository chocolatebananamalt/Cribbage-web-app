import assert from "node:assert/strict";
import test from "node:test";
import { directorChecklist, rosterIntakeState, rosterIntakeMessage } from "../src/lib/director-checklist.ts";

const empty = () => ({ setup: null, activation: null, seating: null, enrollment: null, payments: null, schedule: null, attendance: null });
const open = () => ({ ...empty(), setup: { current: { events: [{}] } }, activation: { status: "activated" }, seating: { registrationClosed: false, publication: null }, enrollment: { roster: [], events: [] }, payments: { entries: [] }, schedule: { events: [] }, attendance: [] });
test("unavailable status never claims a step is complete", () => {
  assert.ok(directorChecklist(empty()).every((step) => step.state === "Check status"));
});
test("new setup offers details first and keeps later prerequisites visible", () => {
  const s = { ...open(), setup: { current: null }, activation: { status: "not_activated" } };
  const steps = directorChecklist(s);
  assert.equal(steps[0].state, "Next");
  assert.equal(steps[1].state, "Blocked");
  assert.equal(steps[2].state, "Blocked");
  assert.equal(steps.length, 10);
});
test("roster intake distinguishes unopened, closed, seating published, and unavailable", () => {
  const seating = { registrationClosed: false, publication: null };
  assert.equal(rosterIntakeState({ status: "not_activated" }, seating), "setup_required");
  assert.equal(rosterIntakeState({ status: "activated" }, seating), "open");
  assert.equal(rosterIntakeState({ status: "activated" }, { ...seating, registrationClosed: true }), "closed");
  assert.equal(rosterIntakeState({ status: "activated" }, { ...seating, publication: {} }), "closed");
  assert.equal(rosterIntakeState(null, seating), "unavailable");
  assert.match(rosterIntakeMessage("setup_required"), /Finalize All Events \/ Open Registration/);
  assert.match(rosterIntakeMessage("closed"), /guarded correction/);
});
test("receipt alone cannot satisfy the separate amount-owed prerequisite", () => {
  const s = open();
  s.enrollment.roster = [{ rosterEntryId: "r", checkInState: "checked_in", enrolledEventIds: ["e"] }];
  s.payments.entries = [{ rosterEntryId: "r", amountOwedMinor: null, amountReceivedMinor: 500, paymentStatus: "not_configured" }];
  assert.equal(directorChecklist(s)[6].state, "Next");
  s.payments.entries[0] = { rosterEntryId: "r", amountOwedMinor: 0, amountReceivedMinor: 0, paymentStatus: "paid" };
  assert.equal(directorChecklist(s)[6].state, "Complete");
  s.payments.entries[0].paymentStatus = "partial";
  assert.equal(directorChecklist(s)[6].state, "Next");
});
test("refresh projections can revoke previous checklist completion", () => {
  const s = open();
  s.enrollment.roster = [{ rosterEntryId: "r", checkInState: "checked_in", enrolledEventIds: ["e"] }];
  assert.equal(directorChecklist(s)[4].state, "Complete");
  s.enrollment.roster.push({ rosterEntryId: "late", checkInState: "not_checked_in", enrolledEventIds: [] });
  assert.equal(directorChecklist(s)[4].state, "Next");
});
test("empty and later events are not silently completed", () => {
  const s = open();
  assert.notEqual(directorChecklist(s)[7].state, "Complete");
  assert.notEqual(directorChecklist(s)[9].state, "Complete");
  s.attendance = [{ eventId: "main", format: "standard_singles", name: "Main", windowState: "closed", unresolvedCount: 0, checkedInCount: 2, noShowCount: 0, pendingDeskCount: 0 }];
  s.schedule.events = [{ eventId: "main", format: "standard_singles", scoringMethod: "digital", schedulePublished: true, playState: "in_progress" }];
  assert.equal(directorChecklist(s)[7].state, "Complete");
  assert.equal(directorChecklist(s)[9].state, "Complete");
  s.attendance[0].pendingDeskCount = 1;
  s.schedule.events.push({ schedulePublished: false, playState: "preparing" });
  assert.notEqual(directorChecklist(s)[7].state, "Complete");
  assert.notEqual(directorChecklist(s)[9].state, "Complete");
});

test("an empty later event is named and directs enrollment instead of an empty attendance loop", () => {
  const s = open();
  s.enrollment.events = [{ eventId: "main", name: "Main", participantCount: 2, format: "standard_singles" }, { eventId: "consolation", name: "Consolation", participantCount: 0, format: "standard_singles" }];
  s.enrollment.roster = [{ rosterEntryId: "r", checkInState: "checked_in", enrolledEventIds: ["main"] }];
  assert.notEqual(directorChecklist(s)[5].state, "Complete");
  assert.match(directorChecklist(s)[5].detail, /No participants recorded for: Consolation/);
  assert.equal(directorChecklist(s)[7].path, "participants");
});

test("Doubles starts use the team projection and direct unfinished teams to their own tools", () => {
  const s = open();
  s.schedule.events = [{ eventId: "doubles", format: "doubles", scoringMethod: "digital", schedulePublished: false, playState: "preparing" }];
  assert.equal(directorChecklist(s)[9].state, "Check status");
  assert.equal(directorChecklist(s)[9].path, "teams");
  s.teamStarts = { doubles: true };
  assert.equal(directorChecklist(s)[9].state, "Complete");
  s.teamStarts.doubles = false;
  assert.notEqual(directorChecklist(s)[9].state, "Complete");
});

test("team enrollment comes from Team Scorecards and missing team data stays unresolved", () => {
  const s = open();
  s.enrollment.events = [{ eventId: "doubles", name: "Doubles", participantCount: 0, format: "doubles" }];
  s.enrollment.roster = [{ rosterEntryId: "r1", checkInState: "checked_in", enrolledEventIds: [] }, { rosterEntryId: "r2", checkInState: "checked_in", enrolledEventIds: [] }];
  s.schedule.events = [{ eventId: "doubles", format: "doubles", scoringMethod: "digital", schedulePublished: false, playState: "preparing" }];
  assert.equal(directorChecklist(s)[5].state, "Check status");
  assert.equal(directorChecklist(s)[5].path, "teams");
  assert.match(directorChecklist(s)[5].detail, /team enrollment status is unavailable/);
  s.teamEnrollment = { doubles: { teamCount: 1, memberRosterEntryIds: ["r1", "r2"] } };
  assert.equal(directorChecklist(s)[5].state, "Complete");
  assert.match(directorChecklist(s)[5].detail, /Team Scorecards/);
});

test("team-only attendance routes to Team Scorecards", () => {
  const s = open();
  s.enrollment.events = [{ eventId: "doubles", name: "Doubles", participantCount: 0, format: "doubles" }];
  s.enrollment.roster = [];
  s.schedule.events = [{ eventId: "doubles", format: "doubles", scoringMethod: "digital", schedulePublished: false, playState: "preparing" }];
  assert.equal(directorChecklist(s)[7].state, "Complete");
  assert.equal(directorChecklist(s)[7].path, "teams");
  assert.match(directorChecklist(s)[7].detail, /No Standard Singles event attendance applies/);
});

test("mixed tournaments keep missing team and Singles attendance projections unknown", () => {
  const s = open();
  s.enrollment.events = [{ eventId: "main", name: "Main", participantCount: 1, format: "standard_singles" }, { eventId: "doubles", name: "Doubles", participantCount: 0, format: "doubles" }];
  s.enrollment.roster = [{ rosterEntryId: "r", checkInState: "checked_in", enrolledEventIds: ["main"] }];
  s.payments = { entries: [{ rosterEntryId: "r", paymentStatus: "paid" }] };
  s.attendance = null;
  assert.equal(directorChecklist(s)[5].state, "Check status");
  assert.equal(directorChecklist(s)[6].state, "Check status");
  assert.equal(directorChecklist(s)[7].state, "Check status");
  assert.doesNotMatch(directorChecklist(s)[7].detail, /No Standard Singles event attendance applies/);
});
