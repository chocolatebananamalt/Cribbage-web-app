import { NextRequest } from "next/server";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../lib/api/validation";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { rule12CorrectionEnabled } from "../../../../../../lib/api/rule12-correction-release";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";

function isBoundResolvedCorrection(value: unknown, correctionId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.correctionId === correctionId && isUuid(item.gameId) && Number.isSafeInteger(item.gameVersion) && (item.gameVersion as number) > 0
    && ["pending", "applied", "approved", "rejected"].includes(item.status as string);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!rule12CorrectionEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const parsed = await readSmallJson(request);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apiJson({ error: "invalid_json" }, { status: 400 });
    const body = parsed as Record<string, unknown>;
    if (!isUuid(id) || !isUuid(body.idempotencyKey)) return apiJson({ error: "invalid_correction_reconciliation" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_rule12_correction_reconciliation_v1", { p_actor_id: actorId, p_correction_id: id, p_operation_id: body.idempotencyKey });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    const result = data as Record<string, unknown>;
    if (result.state === "unknown" && Object.keys(result).length === 1) return apiJson(result);
    if (result.state === "resolved" && Object.keys(result).length === 2 && isBoundResolvedCorrection(result.response, id)) return apiJson(result);
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
