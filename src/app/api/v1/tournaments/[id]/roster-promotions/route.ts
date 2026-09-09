import { NextRequest } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isUuid } from "../../../../../../lib/api/validation";
import { isAcceptedRosterPromotion, isRejectedRosterPromotion } from "../../../../../../lib/api/roster";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return apiJson({ error: "invalid_json" }, { status: 400 }); }
  if (!isUuid(id) || !isUuid(body.approvalDecisionId) || !isUuid(body.idempotencyKey)) return apiJson({ error: "invalid_roster_promotion" }, { status: 400 });
  const supabase = await createClient();
  if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
  const decisionId = body.approvalDecisionId as string;
  const { data, error } = await supabase.rpc("create_roster_entry_from_registration_claim", { p_tournament_id: id, p_approval_decision_id: decisionId, p_idempotency_key: body.idempotencyKey });
  if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
  if (isAcceptedRosterPromotion(data, decisionId)) return apiJson(data);
  if (isRejectedRosterPromotion(data, decisionId)) return apiJson(data, { status: 409 });
  return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
