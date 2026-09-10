import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";
const api = await import(pathToFileURL(path.join(process.cwd(), "src/lib/api/roster-account-activation.ts")).href);
const id = "00000000-0000-4000-8000-000000000001";
const op = "00000000-0000-4000-8000-000000000002";
test("activation API contracts accept only bounded exact decision envelopes", () => {
  assert.equal(api.isActivationIssueRequest({ rosterEntryId: id, expiresAt: "2030-01-01T00:00:00.000Z", operationId: op }), true);
  assert.equal(api.isActivationRedeemRequest({ credential: "acc-activate.v1.00000000-0000-4000-8000-000000000001.abc", operationId: op }), true);
  assert.equal(api.isActivationRedeemRequest({ credential: "x".repeat(513), operationId: op }), false);
  assert.equal(api.isActivationDecisionRequest({ requestId: id, decision: "approve", confirmationPhrase: "ABCD-EFGH", operationId: op }), true);
  assert.equal(api.isActivationDecisionRequest({ requestId: id, decision: "approve", operationId: op }), false);
  assert.equal(api.isActivationDecisionRequest({ requestId: id, decision: "reject", confirmationPhrase: "ABCD-EFGH", operationId: op }), false);
  assert.equal(api.isActivationCancelRequest({ activationId: id, operationId: op, extra: true }), false);
});
