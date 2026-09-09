import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isUuid } from "../../../../../../lib/api/validation";
import { correctionRejectionStatus, isAcceptedCorrectionReview, isRejectedCorrectionOperation } from "../../../../../../lib/api/correction";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!isUuid(id) || !isUuid(body.idempotencyKey) || !["approve", "reject"].includes(body.decision as string)) {
    return NextResponse.json({ error: "invalid_correction_review" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("review_game_correction", {
    p_correction_id: id,
    p_decision: body.decision,
    p_idempotency_key: body.idempotencyKey,
  });
  if (error) return NextResponse.json({ error: "operation_unavailable" }, { status: 503 });
  if (isAcceptedCorrectionReview(data, id, body.decision as "approve" | "reject")) return NextResponse.json(data, { status: 200 });
  if (isRejectedCorrectionOperation(data)) return NextResponse.json(data, { status: correctionRejectionStatus(data.code) });
  return NextResponse.json({ error: "operation_unavailable" }, { status: 503 });
}
