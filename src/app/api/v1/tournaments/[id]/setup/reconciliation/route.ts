import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../../../lib/supabase/server";
import { isSetupRecoveryRequest, isRejectedSetup, isRecoveredSetup } from "../../../../../../../lib/api/setup";
import { isUuid } from "../../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { readSmallJson } from "../../../../../../../lib/api/bounded-json";
const privateNoStore = { "cache-control": "private, no-store" };
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: privateNoStore });
  const { id } = await params; const body = await readSmallJson(request);
  if (body === null) return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: privateNoStore });
  if (!isUuid(id) || !isSetupRecoveryRequest(body)) return NextResponse.json({ error: "invalid_setup_recovery" }, { status: 400, headers: privateNoStore });
  try {
    const supabase = await createClient(); const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError) return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
    if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: privateNoStore });
    const { data, error } = await supabase.rpc("get_tournament_setup_operation_reconciliation", { p_tournament_id: id, p_idempotency_key: body.idempotencyKey });
    if (error || !data || typeof data !== "object" || (data as Record<string, unknown>).authorized !== true || !("result" in (data as Record<string, unknown>))) return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
    const result = (data as Record<string, unknown>).result;
    if (result === null || isRejectedSetup(result) || isRecoveredSetup(result)) return NextResponse.json({ result }, { headers: privateNoStore });
    return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
  } catch {
    return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
  }
}
