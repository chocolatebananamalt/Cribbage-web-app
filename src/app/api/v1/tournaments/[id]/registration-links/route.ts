import { NextRequest } from "next/server";
import { isRegistrationLinkIssueRequest, isRegistrationLinkState, readRegistrationLinkJson } from "../../../../../../lib/api/registration-link";
import { registrationLinkManagementEnabled } from "../../../../../../lib/api/public-registration-v2";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { issueRegistrationLink } from "../../../../../../lib/registration-link-issuer";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!registrationLinkManagementEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc("get_registration_link_state_v2", {
      p_actor_id: subject, p_tournament_id: id,
    });
    if (error || !isRegistrationLinkState(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    return apiJson(data);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!registrationLinkManagementEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readRegistrationLinkJson(request);
    if (!isUuid(id) || !isRegistrationLinkIssueRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const issued = await issueRegistrationLink(createServerOnlyAdminClient(), {
      actorId: subject, tournamentId: id, expiresAt: new Date(body.expiresAt),
      maxClaims: body.maxClaims, maxClaimsPerHour: body.maxClaimsPerHour, operationId: body.operationId,
    });
    if (issued.status === "rejected") return apiJson({ error: "registration_link_conflict" }, { status: 409 });
    if (issued.status === "credential_unavailable") return apiJson({ error: "credential_unavailable" }, { status: 409 });
    return apiJson(
      { status: "issued", credential: issued.credential.canonicalToken, expiresAt: issued.expiresAt },
      { status: 201 },
    );
  });
}
