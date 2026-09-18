import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { isSetupSaveRequest, isSetupWorkspace } from "../src/lib/api/setup.ts";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const contact = { tournamentContactPhone: "+1 808 555 0101", tournamentContactEmail: "director@example.test", tournamentMailingAddress: "PO Box 1\nHonolulu, HI" };
const base = {
  tournamentName: "Full Rehearsal", city: "Honolulu", venue: "Club", stateTerritory: "Hawaii", startsAt: "2026-09-16T09:00",
  endsAt: "2026-09-16T17:00", timezone: "Pacific/Honolulu",
  mainSanctioningFeeRateCents: 300, consolationSanctioningFeeRateCents: 100,
  mainSanctioningFeeOverrideReason: "", mainSanctioningFeeOverrideReference: "",
  consolationSanctioningFeeOverrideReason: "", consolationSanctioningFeeOverrideReference: "",
  tournamentDirectorPublicName: "Director Example", officials: [{ profileId: uuid, role: "director" }], events: [], ...contact,
};

test("setup requires structured phone/email while retaining an optional player-facing mailing address", () => {
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: base, idempotencyKey: uuid }), true);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, tournamentContactPhone: "" }, idempotencyKey: uuid }), false);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, tournamentContactEmail: "not-an-email" }, idempotencyKey: uuid }), false);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, tournamentMailingAddress: "" }, idempotencyKey: uuid }), true);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, payload: { ...base, contactDetails: "private address" }, idempotencyKey: uuid }), false);
});

test("older setup revisions can load blank structured contact fields for repair but cannot be saved unchanged", () => {
  const current = { revisionId: uuid, version: 1, createdAt: "2026-09-15T00:00:00Z", ...base, tournamentContactPhone: "", tournamentContactEmail: "", tournamentMailingAddress: "", events: [] };
  assert.equal(isSetupWorkspace({ current, history: [{ version: 1, createdAt: current.createdAt, eventCount: 0 }], sanctioningFee: { mainRateCents: 300, consolationRateCents: 100, mainEligibleParticipantCount: 0, consolationEligibleParticipantCount: 0, runningTotalCents: 0, mainRateSource: "setup", consolationRateSource: "setup" } }), true);
});

test("database contract preserves legacy free text privately and exposes only structured selected contact", () => {
  const sql = fs.readFileSync(new URL("../database/migrations/0193_structured_tournament_contact_information.sql", import.meta.url), "utf8");
  assert.match(sql, /add column tournament_contact_phone text/);
  assert.match(sql, /save_tournament_setup_version_legacy/);
  assert.match(sql, /'tournamentContactPhone'/);
  assert.match(sql, /tournament_setup_contact_saved/);
  assert.match(sql, /get_public_registration_payment_options_v1/);
  assert.match(sql, /join app\.profiles director/);
  assert.match(sql, /contact\.tournament_contact_phone/);
  assert.match(sql, /missing_tournament_contact/);
  assert.match(sql, /never joins account\/profile addresses/);
});
