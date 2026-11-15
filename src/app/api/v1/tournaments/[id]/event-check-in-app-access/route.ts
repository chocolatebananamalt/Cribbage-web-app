import { NextRequest } from "next/server";

import { accountActivationEnabled } from "../../../../../../lib/api/account-activation-release";
import { isCheckInAndSendAppAccessRequest } from "../../../../../../lib/api/check-in-and-send-app-access";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { checkInAndSendAppAccess } from "../../../../../../lib/check-in-and-send-app-access";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

/**
 * One desk action that checks a player in and issues their private activation
 * link. It is a separate route from tournaments/[id]/event-check-in rather
 * than another action on it, so the single-step desk controls that a director
 * is already using today keep their exact current behaviour.
 *
 * This route sends no email. The link comes back in the response for the
 * director to hand over or read out in person, because email delivery is
 * fail-closed by owner decision (docs/operations/DURABLE_PROJECT_MEMORY.md).
 * The witnessed approval protocol is unchanged: issuing a link does not link
 * an account, and a different signed-in director still approves the request.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    // The whole point of this route is app access. If the activation workflow
    // is ever hidden, this route goes with it rather than becoming a second
    // way in, which is the parity the sibling activation route keeps.
    if (!accountActivationEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isCheckInAndSendAppAccessRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });

    const outcome = await checkInAndSendAppAccess(createServerOnlyAdminClient(), {
      actorId: subject,
      tournamentId: id,
      eventId: body.eventId,
      rosterEntryId: body.rosterEntryId,
      expiresAt: new Date(body.expiresAt),
      checkInOperationId: body.checkInOperationId,
      activationOperationId: body.activationOperationId,
    });
    // Only the check-in step can make this a transport failure. Once it has
    // reported, the response carries both steps and the status reflects
    // whether the player was checked in, never whether the link was issued.
    if (outcome.outcome === "unavailable") return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (outcome.result.checkIn.status === "rejected") return apiJson(outcome.result, { status: 409 });
    return apiJson(outcome.result);
  });
}
