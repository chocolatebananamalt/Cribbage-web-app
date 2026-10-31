import assert from "node:assert/strict";
import test from "node:test";
import { isPendingPhotoCapture, listPendingPhotos, photoMatchesPending, photoRejectionIsTerminal, photoRetryKey, readPendingPhoto } from "../src/lib/paper-games/photo-retry-envelope.ts";
import { countAppSessionStorageRecords } from "../src/lib/client-session-storage.ts";
const id = "40000000-0000-4000-8000-000000000001", other = "40000000-0000-4000-8000-000000000002";
const scope = { actorId: id, tournamentId: id, gameId: id, cardSide: "a", verificationId: "A-1" };
const request = { gameId: id, cardSide: "a", verificationId: "A-1", sourceKind: "file_upload", originalFileName: "synthetic.png", declaredMediaType: "image/png", declaredByteSize: 100, declaredSha256: "a".repeat(64), clientCapturedAt: null, idempotencyKey: other };
const envelope = { version: 1, actorId: id, tournamentId: id, request };
function storage(entries) { const data = new Map(entries); return { get length() { return data.size; }, key: index => [...data.keys()][index] ?? null, getItem: key => data.get(key) ?? null }; }
test("photo envelope is exact and actor/tournament/game/side/verification bound", () => {
  assert.equal(isPendingPhotoCapture(envelope, scope), true);
  for (const changed of [{ actorId: other }, { tournamentId: other }, { gameId: other }, { cardSide: "b" }, { verificationId: "B-1" }]) assert.equal(isPendingPhotoCapture(envelope, { ...scope, ...changed }), false);
  assert.equal(isPendingPhotoCapture({ ...envelope, imageBytes: "forbidden" }, scope), false);
});
test("same image digest/size/type can recover original metadata after rename", () => {
  assert.equal(photoMatchesPending(request, { size: 100, type: "image/png", name: "renamed.png" }, "a".repeat(64)), true);
  assert.equal(photoMatchesPending(request, { size: 100, type: "image/png" }, "b".repeat(64)), false);
  assert.equal(photoMatchesPending(request, { size: 101, type: "image/png" }, "a".repeat(64)), false);
});
test("photo keys are counted by existing safe-switch prefix and isolated from score reconciliation", () => {
  const key = photoRetryKey(scope);
  assert.equal(countAppSessionStorageRecords(storage([[key, JSON.stringify(envelope)]])), 1);
  assert.equal(key.startsWith(`paper-game-completion:${id}:`), false);
});
test("retained inventory remains reachable without a current game candidate", () => {
  const retained = storage([[photoRetryKey(scope), JSON.stringify(envelope)]]);
  assert.deepEqual(listPendingPhotos(retained, id, id), [envelope]);
  assert.deepEqual(listPendingPhotos(retained, other, id), []);
  assert.deepEqual(readPendingPhoto(retained, scope), envelope);
});
test("malformed or changed-scope retained work is never silently discarded", () => {
  for (const raw of ["not-json", JSON.stringify({ ...envelope, request: { ...request, gameId: other } })]) {
    const retained = storage([[photoRetryKey(scope), raw]]);
    assert.throws(() => readPendingPhoto(retained, scope));
    assert.throws(() => listPendingPhotos(retained, id, id));
    assert.equal(countAppSessionStorageRecords(retained), 1);
  }
});
test("only post-authorization receipted capture rejections are terminal", () => {
  for (const code of ["not_capture_official", "tournament_unavailable", "idempotency_conflict", "invalid_request"]) assert.equal(photoRejectionIsTerminal({ code }), false);
  for (const code of ["verification_id_mismatch", "self_capture_denied", "capture_lifecycle_closed"]) assert.equal(photoRejectionIsTerminal({ code }), true);
});
