import { NextRequest } from "next/server";

import { getPlayoffOutcomeWorkspace, isPlayoffOutcomeResult, isPlayoffOutcomeRequest, isRejectedPlayoffOutcome, recordPlayoffOutcomes } from "../../../../../../../../lib/api/playoff-outcome";
import { apiJson, readMediumJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id, eventId } = await params;
    if (!isUuid(id) || !isUuid(eventId)) return apiJson({ error: "invalid_playoff_outcomes" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const workspace = await getPlayoffOutcomeWorkspace(createServerOnlyAdminClient(), actorId, id, eventId);
    return workspace ? apiJson(workspace) : apiJson({ error: "playoff_outcomes_unavailable" }, { status: 503 });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id, eventId } = await params;
    const body = await readMediumJson(request);
    if (!isUuid(id) || !isUuid(eventId) || !isPlayoffOutcomeRequest(body)) return apiJson({ error: "invalid_playoff_outcomes" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await recordPlayoffOutcomes(createServerOnlyAdminClient(), actorId, id, eventId, body);
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isPlayoffOutcomeResult(data, id, eventId)) return apiJson(data);
    if (isRejectedPlayoffOutcome(data, eventId)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
