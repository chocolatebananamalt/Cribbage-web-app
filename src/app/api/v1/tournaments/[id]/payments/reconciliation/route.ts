import { NextRequest } from "next/server";
import { createClient } from "../../../../../../../lib/supabase/server";
import { isPaymentRecoveryRequest, isRecoveredPayment, isRejectedPayment } from "../../../../../../../lib/api/payment";
import { isUuid } from "../../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
  if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
  const { id } = await params; const body = await readSmallJson(request);
  if (body === null) return apiJson({ error: "invalid_json" }, { status: 400 });
  if (!isUuid(id) || !isPaymentRecoveryRequest(body)) return apiJson({ error: "invalid_payment_recovery" }, { status: 400 });
  const supabase = await createClient();
  if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("get_roster_payment_operation_identity_reconciliation", { p_tournament_id: id, p_roster_entry_id: body.rosterEntryId, p_operation_type: body.operationType, p_idempotency_key: body.idempotencyKey });
  if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
  if (!data || typeof data !== "object" || (data as Record<string, unknown>).authorized !== true || !("result" in (data as Record<string, unknown>))) return apiJson({ error: "operation_unavailable" }, { status: 503 });
  const result = (data as Record<string, unknown>).result;
  if (result === null || isRecoveredPayment(result, body) || isRejectedPayment(result, body.rosterEntryId, body.operationType)) return apiJson({ result });
  return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
