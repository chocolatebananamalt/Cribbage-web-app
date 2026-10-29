import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import { isUuid } from "../../../../lib/api/validation";
import { isQOperatingWorkspaceV2, type QOperatingWorkspaceV2 } from "../../../../lib/api/q-operating-schedules";
import QOperatingClient from "./operating-client";
export const dynamic = "force-dynamic";
export default async function QOperatingPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (access.role !== "director") notFound();
  let source: QOperatingWorkspaceV2 | null = null;
  try {
    const { data, error } = await createServerOnlyAdminClient().rpc("get_q_operating_workspace_v2", { p_actor_id: access.user.id, p_tournament_id: tournamentId });
    if (!error && isQOperatingWorkspaceV2(data, tournamentId)) source = data;
  } catch { /* Missing or unavailable support fails closed. */ }
  return <main className="auth-shell"><section className="auth-card corrections-card"><p className="eyebrow">Q OPERATING SCHEDULES</p><h1>Disclosed equal and graduated Q schedules</h1>
    <p><a href={`/tournament/${tournamentId}/setup`}>Back to setup</a> · <a href={`/tournament/${tournamentId}/q-pools`}>Membership and receipt allocation</a> · <a href={`/tournament/${tournamentId}/q-pool-policy`}>Historical v1 policies and reviews</a></p>
    <QOperatingClient actorId={access.user.id} tournamentId={tournamentId} source={source}/><SharedDeviceSignOut/>
  </section></main>;
}
