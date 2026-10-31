import { isUuid } from "../../../lib/api/validation";
import { getCurrentSubject } from "../../../lib/auth/current-subject";
import { createServerOnlyAdminClient } from "../../../lib/supabase/private-admin";
import { getOfficialInvitationContext } from "../../../lib/official-invitation-context";
import OfficialInvitationClient from "./official-invitation-client";

export const dynamic = "force-dynamic";
export default async function OfficialInvitationPage({ params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const actorId = await getCurrentSubject();
  const legacy = secret.length >= 32 && !isUuid(secret);
  let context = null;
  if (actorId && isUuid(secret)) {
    // An unavailable reader/migration fails closed; never infer context from URL.
    try { context = await getOfficialInvitationContext(createServerOnlyAdminClient(), actorId, secret); } catch { context = null; }
  }
  return <main className="auth-shell"><section className="auth-card"><OfficialInvitationClient invitationId={secret} initial={context} legacy={legacy} signedIn={!!actorId} /></section></main>;
}
