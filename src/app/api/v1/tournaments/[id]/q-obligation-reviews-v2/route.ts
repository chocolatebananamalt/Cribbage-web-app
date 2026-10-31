import { type NextRequest } from "next/server";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { isQReviewV2Request, isQReviewV2Result, isQReviewV2Workspace } from "../../../../../../lib/api/q-obligation-review-v2";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_tournament" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_q_obligation_review_workspace_v2", { p_actor_id: actor, p_tournament_id: id });
    return error ? apiJson({ error: "q_review_unavailable" }, { status: 503 }) : data === null ? apiJson({ error: "forbidden" }, { status: 403 }) : isQReviewV2Workspace(data, id) ? apiJson(data) : apiJson({ error: "q_review_unavailable" }, { status: 503 });
  });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params, operationId = request.headers.get("x-idempotency-key"), body = await readLargeJson(request);
    if (!isUuid(id) || !isUuid(operationId) || !isQReviewV2Request(body)) return apiJson({ error: "invalid_q_review" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("record_q_obligation_review_v2", { p_actor_id: actor, p_tournament_id: id, p_request: body, p_operation_id: operationId });
    return error ? apiJson({ error: "q_review_unavailable" }, { status: 503 }) : data === null ? apiJson({ error: "forbidden" }, { status: 403 }) : isQReviewV2Result(data) ? apiJson(data, { status: data.status === "rejected" ? 409 : 200 }) : apiJson({ error: "q_review_unavailable" }, { status: 503 });
  });
}
