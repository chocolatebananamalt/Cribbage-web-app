import { NextRequest } from "next/server";

import { isEventCheckInBootstrapRequest, isEventCheckInRequest } from "../../../../lib/api/event-check-in";
import { apiJson, readSmallJson, withApiFailureBoundary } from "../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../lib/api/same-origin";
import { parseEventCheckInCredential } from "../../../../lib/event-check-in-token";
import { issueEventCheckInCompletionSession } from "../../../../lib/event-check-in-issuer";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";

export async function POST(request: NextRequest) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ status: "unavailable" }, { status: 403 });
    const body = await readSmallJson(request);
    if (isEventCheckInBootstrapRequest(body)) {
      const credential = parseEventCheckInCredential(body.credential);
      if (!credential) return apiJson({ status: "unavailable" }, { status: 400 });
      try {
        const issued = await issueEventCheckInCompletionSession(createServerOnlyAdminClient(), { qrCredential: credential, expiresAt: new Date(Date.now() + 5 * 60_000) });
        return apiJson({ status: "ready", completionSession: issued.credential.canonicalToken, expiresAt: issued.expiresAt });
      } catch { return apiJson({ status: "unavailable" }, { status: 410 }); }
    }
    if (!isEventCheckInRequest(body)) return apiJson({ status: "unavailable" }, { status: 400 });
    const credential = parseEventCheckInCredential(body.completionSession);
    if (!credential) return apiJson({ status: "unavailable" }, { status: 400 });
    const { data, error } = await createServerOnlyAdminClient().rpc("submit_event_check_in_completion_v1", {
      p_completion_id: credential.credentialId, p_secret: credential.secret,
      p_first_name: body.firstName.trim(), p_last_name: body.lastName.trim(), p_email: body.email.trim(), p_acc_number: body.accNumber.trim().toUpperCase(),
    });
    if (error || !data || typeof data !== "object") return apiJson({ status: "unavailable" }, { status: 503 });
    const status = (data as Record<string, unknown>).status;
    return apiJson(data, { status: status === "unavailable" ? 410 : 200 });
  });
}
