import { NextRequest } from "next/server";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../lib/api/same-origin";
import { acceptCoDirector } from "../../../../../lib/officials";
import { isOfficialRejection } from "../../../../../lib/api/officials";
import { createServerOnlyAdminClient } from "../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../lib/supabase/server";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, { params }: { params: Promise<{ secret: string }> }) { return withApiFailureBoundary(async () => { if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 }); const actorId = await requireVerifiedSubject(await createClient()); if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 }); const { secret } = await params; if (secret.length < 32) return apiJson({ error: "invalid_request" }, { status: 400 }); const result = await acceptCoDirector(createServerOnlyAdminClient(), { actorId, secret, operationId: crypto.randomUUID() }) as Record<string, unknown>; return isOfficialRejection(result) ? apiJson({ error: result.code }, { status: 409 }) : apiJson(result); }); }
