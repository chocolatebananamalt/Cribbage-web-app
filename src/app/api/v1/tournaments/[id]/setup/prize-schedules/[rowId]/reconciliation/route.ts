import { NextRequest } from "next/server";
import { isPrizeScheduleReconciliation } from "../../../../../../../../../lib/api/prize-schedule";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../../lib/supabase/server";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, rowId } = await params, body = await readSmallJson(request);
    if (!isUuid(id) || !isUuid(rowId) || !body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).join(",") !== "operationId" || !isUuid((body as { operationId?: unknown }).operationId)) return apiJson({ error: "invalid_operation" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_prize_schedule_reconciliation_v1", { p_actor_id: actorId, p_tournament_id: id, p_client_row_id: rowId, p_operation_id: (body as { operationId: string }).operationId });
    return !error && isPrizeScheduleReconciliation(data, id, rowId) ? apiJson(data) : apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
