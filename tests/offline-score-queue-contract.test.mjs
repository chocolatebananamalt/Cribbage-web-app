import test from "node:test";
import assert from "node:assert/strict";
import { canonicalOfflineSubmissionPayload, canDeleteOfflineQueueRecord, canQueueOfflineIntent, isOfflineQueueIntent, isOfflineQueueRecord, isOfflineReplayReceipt, isOfflineSubmissionCapability } from "../src/lib/offline-score-queue-contract.ts";

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

test("canonical submission signing material is stable and excludes digest and signature", () => {
  const unsigned = { ...submission };
  delete unsigned.payloadDigest;
  delete unsigned.signature;
  const first = canonicalOfflineSubmissionPayload(unsigned);
  const second = canonicalOfflineSubmissionPayload({ ...unsigned });
  assert.equal(first, second);
  assert.doesNotMatch(first, /payloadDigest|signature|playerName|accessToken/);
  assert.match(first, /"margin":31/);
});

test("capabilities and receipts require exact minimal response shapes", () => {
  const capability = { status: "issued", version: 1, capabilityId: "capability-1", deviceKeyId: "device-1", verifiedActorId: "actor-1", sessionBindingId: "session-1", tournamentId: "tournament-1", eventId: "event-1", gameId: "game-1", assignedSide: "a", submissionSlot: 1, expectedGameVersion: 3, capabilityExpiresAtMs: 1000 };
  assert.equal(isOfflineSubmissionCapability(capability), true);
  assert.equal(isOfflineSubmissionCapability({ ...capability, accessToken: "forbidden" }), false);
  const receipt = { version: 1, queueId: "queue-1", clientOperationId: "operation-1", kind: "submission", gameId: "game-1", submissionId: "submission-1", payloadDigest: digest, disposition: "accepted" };
  assert.equal(isOfflineReplayReceipt(receipt), true);
  assert.equal(isOfflineReplayReceipt({ ...receipt, score: { status: "submitted" } }), false);
});

test("offline replay schema is private, immutable, and exposes only least-privilege RPCs", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(new URL("../database/migrations/0122_offline_submission_replay_foundation.sql", import.meta.url), "utf8");
  for (const table of ["offline_device_keys", "offline_score_capabilities", "offline_score_replay_receipts", "offline_score_replay_conflicts"]) {
    assert.match(sql, new RegExp(`create table app\\.${table}`));
    assert.match(sql, new RegExp(`alter table app\\.${table} force row level security`));
  }
  assert.match(sql, /event_schedule_games/);
  assert.match(sql, /coalesce\(auth\.role\(\),''\) <> 'service_role'/);
  assert.match(sql, /public_jwk - 'kty' - 'crv' - 'x' - 'y' - 'ext' - 'key_ops'/);
  assert.match(sql, /state in \('pending','submitted'\)/);
  assert.match(sql, /version not between p_expected_game_version and p_expected_game_version\+1/);
  assert.match(sql, /unique \(actor_profile_id, session_binding_id, canonical_game_id, operation_kind\)/);
  assert.match(sql, /unique \(capability_id\)/);
  assert.match(sql, /grant execute on function public\.issue_offline_submission_capability_v1[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.issue_offline_submission_capability_v1[\s\S]*to authenticated/);
  assert.match(sql, /record_offline_submission_rejection_v1/);
  assert.match(sql, /actor_profile_id=p_actor_id and client_operation_id=p_client_operation_id/);
  assert.match(sql, /grant execute on function public\.replay_offline_submission_v1[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.replay_offline_submission_v1[\s\S]*to authenticated/);
});

test("offline routes are same-origin, claim-bound, signed, bounded, and keep the secret client server-only", async () => {
  const { readFile } = await import("node:fs/promises");
  const capability = await readFile(new URL("../src/app/api/v1/games/[id]/offline-capability/route.ts", import.meta.url), "utf8");
  const replay = await readFile(new URL("../src/app/api/v1/offline-score-replay/route.ts", import.meta.url), "utf8");
  for (const route of [capability, replay]) { assert.match(route, /isSameOriginRequest/); assert.match(route, /readSmallJson/); assert.match(route, /apiJson/); }
  assert.match(capability, /requireVerifiedIdentity/);
  assert.match(capability, /createServerOnlyAdminClient/);
  assert.match(replay, /requireVerifiedIdentity/);
  assert.match(replay, /crypto\.subtle\.verify/);
  assert.match(replay, /createServerOnlyAdminClient/);
  assert.match(replay, /session_mismatch/);
});
