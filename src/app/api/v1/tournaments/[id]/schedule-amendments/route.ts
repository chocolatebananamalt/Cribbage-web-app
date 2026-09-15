import { type NextRequest } from "next/server";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isAmendmentApplied, isAmendmentPreview, isScheduleAmendmentRejected, isScheduleAmendmentRequest } from "../../../../../../lib/api/schedule-amendments";
import { isUuid } from "../../../../../../lib/api/validation";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params; const body = await readLargeJson(request);
    if (!isUuid(id) || !isScheduleAmendmentRequest(body)) return apiJson({ error: "invalid_schedule_amendment" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient()); if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const admin = createServerOnlyAdminClient();
    const common = { p_actor_id: actor, p_tournament_id: id, p_event_id: body.eventId, p_operation_kind: body.operationKind, p_rule_basis: body.ruleBasis, p_director_reason: body.directorReason, p_proposed_schedule: body.proposedSchedule, p_expected_version: body.expectedVersion };
    if (request.nextUrl.searchParams.get("preview") === "1") {
      const { data, error } = await admin.rpc("preview_event_schedule_amendment_v1", common);
      if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
      if (isAmendmentPreview(data)) return apiJson(data); if (isScheduleAmendmentRejected(data)) return apiJson(data, { status: 409 });
      return apiJson({ error: "operation_unavailable" }, { status: 503 });
    }
    const { data, error } = await admin.rpc("confirm_event_schedule_amendment_v1", { ...common, p_amendment_id: body.amendmentId, p_idempotency_key: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isAmendmentApplied(data, body)) return apiJson(data); if (isScheduleAmendmentRejected(data)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
