import { NextRequest } from "next/server";

import {
  isRejectedSetupActivation,
  isSetupActivationRequest,
  isSetupActivationResult,
  isSetupActivationState,
} from "../../../../../../../lib/api/setup-activation";
import {
  apiJson,
  readSmallJson,
  requireVerifiedSubject,
  withApiFailureBoundary,
} from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_tournament" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const admin = createServerOnlyAdminClient();
    const { data, error } = await admin.rpc(
      "get_tournament_setup_activation_state_v3",
      { p_actor_id: subject, p_tournament_id: id },
    );
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSetupActivationState(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
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
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isSetupActivationRequest(body)) {
      return apiJson({ error: "invalid_activation" }, { status: 400 });
    }
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });

    const admin = createServerOnlyAdminClient();
    const { data, error } = await admin.rpc(
      "finalize_tournament_setup_and_open_registration_v1",
      {
        p_actor_id: subject,
        p_tournament_id: id,
        p_setup_revision_id: body.setupRevisionId,
        p_expected_version: body.expectedVersion,
        p_confirmed: body.confirmed,
        p_idempotency_key: body.idempotencyKey,
      },
    );
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    const activatedEvents = data && typeof data === "object" && !Array.isArray(data) && Array.isArray((data as Record<string, unknown>).events)
      ? (data as Record<string, unknown>).events as Array<Record<string, unknown>> : [];
    const teamEventIds = activatedEvents.filter((event) => ["doubles", "canadian_doubles"].includes(String(event.format))).map((event) => event.eventId);
    if (teamEventIds.length) {
      const enabled = await admin.rpc("enable_supported_team_scoring_v1", { p_actor_id: subject, p_tournament_id: id, p_event_ids: teamEventIds, p_parent_operation_id: body.idempotencyKey });
      if (enabled.error || !enabled.data || typeof enabled.data !== "object" || (enabled.data as Record<string, unknown>).status !== "supported_team_scoring_enabled") return apiJson({ error: "operation_unavailable" }, { status: 503 });
    }
    // The explicit audited promotion above commits supported doubles as
    // digital-capable without widening generic/custom team formats.
    const normalized = data && typeof data === "object" && !Array.isArray(data)
      ? { ...data as Record<string, unknown>, events: Array.isArray((data as Record<string, unknown>).events)
        ? ((data as Record<string, unknown>).events as Array<Record<string, unknown>>).map((event) => ({
          ...event,
          scoringMethod: ["doubles", "canadian_doubles"].includes(String(event.format)) ? "digital" : event.scoringMethod,
        }))
        : (data as Record<string, unknown>).events }
      : data;
    if (isSetupActivationResult(normalized, body)) return apiJson(normalized);
    if (isRejectedSetupActivation(data)) {
      if (["tournament_unavailable", "not_director"].includes(data.code)) {
        return apiJson({ error: "not_found" }, { status: 404 });
      }
      return apiJson(data, { status: 409 });
    }
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
