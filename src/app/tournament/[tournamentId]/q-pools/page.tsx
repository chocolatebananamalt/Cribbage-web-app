import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isQPoolMembershipWorkspace } from "../../../../lib/api/q-pool-membership";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import QPoolMembershipClient from "./q-pools-client";

export const dynamic = "force-dynamic";

export default async function QPoolMembershipPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  let workspace = null;
  try {
    const { data, error } = await createServerOnlyAdminClient().rpc("get_q_pool_membership_workspace_v1", {
      p_actor_id: access.user.id,
      p_tournament_id: tournamentId,
    });
    if (!error && isQPoolMembershipWorkspace(data, tournamentId)) workspace = data;
  } catch {
    // RPC availability is a separate status from a supported/unsupported event shape.
  }
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="q-pool-title">
    <p className="eyebrow">EVENT MEMBERSHIP</p>
    <h1 id="q-pool-title">Q Pool Membership and Payment Allocation</h1>
    <p className="auth-note">Q Pool participation is a separate election for each configured pool. Elections do not create payments. Allocation records only use an existing receipt and obligation; enter the base fee and every Q Pool amount explicitly. Paid entry eligibility is not payout eligibility. Automatic payout and settlement are not part of this screen.</p>
    <QPoolMembershipClient actorId={access.user.id} tournamentId={tournamentId} canManage={["director", "co_director"].includes(access.role)} workspace={workspace}/>
    <SharedDeviceSignOut />
  </section></main>;
}
