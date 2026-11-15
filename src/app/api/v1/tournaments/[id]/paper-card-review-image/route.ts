import { NextRequest, NextResponse } from "next/server";

import { isPaperCardReviewImageAuthorization } from "../../../../../../lib/api/paper-card-review-image";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../lib/api/validation";
import { paperCardStorageEnabled, readAndVerifyPaperCard } from "../../../../../../lib/paper-games/private-card-storage";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!paperCardStorageEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    const { id } = await params;
    const gameId = request.nextUrl.searchParams.get("gameId");
    const cardSide = request.nextUrl.searchParams.get("cardSide");
    if (!isUuid(id) || !isUuid(gameId) || (cardSide !== "a" && cardSide !== "b")) {
      return apiJson({ error: "invalid_paper_card_review" }, { status: 400 });
    }
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const admin = createServerOnlyAdminClient();
    const { data, error } = await admin.rpc("authorize_paper_card_human_review_v1", {
      p_actor_id: actorId,
      p_tournament_id: id,
      p_game_id: gameId,
      p_card_side: cardSide,
    });
    if (error || !isPaperCardReviewImageAuthorization(data)) {
      return apiJson({ error: "paper_card_image_unavailable" }, { status: 404 });
    }
    let verified;
    try { verified = await readAndVerifyPaperCard(data.objectPath, data); }
    catch { return apiJson({ error: "image_integrity_mismatch" }, { status: 409 }); }
    return new NextResponse(new Uint8Array(verified.bytes), {
      status: 200,
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `inline; filename="paper-scorecard.${data.mediaType === "image/jpeg" ? "jpg" : data.mediaType.split("/")[1]}"`,
        "content-length": String(verified.byteSize),
        "content-type": data.mediaType,
        "x-content-type-options": "nosniff",
      },
    });
  });
}
