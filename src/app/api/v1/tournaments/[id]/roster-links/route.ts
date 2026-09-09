import { NextRequest } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isRosterAccountLinkRequest, isAcceptedRosterAccountLink, isRejectedRosterAccountLink } from "../../../../../../lib/api/roster-lifecycle";
import { isUuid } from "../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params; let body: unknown;
    try { body = await request.json(); } catch { return apiJson({ error: "invalid_json" }, { status: 400 }); }
    if (!isUuid(id) || !isRosterAccountLinkRequest(body)) return apiJson({ error: "invalid_roster_account_link" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("link_roster_entry_to_account_v2", { p_tournament_id: id, p_roster_entry_id: body.rosterEntryId, p_profile_id: body.profileId, p_idempotency_key: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedRosterAccountLink(data, id, body)) return apiJson(data);
    if (isRejectedRosterAccountLink(data, id, body)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
