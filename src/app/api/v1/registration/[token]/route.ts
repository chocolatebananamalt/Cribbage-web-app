import { NextRequest } from "next/server";
import { readPublicRegistrationContext } from "../../../../../lib/api/public-registration";
import { apiJson, withApiFailureBoundary } from "../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../lib/api/validation";
import { createClient } from "../../../../../lib/supabase/server";

const tokenPattern = /^[A-Za-z0-9_-]{24,200}$/;
const paymentMethods = ["cash", "check", "other", "unspecified"] as const;

function isPaymentMethod(value: unknown): value is (typeof paymentMethods)[number] {
  return typeof value === "string" && paymentMethods.includes(value as (typeof paymentMethods)[number]);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withApiFailureBoundary(async () => {
    const { token } = await params;
    if (!tokenPattern.test(token)) return apiJson({ error: "registration_unavailable" }, { status: 404 });
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_registration_context", { p_token: token });
    if (error) return apiJson({ error: "registration_unavailable" }, { status: 503 });
    if (!data) return apiJson({ error: "registration_unavailable" }, { status: 404 });
    const context = readPublicRegistrationContext(data);
    if (!context) return apiJson({ error: "registration_unavailable" }, { status: 503 });
    return apiJson(context);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return withApiFailureBoundary(async () => {
    const { token } = await params;
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return apiJson({ error: "invalid_json" }, { status: 400 }); }
    if (!tokenPattern.test(token)
      || typeof body.displayName !== "string" || body.displayName.trim().length < 1 || body.displayName.trim().length > 160
      || typeof body.email !== "string" || body.email.trim().length < 3 || body.email.trim().length > 320
      || (body.accNumber !== undefined && typeof body.accNumber !== "string")
      || !isPaymentMethod(body.intendedPaymentMethod)
      || !isUuid(body.idempotencyKey)) return apiJson({ error: "invalid_registration" }, { status: 400 });
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_public_registration_claim", {
      p_token: token, p_display_name: body.displayName, p_email: body.email, p_acc_number: body.accNumber ?? "", p_intended_payment_method: body.intendedPaymentMethod, p_client_operation_id: body.idempotencyKey,
    });
    if (error || !data || typeof data !== "object") return apiJson({ error: "registration_unavailable" }, { status: 503 });
    const result = data as { status?: unknown; code?: unknown };
    if (result.status === "unavailable") return apiJson({ error: "registration_unavailable" }, { status: 404 });
    if (result.status === "rejected") {
      if (result.code === "registration_rate_limited" || result.code === "registration_capacity_reached") return apiJson({ error: "registration_temporarily_unavailable" }, { status: 429 });
      if (result.code === "idempotency_conflict") return apiJson({ error: "registration_retry_conflict" }, { status: 409 });
      return apiJson({ error: "invalid_registration" }, { status: 400 });
    }
    if (result.status !== "received" || Object.keys(result).some((key) => key !== "status")) return apiJson({ error: "registration_unavailable" }, { status: 503 });
    return apiJson({ status: "received" }, { status: 201 });
  });
}
