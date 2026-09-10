import { NextRequest } from "next/server";
import { accountActivationEnabled } from "../../../../../../../lib/api/account-activation-release";
import { isActivationDecisionRequest } from "../../../../../../../lib/api/roster-account-activation";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { decideRosterAccountActivation } from "../../../../../../../lib/roster-account-activation-decision";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

/** A director/co-director records the in-person witnessed decision. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!accountActivationEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, requestId } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isUuid(requestId) || !isActivationDecisionRequest(body) || body.requestId !== requestId) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const result = await decideRosterAccountActivation(createServerOnlyAdminClient(), {
      actorId: subject, tournamentId: id, requestId, decision: body.decision,
      confirmationPhrase: body.confirmationPhrase, operationId: body.operationId,
    });
    if (result.status === "rejected") return apiJson({ error: "activation_decision_rejected" }, { status: 409 });
    return apiJson(result);
  });
}
