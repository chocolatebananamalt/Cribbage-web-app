import { NextRequest } from "next/server";
import {
  isAcceptedPaperGameCompletion,
  isCompletePaperGameRequest,
  isRejectedPaperGameCompletion,
} from "../../../../../../lib/api/paper-game-completion";
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
    if (!isUuid(id) || !isCompletePaperGameRequest(body)) return apiJson({ error: "invalid_paper_game_completion" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("complete_paper_vs_paper_game_v1", {
      p_actor_id: actorId,
      p_tournament_id: id,
      p_event_id: body.eventId,
      p_game_id: body.gameId,
      p_completion_id: body.completionId,
      p_expected_game_version: body.expectedGameVersion,
      p_side_a_claim: body.sideAClaim,
      p_side_b_claim: body.sideBClaim,
      p_operation_id: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedPaperGameCompletion(data, body)) return apiJson(data);
    if (isRejectedPaperGameCompletion(data, body.completionId)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
