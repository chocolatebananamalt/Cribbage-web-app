import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";

const { issueRosterAccountActivation } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/roster-account-activation-issuer.ts")).href);
const input = { actorId: "00000000-0000-4000-8000-000000000001", tournamentId: "00000000-0000-4000-8000-000000000002", rosterEntryId: "00000000-0000-4000-8000-000000000003", expiresAt: new Date("2030-01-01T12:00:00.000Z"), operationId: "00000000-0000-4000-8000-000000000004" };

test("activation issuer transmits only bytea digest material and returns a credential once", async () => {
  let request;
  const result = await issueRosterAccountActivation({ rpc: async (name, args) => { request = { name, args }; return { data: { status: "issued", activationId: args.p_activation_id, rosterEntryId: input.rosterEntryId, tournamentId: input.tournamentId, expiresAt: input.expiresAt.toISOString() }, error: null }; } }, input);
  assert.equal(result.status, "issued");
  assert.equal(request.name, "issue_roster_account_activation_v1");
  assert.match(request.args.p_salt, /^\\x[0-9a-f]{64}$/);
  assert.match(request.args.p_digest, /^\\x[0-9a-f]{64}$/);
  assert.equal(Object.values(request.args).includes(result.credential.canonicalToken), false);
});

test("activation issuer never regenerates a credential from an accepted replay", async () => {
  const result = await issueRosterAccountActivation({ rpc: async () => ({ data: { status: "issued", activationId: "00000000-0000-4000-8000-000000000005", rosterEntryId: input.rosterEntryId, tournamentId: input.tournamentId, expiresAt: input.expiresAt.toISOString() }, error: null }) }, input);
  assert.deepEqual(result, { status: "credential_unavailable" });
});

test("activation issuer rejects mixed receipts and propagates narrow durable conflicts", async () => {
  await assert.rejects(() => issueRosterAccountActivation({ rpc: async () => ({ data: { status: "issued", activationId: input.rosterEntryId }, error: null }) }, input), /unavailable/);
  const result = await issueRosterAccountActivation({ rpc: async () => ({ data: { status: "rejected", code: "activation_unavailable" }, error: null }) }, input);
  assert.deepEqual(result, { status: "rejected", code: "activation_unavailable" });
});
