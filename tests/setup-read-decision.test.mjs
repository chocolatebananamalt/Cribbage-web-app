import assert from "node:assert/strict";
import test from "node:test";
import { decideSetupRead } from "../src/lib/api/setup-read-decision.ts";

test("setup read decision distinguishes authorized absence from malformed or failed reads", () => {
  assert.deepEqual(decideSetupRead({ rpcFailure: false, workspace: null, officialChoices: null, valid: false }), { status: 404, error: "setup_unavailable" });
  assert.deepEqual(decideSetupRead({ rpcFailure: true, workspace: null, officialChoices: null, valid: false }), { status: 503, error: "operation_unavailable" });
  assert.deepEqual(decideSetupRead({ rpcFailure: false, workspace: { current: null }, officialChoices: null, valid: false }), { status: 503, error: "operation_unavailable" });
  assert.deepEqual(decideSetupRead({ rpcFailure: false, workspace: { current: null }, officialChoices: {}, valid: false }), { status: 503, error: "operation_unavailable" });
  assert.deepEqual(decideSetupRead({ rpcFailure: false, workspace: { current: null, history: [] }, officialChoices: { directorProfileId: "123e4567-e89b-42d3-a456-426614174000", coDirectorProfileIds: [] }, valid: true }), { status: 200 });
});
