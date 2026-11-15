import { NextRequest } from "next/server";

import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

function isRequest(value: unknown): value is { eventId: string; idempotencyKey: string } {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 2 && "eventId" in value && "idempotencyKey" in value
    && isUuid((value as Record<string, unknown>).eventId) && isUuid((value as Record<string, unknown>).idempotencyKey);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params; const body = await readSmallJson(request);
    if (!isUuid(id) || !isRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("enable_supported_team_scoring_v1", {
      p_actor_id: subject, p_tournament_id: id, p_event_ids: [body.eventId], p_parent_operation_id: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (data && typeof data === "object" && !Array.isArray(data) && (data as Record<string, unknown>).status === "supported_team_scoring_enabled") return apiJson(data);
    if (data && typeof data === "object" && !Array.isArray(data) && (data as Record<string, unknown>).status === "rejected") return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
