import { type NextRequest } from "next/server";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../../lib/api/validation";
import { isQualificationTieOutcome, isQualificationTieReconciliationRequest } from "../../../../../../../../../lib/api/qualification-ties";
import { createServerOnlyAdminClient } from "../../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../../lib/supabase/server";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId } = await params, body = await readSmallJson(request);
    if (!isUuid(id) || !isUuid(eventId) || !isQualificationTieReconciliationRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_qualification_tie_reconciliation_v1", { p_actor_id: actor, p_tournament_id: id, p_event_id: eventId, p_operation_id: body.operationId, p_request: body.request });
    if (error) return apiJson({ error: "tie_service_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "forbidden" }, { status: 403 });
    return data.authorized === true && Object.keys(data).sort().join() === "authorized,result" && (data.result === null || isQualificationTieOutcome(data.result, eventId))
      ? apiJson(data) : apiJson({ error: "tie_service_unavailable" }, { status: 503 });
  });
}
