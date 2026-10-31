import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { isUuid } from "../../../../../../lib/api/validation";
import { isQAccountingWorkspace, type QAccountingWorkspace } from "../../../../../../lib/api/q-accounting-v6";
import { SharedDeviceSignOut } from "../../../../../../components/shared-device-sign-out";
import QAccountingClient from "./accounting-client";
export const dynamic = "force-dynamic";
export default async function QAccountingPage({ params }: { params: Promise<{ tournamentId: string; eventId: string }> }) {
  const { tournamentId, eventId } = await params;
  if (!isUuid(tournamentId) || !isUuid(eventId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (access.role !== "director") notFound();
  let workspace: QAccountingWorkspace | null = null;
  try {
    const { data, error } = await createServerOnlyAdminClient().rpc("get_q_accounting_workspace_v6", { p_actor_id: access.user.id, p_tournament_id: tournamentId, p_event_id: eventId });
    if (!error && isQAccountingWorkspace(data, tournamentId, eventId)) workspace = data;
  } catch { /* The new schema is independently gated; no fallback to legacy writers. */ }
  return <main className="auth-shell"><section className="auth-card corrections-card"><p className="eyebrow">UNPAID EVENT ACCOUNTING</p><h1>Q Pool and regular-prize accounting</h1>
    <p><a href={`/tournament/${tournamentId}`}>Tournament</a> · <a href={`/tournament/${tournamentId}/q-obligation-reviews-v2`}>Reviewed unpaid Q obligations</a></p>
    <QAccountingClient actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} initialWorkspace={workspace}/><SharedDeviceSignOut/>
  </section></main>;
}
