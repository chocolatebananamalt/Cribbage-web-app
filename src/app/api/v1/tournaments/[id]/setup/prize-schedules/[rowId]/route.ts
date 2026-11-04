import { NextRequest } from "next/server";
import { getPrizeScheduleWorkspace, isPrizeScheduleRequest, isPrizeScheduleSaved, isRejectedPrizeSchedule } from "../../../../../../../../lib/api/prize-schedule";
import { apiJson, readMediumJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";
type Context = { params: Promise<{ id: string; rowId: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  return withApiFailureBoundary(async () => {
    const { id, rowId } = await params;
    if (!isUuid(id) || !isUuid(rowId)) return apiJson({ error: "invalid_prize_schedule" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const workspace = await getPrizeScheduleWorkspace(createServerOnlyAdminClient(), actorId, id, rowId);
    return workspace ? apiJson(workspace) : apiJson({ error: "prize_schedule_unavailable" }, { status: 503 });
  });
}
export async function POST(request: NextRequest, { params }: Context) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, rowId } = await params, body = await readMediumJson(request), operationId = request.headers.get("x-idempotency-key") ?? "";
    if (!isUuid(id) || !isUuid(rowId) || !isUuid(operationId) || !isPrizeScheduleRequest(body)) return apiJson({ error: "invalid_prize_schedule" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("save_setup_prize_schedule_v1", { p_actor_id: actorId, p_tournament_id: id, p_client_row_id: rowId, p_request: body, p_operation_id: operationId });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isPrizeScheduleSaved(data, id, rowId)) return apiJson(data);
    if (isRejectedPrizeSchedule(data, rowId)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
