import { NextRequest } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { isUuid } from "../../../../../../lib/api/validation";
import { isAcceptedRosterStatus, isRejectedRosterStatus, isRosterStatusRequest } from "../../../../../../lib/api/roster-status";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isRosterStatusRequest(body)) return apiJson({ error: "invalid_roster_status" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("set_roster_entry_active_status_v1", {
      p_actor_id: actorId, p_tournament_id: id, p_roster_entry_id: body.rosterEntryId, p_action: body.action,
      p_reason_code: body.reasonCode, p_note: body.note, p_idempotency_key: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedRosterStatus(data, body)) return apiJson(data);
    if (isRejectedRosterStatus(data, body.rosterEntryId)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
