import { NextRequest } from "next/server";
import { accountActivationEnabled } from "../../../../../lib/api/account-activation-release";
import { isActivationRedeemRequest } from "../../../../../lib/api/roster-account-activation";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../lib/api/same-origin";
import { redeemRosterAccountActivation } from "../../../../../lib/roster-account-activation-redeemer";
import { createServerOnlyAdminClient } from "../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../lib/supabase/server";

/** Redeems a fragment-cleared credential after magic-link authentication. */
export async function POST(request: NextRequest) {
  return withApiFailureBoundary(async () => {
    if (!accountActivationEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const body = await readSmallJson(request);
    if (!isActivationRedeemRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const result = await redeemRosterAccountActivation(createServerOnlyAdminClient(), {
      profileId: subject, credential: body.credential, operationId: body.operationId,
    });
    if (result.status === "rejected") return apiJson({ error: "activation_unavailable" }, { status: 409 });
    return apiJson(result);
  });
}
