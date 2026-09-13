import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isPaperCardCaptureRequest,
  isPaperCardCaptureResult,
  isRejectedPaperCardCapture,
  paperCardCaptureEnabled,
} from "../src/lib/api/paper-card-capture.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const gameId = "10000000-0000-4000-8000-000000000001";
const operationId = "20000000-0000-4000-8000-000000000002";
const digest = "a".repeat(64);
const request = {
  gameId,
  cardSide: "a",
  verificationId: "A-7",
  sourceKind: "camera",
  originalFileName: "card-a-7.jpg",
  declaredMediaType: "image/jpeg",
  declaredByteSize: 123456,
  declaredSha256: digest,
  clientCapturedAt: "2026-09-10T09:15:00-10:00",
  idempotencyKey: operationId,
};

test("paper-card capture remains default-off behind one exact value", () => {
  assert.equal(paperCardCaptureEnabled({}), false);
  assert.equal(paperCardCaptureEnabled({ ACC_PAPER_CARD_CAPTURE_ENABLED: "true" }), false);
  assert.equal(paperCardCaptureEnabled({ ACC_PAPER_CARD_CAPTURE_ENABLED: "enabled" }), true);
  assert.match(read(".env.example"), /^ACC_PAPER_CARD_CAPTURE_ENABLED=disabled$/m);
});

test("paper-card capture accepts only exact bounded original metadata", () => {
  assert.equal(isPaperCardCaptureRequest(request), true);
  assert.equal(isPaperCardCaptureRequest({ ...request, clientCapturedAt: null }), true);
  assert.equal(isPaperCardCaptureRequest({ ...request, cardSide: "c" }), false);
  assert.equal(isPaperCardCaptureRequest({ ...request, verificationId: "a-7" }), false);
  assert.equal(isPaperCardCaptureRequest({ ...request, originalFileName: "../card.jpg" }), false);
  assert.equal(isPaperCardCaptureRequest({ ...request, declaredMediaType: "IMAGE/JPEG" }), false);
  assert.equal(isPaperCardCaptureRequest({ ...request, declaredByteSize: 0 }), false);
  assert.equal(isPaperCardCaptureRequest({ ...request, declaredSha256: digest.toUpperCase() }), false);
  assert.equal(isPaperCardCaptureRequest({ ...request, clientCapturedAt: "2026-09-10" }), false);
  assert.equal(isPaperCardCaptureRequest({ ...request, score: 121 }), false);
});

test("paper-card response binds the upload reference and preserves non-authority", () => {
  const result = {
    status: "paper_card_capture_created",
    captureId: "30000000-0000-4000-8000-000000000003",
    uploadIntentId: "40000000-0000-4000-8000-000000000004",
    objectReferenceId: "50000000-0000-4000-8000-000000000005",
    gameId,
    cardSide: "a",
    verificationId: "A-7",
    captureState: "upload_provider_pending",
    humanReviewState: "not_started",
    retentionState: "restricted_hold",
    originalMetadata: {
      sourceKind: "camera",
      fileName: "card-a-7.jpg",
      mediaType: "image/jpeg",
      byteSize: 123456,
      sha256: digest,
      clientCapturedAt: "2026-09-10T09:15:00-10:00",
    },
    uploadProviderConfigured: false,
    uploadAuthorized: false,
    imageStored: false,
    publicUrlCreated: false,
    ocrRequested: false,
    transcriptionCreated: false,
    scoreChanged: false,
    gameVerified: false,
  };
  assert.equal(isPaperCardCaptureResult(result, request), true);
  assert.equal(isPaperCardCaptureResult({ ...result, gameId: operationId }, request), false);
  assert.equal(isPaperCardCaptureResult({ ...result, imageStored: true }, request), false);
  assert.equal(isPaperCardCaptureResult({ ...result, uploadUrl: "https://example.invalid" }, request), false);
  assert.equal(isPaperCardCaptureResult({ ...result, originalMetadata: { ...result.originalMetadata, fileName: "other.jpg" } }, request), false);
});

test("paper-card capture exposes only controlled rejection envelopes", () => {
  assert.equal(isRejectedPaperCardCapture({ status: "rejected", code: "self_capture_denied" }), true);
  assert.equal(isRejectedPaperCardCapture({ status: "rejected", code: "verification_id_mismatch" }), true);
  assert.equal(isRejectedPaperCardCapture({ status: "rejected", code: "made_up" }), false);
  assert.equal(isRejectedPaperCardCapture({ status: "rejected", code: "game_unavailable", detail: "private" }), false);
});

test("migration creates private immutable evidence without storage or scoring authority", () => {
  const sql = read("database/migrations/0109_paper_card_capture_foundation.sql");
  for (const table of ["paper_card_captures", "paper_card_upload_intents", "paper_card_capture_conflicts"]) {
    assert.match(sql, new RegExp(`create table app\\.${table}`));
    assert.match(sql, new RegExp(`alter table app\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`alter table app\\.${table} force row level security`));
    assert.match(sql, new RegExp(`revoke all on table app\\.${table} from public, anon, authenticated`));
    assert.match(sql, new RegExp(`${table}_immutable`));
  }
  assert.match(sql, /create or replace function public\.create_paper_card_capture_v1/);
  assert.match(sql, /create or replace function app\.assert_paper_card_capture_identity/);
  assert.match(sql, /paper_card_captures_identity_guard/);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /r\.role = 'cross_checker'/);
  assert.match(sql, /p_actor_id in \(v_participant_profile_id, v_opponent_profile_id\)/);
  assert.match(sql, /join app\.initial_seating_assignments seating/);
  assert.match(sql, /v_verification_id <> p_verification_id/);
  assert.match(sql, /'restricted_hold'/);
  assert.match(sql, /'upload_provider_pending'/);
  assert.match(sql, /'not_requested'/);
  assert.match(sql, /'publicUrlCreated', false/);
  assert.match(sql, /insert into app\.operation_receipts/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /insert into app\.paper_card_capture_conflicts/);
  assert.match(sql, /return v_existing\.response_payload/);
  assert.match(sql, /from public, anon, authenticated;\s+grant execute[\s\S]*to service_role;/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/);
  assert.doesNotMatch(sql, /insert into (storage\.objects|app\.(score_submissions|score_confirmations|card_scorelines|canonical_games|result_versions))/);
  assert.doesNotMatch(sql, /update app\.(canonical_games|card_scorelines|events|result_versions)/);
  assert.doesNotMatch(sql, /public_url|signed_url|expires_at|purge_at|delete_after/);
});

test("paper-card route is gated, subject-bound, same-origin, and server-only", () => {
  const route = read("src/app/api/v1/tournaments/[id]/paper-card-captures/route.ts");
  assert.match(route, /paperCardCaptureEnabled\(\)/);
  assert.match(route, /error: "not_found"[\s\S]*status: 404/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /readSmallJson/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(route, /create_paper_card_capture_v1/);
  assert.match(route, /p_actor_id: subject/);
  assert.match(route, /p_game_id: body\.gameId/);
  assert.match(route, /p_verification_id: body\.verificationId/);
  assert.match(route, /isPaperCardCaptureResult/);
  assert.match(route, /isRejectedPaperCardCapture/);
  assert.match(route, /withApiFailureBoundary/);
  assert.doesNotMatch(route, /\.storage\.|createSignedUploadUrl|\.from\(|\.insert\(|\.update\(/);
});
