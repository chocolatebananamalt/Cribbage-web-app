import { NextRequest } from "next/server";

import { isPaperCardUploadMetadata, isPaperCardUploadRequest } from "../../../../../../../../lib/api/paper-card-upload";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { createSignedPaperCardUpload, paperCardStorageEnabled } from "../../../../../../../../lib/paper-games/private-card-storage";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; captureId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!paperCardStorageEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, captureId } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isUuid(captureId) || !isPaperCardUploadRequest(body)) return apiJson({ error: "invalid_upload_request" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("authorize_paper_card_upload_v1", {
      p_actor_id: actorId, p_tournament_id: id, p_capture_id: captureId,
      p_upload_intent_id: body.uploadIntentId, p_object_reference_id: body.objectReferenceId,
    });
    if (error || !isPaperCardUploadMetadata(data)) return apiJson({ error: "upload_unavailable" }, { status: 409 });
    const signed = await createSignedPaperCardUpload(data.objectPath);
    return apiJson({ status: "upload_authorized", ...data, token: signed.token });
  });
}
