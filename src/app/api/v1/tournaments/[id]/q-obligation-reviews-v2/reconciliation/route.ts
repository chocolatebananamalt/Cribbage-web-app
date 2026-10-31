import { type NextRequest } from "next/server";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { isQReviewV2Result, isQReviewV2Request } from "../../../../../../../lib/api/q-obligation-review-v2";
import { createClient } from "../../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params, body = await readLargeJson(request);
    if (!isUuid(id) || !body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).sort().join() !== "operationId,request" || !isQReviewV2Request((body as { request?: unknown }).request) || !isUuid((body as { operationId?: unknown }).operationId)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_q_obligation_review_reconciliation_v2", { p_actor_id: actor, p_tournament_id: id, p_operation_id: (body as { operationId: string }).operationId, p_request: (body as { request: unknown }).request });
    if (error) return apiJson({ error: "q_review_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "forbidden" }, { status: 403 });
    return data?.authorized === true && Object.keys(data).sort().join() === "authorized,result" && (data.result === null || isQReviewV2Result(data.result)) ? apiJson(data) : apiJson({ error: "q_review_unavailable" }, { status: 503 });
  });
}
