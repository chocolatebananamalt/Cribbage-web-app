import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isUuid } from "../../../../../../lib/api/validation";

function rejectionStatus(code: unknown) {
  if (code === "authentication_required") return 401;
  if (code === "invalid_request") return 400;
  return 409;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!isUuid(id) || !isUuid(body.submissionId) || !isUuid(body.idempotencyKey)) return NextResponse.json({ error: "invalid_confirmation" }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("confirm_game_score", { p_game_id: id, p_submission_id: body.submissionId, p_idempotency_key: body.idempotencyKey });
  if (error) return NextResponse.json({ error: "operation_unavailable" }, { status: 503 });
  if (data && typeof data === "object" && (data as { status?: unknown }).status === "rejected") {
    return NextResponse.json(data, { status: rejectionStatus((data as { code?: unknown }).code) });
  }
  return NextResponse.json(data, { status: 200 });
}
