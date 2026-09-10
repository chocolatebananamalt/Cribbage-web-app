import { NextRequest } from "next/server";
import { isAcceptedSubmission, isRejectedSubmissionOperation } from "../../../../../../lib/api/game-operation";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../lib/api/validation";
import { createClient } from "../../../../../../lib/supabase/server";

function rejectionStatus(code: unknown) {
  if (code === "authentication_required") return 401;
  if (code === "invalid_submission" || code === "invalid_request") return 400;
  return 409;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return apiJson({ error: "invalid_json" }, { status: 400 }); }
    if (!isUuid(id) || !isUuid(body.submissionId) || !isUuid(body.idempotencyKey) || ![1, 2].includes(body.submissionSlot as number) || !["a", "b"].includes(body.winnerSide as string) || !Number.isInteger(body.margin) || (body.margin as number) < 1 || (body.margin as number) > 121) return apiJson({ error: "invalid_submission" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("submit_game_score", { p_game_id: id, p_submission_id: body.submissionId, p_submission_slot: body.submissionSlot, p_winner_side: body.winnerSide, p_margin: body.margin, p_idempotency_key: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isRejectedSubmissionOperation(data, id)) return apiJson(data, { status: rejectionStatus(data.code) });
    if (isAcceptedSubmission(data, id, body.submissionId as string)) return apiJson(data, { status: 200 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
