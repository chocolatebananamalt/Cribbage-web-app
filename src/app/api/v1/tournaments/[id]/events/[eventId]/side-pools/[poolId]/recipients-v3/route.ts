import { type NextRequest } from "next/server";
import { isSidePoolRecipientMutationV3, isSidePoolRecipientResultV3, isSidePoolRecipientWorkspaceV3, sidePoolRecipientResultMatchesV3 } from "../../../../../../../../../../lib/api/side-pool-recipients-v3";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../../../lib/supabase/server";

type Params = { params: Promise<{ id: string; eventId: string; poolId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return withApiFailureBoundary(async () => {
    const { id, eventId, poolId } = await params;
    if (![id, eventId, poolId].every(isUuid)) return apiJson({ error: "invalid_side_pool" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_side_pool_recipient_workspace_v3", {
      p_actor_id: actor, p_tournament_id: id, p_event_id: eventId, p_pool_id: poolId,
    });
    if (error) return apiJson({ error: "side_recipients_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "forbidden" }, { status: 403 });
    return isSidePoolRecipientWorkspaceV3(data, id, eventId, poolId) ? apiJson(data) : apiJson({ error: "side_recipients_unavailable" }, { status: 503 });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId, poolId } = await params;
    const body: unknown = await readLargeJson(request);
    const operationId = request.headers.get("x-idempotency-key");
    if (![id, eventId, poolId].every(isUuid) || !isUuid(operationId) || !isSidePoolRecipientMutationV3(body)
      || body.eventId !== eventId || body.poolId !== poolId) return apiJson({ error: "invalid_side_recipient_request" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const rpc = body.action === "publish_policy" ? "publish_side_pool_recipient_policy_v3" : "record_side_pool_recipient_review_v3";
    const { data, error } = await createServerOnlyAdminClient().rpc(rpc, {
      p_actor_id: actor, p_tournament_id: id, p_event_id: eventId, p_pool_id: poolId, p_request: body.request, p_operation_id: operationId,
    });
    if (error) return apiJson({ error: "side_recipients_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "forbidden" }, { status: 403 });
    return isSidePoolRecipientResultV3(data) && sidePoolRecipientResultMatchesV3(data, body)
      ? apiJson(data, { status: data.status === "rejected" ? 409 : 200 })
      : apiJson({ error: "side_recipients_unavailable" }, { status: 503 });
  });
}
