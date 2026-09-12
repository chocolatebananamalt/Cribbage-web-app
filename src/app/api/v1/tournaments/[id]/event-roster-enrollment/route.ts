import { NextRequest } from "next/server";

import {
  isEventRosterEnrollmentRequest,
  isEventRosterEnrollmentResult,
  isEventRosterEnrollmentWorkspace,
  isRejectedEventRosterEnrollment,
} from "../../../../../../lib/api/event-roster-enrollment";
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_tournament" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc(
      "get_event_roster_enrollment_workspace_v3",
      { p_actor_id: subject, p_tournament_id: id },
    );
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isEventRosterEnrollmentWorkspace(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    return apiJson(data);
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readLargeJson(request);
    if (!isUuid(id) || !isEventRosterEnrollmentRequest(body)) {
      return apiJson({ error: "invalid_event_roster_enrollment" }, { status: 400 });
    }
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc(
      "enroll_roster_entries_in_event_v3",
      {
        p_actor_id: subject,
        p_tournament_id: id,
        p_event_id: body.eventId,
        p_roster_entry_ids: body.rosterEntryIds,
        p_idempotency_key: body.idempotencyKey,
      },
    );
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isEventRosterEnrollmentResult(data, body)) return apiJson(data);
    if (isRejectedEventRosterEnrollment(data)) {
      if (["tournament_unavailable", "not_director"].includes(data.code)) {
        return apiJson({ error: "not_found" }, { status: 404 });
      }
      return apiJson(data, { status: 409 });
    }
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
