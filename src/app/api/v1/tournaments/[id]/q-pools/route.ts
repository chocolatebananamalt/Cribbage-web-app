import { type NextRequest } from "next/server";
import { isQPoolMembershipWorkspace, isQPoolMutation, isQPoolMutationResult } from "../../../../../../lib/api/q-pool-membership";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_tournament" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_q_pool_membership_workspace_v1", {
      p_actor_id: actor,
      p_tournament_id: id,
    });
    if (error) return apiJson({ error: "q_pool_workspace_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "forbidden" }, { status: 403 });
    return isQPoolMembershipWorkspace(data, id)
      ? apiJson(data)
      : apiJson({ error: "q_pool_workspace_unavailable" }, { status: 503 });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const operationId = request.headers.get("x-idempotency-key");
    const body = await readLargeJson(request);
    if (!isUuid(id) || !isUuid(operationId) || !isQPoolMutation(body)) return apiJson({ error: "invalid_q_pool_mutation" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("save_q_pool_membership_v1", {
      p_actor_id: actor,
      p_tournament_id: id,
      p_request: body,
      p_operation_id: operationId,
    });
    if (error) return apiJson({ error: "q_pool_operation_unavailable" }, { status: 503 });
    if (isQPoolMutationResult(data, body)) return apiJson(data, { status: data.status === "rejected" ? 409 : 200 });
    return apiJson({ error: "q_pool_operation_unavailable" }, { status: 503 });
  });
}
