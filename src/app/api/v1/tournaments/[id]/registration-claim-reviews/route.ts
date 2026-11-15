import { NextRequest } from "next/server";
import { isAcceptedRegistrationClaimReview, isRegistrationClaimReviewRequest, isRejectedRegistrationClaimReview } from "../../../../../../lib/api/registration-claim-review";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isRegistrationClaimReviewRequest(body)) return apiJson({ error: "invalid_registration_review" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("review_registration_claim", {
      p_tournament_id: id,
      p_claim_id: body.claimId,
      p_decision: body.decision,
      p_duplicate_resolution: body.duplicateResolution,
      p_duplicate_of_claim_id: body.duplicateOfClaimId,
      p_reason: body.reason,
      p_idempotency_key: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedRegistrationClaimReview(data, body.claimId, body.decision)) return apiJson(data);
    if (isRejectedRegistrationClaimReview(data, body.claimId)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
