import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isUuid } from "../../../../../../lib/api/validation";
import { isAcceptedRosterPromotion, isRejectedRosterPromotion } from "../../../../../../lib/api/roster";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!isUuid(id) || !isUuid(body.approvalDecisionId) || !isUuid(body.idempotencyKey)) return NextResponse.json({ error: "invalid_roster_promotion" }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const decisionId = body.approvalDecisionId as string;
  const { data, error } = await supabase.rpc("create_roster_entry_from_registration_claim", { p_tournament_id: id, p_approval_decision_id: decisionId, p_idempotency_key: body.idempotencyKey });
  if (error) return NextResponse.json({ error: "operation_unavailable" }, { status: 503 });
  if (isAcceptedRosterPromotion(data, decisionId)) return NextResponse.json(data);
  if (isRejectedRosterPromotion(data, decisionId)) return NextResponse.json(data, { status: 409 });
  return NextResponse.json({ error: "operation_unavailable" }, { status: 503 });
}
