import { NextRequest } from "next/server";

import { isRegistrationLinkRevealRequest, readRegistrationLinkJson } from "../../../../../../../lib/api/registration-link";
import { registrationLinkManagementEnabled } from "../../../../../../../lib/api/public-registration-v2";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { getRegistrationLinkRevealAvailability } from "../../../../../../../lib/registration-link-reveal";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!registrationLinkManagementEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readRegistrationLinkJson(request);
    if (!isUuid(id) || !isRegistrationLinkRevealRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const status = await getRegistrationLinkRevealAvailability(createServerOnlyAdminClient(), {
      actorId: subject, tournamentId: id, expectedLinkId: body.expectedLinkId, expectedVersion: body.expectedVersion,
    });
    if (status === "rejected") return apiJson({ error: "registration_link_conflict" }, { status: 409 });
    return apiJson({ status });
  });
}
