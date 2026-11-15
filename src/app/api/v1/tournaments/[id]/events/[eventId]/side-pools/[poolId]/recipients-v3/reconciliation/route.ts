import { type NextRequest } from "next/server";
import { isSidePoolRecipientMutationV3, isSidePoolRecipientReconciliationV3 } from "../../../../../../../../../../../lib/api/side-pool-recipients-v3";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../../../../lib/supabase/server";

type Params = { params: Promise<{ id: string; eventId: string; poolId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId, poolId } = await params;
    const raw: unknown = await readLargeJson(request);
    if (![id, eventId, poolId].every(isUuid) || !raw || typeof raw !== "object" || Array.isArray(raw)
      || Object.keys(raw).sort().join(",") !== "mutation,operationId") return apiJson({ error: "invalid_request" }, { status: 400 });
    const body = raw as Record<string, unknown>;
    const mutation = body.mutation;
    if (!isUuid(body.operationId) || !isSidePoolRecipientMutationV3(mutation) || mutation.eventId !== eventId || mutation.poolId !== poolId) {
      return apiJson({ error: "invalid_request" }, { status: 400 });
    }
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const requestBody = mutation.request;
    const { data, error } = await createServerOnlyAdminClient().rpc("get_side_pool_recipient_reconciliation_v3", {
      p_actor_id: actor, p_tournament_id: id, p_event_id: eventId, p_pool_id: poolId,
      p_request: requestBody, p_operation_id: body.operationId,
    });
    if (error) return apiJson({ error: "side_recipients_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "forbidden" }, { status: 403 });
    return isSidePoolRecipientReconciliationV3(data, mutation) ? apiJson(data) : apiJson({ error: "side_recipients_unavailable" }, { status: 503 });
  });
}
