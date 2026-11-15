import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_tournament" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_event_prize_pinned_activation_capability_v1", { actor, tid: id });
    if (error || !data || typeof data !== "object" || Array.isArray(data)
      || Object.keys(data).sort().join(",") !== "available,hasV2Bindings,protocol" || data.available !== true || data.protocol !== "event-prize-pins-v1" || typeof data.hasV2Bindings !== "boolean") return apiJson({ error: "operation_unavailable" }, { status: 503 });
    return apiJson({ available: true, protocol: "event-prize-pins-v1", hasV2Bindings: data.hasV2Bindings });
  });
}
