import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { isRegistrationCloseResult } from "../src/lib/api/registration-link.ts";
import { isRejectedSetup, isSavedSetup } from "../src/lib/api/setup.ts";

const read = (path) => fs.readFileSync(path, "utf8");

test("setup accepts only exact authoritative success and rejection envelopes", () => {
  const request = { expectedVersion: 0, idempotencyKey: "10000000-0000-4000-8000-000000000001", payload: { events: [] } };
  const saved = { status: "setup_draft_saved", revisionId: "20000000-0000-4000-8000-000000000001", version: 1, eventCount: 0,
    operationalEventsCreated: false, rulesetApproved: false, seatingUpdated: false, financeUpdated: false,
    resultsUpdated: false, payoutsCalculated: false, qualifiersCalculated: false, accSubmissionCreated: false };
  assert.equal(isSavedSetup(saved, request), true);
  assert.equal(isSavedSetup({ ...saved, unexpectedAuthority: true }, request), false);
  assert.equal(isRejectedSetup({ status: "rejected", code: "stale_version" }), true);
  assert.equal(isRejectedSetup({ status: "rejected", code: "invented" }), false);
  assert.equal(isRejectedSetup({ status: "rejected", code: "stale_version", private: true }), false);
  const client = read("src/app/tournament/[tournamentId]/setup/setup-client.tsx");
  assert.match(client, /response\.status === 409 && isRejectedSetup\(data\)/);
});

test("registration closure preserves retries unless the 409 body is an exact controlled rejection", () => {
  assert.equal(isRegistrationCloseResult({ status: "rejected", code: "registration_unavailable" }), true);
  assert.equal(isRegistrationCloseResult({ status: "rejected", code: "invented" }), false);
  const route = read("src/app/api/v1/tournaments/[id]/registration-close/route.ts");
  const client = read("src/app/tournament/[tournamentId]/seating/seating-client.tsx");
  assert.match(route, /data\.status === "rejected"\) return apiJson\(data, \{ status: 409 \}\)/);
  assert.match(client, /response\.status === 409 && isRegistrationCloseResult\(data\) && data\.status === "rejected"/);
});

test("results and provisional settlement mutations retain ambiguous 409 requests", () => {
  const finalization = read("src/app/tournament/[tournamentId]/results/qualification-finalization-client.tsx");
  const playoff = read("src/app/tournament/[tournamentId]/events/[eventId]/settlement/playoff-placement-client.tsx");
  const settlement = read("src/app/tournament/[tournamentId]/events/[eventId]/settlement/settlement-client.tsx");
  assert.match(finalization, /response\.status === 409 && isRejectedFinalization\(body, eventId\)/);
  assert.match(finalization, /Object\.keys\(item\)\.sort\(\)\.join\(","\) === "code,eventId,status"/);
  assert.match(playoff, /response\.status === 409 && isRejectedPlayoffPlacement\(result, eventId\)/);
  assert.match(playoff, /setPlacements\(initialRows\(workspace\)\)/);
  assert.match(settlement, /response\.status === 409 && isRejectedSettlementDraft\(result, eventId\)/);
});
