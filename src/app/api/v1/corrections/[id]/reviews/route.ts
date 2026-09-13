import { NextRequest } from "next/server";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { isUuid } from "../../../../../../lib/api/validation";
import { reviewRule12Correction } from "../../../../../../lib/corrections/independent-lifecycle";
import { rule12CorrectionEnabled } from "../../../../../../lib/api/rule12-correction-release";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!rule12CorrectionEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params; const body = await readSmallJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body) || !isUuid(id) || !isUuid((body as Record<string, unknown>).idempotencyKey) || !["approve", "reject"].includes((body as Record<string, unknown>).decision as string)) return apiJson({ error: "invalid_correction_review" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient()); if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const data = await reviewRule12Correction(createServerOnlyAdminClient(), { actorId, correctionId: id, decision: (body as Record<string, unknown>).decision as "approve" | "reject", operationId: (body as Record<string, unknown>).idempotencyKey as string });
    return apiJson(data, { status: Object.hasOwn(data as object, "code") ? 409 : 200 });
  });
}
