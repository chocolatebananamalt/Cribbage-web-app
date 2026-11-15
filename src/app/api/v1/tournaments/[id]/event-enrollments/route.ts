import { NextRequest } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isEventEnrollmentRequest, isAcceptedEventEnrollment, isRejectedEventEnrollment } from "../../../../../../lib/api/roster-lifecycle";
import { isUuid } from "../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params; const body = await readSmallJson(request);
    if (body === null) return apiJson({ error: "invalid_json" }, { status: 400 });
    if (!isUuid(id) || !isEventEnrollmentRequest(body)) return apiJson({ error: "invalid_event_enrollment" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("enroll_linked_roster_entry_in_event_v2", { p_tournament_id: id, p_event_id: body.eventId, p_roster_entry_id: body.rosterEntryId, p_idempotency_key: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedEventEnrollment(data, id, body)) return apiJson(data);
    if (isRejectedEventEnrollment(data, id, body)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
