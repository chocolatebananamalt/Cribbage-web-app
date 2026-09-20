import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isSetupOfficialNominationRequest, isSetupOfficialsWorkspace } from "../src/lib/api/setup-officials.ts";
import { isSetupSaveRequest } from "../src/lib/api/setup.ts";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const official = { firstName: "Alex", lastName: "Example", email: "alex@example.test", accNumber: "HI296Y", operationId: uuid };

test("setup official nominations require complete names, email, and adult or youth ACC number", () => {
  assert.equal(isSetupOfficialNominationRequest(official), true);
  assert.equal(isSetupOfficialNominationRequest({ ...official, firstName: "" }), false);
  assert.equal(isSetupOfficialNominationRequest({ ...official, email: "not-email" }), false);
  assert.equal(isSetupOfficialNominationRequest({ ...official, accNumber: "HI-296Y" }), false);
});

test("official workspace supports complete new records and safe historic read-only identities", () => {
  const complete = { nominationId: uuid, displayName: "Alex Example", firstName: "Alex", lastName: "Example", email: "alex@example.test", accNumber: "HI296", status: "registered_approved", profileId: null };
  const historic = { nominationId: "123e4567-e89b-42d3-a456-426614174001", displayName: "Existing official", firstName: "", lastName: "", email: "", accNumber: "", status: "registered_approved", profileId: uuid };
  assert.equal(isSetupOfficialsWorkspace({ tournamentName: "Rehearsal", role: "co_director", canManage: true, capacity: 12, entries: [complete, historic] }), true);
  assert.equal(isSetupOfficialsWorkspace({ tournamentName: "Rehearsal", role: "co_director", canManage: true, capacity: 12, entries: Array.from({ length: 13 }, () => complete) }), false);
});

test("time-zone-aware Setup requires a selected State/Territory", () => {
  const payload = { tournamentName: "Rehearsal", city: "Honolulu", venue: "Club — 123 Main St · 96825", venueName: "Club", venueStreet: "123 Main St", venuePostalCode: "96825", stateTerritory: "Hawaii", startsAt: "2026-09-16T09:00", endsAt: "2026-09-16T17:00", timezone: "Pacific/Honolulu", tournamentDirectorPublicName: "Director Example", tournamentDirectorFirstName: "Director", tournamentDirectorLastName: "Example", tournamentContactPhone: "+1 808 555 0101", tournamentContactEmail: "director@example.test", tournamentMailingAddress: "", mainSanctioningFeeRateCents: 300, consolationSanctioningFeeRateCents: 100, mainSanctioningFeeOverrideReason: "", mainSanctioningFeeOverrideReference: "", consolationSanctioningFeeOverrideReason: "", consolationSanctioningFeeOverrideReference: "", officials: [{ profileId: uuid, role: "director" }], events: [] };
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload, idempotencyKey: uuid }), true);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...payload, stateTerritory: "Atlantis" }, idempotencyKey: uuid }), false);
});

test("database contract keeps official authority role-scoped, audited, capped, and email-gated", () => {
  const sql = [
    readFileSync("database/migrations/0211_setup_official_management_timezones_and_fee_controls.sql", "utf8"),
    readFileSync("database/migrations/0214_setup_state_timezone_integrity.sql", "utf8"),
  ].join("\n");
  for (const token of [
    "state_territory", "missing_state_territory", "tournament_setup_official_nominations",
    "official_capacity_reached", ">=12", "invitation_email_sent", "registered_approved",
    "accept_tournament_setup_official_nomination_by_id_v1", "operation_receipts",
    "tournament_setup_official_removed", "invitation_expires_at", "America/Phoenix",
    "v_can_view", "r.role='co_director'",
  ]) assert.match(sql, new RegExp(token.replaceAll("(", "\\(").replaceAll(")", "\\)")));
  assert.match(sql, /Assignment never grants authority merely because an address already has an[\s\S]*secure sign-in first/);
  assert.match(sql, /'pending',encode\(extensions\.digest/);
});

test("the workspace has no separate official or cross-checker menu entry", () => {
  const workspace = readFileSync("src/app/tournament/[tournamentId]/page.tsx", "utf8");
  const setup = readFileSync("src/app/tournament/[tournamentId]/setup/setup-official-summaries.tsx", "utf8");
  assert.doesNotMatch(workspace, /href=\{`\/tournament\/\$\{tournamentId\}\/officials`\}/);
  assert.doesNotMatch(workspace, /Cross-checker assignments/);
  assert.match(setup, /Tournament officials/);
  assert.match(setup, /Add\/Remove/);
});

test("the officials form says what an ACC # looks like and why Save is unavailable", () => {
  const client = readFileSync("src/app/tournament/[tournamentId]/setup/officials/[role]/setup-officials-client.tsx", "utf8");
  // Save is gated on isAccNumber, so a bare member number such as 99001 leaves
  // the button greyed out. The event check-in form and the roster already print
  // the HI296 example; this form was the one that did not, and its pattern
  // attribute never surfaces because a disabled button never submits.
  assert.match(client, /<span className="field-help">Use HI296, or HI296Y for a youth official\.<\/span>/);
  // The reason the pattern attribute never surfaces is a note for whoever reads
  // this code, not copy for a tournament director standing at a desk.
  assert.doesNotMatch(client, /field-help">[^<]*pattern input attribute/);
  assert.match(client, /unavailableReason/);
  assert.match(client, /two-letter state abbreviation/);
  assert.match(client, /positions are filled\. Remove one before adding another\./);
});
