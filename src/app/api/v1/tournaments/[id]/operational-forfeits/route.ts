import { type NextRequest } from "next/server";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isOperationalForfeitRecorded, isOperationalForfeitRequest, isScheduleAmendmentRejected } from "../../../../../../lib/api/schedule-amendments";
import { isUuid } from "../../../../../../lib/api/validation";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params; const body = await readLargeJson(request);
    if (!isUuid(id) || !isOperationalForfeitRequest(body)) return apiJson({ error: "invalid_operational_forfeit" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient()); if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("record_operational_forfeit_v1", { p_actor_id: actor, p_tournament_id: id, p_event_id: body.eventId, p_game_id: body.gameId, p_forfeit_id: body.forfeitId, p_winner_participant_id: body.winnerParticipantId, p_departing_participant_id: body.departingParticipantId, p_rule_case: body.ruleCase, p_director_reason: body.directorReason, p_idempotency_key: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isOperationalForfeitRecorded(data, body)) return apiJson(data); if (isScheduleAmendmentRejected(data)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
