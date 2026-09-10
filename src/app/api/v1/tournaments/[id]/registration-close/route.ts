import { NextRequest } from "next/server";

import { isRegistrationCloseRequest, isRegistrationCloseResult, readRegistrationLinkJson } from "../../../../../../lib/api/registration-link";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readRegistrationLinkJson(request);
    if (!isUuid(id) || !isRegistrationCloseRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("close_tournament_registration_v2", {
      p_actor_id: subject,
      p_tournament_id: id,
      p_operation_id: body.operationId,
    });
    if (error || !isRegistrationCloseResult(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (data.status === "rejected") return apiJson({ error: "registration_close_conflict" }, { status: 409 });
    return apiJson(data);
  });
}
