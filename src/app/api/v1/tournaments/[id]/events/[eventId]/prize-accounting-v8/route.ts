import { type NextRequest } from "next/server";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { isPrizeAccountingWorkspaceV8 } from "../../../../../../../../lib/api/prize-accounting-v8";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id, eventId } = await params;
    if (!isUuid(id) || !isUuid(eventId)) return apiJson({ error: "invalid_accounting_target" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_prize_accounting_workspace_v8", { p_actor_id: actor, p_tournament_id: id, p_event_id: eventId });
    return error ? apiJson({ error: "prize_accounting_unavailable" }, { status: 503 }) : data === null ? apiJson({ error: "forbidden" }, { status: 403 }) : isPrizeAccountingWorkspaceV8(data, id, eventId) ? apiJson(data) : apiJson({ error: "prize_accounting_unavailable" }, { status: 503 });
  });
}
