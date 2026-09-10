import { NextRequest } from "next/server";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createClient } from "../../../../../../../lib/supabase/server";

function isPolicyReconciliationResult(value: unknown, tournamentId: string) {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (item.status === "configured") {
    return Object.keys(item).length === 5
      && item.tournament_id === tournamentId
      && Number.isSafeInteger(item.policy_version) && (item.policy_version as number) >= 1
      && typeof item.reason_required === "boolean"
      && (item.required_approvals === 0 || item.required_approvals === 1);
  }
  return item.status === "rejected"
    && Object.keys(item).length === 3
    && typeof item.code === "string"
    && item.tournament_id === tournamentId;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    const parsed = await readSmallJson(request);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apiJson({ error: "invalid_json" }, { status: 400 });
    const body = parsed as Record<string, unknown>;
    if (!isUuid(id) || !isUuid(body.idempotencyKey)) return apiJson({ error: "invalid_reconciliation" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("get_correction_policy_operation_reconciliation", { p_tournament_id: id, p_idempotency_key: body.idempotencyKey });
    if (error || !data || typeof data !== "object" || Array.isArray(data) || (data as Record<string, unknown>).authorized !== true || !("result" in (data as Record<string, unknown>))) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    const result = (data as Record<string, unknown>).result;
    if (!isPolicyReconciliationResult(result, id)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    return apiJson({ result }, { status: 200 });
  });
}
