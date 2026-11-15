import { NextRequest } from "next/server";
import { accountActivationEnabled } from "../../../../../../lib/api/account-activation-release";
import { isActivationIssueRequest } from "../../../../../../lib/api/roster-account-activation";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { issueRosterAccountActivation } from "../../../../../../lib/roster-account-activation-issuer";
import { getRosterAccountActivationWorkspace } from "../../../../../../lib/roster-account-activation-workspace";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!accountActivationEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const workspace = await getRosterAccountActivationWorkspace(createServerOnlyAdminClient(), subject, id);
    if (!workspace) return apiJson({ error: "not_found" }, { status: 404 });
    return apiJson(workspace);
  });
}

/**
 * Creates a single-use, fragment-delivered activation credential. This route
 * is off by default; it is not a fallback identity path for an unready pilot.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!accountActivationEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isActivationIssueRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const result = await issueRosterAccountActivation(createServerOnlyAdminClient(), {
      actorId: subject, tournamentId: id, rosterEntryId: body.rosterEntryId,
      expiresAt: new Date(body.expiresAt), operationId: body.operationId,
    });
    if (result.status === "rejected") return apiJson({ error: result.code }, { status: 409 });
    if (result.status === "credential_unavailable") return apiJson({ error: "credential_unavailable" }, { status: 409 });
    return apiJson({ status: "issued", credential: result.credential.canonicalToken, expiresAt: result.expiresAt });
  });
}
