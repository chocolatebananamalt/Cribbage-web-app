import { NextRequest } from "next/server";

import { isEventStartRequest, isEventStartResult, isRejectedEventStart } from "../../../../../../lib/api/event-schedule";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readLargeJson(request);
    if (!isUuid(id) || !isEventStartRequest(body)) return apiJson({ error: "invalid_event_start" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("start_event_play_v1", {
      p_actor_id: subject,
      p_tournament_id: id,
      p_event_id: body.eventId,
      p_schedule_publication_id: body.schedulePublicationId,
      p_participant_snapshot_digest: body.participantSnapshotDigest,
      p_expected_participant_count: body.expectedParticipantCount,
      p_expected_game_count: body.expectedGameCount,
      p_confirmed: body.confirmed,
      p_idempotency_key: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isEventStartResult(data, body)) return apiJson(data);
    if (isRejectedEventStart(data)) {
      if (["tournament_unavailable", "not_director"].includes(data.code)) return apiJson({ error: "not_found" }, { status: 404 });
      return apiJson(data, { status: 409 });
    }
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
