import { NextRequest } from "next/server";
import { createClient } from "../../../../../../../lib/supabase/server";
import { isUuid } from "../../../../../../../lib/api/validation";
import { isAcceptedManualRosterEntry, isRejectedManualRosterEntry } from "../../../../../../../lib/api/roster";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !isUuid((body as Record<string, unknown>).idempotencyKey)) return apiJson({ error: "invalid_manual_roster_reconciliation" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("get_manual_roster_entry_reconciliation_v1", { p_tournament_id: id, p_idempotency_key: (body as Record<string, unknown>).idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedManualRosterEntry(data) || isRejectedManualRosterEntry(data)) return apiJson({ result: data });
    return apiJson({ result: null });
  });
}
