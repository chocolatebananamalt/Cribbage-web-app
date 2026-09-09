import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isUuid } from "../../../../../../lib/api/validation";

function accepted(value: unknown, tournamentId: string, reasonRequired: boolean, requiredApprovals: 0 | 1) {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.status === "configured" && item.tournament_id === tournamentId
    && Number.isSafeInteger(item.policy_version) && (item.policy_version as number) >= 1
    && item.reason_required === reasonRequired && item.required_approvals === requiredApprovals;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!isUuid(id) || typeof body.reasonRequired !== "boolean" || ![0, 1].includes(body.requiredApprovals as number) || !Number.isSafeInteger(body.expectedPolicyVersion) || (body.expectedPolicyVersion as number) < 0 || !isUuid(body.idempotencyKey)) {
    return NextResponse.json({ error: "invalid_policy" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const requiredApprovals = body.requiredApprovals as 0 | 1;
  const { data, error } = await supabase.rpc("configure_correction_policy", {
    p_tournament_id: id,
    p_reason_required: body.reasonRequired,
    p_required_approvals: requiredApprovals,
    p_expected_policy_version: body.expectedPolicyVersion,
    p_idempotency_key: body.idempotencyKey,
  });
  if (error) return NextResponse.json({ error: "operation_unavailable" }, { status: 503 });
  if (accepted(data, id, body.reasonRequired as boolean, requiredApprovals)) return NextResponse.json(data, { status: 200 });
  if (data && typeof data === "object" && (data as Record<string, unknown>).status === "rejected") return NextResponse.json(data, { status: 409 });
  return NextResponse.json({ error: "operation_unavailable" }, { status: 503 });
}
