import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isAcceptedDeviceRecovery,
  isAcceptedDeviceRecoveryReview,
  isCreateDeviceRecoveryRequest,
  isRejectedDeviceRecovery,
  isReviewDeviceRecoveryRequest,
} from "../src/lib/api/device-failure-recovery.ts";

const recoveryId = "10000000-0000-4000-8000-000000000001";
const gameId = "20000000-0000-4000-8000-000000000002";
const operationId = "30000000-0000-4000-8000-000000000003";
const request = {
  recoveryId,
  gameId,
  winnerSide: "a",
  margin: 45,
  evidence: [{ sourceType: "opponent_device", sourceReference: "opponent receipt 19", winnerSide: "a", margin: 45 }],
  idempotencyKey: operationId,
};

test("device recovery request accepts only bounded explicit evidence", () => {
  assert.equal(isCreateDeviceRecoveryRequest(request), true);
  assert.equal(isCreateDeviceRecoveryRequest({ ...request, margin: 0 }), false);
  assert.equal(isCreateDeviceRecoveryRequest({ ...request, evidence: [] }), false);
  assert.equal(isCreateDeviceRecoveryRequest({ ...request, evidence: [{ ...request.evidence[0], sourceReference: "" }] }), false);
  assert.equal(isCreateDeviceRecoveryRequest({ ...request, evidence: [request.evidence[0], request.evidence[0]] }), false);
  assert.equal(isCreateDeviceRecoveryRequest({ ...request, evidence: [{ ...request.evidence[0], score: 2 }] }), false);
});

test("device recovery responses preserve independent non-player authority", () => {
  const pending = { status: "pending_review", recoveryId, gameId, winnerSide: "a", margin: 45, evidenceCount: 1, authoritative: false, playerSubmissionsCreated: false, playerConfirmationsCreated: false };
  assert.equal(isAcceptedDeviceRecovery(pending, request), true);
  assert.equal(isAcceptedDeviceRecovery({ ...pending, authoritative: true }, request), false);
  assert.equal(isAcceptedDeviceRecovery({ ...pending, playerSubmissionsCreated: true }, request), false);
  assert.equal(isAcceptedDeviceRecoveryReview({ status: "approved", decision: "approve", recoveryId, gameId, authoritative: true, playerSubmissionsCreated: false, playerConfirmationsCreated: false }, recoveryId, "approve"), true);
  assert.equal(isAcceptedDeviceRecoveryReview({ status: "approved", decision: "approve", recoveryId, gameId, authoritative: true, playerSubmissionsCreated: true, playerConfirmationsCreated: false }, recoveryId, "approve"), false);
  assert.equal(isReviewDeviceRecoveryRequest({ decision: "reject", idempotencyKey: operationId }), true);
  assert.equal(isReviewDeviceRecoveryRequest({ decision: "approve", idempotencyKey: "bad" }), false);
  assert.equal(isRejectedDeviceRecovery({ status: "rejected", code: "self_recovery_denied", recoveryId }, recoveryId), true);
  assert.equal(isRejectedDeviceRecovery({ status: "rejected", code: "evidence_disputed", recoveryId }, recoveryId, true), true);
});

test("recovery workspace validates candidates, surviving claims, and disputed reviews", () => {
  const source = readFileSync(new URL("../src/lib/recovery/device-failure-workspace.ts", import.meta.url), "utf8");
  assert.match(source, /\["director", "co_director", "cross_checker"\]\.includes\(data\.actorRole/);
  assert.match(source, /\["pending", "submitted", "mismatch", "confirmation_pending"\]\.includes\(item\.gameState/);
  assert.match(source, /\["pending_review", "disputed"\]\.includes\(item\.state/);
  assert.match(source, /item\.survivingClaims\.every\(isRecoveryEvidence\)/);
  assert.match(source, /item\.evidence\.every\(isRecoveryEvidence\)/);
});

test("migration preserves immutable evidence and projects only independently approved recovery", () => {
  const sql = readFileSync(new URL("../database/migrations/0129_device_failure_recovery.sql", import.meta.url), "utf8").toLowerCase();
  for (const table of ["device_failure_recoveries", "device_failure_recovery_evidence", "device_failure_recovery_state_events", "device_failure_recovery_projections"]) {
    assert.match(sql, new RegExp(`create table app\\.${table}`));
    assert.match(sql, new RegExp(`${table}_immutable`));
  }
  assert.match(sql, /source_type text not null check \(source_type in \('opponent_device', 'paper_card'\)\)/);
  assert.match(sql, /reporter_role text not null check \(reporter_role = 'cross_checker'\)/);
  assert.match(sql, /p_actor_id = v_recovery\.reporter_profile_id/);
  assert.match(sql, /participant identity unresolved/);
  assert.match(sql, /participant_identity_unresolved/);
  assert.match(sql, /v_side_a_profile_id is null or v_side_b_profile_id is null/);
  assert.match(sql, /independent reviewer required/);
  assert.match(sql, /disputed evidence cannot approve/);
  assert.match(sql, /playersubmissionscreated', false/);
  assert.match(sql, /playerconfirmationscreated', false/);
  assert.match(sql, /current_effective_scorelines/);
  assert.match(sql, /device_recovery_is_approved/);
  assert.match(sql, /approved device recovery blocks fabricated or duplicate game history/);
  assert.match(sql, /before_totals/);
  assert.match(sql, /after_totals/);
  assert.match(sql, /revoke all on function public\.create_device_failure_recovery_v1[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant (select|insert|update|delete|all) on table/i);
});

test("protected recovery routes enforce same-origin, verified identity, and server-only RPC execution", () => {
  const createRoute = readFileSync(new URL("../src/app/api/v1/tournaments/[id]/device-recoveries/route.ts", import.meta.url), "utf8");
  const reviewRoute = readFileSync(new URL("../src/app/api/v1/device-recoveries/[id]/reviews/route.ts", import.meta.url), "utf8");
  for (const source of [createRoute, reviewRoute]) {
    assert.match(source, /isSameOriginRequest\(request\)/);
    assert.match(source, /readSmallJson\(request\)/);
    assert.match(source, /requireVerifiedSubject\(await createClient\(\)\)/);
    assert.match(source, /createServerOnlyAdminClient\(\)\.rpc/);
  }
  const page = readFileSync(new URL("../src/app/tournament/[tournamentId]/recoveries/page.tsx", import.meta.url), "utf8");
  assert.match(page, /\["director", "co_director", "cross_checker"\]\.includes\(access\.role\).*notFound/s);
  assert.match(page, /different eligible official must approve/i);
});

test("recovery browser preserves proposal and review identities across interrupted requests", () => {
  const client = readFileSync(new URL("../src/app/tournament/[tournamentId]/recoveries/recovery-client.tsx", import.meta.url), "utf8");
  assert.match(client, /device-recovery:proposal:\$\{actorId\}:\$\{item\.gameId\}/);
  assert.match(client, /device-recovery:review:\$\{actorId\}:\$\{item\.recoveryId\}/);
  assert.match(client, /window\.sessionStorage\.setItem/);
  assert.match(client, /Retry sends the exact same protected request/);
  assert.match(client, /Retry sends the exact same protected decision/);
});

test("a non cross-checker is told why the recovery screen is empty", () => {
  const client = readFileSync("src/app/tournament/[tournamentId]/recoveries/recovery-client.tsx", "utf8");
  // Proposing a recovery is a cross-checker action. A director reaching this
  // page from the hub saw the explanation of what recovery is and then nothing,
  // which reads as a broken screen rather than as a role they do not hold.
  assert.match(client, /Only an assigned cross-checker can start a recovery/);
  assert.match(client, /Add one under Tournament officials on the Set Up Tournament screen/);
  const note = client.indexOf("Only an assigned cross-checker can start a recovery");
  const gate = client.indexOf('actorRole === "cross_checker" ? <>');
  assert.ok(note > -1 && gate > -1 && note < gate, "the note must render before the gated section");
});
