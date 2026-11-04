import { type NextRequest } from "next/server";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../../lib/api/validation";
import { isQAccountingFinalRequest, isQAccountingResult } from "../../../../../../../../../lib/api/q-accounting-v6";
import { createServerOnlyAdminClient } from "../../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../../lib/supabase/server";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId } = await params, operationId = request.headers.get("x-idempotency-key"), body = await readLargeJson(request);
    if (!isUuid(id) || !isUuid(eventId) || !isUuid(operationId) || !isQAccountingFinalRequest(body)) return apiJson({ error: "invalid_q_accounting" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("finalize_q_accounting_v6", { p_actor_id: actor, p_tournament_id: id, p_event_id: eventId, p_request: body, p_operation_id: operationId });
    return error ? apiJson({ error: "q_accounting_unavailable" }, { status: 503 }) : data === null ? apiJson({ error: "forbidden" }, { status: 403 }) : isQAccountingResult(data, eventId) && (data.status === "rejected" || data.status === "q_accounting_finalized_unpaid_v6") ? apiJson(data, { status: data.status === "rejected" ? 409 : 200 }) : apiJson({ error: "q_accounting_unavailable" }, { status: 503 });
  });
}
