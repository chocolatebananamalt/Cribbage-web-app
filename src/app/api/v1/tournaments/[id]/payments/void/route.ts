import { NextRequest } from "next/server";
import { createClient } from "../../../../../../../lib/supabase/server";
import { isPaymentVoidRequest, isRejectedPayment, isVoidedPayment } from "../../../../../../../lib/api/payment";
import { isUuid } from "../../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
  if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
  const { id } = await params; const body = await readSmallJson(request);
  if (body === null) return apiJson({ error: "invalid_json" }, { status: 400 });
  if (!isUuid(id) || !isPaymentVoidRequest(body)) return apiJson({ error: "invalid_payment_void" }, { status: 400 });
  const supabase = await createClient();
  if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("void_manual_roster_payment", { p_tournament_id: id, p_roster_entry_id: body.rosterEntryId, p_expected_payment_version: body.expectedPaymentVersion, p_payment_event_id: body.paymentEventId, p_void_reason: body.voidReason, p_idempotency_key: body.idempotencyKey });
  if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
  if (isVoidedPayment(data, body)) return apiJson(data);
  if (isRejectedPayment(data, body.rosterEntryId, "void_manual_roster_payment")) return apiJson(data, { status: 409 });
  return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
