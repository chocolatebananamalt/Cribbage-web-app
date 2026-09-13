import { NextRequest } from "next/server";
import { isAcceptedDeviceRecovery, isCreateDeviceRecoveryRequest, isRejectedDeviceRecovery } from "../../../../../../lib/api/device-failure-recovery";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isCreateDeviceRecoveryRequest(body)) return apiJson({ error: "invalid_device_recovery" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("create_device_failure_recovery_v1", {
      p_actor_id: actorId,
      p_tournament_id: id,
      p_game_id: body.gameId,
      p_recovery_id: body.recoveryId,
      p_winner_side: body.winnerSide,
      p_margin: body.margin,
      p_evidence: body.evidence,
      p_operation_id: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedDeviceRecovery(data, body)) return apiJson(data);
    if (isRejectedDeviceRecovery(data, body.recoveryId)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
