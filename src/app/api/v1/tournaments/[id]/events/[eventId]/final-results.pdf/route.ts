import { NextRequest, NextResponse } from "next/server";

import { getFinalizedEventReport } from "../../../../../../../../lib/api/finalized-event-report";
import { isSidePoolWorkspace } from "../../../../../../../../lib/api/side-pools";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { buildFinalizedEventReportPdf } from "../../../../../../../../lib/results/finalized-event-report-pdf";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id, eventId } = await params;
    if (!isUuid(id) || !isUuid(eventId)) return apiJson({ error: "invalid_final_results_report" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const admin = createServerOnlyAdminClient();
    const report = await getFinalizedEventReport(admin, actorId, id, eventId);
    if (!report) return apiJson({ error: "final_results_not_ready" }, { status: 409 });
    const sidePoolResult = await admin.rpc("get_event_side_pool_workspace_v1", { p_actor_id: actorId, p_tournament_id: id });
    const sidePoolWorkspace = !sidePoolResult.error && isSidePoolWorkspace(sidePoolResult.data) ? sidePoolResult.data : null;
    const sidePools = sidePoolWorkspace?.events.find((item) => item.eventId === eventId)?.pools ?? [];
    const pdf = await buildFinalizedEventReportPdf(report, sidePools);
    return new NextResponse(new Uint8Array(pdf), { headers: {
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": `attachment; filename="tournament-results-${eventId}.pdf"`,
      "content-type": "application/pdf",
      "x-content-type-options": "nosniff",
    } });
  });
}
