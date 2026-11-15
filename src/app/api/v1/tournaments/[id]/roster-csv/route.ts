import { NextRequest } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { isAcceptedRosterCsvImport, isRejectedRosterCsvImport, isRosterCsvImportRequest } from "../../../../../../lib/api/roster";
import { isUuid } from "../../../../../../lib/api/validation";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readLargeJson(request);
    if (!isUuid(id) || !isRosterCsvImportRequest(body)) return apiJson({ error: "invalid_roster_csv" }, { status: 400 });
    const supabase = await createClient();
    const actor = await requireVerifiedSubject(supabase);
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("import_roster_csv_v3", { p_actor_id: actor, p_tournament_id: id, p_rows: body.rows, p_idempotency_key: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedRosterCsvImport(data)) return apiJson(data);
    if (isRejectedRosterCsvImport(data)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
