import { NextRequest } from "next/server";

import { isDeskEventCheckIn, isDirectorQrIssue, isDirectorWindowAction } from "../../../../../../lib/api/event-check-in";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { issueEventCheckInCredential } from "../../../../../../lib/event-check-in-issuer";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_event_check_in_workspace_v1", { p_actor_id: actor, p_tournament_id: id });
    if (error || !data) return apiJson({ error: "not_found" }, { status: 404 });
    return apiJson(data);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !body || typeof body !== "object") return apiJson({ error: "invalid_request" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const admin = createServerOnlyAdminClient();
    if (isDeskEventCheckIn(body)) {
      const { data, error } = await admin.rpc("desk_check_in_event_v1", { p_actor_id: actor, p_tournament_id: id, p_event_id: body.eventId, p_roster_entry_id: body.rosterEntryId, p_idempotency_key: body.idempotencyKey });
      if (error || !data || typeof data !== "object") return apiJson({ error: "operation_unavailable" }, { status: 503 });
      return apiJson(data, { status: (data as Record<string, unknown>).status === "rejected" ? 409 : 200 });
    }
    if (isDirectorWindowAction(body)) {
      const rpc = body.action === "open" ? "open_event_check_in_window_v1" : "close_event_check_in_window_v1";
      const { data, error } = await admin.rpc(rpc, { p_actor_id: actor, p_tournament_id: id, p_event_id: body.eventId, p_idempotency_key: body.idempotencyKey });
      if (error || !data || typeof data !== "object") return apiJson({ error: "operation_unavailable" }, { status: 503 });
      return apiJson(data, { status: (data as Record<string, unknown>).status === "rejected" ? 409 : 200 });
    }
    if (isDirectorQrIssue(body)) {
      const issued = await issueEventCheckInCredential(admin, { actorId: actor, tournamentId: id, eventId: body.eventId, expiresAt: new Date(Date.now() + 60_000), operationId: body.idempotencyKey });
      const origin = request.nextUrl.origin;
      return apiJson({ status: "issued", eventId: body.eventId, expiresAt: issued.expiresAt, url: `${origin}/event-check-in#${issued.credential.canonicalToken}` });
    }
    return apiJson({ error: "invalid_request" }, { status: 400 });
  });
}
