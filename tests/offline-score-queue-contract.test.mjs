import test from "node:test";
import assert from "node:assert/strict";
import { canDeleteOfflineQueueRecord, canQueueOfflineIntent, isOfflineQueueIntent, isOfflineQueueRecord } from "../src/lib/offline-score-queue-contract.ts";

const digest = "a".repeat(64);
const submission = {
  version: 1, queueId: "queue-1", createdAtMs: 100, clientOperationId: "operation-1",
  verifiedActorId: "actor-1", sessionBindingId: "session-1", deviceKeyId: "device-key-1",
  tournamentId: "tournament-1", eventId: "event-1", gameId: "game-1", assignedSide: "a",
  expectedGameVersion: 3, capabilityId: "capability-1", capabilityExpiresAtMs: 1000,
  payloadDigest: digest, signature: "non-exportable-key-signature", kind: "submission",
  submissionId: "submission-1", submissionSlot: 1, winnerSide: "a", margin: 31,
};

test("offline queue intent has an exact, minimal immutable shape and no local verified state", () => {
  assert.equal(isOfflineQueueIntent(submission), true);
  assert.equal(isOfflineQueueIntent({ ...submission, playerName: "must not persist" }), false);
  assert.equal(isOfflineQueueIntent({ ...submission, margin: 122 }), false);
  assert.equal(isOfflineQueueRecord({ intent: submission, state: "Queued" }), true);
  assert.equal(isOfflineQueueRecord({ intent: submission, state: "Verified" }), false);
});

test("offline confirmation requires the server-issued matching challenge and an unexpired capability", () => {
  const confirmation = { ...submission, kind: "confirmation", matchedResultChallengeFingerprint: "b".repeat(64) };
  delete confirmation.submissionSlot; delete confirmation.winnerSide; delete confirmation.margin;
  assert.equal(isOfflineQueueIntent(confirmation), true);
  assert.equal(canQueueOfflineIntent(confirmation, 999), true);
  assert.equal(canQueueOfflineIntent(confirmation, 1000), false);
  assert.equal(isOfflineQueueIntent({ ...confirmation, matchedResultChallengeFingerprint: "client-only" }), false);
});

test("a queue record can only be deleted by an exact bound terminal receipt", () => {
  const record = { intent: submission, state: "PendingSync" };
  const receipt = { version: 1, queueId: "queue-1", clientOperationId: "operation-1", kind: "submission", gameId: "game-1", submissionId: "submission-1", payloadDigest: digest, disposition: "accepted" };
  assert.equal(canDeleteOfflineQueueRecord(record, receipt), true);
  assert.equal(canDeleteOfflineQueueRecord(record, { ...receipt, gameId: "other-game" }), false);
  assert.equal(canDeleteOfflineQueueRecord(record, { ...receipt, accessToken: "must not appear" }), false);
  assert.equal(canDeleteOfflineQueueRecord(record, { ...receipt, disposition: "verified" }), false);
});
