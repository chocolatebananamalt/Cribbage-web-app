import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";

const { createRosterAccountActivationCredential } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/roster-account-activation-token.ts")).href);
const { redeemRosterAccountActivation } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/roster-account-activation-redeemer.ts")).href);

const activationId = "00000000-0000-4000-8000-000000000001";
const input = { profileId: "00000000-0000-4000-8000-000000000002", operationId: "00000000-0000-4000-8000-000000000003" };

test("activation redeemer reads a private salt then transmits only a bytea digest", async () => {
  const credential = createRosterAccountActivationCredential(activationId);
  const calls = [];
  const result = await redeemRosterAccountActivation({ rpc: async (name, args) => {
    calls.push({ name, args });
    if (name === "get_roster_account_activation_salt_v1") return { data: { status: "ready", activationId, saltBase64: Buffer.alloc(32, 7).toString("base64") }, error: null };
    return { data: { status: "pending", activationId, requestId: "00000000-0000-4000-8000-000000000004", confirmationPhrase: "ABCD-EFGH" }, error: null };
  } }, { ...input, credential: credential.canonicalToken });
  assert.equal(result.status, "pending");
  assert.equal(calls[0].name, "get_roster_account_activation_salt_v1");
  assert.equal(calls[1].name, "redeem_roster_account_activation_v1");
  assert.match(calls[1].args.p_digest, /^\\x[0-9a-f]{64}$/);
  assert.equal(Object.values(calls[1].args).includes(credential.canonicalToken), false);
});

test("activation redeemer keeps unavailable and malformed credentials generic", async () => {
  const unavailable = await redeemRosterAccountActivation({ rpc: async () => ({ data: { status: "unavailable" }, error: null }) }, { ...input, credential: createRosterAccountActivationCredential(activationId).canonicalToken });
  assert.deepEqual(unavailable, { status: "rejected" });
  const malformed = await redeemRosterAccountActivation({ rpc: async () => { throw new Error("must not call"); } }, { ...input, credential: "not-a-credential" });
  assert.deepEqual(malformed, { status: "rejected" });
});
