import { NextRequest } from "next/server";
import { isSyntheticPaperDeployment } from "../../../../../../lib/api/synthetic-paper-evidence";
import { isAcceptedSimulationResult, isMultiEventSimulationAction } from "../../../../../../lib/api/multi-event-simulation-action";
import { isSimulatedFinanceSelector, projectSimulatedFinanceSelector } from "../../../../../../lib/api/simulated-finance-selector";
import { apiJson, readMediumJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

const names: Record<string, { rpc: string; status: string; event: boolean }> = {
  disclose: { rpc: "publish_multi_event_pool_disclosure_v1", status: "synthetic_pool_policy_disclosed", event: true },
  election: { rpc: "record_multi_event_simulated_pool_election_v1", status: "synthetic_pool_election_recorded", event: true },
  receipt: { rpc: "record_multi_event_synthetic_pool_receipt_v1", status: "synthetic_pool_receipt_recorded", event: false },
  expense: { rpc: "record_multi_event_finance_source_v1", status: "multi_event_source_recorded", event: false },
  classify: { rpc: "review_multi_event_expenses_v1", status: "synthetic_expenses_classified", event: true },
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSyntheticPaperDeployment(process.env)) return apiJson({ error: "not_found" }, { status: 404 });
    const { id } = await params;
    const eventId = request.nextUrl.searchParams.get("eventId");
    if (!isUuid(id) || !isUuid(eventId) || request.nextUrl.searchParams.size !== 1) return apiJson({ error: "invalid_request" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_simulated_finance_selector_workspace_v1", { actor, tid: id, eid: eventId });
    if (error || !isSimulatedFinanceSelector(data, id, eventId)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    return apiJson(projectSimulatedFinanceSelector(data as Record<string, unknown>));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSyntheticPaperDeployment(process.env)) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readMediumJson(request);
    if (!isUuid(id) || !isMultiEventSimulationAction(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const actor = await requireVerifiedSubject(await createClient());
    if (!actor) return apiJson({ error: "unauthorized" }, { status: 401 });
    const value = body as { action: string; operationId: string; eventId?: string; request: Record<string, unknown> };
    const action = names[value.action];
    if (!action) return apiJson({ error: "invalid_request" }, { status: 400 });
    // All these RPCs authorize the actor against database-owned roles and the
    // enrolled synthetic fixture. A role or actor in the request is rejected.
    const args: Record<string, unknown> = { actor, tid: id, op: value.operationId };
    if (action.event) args.eid = value.eventId;
    args[value.action === "expense" ? "request" : "req"] = value.request;
    const { data, error } = await createServerOnlyAdminClient().rpc(action.rpc, args);
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    const result = data as Record<string, unknown>;
    if (result.status === "rejected" && typeof result.code === "string" && /^[a-z_]{1,80}$/.test(result.code)) {
      return apiJson({ status: "rejected", code: result.code }, { status: 409 });
    }
    if (result.status !== action.status || !isAcceptedSimulationResult(result, value)) {
      return apiJson({ error: "operation_unavailable" }, { status: 503 });
    }
    return apiJson(result);
  });
}
