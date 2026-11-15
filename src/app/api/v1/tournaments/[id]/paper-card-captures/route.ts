import { NextRequest } from "next/server";

import {
  isPaperCardCaptureRequest,
  isPaperCardCaptureResult,
  isRejectedPaperCardCapture,
  paperCardCaptureEnabled,
} from "../../../../../../lib/api/paper-card-capture";
import {
  apiJson,
  readSmallJson,
  requireVerifiedSubject,
  withApiFailureBoundary,
} from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiFailureBoundary(async () => {
    if (!paperCardCaptureEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isPaperCardCaptureRequest(body)) {
      return apiJson({ error: "invalid_paper_card_capture" }, { status: 400 });
    }
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });

    const { data, error } = await createServerOnlyAdminClient().rpc(
      "create_paper_card_capture_v1",
      {
        p_actor_id: subject,
        p_tournament_id: id,
        p_game_id: body.gameId,
        p_card_side: body.cardSide,
        p_verification_id: body.verificationId,
        p_source_kind: body.sourceKind,
        p_original_file_name: body.originalFileName,
        p_declared_media_type: body.declaredMediaType,
        p_declared_byte_size: body.declaredByteSize,
        p_declared_sha256: body.declaredSha256,
        p_client_captured_at: body.clientCapturedAt,
        p_idempotency_key: body.idempotencyKey,
      },
    );
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isPaperCardCaptureResult(data, body)) return apiJson(data);
    if (isRejectedPaperCardCapture(data)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
