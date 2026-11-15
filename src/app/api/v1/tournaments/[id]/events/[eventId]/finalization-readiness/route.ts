import { NextRequest } from "next/server";

import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { getEventFinalizationReadiness } from "../../../../../../../../lib/results/finalization-readiness";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  return withApiFailureBoundary(async () => {
    const { id, eventId } = await params;
    if (!isUuid(id) || !isUuid(eventId)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const supabase = await createClient();
    const subject = await requireVerifiedSubject(supabase);
    if (!subject) return apiJson({ error: "unauthorized" }, { status: 401 });
    const report = await getEventFinalizationReadiness(
      createServerOnlyAdminClient(), subject, id, eventId,
    );
    if (report === null) return apiJson({ error: "not_found" }, { status: 404 });
    return apiJson(report);
  });
}
