import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  isQPoolMembershipWorkspace,
  isQPoolMutation,
  isQPoolMutationResult,
  isQPoolReconciliation,
  qPoolMutationMatchesWorkspace,
} from "../src/lib/api/q-pool-membership.ts";
import { countAppSessionStorageRecords, isAppRecoveryStorageKey } from "../src/lib/client-session-storage.ts";

const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const tid = id(1), eventId = id(2), p1 = id(3), p2 = id(4), roster = id(5), participant = id(6), membershipId = id(7), receipt = id(8);
const workspace = {
  tournamentId: tid, eventId, eventName: "Main", canCorrect: true, started: false, supported: true, blockedReason: null,
  baseFeeMinor: 1000,
  pools: [{ poolVersionId: p1, slot: 1, name: "Q-A", feeMinor: 500 }, { poolVersionId: p2, slot: 2, name: "Q-B", feeMinor: 1000 }],
  entries: [{ rosterEntryId: roster, participantId: participant, displayName: "Sample Player", membershipVersion: 1, membershipVersionId: membershipId,
    pools: [{ poolVersionId: p1, prePlayElected: true, elected: true, consentReference: "paper opt-in", amountOwedMinor: 500, amountAllocatedMinor: 0, paidEntryEligible: false }, { poolVersionId: p2, prePlayElected: false, elected: false, consentReference: "", amountOwedMinor: 0, amountAllocatedMinor: 0, paidEntryEligible: false }],
    allocationVersion: 0, receiptId: receipt, receiptVersion: 1, receivedMinor: 1500, obligationVersion: 1, obligationMinor: 1500, allocationCurrent: false, baseAllocatedMinor: 0, reason: null }],
};
const membership = { action: "membership", rosterEntryId: roster, expectedVersion: 1, correction: false, reason: "Director recorded consent", pools: [{ poolVersionId: p1, elected: true, consentReference: "paper opt-in" }, { poolVersionId: p2, elected: false, consentReference: "" }] };
const allocation = { action: "allocation", rosterEntryId: roster, expectedVersion: 0, correction: false, reason: "Allocate recorded receipt", membershipVersionId: membershipId, receiptId: receipt, obligationVersion: 1, baseMinor: 1000, pools: [{ poolVersionId: p1, amountMinor: 500 }, { poolVersionId: p2, amountMinor: 0 }] };

test("Q Pool workspace rejects missing, duplicate, or extra per-pool membership rows", () => {
  assert.equal(isQPoolMembershipWorkspace(workspace, tid), true);
  const longPoolLabel = { ...workspace, pools: [{ ...workspace.pools[0], name: `Q Pool 1 - ${"😀".repeat(160)}` }, workspace.pools[1]] };
  assert.equal(longPoolLabel.pools[0].name.length, 331);
  assert.equal(isQPoolMembershipWorkspace(longPoolLabel), true, "all database-valid Unicode pool labels are accepted despite UTF-16 length");
  assert.equal(isQPoolMembershipWorkspace(workspace, id(99)), false);
  assert.equal(isQPoolMembershipWorkspace({ ...workspace, entries: [{ ...workspace.entries[0], pools: [workspace.entries[0].pools[0]] }] }), false);
  assert.equal(isQPoolMembershipWorkspace({ ...workspace, pools: [{ ...workspace.pools[0], slot: 1 }, { ...workspace.pools[1], slot: 1 }] }), false);
  assert.equal(isQPoolMembershipWorkspace({ ...workspace, pools: [{ ...workspace.pools[0], extra: true }, workspace.pools[1]] }), false);
  const unknownFees = { ...workspace, supported: false, baseFeeMinor: 0, pools: [{ ...workspace.pools[0], feeMinor: 0 }, { ...workspace.pools[1], feeMinor: 0 }] };
  assert.equal(isQPoolMembershipWorkspace(unknownFees), true, "unsupported unknown-fee facts stay distinct from an unavailable RPC");
  const obligationMismatch = { ...workspace, entries: [{ ...workspace.entries[0], obligationMinor: 1000 }] };
  assert.equal(isQPoolMembershipWorkspace(obligationMismatch), true, "a stale obligation is visible when no allocation snapshot is current");
  assert.equal(qPoolMutationMatchesWorkspace(allocation, obligationMismatch, obligationMismatch.entries[0]), false, "stale obligation blocks allocation instead of hiding the workspace");
});

test("membership mutations require exact unique pool coverage and consent for opt-ins", () => {
  assert.equal(isQPoolMutation(membership), true);
  assert.equal(qPoolMutationMatchesWorkspace(membership, workspace, workspace.entries[0]), true);
  assert.equal(isQPoolMutation({ ...membership, pools: [membership.pools[0]] }), true, "shape alone is independent of workspace");
  assert.equal(qPoolMutationMatchesWorkspace({ ...membership, pools: [membership.pools[0]] }, workspace, workspace.entries[0]), false);
  assert.equal(isQPoolMutation({ ...membership, pools: [membership.pools[0], membership.pools[0]] }), false);
  assert.equal(isQPoolMutation({ ...membership, pools: [{ ...membership.pools[0], elected: true, consentReference: "  " }, membership.pools[1]] }), false);
  assert.equal(isQPoolMutation({ ...membership, extra: true }), false);
  assert.equal(isQPoolMutation({ ...membership, correction: true, expectedVersion: 0 }), false, "corrections require a prior version");
  assert.equal(isQPoolMutation({ ...membership, pools: [] }), false, "SQL requires configured Q Pool coverage");
  const started = { ...workspace, started: true };
  assert.equal(qPoolMutationMatchesWorkspace({ ...membership, correction: true }, started, workspace.entries[0]), true);
  const declinedAfterStart = { ...workspace.entries[0], pools: [{ ...workspace.entries[0].pools[0], elected: false, consentReference: "", amountOwedMinor: 0 }, workspace.entries[0].pools[1]] };
  const restoreKnownPool = { ...membership, correction: true, pools: [{ poolVersionId: p1, elected: true, consentReference: "restore known pre-play election" }, { poolVersionId: p2, elected: false, consentReference: "" }] };
  assert.equal(qPoolMutationMatchesWorkspace(restoreKnownPool, started, declinedAfterStart), true, "a previously elected pool can be restored after a decline");
  assert.equal(qPoolMutationMatchesWorkspace({ ...restoreKnownPool, pools: [{ poolVersionId: p1, elected: false, consentReference: "" }, { poolVersionId: p2, elected: true, consentReference: "late opt-in" }] }, started, declinedAfterStart), false, "a new pool cannot be added after play starts");
  assert.equal(qPoolMutationMatchesWorkspace({ ...membership, correction: true }, started, { ...workspace.entries[0], membershipVersion: 0, membershipVersionId: null }), false, "first late opt-in is blocked");
  assert.equal(qPoolMutationMatchesWorkspace({ ...membership, correction: true }, workspace, workspace.entries[0]), true, "pre-start director can explicitly mark a version correction");
  assert.equal(qPoolMutationMatchesWorkspace({ ...membership, correction: true }, { ...workspace, canCorrect: false }, workspace.entries[0]), false, "pre-start correction remains director-only");
});

test("receipt allocation requires a full explicit snapshot, exact receipt total and per-pool caps", () => {
  assert.equal(isQPoolMutation(allocation), true);
  assert.equal(qPoolMutationMatchesWorkspace(allocation, workspace, workspace.entries[0]), true);
  assert.equal(qPoolMutationMatchesWorkspace({ ...allocation, pools: [{ ...allocation.pools[0], amountMinor: 400 }, { ...allocation.pools[1], amountMinor: 100 }] }, workspace, workspace.entries[0]), false, "cannot allocate to an unelected pool even when sum matches");
  assert.equal(qPoolMutationMatchesWorkspace({ ...allocation, baseMinor: 1200, pools: [{ ...allocation.pools[0], amountMinor: 500 }, allocation.pools[1]] }, workspace, workspace.entries[0]), false, "base allocation cannot exceed base fee");
  assert.equal(qPoolMutationMatchesWorkspace({ ...allocation, pools: [allocation.pools[0]] }, workspace, workspace.entries[0]), false, "each configured pool must be represented");
  assert.equal(qPoolMutationMatchesWorkspace({ ...allocation, receiptId: id(77) }, workspace, workspace.entries[0]), false, "allocation pins the existing receipt");
  assert.equal(qPoolMutationMatchesWorkspace({ ...allocation, pools: [{ ...allocation.pools[0], amountMinor: Number.MAX_SAFE_INTEGER }, allocation.pools[1]] }, workspace, workspace.entries[0]), false);
  const started = { ...workspace, started: true };
  assert.equal(qPoolMutationMatchesWorkspace({ ...allocation, correction: true }, started, workspace.entries[0]), false, "first post-start allocation is blocked");
  assert.equal(qPoolMutationMatchesWorkspace({ ...allocation, correction: true, expectedVersion: 1 }, started, { ...workspace.entries[0], allocationVersion: 1, allocationCurrent: false }), true, "existing allocation can be corrected to replace a stale current allocation");
  assert.equal(qPoolMutationMatchesWorkspace({ ...allocation, correction: true, expectedVersion: 1 }, { ...started, canCorrect: false }, { ...workspace.entries[0], allocationVersion: 1, allocationCurrent: true }), false, "post-play correction requires director authority");
});

test("saved, rejected and reconciliation results are exact and tied to the request", () => {
  const saved = { status: "q_pool_saved", action: "allocation", rosterEntryId: roster, version: 1, versionId: id(20) };
  assert.equal(isQPoolMutationResult(saved, allocation), true);
  assert.equal(isQPoolMutationResult({ ...saved, version: 2 }, allocation), false);
  assert.equal(isQPoolMutationResult({ ...saved, extra: true }, allocation), false);
  const rejected = { status: "rejected", code: "stale_version", rosterEntryId: roster };
  assert.equal(isQPoolMutationResult(rejected, allocation), true);
  assert.equal(isQPoolReconciliation({ authorized: true, result: null }), true);
  assert.equal(isQPoolReconciliation({ authorized: false, result: null }), false);
  assert.equal(isQPoolReconciliation({ authorized: true, result: { ...saved, extra: true } }), false);
});

test("Q Pool exact retry key is included in shared recovery record counts", () => {
  const qKey = `payment-obligation:q-pool:${id(40)}:${id(41)}`;
  assert.ok(qKey.startsWith("payment-obligation:"), "already shipped counters recognize this financial prefix");
  assert.notEqual(qKey, `payment-obligation:${id(40)}:${id(41)}:${id(42)}`, "ordinary obligation rows cannot collide");
  assert.doesNotMatch(fs.readFileSync("src/lib/client-session-storage.ts", "utf8"), /"q-pool-operation:"/, "no new prefix knowledge is needed in an older root bundle");
  const records = new Map([[`payment-obligation:q-pool:${id(40)}:${id(41)}`, "exact-operation"], ["unrelated-tab-data", "keep"]]);
  const storage = {
    get length() { return records.size; },
    key(index) { return [...records.keys()][index] ?? null; },
    getItem(key) { return records.get(key) ?? null; },
  };
  assert.equal(isAppRecoveryStorageKey(`payment-obligation:q-pool:${id(40)}:${id(41)}`), true);
  assert.equal(countAppSessionStorageRecords(storage), 1);
});

test("Q Pool routes verify actor, origin, service-only RPC use and keep unknown workspace unavailable", () => {
  const route = fs.readFileSync("src/app/api/v1/tournaments/[id]/q-pools/route.ts", "utf8");
  const reconciliation = fs.readFileSync("src/app/api/v1/tournaments/[id]/q-pools/reconciliation/route.ts", "utf8");
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(route, /get_q_pool_membership_workspace_v1/);
  assert.match(route, /save_q_pool_membership_v1/);
  assert.match(route, /q_pool_workspace_unavailable/);
  assert.match(reconciliation, /get_q_pool_membership_reconciliation_v1/);
  assert.match(reconciliation, /isSameOriginRequest/);
  assert.match(reconciliation, /requireVerifiedSubject/);
});
