import { type NextRequest } from "next/server";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { isQualificationTieRequest, isQualificationTieOutcome, isQualificationTieWorkspace, qualificationTieOutcomeMatches } from "../../../../../../../../lib/api/qualification-ties";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id, eventId } = await params;
    if (!isUuid(id) || !isUuid(eventId)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_qualification_tie_workspace_v1", { p_actor_id: actor, p_tournament_id: id, p_event_id: eventId });
    return error ? apiJson({ error: "tie_service_unavailable" }, { status: 503 })
      : data === null ? apiJson({ error: "forbidden" }, { status: 403 })
      : isQualificationTieWorkspace(data, id, eventId) ? apiJson(data) : apiJson({ error: "tie_service_unavailable" }, { status: 503 });
  });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId } = await params, operation = request.headers.get("x-idempotency-key"), body = await readSmallJson(request);
    if (!isUuid(id) || !isUuid(eventId) || !isUuid(operation) || !isQualificationTieRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("save_qualification_tie_resolution_v1", { p_actor_id: actor, p_tournament_id: id, p_event_id: eventId, p_request: body, p_operation_id: operation });
    if (error) return apiJson({ error: "tie_service_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "forbidden" }, { status: 403 });
    return isQualificationTieOutcome(data, eventId) && qualificationTieOutcomeMatches(data, body)
      ? apiJson(data, { status: data.status === "rejected" ? 409 : 200 }) : apiJson({ error: "tie_service_unavailable" }, { status: 503 });
  });
}
