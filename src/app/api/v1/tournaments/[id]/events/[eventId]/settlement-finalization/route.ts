import { NextRequest } from "next/server";

import { finalizeManualSettlement, getManualSettlementFinalizationWorkspace, isManualSettlementFinalizationOutcome, isManualSettlementFinalizationRequest, isRejectedManualSettlementFinalization } from "../../../../../../../../lib/api/settlement-finalization";
import { apiJson, readMediumJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id, eventId } = await params;
    if (!isUuid(id) || !isUuid(eventId)) return apiJson({ error: "invalid_settlement_finalization" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const workspace = await getManualSettlementFinalizationWorkspace(createServerOnlyAdminClient(), actorId, id, eventId);
    return workspace ? apiJson(workspace) : apiJson({ error: "settlement_finalization_unavailable" }, { status: 404 });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId } = await params;
    const body = await readMediumJson(request);
    if (!isUuid(id) || !isUuid(eventId) || !isManualSettlementFinalizationRequest(body)) {
      return apiJson({ error: "invalid_settlement_finalization" }, { status: 400 });
    }
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await finalizeManualSettlement(createServerOnlyAdminClient(), actorId, id, eventId, body);
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isManualSettlementFinalizationOutcome(data, id, eventId)) return apiJson(data);
    if (isRejectedManualSettlementFinalization(data, eventId)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
