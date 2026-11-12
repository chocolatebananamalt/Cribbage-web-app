import { type NextRequest } from "next/server";
import { isQPoolReconciliation } from "../../../../../../../lib/api/q-pool-membership";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || !("operationId" in body) || !isUuid(body.operationId)) {
      return apiJson({ error: "invalid_q_pool_reconciliation" }, { status: 400 });
    }
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_q_pool_membership_reconciliation_v1", {
      p_actor_id: actor,
      p_tournament_id: id,
      p_operation_id: body.operationId,
    });
    if (error) return apiJson({ error: "q_pool_reconciliation_unavailable" }, { status: 503 });
    if (!isQPoolReconciliation(data)) return apiJson({ error: "q_pool_reconciliation_unavailable" }, { status: 503 });
    return apiJson(data);
  });
}
