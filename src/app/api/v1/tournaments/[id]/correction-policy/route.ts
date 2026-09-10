import { NextRequest } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isUuid } from "../../../../../../lib/api/validation";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { rule12CorrectionEnabled } from "../../../../../../lib/api/rule12-correction-release";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";

const policyRejectionCodes = ["authentication_required", "invalid_request", "tournament_not_configurable", "not_director", "stale_policy", "idempotency_conflict", "policy_rejected"];

function accepted(value: unknown, tournamentId: string, reasonRequired: boolean, requiredApprovals: 0 | 1, expectedPolicyVersion: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 5 && item.status === "configured" && item.tournament_id === tournamentId
    && item.policy_version === expectedPolicyVersion + 1
    && item.reason_required === reasonRequired && item.required_approvals === requiredApprovals;
}

function rejected(value: unknown, tournamentId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 3 && item.status === "rejected" && item.tournament_id === tournamentId && policyRejectionCodes.includes(item.code as string);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
  if (!rule12CorrectionEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
  if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
  const { id } = await params;
  const parsed = await readSmallJson(request);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apiJson({ error: "invalid_json" }, { status: 400 });
  const body = parsed as Record<string, unknown>;
  if (!isUuid(id) || typeof body.reasonRequired !== "boolean" || ![0, 1].includes(body.requiredApprovals as number) || !Number.isSafeInteger(body.expectedPolicyVersion) || (body.expectedPolicyVersion as number) < 0 || !isUuid(body.idempotencyKey)) {
    return apiJson({ error: "invalid_policy" }, { status: 400 });
  }
  const supabase = await createClient();
  if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
  const requiredApprovals = body.requiredApprovals as 0 | 1;
  const { data, error } = await supabase.rpc("configure_correction_policy", {
    p_tournament_id: id,
    p_reason_required: body.reasonRequired,
    p_required_approvals: requiredApprovals,
    p_expected_policy_version: body.expectedPolicyVersion,
    p_idempotency_key: body.idempotencyKey,
  });
  if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
  if (accepted(data, id, body.reasonRequired as boolean, requiredApprovals, body.expectedPolicyVersion as number)) return apiJson(data);
  if (rejected(data, id)) return apiJson(data, { status: 409 });
  return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
