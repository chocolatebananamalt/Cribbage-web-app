import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isSanctioningFeeRateOverrideRequest } from "../src/lib/api/sanctioning-fee.ts";
import { isSetupSaveRequest } from "../src/lib/api/setup.ts";

const id = "123e4567-e89b-42d3-a456-426614174000";
const payload = { tournamentName: "Rehearsal", city: "Honolulu", venue: "Club", startsAt: "2026-09-16T09:00", endsAt: "2026-09-16T17:00", timezone: "Pacific/Honolulu", tournamentContactPhone: "+1 808 555 0101", tournamentContactEmail: "director@example.test", tournamentMailingAddress: "PO Box 1", mainSanctioningFeeRateCents: 300, consolationSanctioningFeeRateCents: 100, mainSanctioningFeeOverrideReason: "", mainSanctioningFeeOverrideReference: "", consolationSanctioningFeeOverrideReason: "", consolationSanctioningFeeOverrideReference: "", officials: [{ profileId: id, role: "director" }], events: [] };

test("non-default setup rates require audit reason and ACC reference", () => {
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, idempotencyKey: id, payload }), true);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, idempotencyKey: id, payload: { ...payload, mainSanctioningFeeRateCents: 350 } }), false);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, idempotencyKey: id, payload: { ...payload, mainSanctioningFeeRateCents: 350, mainSanctioningFeeOverrideReason: "ACC notice", mainSanctioningFeeOverrideReference: "ACC notice 2026-09-01" } }), true);
});

test("rate override endpoint requires a bounded reason, ACC reference, event kind, and idempotency key", () => {
  assert.equal(isSanctioningFeeRateOverrideRequest({ eventKind: "main", rateCents: 350, reason: "ACC notice", accReference: "ACC notice 2026-09-01", idempotencyKey: id }), true);
  assert.equal(isSanctioningFeeRateOverrideRequest({ eventKind: "satellite", rateCents: 350, reason: "ACC notice", accReference: "ACC notice", idempotencyKey: id }), false);
  assert.equal(isSanctioningFeeRateOverrideRequest({ eventKind: "main", rateCents: 350, reason: "", accReference: "ACC notice", idempotencyKey: id }), false);
});

test("database preserves legacy totals, snapshots Start Play, and rejects post-start rate changes", () => {
  const migration = readFileSync("database/migrations/0197_calculated_sanctioning_fee_rates.sql", "utf8");
  assert.match(migration, /sanctioningFeeCents',null/);
  assert.match(migration, /event_sanctioning_fee_snapshots/);
  assert.match(migration, /override_tournament_sanctioning_fee_rate_v1/);
  assert.match(migration, /event_play_starts/);
  assert.match(migration, /rate_locked_after_start/);
  assert.match(migration, /revoke all on function public\.override_tournament_sanctioning_fee_rate_v1/);
});

test("setup confirmation and protected controls match the clarity requirements", () => {
  const client = readFileSync("src/app/tournament/[tournamentId]/setup/setup-client.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(client, /function finalizationEventLine\(event: SetupEvent\)/);
  assert.match(client, /eventLabels\[event\.eventKind\].*event\.displayName.*event\.styleCode/s);
  assert.match(client, /Satellite Event/);
  assert.match(client, /Tournament contact phone \(<span className="required-field"/);
  assert.match(client, /className="required-label"/);
  assert.match(client, /Tournament mailing address \(optional\).*Note: This address will be visible to players/s);
  assert.match(client, /Yes, Finalize &amp; Open Registration/);
  assert.match(client, /ACC Sanctioning Fee Rate Adjustment Tool/);
  assert.match(client, /Only adjust with ACC Board approval\. Before Start Play only/);
  assert.match(client, /refreshSanctioningFee/);
  assert.match(client, /15_000/);
  assert.match(client, /Refresh total/);
  assert.match(client, /registration-primary/);
  assert.match(client, /Post-finalization event administration/);
  assert.match(client, /Use only when necessary after registration opens/);
  assert.match(css, /\.required-label \{ display:inline-flex;[^}]*white-space:nowrap/);
  assert.match(css, /\.setup-workspace>fieldset \{ min-width:0; \}/);
  assert.match(css, /\.setup-event \{ grid-template-columns:minmax\(0,1fr\); min-width:0; \}/);
  assert.match(css, /\.registration-primary \{ display:grid; width:100%/);
  assert.match(css, /\.setup-post-finalization \{ display:grid/);
  assert.match(css, /setup-workspace:has\(\[role="alertdialog"\]\)/);
});
