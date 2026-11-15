import { NextRequest } from "next/server";
import { isSetupOfficialManageRequest, isSetupOfficialNominationRequest, isSetupOfficialRole, isSetupOfficialsWorkspace } from "../../../../../../../lib/api/setup-officials";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../lib/supabase/server";
import { getSetupOfficialsWorkspace, manageSetupOfficial } from "../../../../../../../lib/setup-officials";
import { saveSetupOfficialInvitation } from "../../../../../../../lib/setup-official-delivery";

export const dynamic = "force-dynamic";

async function context(params: Promise<{ id: string; role: string }>) { const { id, role } = await params; if (!isUuid(id) || !isSetupOfficialRole(role)) return null; const actorId = await requireVerifiedSubject(await createClient()); return actorId ? { id, role, actorId } : null; }

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; role: string }> }) { return withApiFailureBoundary(async () => { const item = await context(params); if (!item) return apiJson({ error: "unauthorized" }, { status: 401 }); const workspace = await getSetupOfficialsWorkspace(createServerOnlyAdminClient(), item.actorId, item.id, item.role); return workspace && isSetupOfficialsWorkspace(workspace) ? apiJson(workspace) : apiJson({ error: "not_found" }, { status: 404 }); }); }

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; role: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const item = await context(params);
    const body = await readSmallJson(request);
    if (!item || !isSetupOfficialNominationRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 });
    const admin = createServerOnlyAdminClient();
    const result = await saveSetupOfficialInvitation(admin, { ...body, actorId: item.actorId, tournamentId: item.id, role: item.role }, async (path) => {
      const redirectTo = `${new URL(request.url).origin}/auth/callback?next=${encodeURIComponent(path)}`;
      const delivery = await admin.auth.signInWithOtp({ email: body.email.trim(), options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
      return !delivery.error;
    });
    const accepted = ["registered_approved", "invitation_link_ready", "invitation_email_sent", "delivery_unavailable"].includes(String(result.status));
    return apiJson(result, accepted ? undefined : { status: 409 });
  });
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; role: string }> }) { return withApiFailureBoundary(async () => { if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 }); const item = await context(params); const body = await readSmallJson(request); if (!item || !isSetupOfficialManageRequest(body)) return apiJson({ error: "invalid_request" }, { status: 400 }); const result = await manageSetupOfficial(createServerOnlyAdminClient(), { actorId: item.actorId, tournamentId: item.id, ...body }); return result.status === "rejected" ? apiJson(result, { status: 409 }) : apiJson(result); }); }
