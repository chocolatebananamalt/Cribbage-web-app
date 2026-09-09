import { NextRequest } from "next/server";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../lib/api/validation";
import { createClient } from "../../../../../../lib/supabase/server";

function isBoundResolvedCorrection(value: unknown, correctionId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.correction_id === correctionId && isUuid(item.game_id) && Number.isSafeInteger(item.version) && (item.version as number) > 0
    && ["pending", "applied", "approved", "rejected"].includes(item.status as string);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return apiJson({ error: "invalid_json" }, { status: 400 }); }
    if (!isUuid(id) || !isUuid(body.idempotencyKey)) return apiJson({ error: "invalid_correction_reconciliation" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("get_correction_operation_reconciliation", { p_correction_id: id, p_idempotency_key: body.idempotencyKey });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    const result = data as Record<string, unknown>;
    if (result.state === "unknown" && Object.keys(result).length === 1) return apiJson(result);
    if (result.state === "resolved" && Object.keys(result).length === 2 && isBoundResolvedCorrection(result.response, id)) return apiJson(result);
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
