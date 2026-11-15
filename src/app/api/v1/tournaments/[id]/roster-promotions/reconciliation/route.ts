import { NextRequest } from "next/server";
import { isAcceptedRosterPromotion, isRejectedRosterPromotion } from "../../../../../../../lib/api/roster";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createClient } from "../../../../../../../lib/supabase/server";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const parsed = await readSmallJson(request);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apiJson({ error: "invalid_json" }, { status: 400 });
    const body = parsed as Record<string, unknown>;
    if (!isUuid(id) || !isUuid(body.approvalDecisionId) || !isUuid(body.idempotencyKey)) return apiJson({ error: "invalid_roster_promotion" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const decisionId = body.approvalDecisionId as string;
    const { data, error } = await supabase.rpc("get_roster_promotion_operation_reconciliation", { p_tournament_id: id, p_approval_decision_id: decisionId, p_idempotency_key: body.idempotencyKey });
    if (error || !data || typeof data !== "object" || (data as Record<string, unknown>).authorized !== true || !("result" in (data as Record<string, unknown>))) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    const result = (data as Record<string, unknown>).result;
    if (result === null || isAcceptedRosterPromotion(result, decisionId) || isRejectedRosterPromotion(result, decisionId)) return apiJson({ result });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
