import { NextRequest } from "next/server";
import { isAcceptedRosterPromotion, isRejectedRosterPromotion } from "../../../../../../../lib/api/roster";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return apiJson({ error: "invalid_json" }, { status: 400 }); }
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
