import { NextRequest } from "next/server";

import { isEventPlayPauseRequest, isEventPlayPauseResult } from "../../../../../../../../lib/api/event-control";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isUuid(eventId) || !isEventPlayPauseRequest(body)) {
      return apiJson({ error: "invalid_play_pause_request" }, { status: 400 });
    }
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });

    const { data, error } = await createServerOnlyAdminClient().rpc("set_event_play_pause_v1", {
      p_actor_id: subject,
      p_tournament_id: id,
      p_event_id: eventId,
      p_action: body.action,
      p_reason: body.reason.trim(),
      p_operation_id: body.idempotencyKey,
    });

    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (!isEventPlayPauseResult(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    // A refusal is a real answer about the event, not a transport failure, so it
    // carries its own code back to the director rather than a generic message.
    if (data.status === "rejected") return apiJson(data, { status: 409 });
    return apiJson(data);
  });
}
