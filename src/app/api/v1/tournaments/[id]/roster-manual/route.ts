import { NextRequest } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { isUuid } from "../../../../../../lib/api/validation";
import { isAcceptedManualRosterEntry, isManualRosterEntryRequest, isRejectedManualRosterEntry } from "../../../../../../lib/api/roster";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isManualRosterEntryRequest(body)) return apiJson({ error: "invalid_manual_roster_entry" }, { status: 400 });
    const supabase = await createClient();
    const actor = await requireVerifiedSubject(supabase);
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("create_manual_roster_entry_v2", {
      p_actor_id: actor,
      p_tournament_id: id,
      p_display_name: body.displayName,
      p_email: body.email,
      p_acc_number: body.accNumber,
      p_scorecard_type: body.scorecardType,
      p_idempotency_key: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedManualRosterEntry(data)) return apiJson(data);
    if (isRejectedManualRosterEntry(data)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
