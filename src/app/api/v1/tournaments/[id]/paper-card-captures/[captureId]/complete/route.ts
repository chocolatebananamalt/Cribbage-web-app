import { NextRequest } from "next/server";

import { isPaperCardUploadCompletion, isPaperCardUploadMetadata, isPaperCardUploadRequest } from "../../../../../../../../lib/api/paper-card-upload";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { paperCardStorageEnabled, readAndVerifyPaperCard } from "../../../../../../../../lib/paper-games/private-card-storage";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; captureId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!paperCardStorageEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, captureId } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isUuid(captureId) || !isPaperCardUploadRequest(body)) return apiJson({ error: "invalid_upload_completion" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const admin = createServerOnlyAdminClient();
    const { data: metadata, error: metadataError } = await admin.rpc("authorize_paper_card_upload_completion_v1", {
      p_actor_id: actorId, p_tournament_id: id, p_capture_id: captureId,
      p_upload_intent_id: body.uploadIntentId, p_object_reference_id: body.objectReferenceId,
    });
    if (metadataError || !isPaperCardUploadMetadata(metadata)) return apiJson({ error: "upload_unavailable" }, { status: 409 });
    try { await readAndVerifyPaperCard(metadata.objectPath, metadata); }
    catch { return apiJson({ error: "image_integrity_mismatch" }, { status: 409 }); }
    const { data, error } = await admin.rpc("record_paper_card_storage_receipt_v1", {
      p_actor_id: actorId, p_tournament_id: id, p_capture_id: captureId,
      p_upload_intent_id: body.uploadIntentId, p_object_reference_id: body.objectReferenceId,
      p_object_path: metadata.objectPath, p_media_type: metadata.mediaType,
      p_byte_size: metadata.byteSize, p_sha256: metadata.sha256,
    });
    if (error || !isPaperCardUploadCompletion(data, captureId)) return apiJson({ error: "storage_receipt_unavailable" }, { status: 503 });
    return apiJson(data);
  });
}
