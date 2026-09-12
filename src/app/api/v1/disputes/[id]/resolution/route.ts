import { NextRequest } from "next/server";

import {
  isRejectedEventDispute,
  isResolvedEventDisputeOutcome,
  isResolveEventDisputeRequest,
  resolveEventDispute,
} from "../../../../../../lib/api/event-disputes";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isResolveEventDisputeRequest(body)) {
      return apiJson({ error: "invalid_event_dispute_resolution" }, { status: 400 });
    }
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await resolveEventDispute(createServerOnlyAdminClient(), actorId, id, body);
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isResolvedEventDisputeOutcome(data, id)) return apiJson(data);
    if (isRejectedEventDispute(data, id, true)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
