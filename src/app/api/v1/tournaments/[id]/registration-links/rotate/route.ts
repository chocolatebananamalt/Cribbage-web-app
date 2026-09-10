import { NextRequest } from "next/server";

import { isRegistrationLinkRotateRequest, isRegistrationLinkRotateResult, readRegistrationLinkJson } from "../../../../../../../lib/api/registration-link";
import { publicRegistrationEnabled } from "../../../../../../../lib/api/public-registration-v2";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { rotateRegistrationLink } from "../../../../../../../lib/registration-link-issuer";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!publicRegistrationEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readRegistrationLinkJson(request);
    if (!isUuid(id) || !isRegistrationLinkRotateRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const result = await rotateRegistrationLink(createServerOnlyAdminClient(), {
      actorId: subject,
      tournamentId: id,
      expectedLinkId: body.expectedLinkId,
      expectedVersion: body.expectedVersion,
      expiresAt: new Date(body.expiresAt),
      maxClaims: body.maxClaims,
      maxClaimsPerHour: body.maxClaimsPerHour,
      operationId: body.operationId,
    });
    if (result.status === "credential_unavailable") return apiJson({ error: "credential_unavailable" }, { status: 409 });
    if (result.status === "rejected") return apiJson({ error: "registration_link_conflict" }, { status: 409 });
    const response = {
      status: result.status,
      linkId: result.credential.linkId,
      state: "open" as const,
      expiresAt: result.expiresAt,
      version: result.version,
      credential: result.credential.canonicalToken,
    };
    if (!isRegistrationLinkRotateResult({
      status: result.status,
      linkId: result.credential.linkId,
      state: "open",
      expiresAt: result.expiresAt,
      version: result.version,
    })) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    return apiJson(response, { status: 201 });
  });
}
