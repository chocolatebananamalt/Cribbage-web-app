import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../../../lib/supabase/server";
import { isPaymentRecordRequest, isRecordedPayment, isRejectedPayment } from "../../../../../../../lib/api/payment";
import { isUuid } from "../../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const { id } = await params; let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!isUuid(id) || !isPaymentRecordRequest(body)) return NextResponse.json({ error: "invalid_payment_record" }, { status: 400 });
  const supabase = await createClient(); const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("record_manual_roster_payment", { p_tournament_id: id, p_roster_entry_id: body.rosterEntryId, p_expected_payment_version: body.expectedPaymentVersion, p_amount_minor: body.amountMinor, p_currency_code: "USD", p_payment_method: body.paymentMethod, p_payment_received_at: body.paymentReceivedAt, p_note: body.note, p_idempotency_key: body.idempotencyKey });
  if (error) return NextResponse.json({ error: "operation_unavailable" }, { status: 503 });
  if (isRecordedPayment(data, body)) return NextResponse.json(data, { headers: { "cache-control": "private, no-store" } });
  if (isRejectedPayment(data, body.rosterEntryId)) return NextResponse.json(data, { status: 409, headers: { "cache-control": "private, no-store" } });
  return NextResponse.json({ error: "operation_unavailable" }, { status: 503 });
}
