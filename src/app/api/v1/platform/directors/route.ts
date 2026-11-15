import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../lib/api/route-boundary";
import { getDirectorAdminWorkspace } from "../../../../../lib/director-administration";
import { createClient } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiFailureBoundary(async () => {
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const workspace = await getDirectorAdminWorkspace(actorId);
    return workspace ? apiJson(workspace) : apiJson({ error: "not_found" }, { status: 404 });
  });
}
