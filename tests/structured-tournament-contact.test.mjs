import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { isSetupSaveRequest, isSetupWorkspace } from "../src/lib/api/setup.ts";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const contact = { tournamentContactPhone: "+1 808 555 0101", tournamentContactEmail: "director@example.test", tournamentMailingAddress: "PO Box 1\nHonolulu, HI" };
const base = {
  tournamentName: "Full Rehearsal", city: "Honolulu", venue: "Club — 123 Main St · 96825", venueName: "Club", venueStreet: "123 Main St", venuePostalCode: "96825", stateTerritory: "Hawaii", startsAt: "2026-09-16T09:00",
  endsAt: "2026-09-16T17:00", timezone: "Pacific/Honolulu",
  mainSanctioningFeeRateCents: 300, consolationSanctioningFeeRateCents: 100,
  mainSanctioningFeeOverrideReason: "", mainSanctioningFeeOverrideReference: "",
  consolationSanctioningFeeOverrideReason: "", consolationSanctioningFeeOverrideReference: "",
  tournamentDirectorPublicName: "Director Example", tournamentDirectorFirstName: "Director", tournamentDirectorLastName: "Example", officials: [{ profileId: uuid, role: "director" }], events: [], ...contact,
};

test("setup accepts optional player-facing phone/email/address and validates supplied values", () => {
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: base, idempotencyKey: uuid }), true);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, venuePostalCode: "" }, idempotencyKey: uuid }), false);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, venueStreet: "Different", venue: base.venue }, idempotencyKey: uuid }), false);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, tournamentDirectorLastName: "", tournamentDirectorPublicName: "Director" }, idempotencyKey: uuid }), false);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, tournamentContactPhone: "", tournamentContactEmail: "" }, idempotencyKey: uuid }), true);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, tournamentContactPhone: "123" }, idempotencyKey: uuid }), false);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, tournamentContactEmail: "not-an-email" }, idempotencyKey: uuid }), false);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, tournamentMailingAddress: "" }, idempotencyKey: uuid }), true);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, contactDetails: "private address" }, idempotencyKey: uuid }), false);
});

test("older setup revisions can load blank optional player-facing contact fields", () => {
  const current = { revisionId: uuid, version: 1, createdAt: "2026-09-15T00:00:00Z", ...base, tournamentContactPhone: "", tournamentContactEmail: "", tournamentMailingAddress: "", events: [] };
  assert.equal(isSetupWorkspace({ current, history: [{ version: 1, createdAt: current.createdAt, eventCount: 0 }], sanctioningFee: { mainRateCents: 300, consolationRateCents: 100, mainEligibleParticipantCount: 0, consolationEligibleParticipantCount: 0, runningTotalCents: 0, mainRateSource: "setup", consolationRateSource: "setup" } }), true);
});

test("database contract preserves legacy free text privately and exposes only structured selected contact", () => {
  const sql = fs.readFileSync(new URL("../database/migrations/0193_structured_tournament_contact_information.sql", import.meta.url), "utf8");
  const optionalSql = fs.readFileSync(new URL("../database/migrations/0234_optional_player_facing_director_contact.sql", import.meta.url), "utf8");
  assert.match(sql, /add column tournament_contact_phone text/);
  assert.match(sql, /save_tournament_setup_version_legacy/);
  assert.match(sql, /'tournamentContactPhone'/);
  assert.match(sql, /tournament_setup_contact_saved/);
  assert.match(sql, /get_public_registration_payment_options_v1/);
  assert.match(sql, /join app\.profiles director/);
  assert.match(sql, /contact\.tournament_contact_phone/);
  assert.match(sql, /missing_tournament_contact/);
  assert.match(sql, /never joins account\/profile addresses/);
  assert.match(optionalSql, /apply_optional_tournament_contact_v1/);
  assert.match(optionalSql, /nullif\(trim\(v_phone\),''\)/);
  assert.match(optionalSql, /alter column tournament_contact_phone drop not null/);
  assert.match(optionalSql, /configure_tournament_public_contact_from_setup_v1/);
  assert.match(optionalSql, /coalesce\(contact\.tournament_contact_phone,setup\.tournament_contact_phone,''\)/);
  assert.doesNotMatch(optionalSql, /r\.tournament_contact_phone is not null and r\.tournament_contact_email is not null/);
  assert.match(optionalSql, /activate_tournament_setup_v2_legacy/);
  assert.doesNotMatch(optionalSql, /missing_tournament_contact/);
});
