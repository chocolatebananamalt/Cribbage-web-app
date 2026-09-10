import { NextRequest } from "next/server";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { createClient } from "../../../../../../lib/supabase/server";
import { isUuid } from "../../../../../../lib/api/validation";
import { correctionRejectionStatus, isAcceptedCorrectionReview, isRejectedCorrectionReview } from "../../../../../../lib/api/correction";
import { rule12CorrectionEnabled } from "../../../../../../lib/api/rule12-correction-release";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
  if (!rule12CorrectionEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
  const { id } = await params;
  const parsed = await readSmallJson(request);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apiJson({ error: "invalid_json" }, { status: 400 });
  const body = parsed as Record<string, unknown>;
  if (!isUuid(id) || !isUuid(body.idempotencyKey) || !["approve", "reject"].includes(body.decision as string)) {
    return apiJson({ error: "invalid_correction_review" }, { status: 400 });
  }
  const supabase = await createClient();
  if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("review_game_correction", {
    p_correction_id: id,
    p_decision: body.decision,
    p_idempotency_key: body.idempotencyKey,
  });
  if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
  if (isAcceptedCorrectionReview(data, id, body.decision as "approve" | "reject")) return apiJson(data, { status: 200 });
  if (isRejectedCorrectionReview(data, id)) return apiJson(data, { status: correctionRejectionStatus(data.code) });
  return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
