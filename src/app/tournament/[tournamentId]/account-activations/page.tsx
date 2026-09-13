import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { accountActivationEnabled } from "../../../../lib/api/account-activation-release";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getRosterAccountActivationWorkspace } from "../../../../lib/roster-account-activation-workspace";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import ActivationWorkspaceClient from "./activation-workspace-client";

export const dynamic = "force-dynamic";

export default async function AccountActivationsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!accountActivationEnabled() || !isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const workspace = await getRosterAccountActivationWorkspace(createServerOnlyAdminClient(), access.user.id, tournamentId);
  if (!workspace) notFound();

  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="activation-workspace-title"><p className="eyebrow">PLAYER ACCESS</p><h1 id="activation-workspace-title">Player Account Activation</h1><p className="auth-note">Issue a private link to one unlinked roster entry. A different signed-in director must compare the player&apos;s request ID and witness phrase in person before approving it.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><ActivationWorkspaceClient tournamentId={tournamentId} workspace={workspace} /><SharedDeviceSignOut /></section></main>;
}
