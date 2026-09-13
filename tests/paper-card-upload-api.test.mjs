import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { isPaperCardUploadCompletion, isPaperCardUploadMetadata, isPaperCardUploadRequest } from "../src/lib/api/paper-card-upload.ts";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";

test("paper-card upload contracts reject altered and oversized metadata", () => {
  assert.equal(isPaperCardUploadRequest({ uploadIntentId: id, objectReferenceId: other }), true);
  assert.equal(isPaperCardUploadRequest({ uploadIntentId: id, objectReferenceId: other, path: "injected" }), false);
  const metadata = { captureId: id, uploadIntentId: other, objectReferenceId: id, objectPath: `${id}/${other}.jpg`, mediaType: "image/jpeg", byteSize: 10, sha256: "a".repeat(64), retentionState: "restricted_hold" };
  assert.equal(isPaperCardUploadMetadata(metadata), true);
  assert.equal(isPaperCardUploadMetadata({ ...metadata, objectPath: "../secret.jpg" }), false);
  assert.equal(isPaperCardUploadMetadata({ ...metadata, byteSize: 10 * 1024 * 1024 + 1 }), false);
});

test("stored image remains non-authoritative and requires later OCR/human review", () => {
  const result = { status: "image_stored", captureId: id, storageReceiptId: other, retentionState: "restricted_hold", ocrRequested: false, scoreChanged: false, gameVerified: false };
  assert.equal(isPaperCardUploadCompletion(result, id), true);
  assert.equal(isPaperCardUploadCompletion({ ...result, gameVerified: true }, id), false);
});

test("upload routes are same-origin, session-verified, RPC-scoped boundaries", () => {
  for (const part of ["upload", "complete"]) {
    const route = fs.readFileSync(new URL(`../src/app/api/v1/tournaments/[id]/paper-card-captures/[captureId]/${part}/route.ts`, import.meta.url), "utf8");
    assert.match(route, /isSameOriginRequest/);
    assert.match(route, /requireVerifiedSubject/);
    assert.doesNotMatch(route, /\.from\(/);
  }
});
