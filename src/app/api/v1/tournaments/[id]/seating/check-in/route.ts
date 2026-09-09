import { NextRequest } from "next/server";
import { createClient } from "../../../../../../../lib/supabase/server";
import { isCheckInRequest, isAcceptedCheckIn, isRejectedCheckIn } from "../../../../../../../lib/api/seating";
import { isUuid } from "../../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    let body: unknown;
    try { body = await request.json(); } catch { return apiJson({ error: "invalid_json" }, { status: 400 }); }
    if (!isUuid(id) || !isCheckInRequest(body)) return apiJson({ error: "invalid_check_in" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("record_roster_check_in_event_v2", { p_tournament_id: id, p_roster_entry_id: body.rosterEntryId, p_check_in_state: body.checkInState, p_reason: body.reason, p_idempotency_key: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedCheckIn(data, id, body)) return apiJson(data);
    if (isRejectedCheckIn(data, id, body)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
