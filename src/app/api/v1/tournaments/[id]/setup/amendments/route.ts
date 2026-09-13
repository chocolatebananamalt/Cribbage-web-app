import { NextRequest } from "next/server";

import { isRejectedSetupAmendment, isSetupAmendmentRequest, isSetupAmendmentResult } from "../../../../../../../lib/api/setup-amendment";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { readLargeJson } from "../../../../../../../lib/api/bounded-json";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readLargeJson(request);
    if (!isUuid(id) || !isSetupAmendmentRequest(body)) return apiJson({ error: "invalid_amendment" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("append_tournament_setup_events_v1", {
      p_actor_id: subject,
      p_tournament_id: id,
      p_expected_setup_revision_id: body.expectedSetupRevisionId,
      p_expected_setup_version: body.expectedSetupVersion,
      p_events: body.events,
      p_operation_id: body.operationId,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isSetupAmendmentResult(data, body)) return apiJson(data);
    if (isRejectedSetupAmendment(data)) {
      if (["tournament_unavailable", "not_director"].includes(data.code)) return apiJson({ error: "not_found" }, { status: 404 });
      return apiJson(data, { status: 409 });
    }
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
