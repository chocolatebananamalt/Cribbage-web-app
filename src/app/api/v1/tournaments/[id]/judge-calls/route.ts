import { NextRequest } from "next/server";

import {
  changeLiveJudgeCall,
  getLiveJudgeCalls,
  isLiveJudgeCallRequest,
} from "../../../../../../lib/api/live-judge-calls";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

function rejected(data: unknown) {
  return !!data && typeof data === "object" && (data as Record<string, unknown>).status === "rejected";
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: "invalid_tournament" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const workspace = await getLiveJudgeCalls(createServerOnlyAdminClient(), actorId, id);
    return workspace ? apiJson(workspace) : apiJson({ error: "judge_calls_unavailable" }, { status: 403 });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (!isUuid(id) || !isLiveJudgeCallRequest(body)) return apiJson({ error: "invalid_judge_call" }, { status: 400 });
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await changeLiveJudgeCall(createServerOnlyAdminClient(), actorId, id, body);
    if (error || !data || typeof data !== "object") return apiJson({ error: "operation_unavailable" }, { status: 503 });
    return rejected(data) ? apiJson(data, { status: 409 }) : apiJson(data);
  });
}
