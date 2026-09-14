import { NextRequest } from "next/server";
import { isSameOriginRequest } from "../../../../lib/api/same-origin";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../lib/api/route-boundary";
import { isUuid } from "../../../../lib/api/validation";
import { submitDirectorApplication } from "../../../../lib/director-administration";
import { createClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const body = await readSmallJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !isUuid((body as Record<string, unknown>).idempotencyKey)) {
      return apiJson({ error: "invalid_request" }, { status: 400 });
    }
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const result = await submitDirectorApplication(actorId, (body as { idempotencyKey: string }).idempotencyKey);
    if (!result) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    return apiJson(result, { status: result.status === "rejected" ? 409 : 200 });
  });
}
