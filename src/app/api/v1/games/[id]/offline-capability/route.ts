import { NextRequest } from "next/server";
import { apiJson, readSmallJson, requireVerifiedIdentity, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { isOfflineSubmissionCapability } from "../../../../../../lib/offline-score-queue-contract";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";

function isPublicP256Jwk(value: unknown): value is JsonWebKey {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.kty === "EC" && item.crv === "P-256" && typeof item.x === "string" && item.x.length >= 40 && item.x.length <= 60
    && typeof item.y === "string" && item.y.length >= 40 && item.y.length <= 60 && item.ext === true
    && Array.isArray(item.key_ops) && item.key_ops.length === 1 && item.key_ops[0] === "verify" && !("d" in item)
    && Object.keys(item).length === 6 && Object.keys(item).every((key) => ["kty", "crv", "x", "y", "ext", "key_ops"].includes(key));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const raw = await readSmallJson(request);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return apiJson({ error: "invalid_capability_request" }, { status: 400 });
    const body = raw as Record<string, unknown>;
    if (Object.keys(body).length !== 3 || !isUuid(id) || !isUuid(body.capabilityId) || !isUuid(body.deviceKeyId) || !isPublicP256Jwk(body.publicJwk)) {
      return apiJson({ error: "invalid_capability_request" }, { status: 400 });
    }
    const supabase = await createClient();
    const identity = await requireVerifiedIdentity(supabase);
    if (!identity) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("issue_offline_submission_capability_v1", {
      p_actor_id: identity.subject, p_session_binding_id: identity.sessionId, p_game_id: id,
      p_capability_id: body.capabilityId, p_device_key_id: body.deviceKeyId, p_public_jwk: body.publicJwk,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isOfflineSubmissionCapability(data) && data.verifiedActorId === identity.subject && data.sessionBindingId === identity.sessionId && data.gameId === id) return apiJson(data);
    const code = data && typeof data === "object" ? (data as Record<string, unknown>).code : "capability_unavailable";
    return apiJson({ error: code }, { status: code === "authentication_required" ? 401 : 409 });
  });
}
