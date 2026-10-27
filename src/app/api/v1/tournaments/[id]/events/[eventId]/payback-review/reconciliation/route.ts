import { NextRequest } from "next/server";
import { isPaybackReviewReconciliation, reconcilePaybackReview } from "../../../../../../../../../lib/api/payback-review";
import { apiJson, readMediumJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../../lib/supabase/server";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId } = await params;
    const body = await readMediumJson(request);
    const operationId = body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).join(",") === "operationId"
      && typeof (body as { operationId?: unknown }).operationId === "string" ? (body as { operationId: string }).operationId : "";
    if (!isUuid(id) || !isUuid(eventId) || !isUuid(operationId)) return apiJson({ error: "invalid_reconciliation" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await reconcilePaybackReview(createServerOnlyAdminClient(), actorId, id, eventId, operationId);
    return error || !isPaybackReviewReconciliation(data, id, eventId) ? apiJson({ error: "operation_unavailable" }, { status: 503 }) : apiJson(data);
  });
}
