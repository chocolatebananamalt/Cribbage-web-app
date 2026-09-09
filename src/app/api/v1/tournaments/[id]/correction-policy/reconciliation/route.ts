import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../../../lib/supabase/server";
import { isUuid } from "../../../../../../../lib/api/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!isUuid(id) || !isUuid(body.idempotencyKey)) return NextResponse.json({ error: "invalid_reconciliation" }, { status: 400 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("get_correction_policy_operation_reconciliation", { p_tournament_id: id, p_idempotency_key: body.idempotencyKey });
  if (error) return NextResponse.json({ error: "operation_unavailable" }, { status: 503 });
  return NextResponse.json({ result: data ?? null }, { status: 200 });
}
