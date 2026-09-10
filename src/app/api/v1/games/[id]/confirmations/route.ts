import { NextRequest } from "next/server";
import { isAcceptedConfirmation, isRejectedConfirmationOperation } from "../../../../../../lib/api/game-operation";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../lib/api/validation";
import { createClient } from "../../../../../../lib/supabase/server";

function rejectionStatus(code: unknown) {
  if (code === "authentication_required") return 401;
  if (code === "invalid_request") return 400;
  return 409;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    const rawBody = await readSmallJson(request);
    if (!rawBody || typeof rawBody !== "object") return apiJson({ error: "invalid_confirmation" }, { status: 400 });
    const body = rawBody as Record<string, unknown>;
    if (!isUuid(id) || !isUuid(body.submissionId) || !isUuid(body.idempotencyKey)) return apiJson({ error: "invalid_confirmation" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("confirm_game_score", { p_game_id: id, p_submission_id: body.submissionId, p_idempotency_key: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isRejectedConfirmationOperation(data, id)) return apiJson(data, { status: rejectionStatus(data.code) });
    if (isAcceptedConfirmation(data, id)) return apiJson(data, { status: 200 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
