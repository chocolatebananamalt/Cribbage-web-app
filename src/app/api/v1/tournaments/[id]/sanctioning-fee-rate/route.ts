import { NextRequest } from "next/server";
import { isSanctioningFeeRateOverrideRequest, isSanctioningFeeRateOverrideResult } from "../../../../../../lib/api/sanctioning-fee";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isSanctioningFeeRateOverrideRequest(body)) return apiJson({ error: "invalid_sanctioning_fee_rate_override" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("override_tournament_sanctioning_fee_rate_v1", {
      p_actor_id: actor, p_tournament_id: id, p_event_kind: body.eventKind, p_rate_cents: body.rateCents,
      p_reason: body.reason, p_acc_reference: "ACC Board approval — director attested", p_idempotency_key: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isSanctioningFeeRateOverrideResult(data, body)) return apiJson(data);
    return apiJson(data && typeof data === "object" ? data : { error: "operation_unavailable" }, { status: 409 });
  });
}
