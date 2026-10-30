import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { isUuid } from "../../../../../../lib/api/validation";
import { isPrizeAccountingWorkspaceV8, type PrizeAccountingWorkspaceV8 } from "../../../../../../lib/api/prize-accounting-v8";
import { SharedDeviceSignOut } from "../../../../../../components/shared-device-sign-out";
import PrizeAccountingClient from "./accounting-client";
export const dynamic = "force-dynamic";
export default async function PrizeAccountingPage({ params }: { params: Promise<{ tournamentId: string; eventId: string }> }) {
  const { tournamentId, eventId } = await params;
  if (!isUuid(tournamentId) || !isUuid(eventId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (access.role !== "director") notFound();
  let workspace: PrizeAccountingWorkspaceV8 | null = null;
  try {
    const { data, error } = await createServerOnlyAdminClient().rpc("get_prize_accounting_workspace_v8", { p_actor_id: access.user.id, p_tournament_id: tournamentId, p_event_id: eventId });
    if (!error && isPrizeAccountingWorkspaceV8(data, tournamentId, eventId)) workspace = data;
  } catch { /* The new schema is independently gated; no fallback to legacy writers. */ }
  return <main className="auth-shell"><section className="auth-card corrections-card"><p className="eyebrow">UNPAID EVENT ACCOUNTING</p><h1>Regular-prize accounting with $5 awards</h1>
    <p><a href={`/tournament/${tournamentId}`}>Tournament</a> · <a href={`/tournament/${tournamentId}/results?event=${eventId}`}>Qualifying results</a></p>
    <PrizeAccountingClient actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} initialWorkspace={workspace}/><SharedDeviceSignOut/>
  </section></main>;
}
