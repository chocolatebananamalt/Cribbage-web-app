import { NextRequest } from "next/server";

import { isAcceptedEventChange, isEventChangeRequest, isRejectedEventChange } from "../../../../../../lib/api/event-changes";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_tournament" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_event_change_workspace_v1", { p_actor_id: subject, p_tournament_id: id });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (!data) return apiJson({ error: "not_found" }, { status: 404 });
    return apiJson(data);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isEventChangeRequest(body)) return apiJson({ error: "invalid_event_change" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("change_event_lifecycle_v1", {
      p_actor_id: subject, p_tournament_id: id, p_event_id: body.eventId, p_action: body.action,
      p_reason: body.reason.trim(), p_operation_id: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedEventChange(data, body)) return apiJson(data);
    if (isRejectedEventChange(data)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
