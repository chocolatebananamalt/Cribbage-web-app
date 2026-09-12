import { NextRequest } from "next/server";
import { isPublicRegistrationClaim, publicRegistrationEnabled } from "../../../../../lib/api/public-registration-v2";
import { apiJson, readSmallJson, withApiFailureBoundary } from "../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../lib/api/same-origin";
import { digestRegistrationLinkCredential, parseRegistrationLinkCredential } from "../../../../../lib/registration-link-token";
import { createServerOnlyAdminClient } from "../../../../../lib/supabase/private-admin";

function bytea(value: Uint8Array) { return `\\x${Buffer.from(value).toString("hex")}`; }
function material(value: unknown): { salt: string } | null { return !!value && typeof value === "object" && Object.keys(value).length === 3 && typeof (value as Record<string, unknown>).salt === "string" ? { salt: (value as Record<string, unknown>).salt as string } : null; }

export async function POST(request: NextRequest) {
  return withApiFailureBoundary(async () => {
    if (!publicRegistrationEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const body = await readSmallJson(request);
    if (body === null) return apiJson({ error: "unavailable" }, { status: 404 });
    if (!isPublicRegistrationClaim(body)) return apiJson({ error: "unavailable" }, { status: 404 });
    const credential = parseRegistrationLinkCredential(body.credential);
    if (!credential) return apiJson({ error: "unavailable" }, { status: 404 });
    const admin = createServerOnlyAdminClient();
    const redemption = await admin.rpc("get_registration_link_redemption_material_v2", { p_link_id: credential.linkId });
    const current = material(redemption.data);
    const salt = current ? Buffer.from(current.salt, "base64") : null;
    if (redemption.error || !salt || salt.byteLength !== 32) return apiJson({ error: "unavailable" }, { status: 404 });
    const digest = digestRegistrationLinkCredential(salt, credential.canonicalToken);
    const result = await admin.rpc("submit_registration_claim_v3", { p_link_id: credential.linkId, p_digest: bytea(digest), p_display_name: body.displayName, p_email: body.email, p_acc_number: body.accNumber, p_intended_payment_method: body.intendedPaymentMethod, p_scorecard_type: body.scorecardType, p_client_operation_id: body.operationId });
    if (result.error || !result.data || typeof result.data !== "object") return apiJson({ error: "unavailable" }, { status: 404 });
    const response = result.data as Record<string, unknown>;
    if (response.status === "received" && Object.keys(response).length === 1) return apiJson({ status: "received" });
    if (response.status === "rejected" && response.code === "registration_capacity_reached" && Object.keys(response).length === 2) return apiJson({ status: "unavailable" }, { status: 409 });
    return apiJson({ error: "unavailable" }, { status: 404 });
  });
}
