import { NextRequest } from "next/server";
import { isCrossCheckerAssignmentRequest } from "../../../../../../lib/api/cross-checker-assignment";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { assignCrossChecker, getCrossCheckerAssignmentWorkspace } from "../../../../../../lib/cross-checker-assignment";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const workspace = await getCrossCheckerAssignmentWorkspace(createServerOnlyAdminClient(), subject, id);
    if (!workspace) return apiJson({ error: "not_found" }, { status: 404 });
    return apiJson(workspace);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isCrossCheckerAssignmentRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const result = await assignCrossChecker(createServerOnlyAdminClient(), {
      actorId: subject,
      tournamentId: id,
      rosterEntryId: body.rosterEntryId,
      operationId: body.operationId,
    });
    if (result.status === "rejected") return apiJson({ error: result.code }, { status: 409 });
    return apiJson(result);
  });
}

