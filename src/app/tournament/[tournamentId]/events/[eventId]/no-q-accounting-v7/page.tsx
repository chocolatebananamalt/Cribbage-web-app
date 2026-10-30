import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { isUuid } from "../../../../../../lib/api/validation";
import { isNoQAccountingWorkspace, type NoQAccountingWorkspace } from "../../../../../../lib/api/no-q-accounting-v7";
import { SharedDeviceSignOut } from "../../../../../../components/shared-device-sign-out";
import NoQAccountingClient from "./accounting-client";
export const dynamic = "force-dynamic";
export default async function NoQAccountingPage({ params }: { params: Promise<{ tournamentId: string; eventId: string }> }) {
  const { tournamentId, eventId } = await params;
  if (!isUuid(tournamentId) || !isUuid(eventId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (access.role !== "director") notFound();
  let workspace: NoQAccountingWorkspace | null = null;
  try {
    const { data, error } = await createServerOnlyAdminClient().rpc("get_no_q_accounting_workspace_v7", { p_actor_id: access.user.id, p_tournament_id: tournamentId, p_event_id: eventId });
    if (!error && isNoQAccountingWorkspace(data, tournamentId, eventId)) workspace = data;
  } catch { /* The new schema is independently gated; no fallback to legacy writers. */ }
  return <main className="auth-shell"><section className="auth-card corrections-card"><p className="eyebrow">UNPAID EVENT ACCOUNTING</p><h1>Regular-prize accounting without Q Pools</h1>
    <p><a href={`/tournament/${tournamentId}`}>Tournament</a> · <a href={`/tournament/${tournamentId}/results?event=${eventId}`}>Qualifying results</a></p>
    <NoQAccountingClient actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} initialWorkspace={workspace}/><SharedDeviceSignOut/>
  </section></main>;
}
