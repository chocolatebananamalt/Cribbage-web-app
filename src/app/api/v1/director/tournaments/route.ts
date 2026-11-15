import { NextRequest } from "next/server";
import { isCreateTournamentRequest, isTournamentCreated } from "../../../../../lib/api/director-administration";
import { isSameOriginRequest } from "../../../../../lib/api/same-origin";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../lib/api/route-boundary";
import { createTournamentDraft } from "../../../../../lib/director-administration";
import { createClient } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const body = await readSmallJson(request);
    if (!isCreateTournamentRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const result = await createTournamentDraft(actorId, body);
    if (!result) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (!isTournamentCreated(result)) return apiJson({ error: "code" in result ? result.code : "creation_rejected" }, { status: 409 });
    return apiJson(result);
  });
}
