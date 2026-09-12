import { NextRequest } from "next/server";
import { apiJson, readSmallJson, requireVerifiedIdentity, withApiFailureBoundary } from "../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../lib/api/same-origin";
import {
  canonicalOfflineSubmissionPayload,
  isOfflineQueueIntent,
  type OfflineReplayReceipt,
  type OfflineSubmissionIntent,
  type UnsignedOfflineSubmission,
} from "../../../../lib/offline-score-queue-contract";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import { createClient } from "../../../../lib/supabase/server";

function base64UrlBytes(value: string) {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(value)) throw new Error("invalid_signature");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

function unsigned(intent: OfflineSubmissionIntent): UnsignedOfflineSubmission {
  return {
    version: intent.version, queueId: intent.queueId, createdAtMs: intent.createdAtMs,
    clientOperationId: intent.clientOperationId, verifiedActorId: intent.verifiedActorId,
    sessionBindingId: intent.sessionBindingId, deviceKeyId: intent.deviceKeyId,
    tournamentId: intent.tournamentId, eventId: intent.eventId, gameId: intent.gameId,
    assignedSide: intent.assignedSide, expectedGameVersion: intent.expectedGameVersion,
    capabilityId: intent.capabilityId, capabilityExpiresAtMs: intent.capabilityExpiresAtMs,
    kind: "submission", submissionId: intent.submissionId, submissionSlot: intent.submissionSlot,
    winnerSide: intent.winnerSide, margin: intent.margin,
  };
}

function hex(bytes: Uint8Array) { return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(""); }

async function verifyIntent(intent: OfflineSubmissionIntent, publicJwk: JsonWebKey) {
  const bytes = new TextEncoder().encode(canonicalOfflineSubmissionPayload(unsigned(intent)));
  const digest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
  if (digest !== intent.payloadDigest) return false;
  const key = await crypto.subtle.importKey("jwk", publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, base64UrlBytes(intent.signature), bytes);
}

export async function POST(request: NextRequest) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const raw = await readSmallJson(request);
    if (!isOfflineQueueIntent(raw) || raw.kind !== "submission") return apiJson({ error: "invalid_offline_submission" }, { status: 400 });
    const supabase = await createClient();
    const identity = await requireVerifiedIdentity(supabase);
    if (!identity) return apiJson({ error: "unauthorized" }, { status: 401 });
    if (raw.verifiedActorId !== identity.subject) return apiJson({ error: "actor_mismatch" }, { status: 401 });
    // A fresh magic-link session for the same actor may replay the immutable
    // device-signed queue. The original session remains part of the signed
    // payload and capability lookup; a different actor is always rejected.
    const replaySessionId = raw.sessionBindingId;
    const admin = createServerOnlyAdminClient();
    const capabilityRead = await admin.rpc("get_offline_submission_capability_v1", {
      p_actor_id: identity.subject, p_session_binding_id: replaySessionId, p_capability_id: raw.capabilityId, p_queue_id: raw.queueId,
    });
    const recordRejection = async (reasonCode: "capability_unavailable" | "scope_mismatch" | "invalid_signature") => {
      const recorded = await admin.rpc("record_offline_submission_rejection_v1", {
        p_actor_id: identity.subject, p_session_binding_id: replaySessionId,
        p_queue_id: raw.queueId, p_client_operation_id: raw.clientOperationId,
        p_device_key_id: raw.deviceKeyId, p_tournament_id: raw.tournamentId,
        p_event_id: raw.eventId, p_game_id: raw.gameId, p_submission_id: raw.submissionId,
        p_payload_digest: raw.payloadDigest, p_signature: raw.signature, p_reason_code: reasonCode,
      });
      if (recorded.error || !recorded.data || typeof recorded.data !== "object") return apiJson({ error: "operation_unavailable" }, { status: 503 });
      if ((recorded.data as Record<string, unknown>).status === "rate_limited") return apiJson({ error: "rate_limited" }, { status: 429 });
      return apiJson(recorded.data, { status: 409 });
    };
    if (capabilityRead.error || !capabilityRead.data || typeof capabilityRead.data !== "object") return recordRejection("capability_unavailable");
    const capability = capabilityRead.data as Record<string, unknown>;
    const matches = capability.capabilityId === raw.capabilityId && capability.deviceKeyId === raw.deviceKeyId
      && capability.verifiedActorId === raw.verifiedActorId && capability.sessionBindingId === raw.sessionBindingId
      && capability.tournamentId === raw.tournamentId && capability.eventId === raw.eventId
      && capability.gameId === raw.gameId && capability.assignedSide === raw.assignedSide
      && capability.submissionSlot === raw.submissionSlot && capability.expectedGameVersion === raw.expectedGameVersion
      && capability.capabilityExpiresAtMs === raw.capabilityExpiresAtMs;
    if (!matches || !capability.publicJwk || typeof capability.publicJwk !== "object") return recordRejection("scope_mismatch");
    if (!await verifyIntent(raw, capability.publicJwk as JsonWebKey)) return recordRejection("invalid_signature");
    if (capability.priorReceipt && typeof capability.priorReceipt === "object") {
      const prior = capability.priorReceipt as Record<string, unknown>;
      if (prior.queueId === raw.queueId && prior.clientOperationId === raw.clientOperationId
        && prior.submissionId === raw.submissionId && prior.payloadDigest === raw.payloadDigest
        && prior.signature === raw.signature && prior.response && typeof prior.response === "object") {
        const stored = prior.response as Record<string, unknown>;
        const disposition = stored.disposition as OfflineReplayReceipt["disposition"];
        if (["accepted", "rejected", "quarantined", "conflict"].includes(disposition)) {
          const receipt: OfflineReplayReceipt = { version: 1, queueId: raw.queueId, clientOperationId: raw.clientOperationId,
            kind: "submission", gameId: raw.gameId, submissionId: raw.submissionId,
            payloadDigest: raw.payloadDigest, disposition };
          return apiJson(receipt, { status: disposition === "accepted" ? 200 : 409 });
        }
      }
    }
    const { data, error } = await admin.rpc("replay_offline_submission_v1", {
      p_actor_id: identity.subject, p_session_binding_id: replaySessionId,
      p_queue_id: raw.queueId, p_client_operation_id: raw.clientOperationId,
      p_capability_id: raw.capabilityId, p_device_key_id: raw.deviceKeyId,
      p_tournament_id: raw.tournamentId, p_event_id: raw.eventId, p_game_id: raw.gameId,
      p_assigned_side: raw.assignedSide, p_expected_game_version: raw.expectedGameVersion,
      p_submission_id: raw.submissionId, p_submission_slot: raw.submissionSlot,
      p_winner_side: raw.winnerSide, p_margin: raw.margin,
      p_payload_digest: raw.payloadDigest, p_signature: raw.signature,
    });
    if (error || !data || typeof data !== "object") return apiJson({ error: "operation_unavailable" }, { status: 503 });
    const result = data as Record<string, unknown>;
    const disposition = result.disposition;
    if (!["accepted", "rejected", "quarantined", "conflict"].includes(disposition as string)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    const receipt: OfflineReplayReceipt = { version: 1, queueId: raw.queueId, clientOperationId: raw.clientOperationId,
      kind: "submission", gameId: raw.gameId, submissionId: raw.submissionId,
      payloadDigest: raw.payloadDigest, disposition: disposition as OfflineReplayReceipt["disposition"] };
    return apiJson(receipt, { status: disposition === "accepted" ? 200 : 409 });
  });
}
