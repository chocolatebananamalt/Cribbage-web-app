import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";

const decision = await import(pathToFileURL(path.join(process.cwd(), "src/lib/roster-account-activation-decision.ts")).href);
const cancellation = await import(pathToFileURL(path.join(process.cwd(), "src/lib/roster-account-activation-canceller.ts")).href);

const actorId = "00000000-0000-4000-8000-000000000001";
const tournamentId = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const activationId = "00000000-0000-4000-8000-000000000004";
const rosterEntryId = "00000000-0000-4000-8000-000000000005";
const linkId = "00000000-0000-4000-8000-000000000006";
const operationId = "00000000-0000-4000-8000-000000000007";

test("activation decision accepts only an exact database approval receipt", async () => {
  const calls = [];
  const admin = { async rpc(name, args) {
    calls.push({ name, args });
    return { data: { status: "approved", requestId, rosterEntryId, linkId }, error: null };
  } };
  const result = await decision.decideRosterAccountActivation(admin, {
    actorId, tournamentId, requestId, decision: "approve", confirmationPhrase: "ABCD-EFGH", operationId,
  });
  assert.deepEqual(result, { status: "approved", requestId, rosterEntryId, linkId });
  assert.deepEqual(calls[0], { name: "decide_roster_account_activation_v1", args: {
    p_actor_id: actorId, p_tournament_id: tournamentId, p_request_id: requestId,
    p_decision: "approve", p_confirmation_phrase: "ABCD-EFGH", p_operation_id: operationId,
  } });
});

test("activation decision refuses malformed database success responses", async () => {
  const admin = { async rpc() { return { data: { status: "approved", requestId, rosterEntryId }, error: null }; } };
  await assert.rejects(() => decision.decideRosterAccountActivation(admin, {
    actorId, tournamentId, requestId, decision: "approve", confirmationPhrase: "ABCD-EFGH", operationId,
  }), /unavailable/);
});

test("activation cancellation accepts only the exact requested cancellation", async () => {
  const admin = { async rpc(name, args) {
    assert.equal(name, "cancel_roster_account_activation_v1");
    assert.deepEqual(args, { p_actor_id: actorId, p_tournament_id: tournamentId, p_activation_id: activationId, p_operation_id: operationId });
    return { data: { status: "cancelled", activationId }, error: null };
  } };
  assert.deepEqual(await cancellation.cancelRosterAccountActivation(admin, { actorId, tournamentId, activationId, operationId }), { status: "cancelled", activationId });
});

test("activation cancellation refuses a mismatched database response", async () => {
  const admin = { async rpc() { return { data: { status: "cancelled", activationId: rosterEntryId }, error: null }; } };
  await assert.rejects(() => cancellation.cancelRosterAccountActivation(admin, { actorId, tournamentId, activationId, operationId }), /unavailable/);
});
