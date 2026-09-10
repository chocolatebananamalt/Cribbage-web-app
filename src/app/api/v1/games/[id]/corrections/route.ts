import { NextRequest } from "next/server";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { createClient } from "../../../../../../lib/supabase/server";
import { isUuid } from "../../../../../../lib/api/validation";
import { correctionRejectionStatus, isAcceptedCorrectionProposal, isRejectedCorrectionProposal } from "../../../../../../lib/api/correction";

const maxReasonLength = 500;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
  const { id } = await params;
  const parsed = await readSmallJson(request);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apiJson({ error: "invalid_json" }, { status: 400 });
  const body = parsed as Record<string, unknown>;
  const reason = body.reason;
  if (!isUuid(id) || !isUuid(body.correctionId) || !isUuid(body.idempotencyKey)
    || !Number.isSafeInteger(body.expectedGameVersion) || (body.expectedGameVersion as number) < 1
    || !["a", "b"].includes(body.winnerSide as string)
    || !Number.isInteger(body.margin) || (body.margin as number) < 1 || (body.margin as number) > 121
    || (reason !== undefined && (typeof reason !== "string" || reason.length > maxReasonLength))) {
    return apiJson({ error: "invalid_correction" }, { status: 400 });
  }
  const supabase = await createClient();
  if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("propose_game_correction", {
    p_game_id: id,
    p_correction_id: body.correctionId,
    p_expected_game_version: body.expectedGameVersion,
    p_winner_side: body.winnerSide,
    p_margin: body.margin,
    p_reason: typeof reason === "string" ? reason : null,
    p_idempotency_key: body.idempotencyKey,
  });
  if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
  if (isAcceptedCorrectionProposal(data, body.correctionId as string, id, body.expectedGameVersion as number)) return apiJson(data, { status: 200 });
  if (isRejectedCorrectionProposal(data, id)) return apiJson(data, { status: correctionRejectionStatus(data.code) });
  return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
