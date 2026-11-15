import { NextRequest } from "next/server";

import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isArchiveTournamentRequest, isTournamentArchiveResult } from "../../../../../../lib/api/tournament-archive";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isArchiveTournamentRequest(body)) return apiJson({ error: "invalid_archive_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });

    const admin = createServerOnlyAdminClient();
    const { data, error } = body.action === "archive"
      ? await admin.rpc("archive_tournament_v1", {
        p_actor_id: subject, p_tournament_id: id, p_reason: body.reason.trim(), p_operation_id: body.idempotencyKey,
      })
      : await admin.rpc("restore_tournament_v1", {
        p_actor_id: subject, p_tournament_id: id, p_operation_id: body.idempotencyKey,
      });

    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (!isTournamentArchiveResult(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    // A rejection is a real, reportable answer, not a transport failure, so it
    // carries its own code back to the director rather than a generic message.
    if (data.status === "rejected") return apiJson(data, { status: 409 });
    return apiJson(data);
  });
}
