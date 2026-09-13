import { NextRequest } from "next/server";

import {
  isRejectedSetupActivation,
  isSetupActivationRequest,
  isSetupActivationResult,
  isSetupActivationState,
} from "../../../../../../../lib/api/setup-activation";
import {
  apiJson,
  readSmallJson,
  requireVerifiedSubject,
  withApiFailureBoundary,
} from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_tournament" }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc(
      "get_tournament_setup_activation_state_v3",
      { p_actor_id: subject, p_tournament_id: id },
    );
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (data === null) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSetupActivationState(data)) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    return apiJson(data);
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isSetupActivationRequest(body)) {
      return apiJson({ error: "invalid_activation" }, { status: 400 });
    }
    const subject = await requireVerifiedSubject(await createClient());
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });

    const { data, error } = await createServerOnlyAdminClient().rpc(
      "activate_tournament_setup_v2",
      {
        p_actor_id: subject,
        p_tournament_id: id,
        p_setup_revision_id: body.setupRevisionId,
        p_expected_version: body.expectedVersion,
        p_idempotency_key: body.idempotencyKey,
      },
    );
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isSetupActivationResult(data, body)) return apiJson(data);
    if (isRejectedSetupActivation(data)) {
      if (["tournament_unavailable", "not_director"].includes(data.code)) {
        return apiJson({ error: "not_found" }, { status: 404 });
      }
      return apiJson(data, { status: 409 });
    }
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
