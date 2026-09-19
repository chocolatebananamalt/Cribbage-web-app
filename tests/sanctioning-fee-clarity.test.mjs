import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isSanctioningFeeRateOverrideRequest } from "../src/lib/api/sanctioning-fee.ts";
import { isSetupSaveRequest } from "../src/lib/api/setup.ts";

const id = "123e4567-e89b-42d3-a456-426614174000";
const payload = { tournamentName: "Rehearsal", city: "Honolulu", venue: "Club", stateTerritory: "Hawaii", startsAt: "2026-09-16T09:00", endsAt: "2026-09-16T17:00", timezone: "Pacific/Honolulu", tournamentDirectorPublicName: "Director Example", tournamentContactPhone: "+1 808 555 0101", tournamentContactEmail: "director@example.test", tournamentMailingAddress: "PO Box 1", mainSanctioningFeeRateCents: 300, consolationSanctioningFeeRateCents: 100, mainSanctioningFeeOverrideReason: "", mainSanctioningFeeOverrideReference: "", consolationSanctioningFeeOverrideReason: "", consolationSanctioningFeeOverrideReference: "", officials: [{ profileId: id, role: "director" }], events: [] };

test("saved drafts require the selected State/Territory and preserve legacy override evidence", () => {
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, idempotencyKey: id, payload }), true);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, idempotencyKey: id, payload: { ...payload, stateTerritory: "" } }), false);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, idempotencyKey: id, payload: { ...payload, mainSanctioningFeeRateCents: 350 } }), false);
  assert.equal(isSetupSaveRequest({ expectedVersion: 0, idempotencyKey: id, payload: { ...payload, mainSanctioningFeeRateCents: 350, mainSanctioningFeeOverrideReason: "ACC notice", mainSanctioningFeeOverrideReference: "ACC notice 2026-09-01" } }), true);
});

test("rate override endpoint requires a bounded reason, event kind, and idempotency key", () => {
  assert.equal(isSanctioningFeeRateOverrideRequest({ eventKind: "main", rateCents: 350, reason: "ACC notice", idempotencyKey: id }), true);
  assert.equal(isSanctioningFeeRateOverrideRequest({ eventKind: "satellite", rateCents: 350, reason: "ACC notice", idempotencyKey: id }), false);
  assert.equal(isSanctioningFeeRateOverrideRequest({ eventKind: "main", rateCents: 350, reason: "", idempotencyKey: id }), false);
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
  assert.match(client, /Adjust Main rate/);
  assert.match(client, /Adjust Consolation rate/);
  assert.match(client, /Save Adjusted Main Rate/);
  assert.match(client, /Reason \(<span className="required-field"/);
  assert.match(client, /Only adjust with ACC Board approval\. Before Start Play only/);
  assert.match(client, /refreshSanctioningFee/);
  assert.doesNotMatch(client, /15_000/);
  assert.match(client, /Refresh total/);
  assert.match(client, /registration-primary/);
  assert.match(client, /Post-finalization event administration/);
  assert.match(client, /Use only when necessary after registration opens/);
  assert.match(css, /\.required-label \{ display:inline-flex;[^}]*white-space:nowrap/);
  assert.match(css, /\.setup-workspace>fieldset \{ min-width:0; \}/);
  assert.match(css, /\.setup-event \{ grid-template-columns:minmax\(0,1fr\); min-width:0; \}/);
  assert.match(css, /@media \(max-width:700px\) \{ \.setup-event \.setup-grid \{ width:100%; max-width:100%; grid-template-columns:minmax\(0,1fr\); min-width:0; \}\.setup-event \.setup-grid>\*,\.setup-event \.setup-subsection,\.setup-event \.setup-subsection>\* \{ min-width:0; max-width:100%; \}\.setup-event \.setup-subsection,\.setup-event \.setup-subsection label \{ grid-template-columns:minmax\(0,1fr\); \} \}/);
  assert.match(css, /\.registration-primary \{ display:grid; width:100%/);
  assert.match(css, /\.setup-post-finalization \{ display:grid/);
  assert.match(css, /setup-workspace:has\(\[role="alertdialog"\]\)/);
});

test("the ACC sanctioning fee rate editor is typeable and never saves silently", () => {
  const client = readFileSync(new URL("../src/app/tournament/[tournamentId]/setup/setup-client.tsx", import.meta.url), "utf8");
  // RateInput commits on every parseable keystroke. If its React key interpolates
  // the value being edited, each accepted digit remounts the input, resets its
  // draft and drops focus, so the rate cannot be typed at all.
  assert.doesNotMatch(client, /key=\{`main-sanctioning-rate-\$\{displayedMain\}`\}/);
  assert.doesNotMatch(client, /key=\{`consolation-sanctioning-rate-\$\{displayedConsolation\}`\}/);
  assert.match(client, /key=\{`main-sanctioning-rate-\$\{storedMainRateCents\}-\$\{eventKind === "main"\}`\}/);
  assert.match(client, /key=\{`consolation-sanctioning-rate-\$\{storedConsolationRateCents\}-\$\{eventKind === "consolation"\}`\}/);
  // Save must be blocked by disabled state, not by an early return that leaves
  // the director with no rate change and no explanation.
  assert.match(client, /const canSave = eventKind !== null && reason\.trim\(\)\.length > 0 && rateChanged;/);
  assert.match(client, /eventKind === "main" && !canSave/);
  assert.match(client, /eventKind === "consolation" && !canSave/);
  assert.match(client, /A reason is required\./);
  assert.match(client, /Cancel rate change/);
});

test("the Adjust rate buttons do not wait for a first setup save", () => {
  const client = readFileSync("src/app/tournament/[tournamentId]/setup/setup-client.tsx", "utf8");
  // A director sets the ACC rates while creating the tournament, before any
  // draft exists. The RPC has always allowed that: it checks tournament status,
  // the director role, and whether play started, never a setup revision. The
  // page used to gate on canAdjust={!!revisionId && !pending}, so both buttons
  // were dead on every new tournament and nothing on screen said why.
  assert.doesNotMatch(client, /canAdjust=\{!!revisionId/);
  assert.match(client, /canAdjust=\{!pending\}/);
  assert.match(client, /unavailableReason/);
});

test("the panel shows the rate in force, not the rate in the saved draft", () => {
  const client = readFileSync("src/app/tournament/[tournamentId]/setup/setup-client.tsx", "utf8");
  // An override applies with or without a saved revision. Reading the rate off
  // the setup payload showed 3.00 straight back to a director who had just
  // changed it, because a never-saved tournament falls back to blankPayload.
  assert.match(client, /const effectiveMainRateCents = sanctioningFee\?\.mainRateCents/);
  assert.match(client, /const effectiveConsolationRateCents = sanctioningFee\?\.consolationRateCents/);
  assert.match(client, /mainRateCents=\{effectiveMainRateCents\}/);
  assert.match(client, /mainRateCents: workspace\.sanctioningFee\.mainRateCents/);
});

test("each rate rejection names its own reason", async () => {
  const { sanctioningFeeRateRejectionMessage } = await import("../src/lib/api/sanctioning-fee.ts");
  assert.match(sanctioningFeeRateRejectionMessage("rate_locked_after_start"), /Play has already started/);
  assert.match(sanctioningFeeRateRejectionMessage("rate_unchanged"), /already the rate in force/);
  assert.match(sanctioningFeeRateRejectionMessage("not_director"), /Co-Director/);
  assert.match(sanctioningFeeRateRejectionMessage("tournament_unavailable"), /draft or open/);
  assert.match(sanctioningFeeRateRejectionMessage(null), /Reload the page/);
  const client = readFileSync("src/app/tournament/[tournamentId]/setup/setup-client.tsx", "utf8");
  assert.doesNotMatch(client, /Confirm the event has not started and try again/);
});
