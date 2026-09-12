import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";
const api = await import(pathToFileURL(path.join(process.cwd(), "src/lib/api/roster-account-activation.ts")).href);
const id = "00000000-0000-4000-8000-000000000001";
const op = "00000000-0000-4000-8000-000000000002";
test("activation API contracts accept only bounded exact decision envelopes", () => {
  const now = new Date("2030-01-01T00:00:00.000Z");
  assert.equal(api.isActivationIssueRequest({ rosterEntryId: id, expiresAt: "2030-01-01T00:30:00.000Z", operationId: op }, now), true);
  assert.equal(api.isActivationIssueRequest({ rosterEntryId: id, expiresAt: "2030-01-01T00:05:00.000Z", operationId: op }, now), false);
  assert.equal(api.isActivationIssueRequest({ rosterEntryId: id, expiresAt: "2030-01-01T01:00:00.001Z", operationId: op }, now), false);
  assert.equal(api.isActivationRedeemRequest({ credential: "acc-activate.v1.00000000-0000-4000-8000-000000000001.abc", operationId: op }), true);
  assert.equal(api.isActivationRedeemRequest({ credential: "x".repeat(513), operationId: op }), false);
  assert.equal(api.isActivationDecisionRequest({ requestId: id, decision: "approve", confirmationPhrase: "ABCD-EFGH", operationId: op }), true);
  assert.equal(api.isActivationDecisionRequest({ requestId: id, decision: "approve", operationId: op }), false);
  assert.equal(api.isActivationDecisionRequest({ requestId: id, decision: "reject", confirmationPhrase: "ABCD-EFGH", operationId: op }), false);
  assert.equal(api.isActivationCancelRequest({ activationId: id, operationId: op, extra: true }), false);
});

test("activation response contracts reject partial or broadened identity receipts", () => {
  const secret = "A".repeat(43);
  assert.equal(api.isActivationIssueResult({ status: "issued", credential: `${id}.${secret}`, expiresAt: "2030-01-01T00:30:00.000Z" }), true);
  assert.equal(api.isActivationIssueResult({ status: "issued", credential: `${id}.${secret}`, expiresAt: "2030-01-01T00:30:00.000Z", activationId: id }), false);
  assert.equal(api.isActivationRedemptionResult({ status: "pending", activationId: id, requestId: op, confirmationPhrase: "ABCD-EFGH" }), true);
  assert.equal(api.isActivationRedemptionResult({ status: "pending", activationId: id, requestId: op }), false);
  assert.equal(api.isActivationDecisionResult({ status: "approved", requestId: id, rosterEntryId: op, linkId: id }, id), true);
  assert.equal(api.isActivationCancellationResult({ status: "cancelled", activationId: id }, id), true);
});

test("director workspace requires exact safe fields and a matching pending activation", () => {
  const activationId = "00000000-0000-4000-8000-000000000003";
  const workspace = {
    tournamentName: "Sample event",
    rosterEntries: [{ rosterEntryId: id, displayName: "Sample Player", activation: { activationId, state: "pending", expiresAt: "2030-01-01T00:30:00.000Z" } }],
    pendingRequests: [{ requestId: op, activationId, rosterEntryId: id, rosterDisplayName: "Sample Player", requestedAt: "2030-01-01T00:10:00.000Z", expiresAt: "2030-01-01T00:30:00.000Z", canApprove: true }],
  };
  assert.equal(api.isActivationWorkspace(workspace), true);
  assert.equal(api.isActivationWorkspace({ ...workspace, confirmationPhrase: "ABCD-EFGH" }), false);
  assert.equal(api.isActivationWorkspace({ ...workspace, pendingRequests: [{ ...workspace.pendingRequests[0], activationId: op }] }), false);
});
