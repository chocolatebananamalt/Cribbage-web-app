import { NextRequest } from "next/server";
import { isTournamentDayImportRequest, isAcceptedTournamentDayImport, isRejectedTournamentDayImport } from "../../../../../../lib/api/tournament-day-import";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readLargeJson(request);
    if (!isUuid(id) || !isTournamentDayImportRequest(body)) return apiJson({ error: "invalid_tournament_day_import" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("import_tournament_day_csv_v1", {
      p_actor_id: actor,
      p_tournament_id: id,
      p_rows: body.rows,
      p_idempotency_key: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedTournamentDayImport(data)) return apiJson(data);
    if (isRejectedTournamentDayImport(data)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
