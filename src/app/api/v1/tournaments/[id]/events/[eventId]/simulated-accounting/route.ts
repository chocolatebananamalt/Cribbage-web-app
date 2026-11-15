import { type NextRequest } from "next/server";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSyntheticPaperDeployment } from "../../../../../../../../lib/api/synthetic-paper-evidence";
import { namedMultiEventAwardPreview } from "../../../../../../../../lib/api/multi-event-award-preview";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSyntheticPaperDeployment(process.env)) return apiJson({ error: "not_found" }, { status: 404 });
    const { id, eventId } = await params;
    if (!isUuid(id) || !isUuid(eventId)) return apiJson({ error: "invalid_target" }, { status: 400 });
    const userClient = await createClient(); const actor = await requireVerifiedSubject(userClient);
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const admin = createServerOnlyAdminClient();
    const [preview, selector, standings] = await Promise.all([
      admin.rpc("get_multi_event_award_preview_v1", { actor, tid: id, eid: eventId }),
      admin.rpc("get_simulated_finance_selector_workspace_v1", { actor, tid: id, eid: eventId }),
      userClient.rpc("get_preliminary_event_standings", { p_tournament_id: id, p_event_id: eventId }),
    ]);
    if (preview.error || selector.error || standings.error) return apiJson({ error: "preview_unavailable" }, { status: 503 });
    if (preview.data === null || selector.data === null) return apiJson({ error: "forbidden" }, { status: 403 });
    const data = preview.data as Record<string, unknown>;
    if (data && data.status === "blocked" && typeof data.code === "string" && /^[a-z_]{1,80}$/.test(data.code)) return apiJson({ status: "blocked", code: data.code });
    const named = namedMultiEventAwardPreview(preview.data, selector.data, standings.data, id, eventId);
    if (!named) return apiJson({ error: "preview_unavailable" }, { status: 503 });
    const latest = await admin.rpc("get_multi_event_award_preview_v1", { actor, tid: id, eid: eventId });
    if (latest.error || !latest.data || latest.data.status !== "preview" || latest.data.sourceDigest !== named.sourceDigest) return apiJson({ error: "preview_unavailable" }, { status: 503 });
    return apiJson(named);
  });
}
