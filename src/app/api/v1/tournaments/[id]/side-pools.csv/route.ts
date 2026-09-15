import { NextRequest, NextResponse } from "next/server";
import { isSidePoolWorkspace } from "../../../../../../lib/api/side-pools";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../lib/api/validation";
import { buildSidePoolDirectorCsv } from "../../../../../../lib/results/side-pool-export";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_tournament" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const admin = createServerOnlyAdminClient();
    const { data, error } = await admin.rpc("get_event_side_pool_director_export_v1", { p_actor_id: actorId, p_tournament_id: id });
    if (error) return apiJson({ error: "side_pool_export_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "forbidden" }, { status: 403 });
    if (!isSidePoolWorkspace(data)) return apiJson({ error: "side_pool_export_unavailable" }, { status: 503 });
    return new NextResponse(buildSidePoolDirectorCsv(data), { headers: {
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": `attachment; filename="side-pools-${id}.csv"`,
      "content-type": "text/csv; charset=utf-8",
      "x-content-type-options": "nosniff",
    } });
  });
}
