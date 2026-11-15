import { NextRequest } from "next/server";
import { createClient } from "../../../../../../../lib/supabase/server";
import { isInitialSeatingRequest, isAcceptedInitialSeating, isRejectedInitialSeating } from "../../../../../../../lib/api/seating";
import { isUuid } from "../../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { apiJson, readMediumJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readMediumJson(request);
    if (body === null) return apiJson({ error: "invalid_json" }, { status: 400 });
    if (!isUuid(id) || !isInitialSeatingRequest(body)) return apiJson({ error: "invalid_initial_seating" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("publish_initial_seating_v2", { p_tournament_id: id, p_table_count: body.tableCount, p_seats_per_table: body.seatsPerTable, p_assignments: body.assignments, p_idempotency_key: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedInitialSeating(data, id, body)) return apiJson(data);
    if (isRejectedInitialSeating(data, id, body)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
