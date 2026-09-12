import { NextRequest } from "next/server";
import { isAcceptedPaperOfficialIdentity, isBindPaperOfficialIdentityRequest, isRejectedPaperOfficialIdentity } from "../../../../../../lib/api/paper-game-completion";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params; const body = await readSmallJson(request);
    if (!isUuid(id) || !isBindPaperOfficialIdentityRequest(body)) return apiJson({ error: "invalid_paper_official_identity" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("bind_paper_official_identity_v1", { p_actor_id: actorId, p_tournament_id: id, p_binding_id: body.bindingId, p_official_profile_id: body.officialProfileId, p_binding_kind: body.bindingKind, p_roster_entry_id: body.rosterEntryId, p_expected_binding_version: body.expectedBindingVersion, p_operation_id: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedPaperOfficialIdentity(data, body, id)) return apiJson(data);
    if (isRejectedPaperOfficialIdentity(data, body.bindingId)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
