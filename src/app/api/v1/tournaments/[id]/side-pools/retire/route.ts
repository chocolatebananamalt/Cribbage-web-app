import { NextRequest } from "next/server";

import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isRetireSidePoolRequest, isSidePoolRetirementResult } from "../../../../../../../lib/api/side-pool-retirement";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

// Its own segment rather than a ninth action on the side-pools mutation route,
// so the one request that removes a pool cannot be reached by a payload that
// merely resembles an election or a payout.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isRetireSidePoolRequest(body)) return apiJson({ error: "invalid_retire_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });

    const admin = createServerOnlyAdminClient();
    const { data, error } = await admin.rpc("retire_event_side_pool_v1", {
      p_actor_id: subject,
      p_tournament_id: id,
      p_event_id: body.eventId,
      p_pool_id: body.poolId,
      p_reason: body.reason.trim(),
      p_operation_id: body.idempotencyKey,
    });

    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (!isSidePoolRetirementResult(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    // A pool that holds money is a real, reportable answer. It carries its own
    // code and its activity counts back to the director rather than the generic
    // message a transport failure gets.
    if (data.status === "rejected") return apiJson(data, { status: 409 });
    return apiJson(data);
  });
}
