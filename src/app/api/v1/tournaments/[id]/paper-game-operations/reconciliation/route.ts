import { NextRequest } from "next/server";
import { isPaperGameOperationReconciliationRequest } from "../../../../../../../lib/api/paper-game-completion";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isPaperGameOperationReconciliationRequest(body)) return apiJson({ error: "invalid_paper_game_reconciliation" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_paper_game_operation_reconciliation_v1", {
      p_actor_id: actorId,
      p_tournament_id: id,
      p_operation_type: body.operationType,
      p_target_id: body.targetId,
      p_operation_id: body.idempotencyKey,
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    const result = data as Record<string, unknown>;
    if (result.authorized !== true || !Object.prototype.hasOwnProperty.call(result, "result")) return apiJson({ error: "unauthorized" }, { status: 403 });
    return apiJson({ result: result.result });
  });
}
