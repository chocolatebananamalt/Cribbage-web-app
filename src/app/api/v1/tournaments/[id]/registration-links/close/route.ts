import { NextRequest } from "next/server";

import { isRegistrationLinkCloseRequest, isRegistrationLinkCloseResult, readRegistrationLinkJson } from "../../../../../../../lib/api/registration-link";
import { publicRegistrationEnabled } from "../../../../../../../lib/api/public-registration-v2";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!publicRegistrationEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readRegistrationLinkJson(request);
    if (!isUuid(id) || !isRegistrationLinkCloseRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("close_registration_link_v2", {
      p_actor_id: subject,
      p_tournament_id: id,
      p_expected_link_id: body.expectedLinkId,
      p_expected_version: body.expectedVersion,
      p_operation_id: body.operationId,
    });
    if (error || !isRegistrationLinkCloseResult(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (data.status === "rejected") return apiJson({ error: "registration_link_conflict" }, { status: 409 });
    return apiJson(data);
  });
}
