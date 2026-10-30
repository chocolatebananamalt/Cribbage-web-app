import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import { isUuid } from "../../../../lib/api/validation";
import { isQPreviewSources, type QPreviewSources } from "../../../../lib/results/q-pool-preview";
import QPolicyClient from "./policy-client";
import { getSyntheticEventContext } from "../../../../lib/paper-games/synthetic-event-context";
import { SyntheticEventNotice } from "../../../../components/synthetic-event-notice";
export const dynamic = "force-dynamic";
export default async function QPoolPolicyPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const syntheticContext = await getSyntheticEventContext(access.user.id, tournamentId);
  let source: QPreviewSources | null = null;
  try {
    const { data, error } = await createServerOnlyAdminClient().rpc("get_q_pool_preview_sources_v1", { p_actor_id: access.user.id, p_tournament_id: tournamentId });
    if (!error && isQPreviewSources(data, tournamentId)) source = data;
  } catch { /* Unavailable support stays closed. */ }
  return <main className="auth-shell"><section className="auth-card corrections-card"><p className="eyebrow">Q POOL POLICY</p><h1>Disclosed Q Pool policy and payout preview</h1>{syntheticContext && <SyntheticEventNotice context={syntheticContext}/>} {syntheticContext && <p className="auth-note">Q policy acknowledgments and membership shown here are simulated director-configured choices for fictional entrants, not personal player consent.</p>}
    <p><a href={`/tournament/${tournamentId}/setup`}>Back to setup</a> · <a href={`/tournament/${tournamentId}/q-pools`}>Membership and receipt allocation</a></p>
    {access.role === "director" && <p><a href={`/tournament/${tournamentId}/q-obligation-reviews`}>Record or review unpaid Q obligations</a></p>}
    {access.role === "director" && <p><a href={`/tournament/${tournamentId}/q-operating-schedules`}>Disclosed equal and graduated operating schedules</a>. Existing v1 policies and unpaid history below are preserved.</p>}
    <QPolicyClient actorId={access.user.id} tournamentId={tournamentId} source={source}/><SharedDeviceSignOut/>
  </section></main>;
}
