import { NextRequest } from "next/server";
import { accountActivationEnabled } from "../../../../../../../../lib/api/account-activation-release";
import { isActivationCancelRequest } from "../../../../../../../../lib/api/roster-account-activation";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { cancelRosterAccountActivation } from "../../../../../../../../lib/roster-account-activation-canceller";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

/** Cancels an unused activation through the audited private transaction. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; activationId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!accountActivationEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, activationId } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isUuid(activationId) || !isActivationCancelRequest(body) || body.activationId !== activationId) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const result = await cancelRosterAccountActivation(createServerOnlyAdminClient(), {
      actorId: subject, tournamentId: id, activationId, operationId: body.operationId,
    });
    if (result.status === "rejected") return apiJson({ error: "activation_cancellation_rejected" }, { status: 409 });
    return apiJson(result);
  });
}
