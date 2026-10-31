import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isQPoolMembershipWorkspace } from "../../../../lib/api/q-pool-membership";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import QPoolMembershipClient, { type QConsentPolicy } from "./q-pools-client";
import { isQPreviewSources, Q_POLICY_TEXT } from "../../../../lib/results/q-pool-preview";
import { qMembershipOperatingDisclosures } from "../../../../lib/results/q-membership-disclosures";
import { getSyntheticEventContext } from "../../../../lib/paper-games/synthetic-event-context";
import { SyntheticEventNotice } from "../../../../components/synthetic-event-notice";

export const dynamic = "force-dynamic";

export default async function QPoolMembershipPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const syntheticContext = await getSyntheticEventContext(access.user.id, tournamentId);
  let workspace = null;
  let policies: QConsentPolicy[] = [];
  try {
    const { data, error } = await createServerOnlyAdminClient().rpc("get_q_pool_membership_workspace_v1", {
      p_actor_id: access.user.id,
      p_tournament_id: tournamentId,
    });
    if (!error && isQPoolMembershipWorkspace(data, tournamentId)) workspace = data;
    const policyRead = await createServerOnlyAdminClient().rpc("get_q_pool_preview_sources_v1", { p_actor_id: access.user.id, p_tournament_id: tournamentId });
    if (!policyRead.error && isQPreviewSources(policyRead.data, tournamentId)) policies = policyRead.data.policies.map(p => ({ ...p, disclosureText: Q_POLICY_TEXT }));
    if (access.role === "director") {
      const operatingRead = await createServerOnlyAdminClient().rpc("get_q_operating_workspace_v2", { p_actor_id: access.user.id, p_tournament_id: tournamentId });
      const operatingPolicies = !operatingRead.error ? qMembershipOperatingDisclosures(operatingRead.data,tournamentId) : null;
      if (operatingPolicies) policies = [...policies,...operatingPolicies];
    }
  } catch {
    // RPC availability is a separate status from a supported/unsupported event shape.
  }
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="q-pool-title">
    <p className="eyebrow">EVENT MEMBERSHIP</p>
    <h1 id="q-pool-title">Q Pool Membership and Payment Allocation</h1>
    {syntheticContext && <><SyntheticEventNotice context={syntheticContext}/><p className="auth-note">Membership and acknowledgments for this rehearsal are simulated fictional director-configured choices, not personal player consent.</p></>}
    <p className="auth-note">Q Pool participation is a separate election for each configured pool. Elections do not create payments. Allocation records only use an existing receipt and obligation; enter the base fee and every Q Pool amount explicitly. Paid entry eligibility is not payout eligibility. Automatic payout and settlement are not part of this screen.</p>
    <p><a href={`/tournament/${tournamentId}/q-pool-policy`}>Disclose a Q Pool policy before collection / review payout preview</a></p>
    {access.role === "director" && <p><a href={`/tournament/${tournamentId}/q-operating-schedules`}>Select clarified equal or graduated Q operating schedule</a></p>}
    {access.role === "co_director" && <p className="auth-note">For a clarified v2 Q operating schedule, the primary director must record the policy acknowledgment and election. This screen does not load v2 disclosures for co-directors.</p>}
    <QPoolMembershipClient actorId={access.user.id} tournamentId={tournamentId} canManage={["director", "co_director"].includes(access.role)} workspace={workspace} policies={policies}/>
    <SharedDeviceSignOut />
  </section></main>;
}
