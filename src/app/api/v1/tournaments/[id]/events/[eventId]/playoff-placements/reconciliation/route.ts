import { NextRequest } from "next/server";

import { isPlayoffPlacementOutcome, isRejectedPlayoffPlacement } from "../../../../../../../../../lib/api/playoff-placement";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isUuid(eventId) || !body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || !("idempotencyKey" in body) || !isUuid(body.idempotencyKey)) return apiJson({ error: "invalid_reconciliation" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_standard_singles_playoff_placement_reconciliation_v1", {
      p_actor_id: actorId, p_tournament_id: id, p_event_id: eventId, p_operation_id: body.idempotencyKey,
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data)
      || Object.keys(data).sort().join(",") !== "authorized,result" || (data as Record<string, unknown>).authorized !== true) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    const result = (data as { result: unknown }).result;
    if (result !== null && !isPlayoffPlacementOutcome(result, id, eventId) && !isRejectedPlayoffPlacement(result, eventId)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    return apiJson({ result });
  });
}
