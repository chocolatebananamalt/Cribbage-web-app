import { NextRequest } from "next/server";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isAcceptedScorecardPreference, isRejectedScorecardPreference, isScorecardPreferenceRequest } from "../../../../../../lib/api/scorecard-preference";
import { isUuid } from "../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isScorecardPreferenceRequest(body)) return apiJson({ error: "invalid_scorecard_preference" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("set_roster_scorecard_preference_v1", {
      p_actor_id: actorId,
      p_tournament_id: id,
      p_roster_entry_id: body.rosterEntryId,
      p_expected_version: body.expectedVersion,
      p_scorecard_type: body.scorecardType,
      p_reason: body.reason,
      p_idempotency_key: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAcceptedScorecardPreference(data, body)) return apiJson(data);
    if (isRejectedScorecardPreference(data, body.rosterEntryId)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
