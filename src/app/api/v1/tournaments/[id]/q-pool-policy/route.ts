import { type NextRequest } from "next/server";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { isQPolicyRequest, isQPolicyResult } from "../../../../../../lib/api/q-pool-policy";
import { isQPreviewSources } from "../../../../../../lib/results/q-pool-preview";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_tournament" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_q_pool_preview_sources_v1", { p_actor_id: actor, p_tournament_id: id });
    return error ? apiJson({ error: "q_policy_unavailable" }, { status: 503 }) : data === null ? apiJson({ error: "forbidden" }, { status: 403 })
      : isQPreviewSources(data, id) ? apiJson(data) : apiJson({ error: "q_policy_unavailable" }, { status: 503 });
  });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params, operationId = request.headers.get("x-idempotency-key"), body = await readLargeJson(request);
    if (!isUuid(id) || !isUuid(operationId) || !isQPolicyRequest(body)) return apiJson({ error: "invalid_q_policy" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("publish_q_pool_policy_v1", { p_actor_id: actor, p_tournament_id: id, p_request: body, p_operation_id: operationId });
    if (error) return apiJson({ error: "q_policy_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "forbidden" }, { status: 403 });
    return isQPolicyResult(data) && (data.status === "rejected" || data.poolVersionId === body.poolVersionId)
      ? apiJson(data, { status: data.status === "rejected" ? 409 : 200 }) : apiJson({ error: "q_policy_unavailable" }, { status: 503 });
  });
}
