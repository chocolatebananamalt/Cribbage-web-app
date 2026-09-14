import { NextRequest } from "next/server";
import { isReviewDirectorRequest } from "../../../../../../lib/api/director-administration";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../lib/api/validation";
import { reviewDirectorApplication } from "../../../../../../lib/director-administration";
import { createClient } from "../../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isReviewDirectorRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const result = await reviewDirectorApplication(actorId, id, body);
    if (!result) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    return apiJson(result, { status: result.status === "rejected" ? 409 : 200 });
  });
}
