import { NextRequest } from "next/server";
import { integratedTestBackendRef } from "../../../../../../lib/integrated-test-target";
import { fictionalDrawBoundaryEnabled } from "../../../../../../lib/api/fictional-draw-enabled";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { readBoundedJson } from "../../../../../../lib/api/bounded-json";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";

const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
const exact = (x: Record<string, unknown>, keys: string[]) => Object.keys(x).sort().join() === keys.sort().join();
/** Default-off, isolated preview boundary. The SQL candidate is also ungranted
 * by default and requires a separately verified operator marker and scope. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 return withApiFailureBoundary(async () => {
  if (!fictionalDrawBoundaryEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
  if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
  const { id } = await params, body = await readBoundedJson(request, 2048);
  if (!uuid(id) || !body || typeof body !== "object" || Array.isArray(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
  const x = body as Record<string, unknown>;
  const common = uuid(x.eventId) && uuid(x.operationId) && x.confirmed === true;
  const admission = x.action === "admit" && exact(x, ["action", "eventId", "operationId", "confirmed"]);
  const publish = x.action === "publish_schedule" && exact(x, ["action", "eventId", "operationId", "confirmed", "reviewedActorId", "reviewedOperationId"]) && uuid(x.reviewedActorId) && uuid(x.reviewedOperationId);
  if (!common || (!admission && !publish)) return apiJson({ error: "invalid_request" }, { status: 400 });
  const actor = await requireVerifiedSubject(await createClient());
  if (!uuid(actor)) return apiJson({ error: "unauthorized" }, { status: 401 });
  const args = { p_actor_id: actor, p_tournament_id: id, p_event_id: x.eventId, p_operation_id: x.operationId, p_confirmed: true, p_project_ref: integratedTestBackendRef() };
  const { data, error } = await createServerOnlyAdminClient().rpc(admission ? "admit_fictional_draw_v1" : "publish_fictional_draw_schedule_v1", publish ? { ...args, p_reviewed_actor_id: x.reviewedActorId, p_reviewed_operation_id: x.reviewedOperationId } : args);
  if (await requireVerifiedSubject(await createClient()) !== actor) return apiJson({ error: "operation_outcome_unknown" }, { status: 503 });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return apiJson({ error: "operation_outcome_unknown" }, { status: 503 });
  if (admission && data.status === "trial_scope_recorded" && Number.isInteger(data.version) && uuid(data.scopeVersionId) && typeof data.expiresAt === "string") return apiJson(data);
  if (publish && data.status === "event_schedule_published" && data.eventId === x.eventId && data.gameCount === 12 && data.participantCount === 18 && data.matchCount === 108 && uuid(data.publicationId)) return apiJson(data);
  return apiJson({ error: "operation_outcome_unknown" }, { status: 503 });
 });
}

