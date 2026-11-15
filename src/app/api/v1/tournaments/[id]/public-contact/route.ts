import { NextRequest } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isUuid } from "../../../../../../lib/api/validation";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";

function validRequest(value: unknown): value is { directorName: string; idempotencyKey: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 2 && typeof item.directorName === "string" && item.directorName.trim().length >= 1 && item.directorName.trim().length <= 160 && !["tournament participant", "tournament director", "primary director"].includes(item.directorName.trim().toLowerCase()) && isUuid(item.idempotencyKey);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !validRequest(body)) return apiJson({ error: "invalid_public_contact" }, { status: 400 });
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("correct_tournament_public_contact_v1", { p_tournament_id: id, p_director_name: body.directorName, p_idempotency_key: body.idempotencyKey });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (data && typeof data === "object" && (data as Record<string, unknown>).status === "public_contact_corrected") return apiJson(data);
    if (data && typeof data === "object" && (data as Record<string, unknown>).status === "rejected") return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
