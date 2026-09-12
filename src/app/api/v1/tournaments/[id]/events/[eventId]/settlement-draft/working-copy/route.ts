import { NextRequest, NextResponse } from "next/server";

import { getQualificationResult } from "../../../../../../../../../lib/api/qualification-finalization";
import { getSettlementWorkspace } from "../../../../../../../../../lib/api/settlement-draft";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../../../../lib/api/validation";
import { buildSettlementWorkingCopyCsv } from "../../../../../../../../../lib/results/settlement-working-copy";
import { createServerOnlyAdminClient } from "../../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id, eventId } = await params;
    if (!isUuid(id) || !isUuid(eventId)) return apiJson({ error: "invalid_settlement_working_copy" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const admin = createServerOnlyAdminClient();
    const workspace = await getSettlementWorkspace(admin, actorId, id, eventId);
    if (!workspace) return apiJson({ error: "settlement_working_copy_unavailable" }, { status: 404 });
    const qualification = await getQualificationResult(admin, actorId, id, eventId);
    if (!qualification) return apiJson({ error: "settlement_working_copy_unavailable" }, { status: 404 });
    const csv = buildSettlementWorkingCopyCsv(workspace, qualification);
    if (!csv) return apiJson({ error: "settlement_draft_required" }, { status: 409 });
    return new NextResponse(csv, {
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "content-disposition": `attachment; filename="settlement-working-copy-v${workspace.draft?.version ?? 0}.csv"`,
        "content-type": "text/csv; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  });
}
