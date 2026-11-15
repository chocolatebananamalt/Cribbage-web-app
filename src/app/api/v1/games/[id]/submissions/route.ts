import { NextRequest } from "next/server";
import { isAcceptedSubmission, isRejectedSubmissionOperation } from "../../../../../../lib/api/game-operation";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { createClient } from "../../../../../../lib/supabase/server";

function rejectionStatus(code: unknown) {
  if (code === "authentication_required") return 401;
  if (code === "invalid_submission" || code === "invalid_request") return 400;
  return 409;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const rawBody = await readSmallJson(request);
    if (!rawBody || typeof rawBody !== "object") return apiJson({ error: "invalid_submission" }, { status: 400 });
    const body = rawBody as Record<string, unknown>;
    if (!isUuid(id) || !isUuid(body.submissionId) || !isUuid(body.idempotencyKey) || ![1, 2].includes(body.submissionSlot as number) || !["a", "b"].includes(body.winnerSide as string) || !Number.isInteger(body.margin) || (body.margin as number) < 1 || (body.margin as number) > 121) return apiJson({ error: "invalid_submission" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    // Pause All Play and Close Event (0229) are enforced here rather than inside
    // submit_game_score. That function is the path every player is using right
    // now and the one place a regression loses a real score, so the new gate
    // sits in front of it instead of inside it. A gate that cannot be read
    // refuses the submission: a broken gate that accepts scores into a closed
    // event is the exact outcome the control exists to prevent.
    //
    // Neither code appears in isRejectedSubmissionOperation's allowlist, which
    // is deliberate. isDefinitiveScoreMutationFailure therefore treats both as
    // non-definitive and the browser keeps the player's entry envelope, so the
    // same result can be retried after play resumes rather than being lost.
    const gate = await supabase.rpc("get_game_play_gate_v1", { p_game_id: id });
    if (gate.error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (gate.data === "paused" || gate.data === "closed") {
      return apiJson({ status: "rejected", game_id: id, code: gate.data === "paused" ? "event_play_paused" : "event_play_closed" }, { status: 409 });
    }
    const { data, error } = await supabase.rpc("submit_game_score", { p_game_id: id, p_submission_id: body.submissionId, p_submission_slot: body.submissionSlot, p_winner_side: body.winnerSide, p_margin: body.margin, p_idempotency_key: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isRejectedSubmissionOperation(data, id)) return apiJson(data, { status: rejectionStatus(data.code) });
    if (isAcceptedSubmission(data, id, body.submissionId as string)) return apiJson(data, { status: 200 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
