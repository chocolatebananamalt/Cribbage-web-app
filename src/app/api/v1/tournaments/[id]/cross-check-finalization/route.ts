import { NextRequest } from "next/server";

import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isFinalizeCrossCheckingRequest, isFinalizeCrossCheckingResult } from "../../../../../../lib/api/cross-check-finalization";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isFinalizeCrossCheckingRequest(body)) return apiJson({ error: "invalid_finalize_cross_checking_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });

    const admin = createServerOnlyAdminClient();
    const { data, error } = await admin.rpc("finalize_cross_checking_v1", {
      p_actor_id: subject, p_tournament_id: id, p_operation_id: body.idempotencyKey,
    });

    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (!isFinalizeCrossCheckingResult(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    // A refusal is the answer, not a failure: it names the condition that is
    // still outstanding, and the screen redraws around it. Only a transport or
    // shape failure is a 503.
    if (data.status === "rejected") return apiJson(data, { status: 409 });
    return apiJson(data);
  });
}
