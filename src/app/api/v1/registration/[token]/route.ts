import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { isUuid } from "../../../../../lib/api/validation";

const tokenPattern = /^[A-Za-z0-9_-]{24,200}$/;
const paymentMethods = ["cash", "check", "other", "unspecified"] as const;

function isPaymentMethod(value: unknown): value is (typeof paymentMethods)[number] {
  return typeof value === "string" && paymentMethods.includes(value as (typeof paymentMethods)[number]);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenPattern.test(token)) return NextResponse.json({ error: "registration_unavailable" }, { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_registration_context", { p_token: token });
  if (error) return NextResponse.json({ error: "registration_unavailable" }, { status: 503 });
  if (!data || typeof data !== "object") return NextResponse.json({ error: "registration_unavailable" }, { status: 404 });
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!tokenPattern.test(token)
    || typeof body.displayName !== "string" || body.displayName.trim().length < 1 || body.displayName.trim().length > 160
    || typeof body.email !== "string" || body.email.trim().length < 3 || body.email.trim().length > 320
    || (body.accNumber !== undefined && typeof body.accNumber !== "string")
    || !isPaymentMethod(body.intendedPaymentMethod)
    || !isUuid(body.idempotencyKey)) return NextResponse.json({ error: "invalid_registration" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_public_registration_claim", {
    p_token: token,
    p_display_name: body.displayName,
    p_email: body.email,
    p_acc_number: body.accNumber ?? "",
    p_intended_payment_method: body.intendedPaymentMethod,
    p_client_operation_id: body.idempotencyKey,
  });
  if (error) return NextResponse.json({ error: "registration_unavailable" }, { status: 503 });
  if (!data || typeof data !== "object") return NextResponse.json({ error: "registration_unavailable" }, { status: 503 });
  const result = data as { status?: unknown };
  if (result.status === "unavailable") return NextResponse.json({ error: "registration_unavailable" }, { status: 404 });
  if (result.status === "rejected") {
    const code = (result as { code?: unknown }).code;
    if (code === "registration_rate_limited" || code === "registration_capacity_reached") return NextResponse.json({ error: "registration_temporarily_unavailable" }, { status: 429 });
    if (code === "idempotency_conflict") return NextResponse.json({ error: "registration_retry_conflict" }, { status: 409 });
    return NextResponse.json({ error: "invalid_registration" }, { status: 400 });
  }
  if (result.status !== "received") return NextResponse.json({ error: "registration_unavailable" }, { status: 503 });
  return NextResponse.json({ status: "received" }, { status: 201, headers: { "cache-control": "no-store" } });
}
