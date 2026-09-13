import { NextRequest } from "next/server";

import { finalizeQualification, getQualificationResult, isQualificationFinalizationOutcome, isQualificationFinalizationRequest, isRejectedQualificationFinalization } from "../../../../../../../../lib/api/qualification-finalization";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id, eventId } = await params;
    if (!isUuid(id) || !isUuid(eventId)) return apiJson({ error: "invalid_qualification_finalization" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const result = await getQualificationResult(createServerOnlyAdminClient(), actorId, id, eventId);
    return result ? apiJson({ status: "qualification_finalized", eventId }) : apiJson({ status: "not_finalized", eventId });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isUuid(eventId) || body === null || !isQualificationFinalizationRequest(body)) {
      return apiJson({ error: "invalid_qualification_finalization" }, { status: 400 });
    }
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await finalizeQualification(createServerOnlyAdminClient(), actorId, id, eventId, body.idempotencyKey);
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isQualificationFinalizationOutcome(data, id, eventId)) return apiJson(data);
    if (isRejectedQualificationFinalization(data, eventId)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
