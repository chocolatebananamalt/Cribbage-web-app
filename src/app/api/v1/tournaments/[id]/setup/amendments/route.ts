import { NextRequest } from "next/server";

import { isRejectedSetupAmendment, isSetupAmendmentRequest, isSetupAmendmentResult } from "../../../../../../../lib/api/setup-amendment";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { readLargeJson } from "../../../../../../../lib/api/bounded-json";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readLargeJson(request);
    if (!isUuid(id) || !isSetupAmendmentRequest(body)) return apiJson({ error: "invalid_amendment" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const coreEvents = body.events.map((event) => { const coreEvent = { ...event }; Reflect.deleteProperty(coreEvent, "sidePools"); return coreEvent; });
    const { data, error } = await createServerOnlyAdminClient().rpc("append_tournament_setup_events_v1", {
      p_actor_id: subject,
      p_tournament_id: id,
      p_expected_setup_revision_id: body.expectedSetupRevisionId,
      p_expected_setup_version: body.expectedSetupVersion,
      p_events: coreEvents,
      p_operation_id: body.operationId,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    const admin = createServerOnlyAdminClient();
    const setupRevisionId = data && typeof data === "object" && !Array.isArray(data) && typeof (data as Record<string, unknown>).setupRevisionId === "string"
      ? (data as Record<string, unknown>).setupRevisionId : null;
    if (setupRevisionId && data && typeof data === "object" && (data as Record<string, unknown>).status === "tournament_setup_amended") {
      const configured = await admin.rpc("configure_tournament_setup_side_pools_v1", { p_actor_id: subject, p_tournament_id: id, p_setup_revision_id: setupRevisionId, p_events: body.events });
      if (configured.error || !configured.data || typeof configured.data !== "object" || (configured.data as Record<string, unknown>).status !== "setup_side_pools_configured") return apiJson({ error: "operation_unavailable" }, { status: 503 });
      const materialized = await admin.rpc("materialize_tournament_setup_side_pools_v1", { p_actor_id: subject, p_tournament_id: id, p_setup_revision_id: setupRevisionId });
      if (materialized.error || !materialized.data || typeof materialized.data !== "object" || (materialized.data as Record<string, unknown>).status !== "setup_side_pools_materialized") return apiJson({ error: "operation_unavailable" }, { status: 503 });
    }
    const amendedEvents = data && typeof data === "object" && !Array.isArray(data) && Array.isArray((data as Record<string, unknown>).events)
      ? (data as Record<string, unknown>).events as Array<Record<string, unknown>> : [];
    const teamEventIds = amendedEvents.filter((event) => ["doubles", "canadian_doubles"].includes(String(event.format))).map((event) => event.eventId);
    if (teamEventIds.length) {
      const enabled = await admin.rpc("enable_supported_team_scoring_v1", { p_actor_id: subject, p_tournament_id: id, p_event_ids: teamEventIds, p_parent_operation_id: body.operationId });
      if (enabled.error || !enabled.data || typeof enabled.data !== "object" || (enabled.data as Record<string, unknown>).status !== "supported_team_scoring_enabled") return apiJson({ error: "operation_unavailable" }, { status: 503 });
    }
    const normalized = data && typeof data === "object" && !Array.isArray(data)
      ? { ...data as Record<string, unknown>, events: Array.isArray((data as Record<string, unknown>).events)
        ? ((data as Record<string, unknown>).events as Array<Record<string, unknown>>).map((event) => ({
          ...event,
          scoringMethod: ["doubles", "canadian_doubles"].includes(String(event.format)) ? "digital" : event.scoringMethod,
        }))
        : (data as Record<string, unknown>).events }
      : data;
    if (isSetupAmendmentResult(normalized, body)) return apiJson(normalized);
    if (isRejectedSetupAmendment(data)) {
      if (["tournament_unavailable", "not_director"].includes(data.code)) return apiJson({ error: "not_found" }, { status: 404 });
      return apiJson(data, { status: 409 });
    }
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
