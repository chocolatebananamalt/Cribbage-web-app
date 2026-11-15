import { NextRequest } from "next/server";
import { isPrizeScheduleResolution } from "../../../../../../../../lib/api/prize-schedule";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";
// POST is a same-origin bounded read: it creates no operation receipt or business record.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId } = await params, body = await readSmallJson(request);
    if (!isUuid(id) || !isUuid(eventId) || !body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).join(",") !== "source") return apiJson({ error: "invalid_source" }, { status: 400 });
    const source = (body as { source: unknown }).source;
    if (!source || typeof source !== "object" || Array.isArray(source) || Object.keys(source).sort().join(",") !== "kind,qualificationResultVersionId,resultId") return apiJson({ error: "invalid_source" }, { status: 400 });
    const s = source as Record<string, unknown>;
    if (!["legacy_placement_v2", "playoff_outcome_v3"].includes(s.kind as string) || !isUuid(s.resultId) || !isUuid(s.qualificationResultVersionId)) return apiJson({ error: "invalid_source" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_event_prize_schedule_resolution_v1", { p_actor_id: actorId, p_tournament_id: id, p_event_id: eventId, p_source: source });
    return !error && isPrizeScheduleResolution(data) ? apiJson(data) : apiJson({ error: "prize_schedule_unavailable" }, { status: 503 });
  });
}
