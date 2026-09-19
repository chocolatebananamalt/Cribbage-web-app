import { NextRequest } from "next/server";

import { isEventPlayCloseRequest, isEventPlayCloseResult } from "../../../../../../../../lib/api/event-control";
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
    if (!isUuid(id) || !isUuid(eventId) || !isEventPlayCloseRequest(body)) {
      return apiJson({ error: "invalid_play_close_request" }, { status: 400 });
    }
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });

    const admin = createServerOnlyAdminClient();
    // Close and reopen share one route because they are one decision with two
    // directions, and splitting them would let a client hold a stale idea of
    // which one is currently available. The database decides that, not the page.
    const { data, error } = body.action === "close"
      ? await admin.rpc("close_event_play_v1", {
        p_actor_id: subject,
        p_tournament_id: id,
        p_event_id: eventId,
        p_reason: body.reason.trim(),
        // Forward the caller's own confirmation rather than a constant, so the
        // check inside close_event_play_v1 is a real second layer instead of a
        // guard the route always satisfies for it.
        p_confirmed: body.confirmed,
        p_operation_id: body.idempotencyKey,
      })
      : await admin.rpc("reopen_event_play_v1", {
        p_actor_id: subject,
        p_tournament_id: id,
        p_event_id: eventId,
        p_reason: body.reason.trim(),
        p_operation_id: body.idempotencyKey,
      });

    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (!isEventPlayCloseResult(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (data.status === "rejected") return apiJson(data, { status: 409 });
    return apiJson(data);
  });
}
