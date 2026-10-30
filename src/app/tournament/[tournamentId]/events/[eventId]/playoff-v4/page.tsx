import { notFound } from 'next/navigation';
import { requireTournamentAccess } from '../../../../../../lib/auth/require-tournament-access';
import { createServerOnlyAdminClient } from '../../../../../../lib/supabase/private-admin';
import { isUuid } from '../../../../../../lib/api/validation';
import { isPlayoffV4Workspace, type PlayoffV4Workspace } from '../../../../../../lib/api/playoff-outcome-v4';
import { getAccountingEntry } from '../../../../../../lib/api/accounting-entry';
import { SharedDeviceSignOut } from '../../../../../../components/shared-device-sign-out';
import FiveQualifierPlayoffClient from './playoff-client';
export const dynamic = 'force-dynamic';
export default async function FiveQualifierPlayoffPage({ params }: { params: Promise<{ tournamentId: string; eventId: string }> }) {
 const { tournamentId, eventId } = await params;
 if (!isUuid(tournamentId) || !isUuid(eventId)) notFound();
 const access = await requireTournamentAccess(tournamentId);
 if (!['director', 'co_director'].includes(access.role)) notFound();
 let workspace: PlayoffV4Workspace | null = null;
 const admin = createServerOnlyAdminClient();
 const accountingEntry = access.role === 'director' ? await getAccountingEntry(admin, access.user.id, tournamentId, eventId) : null;
 try {
  const { data, error } = await admin.rpc('get_standard_singles_playoff_outcome_workspace_v4', { p_actor_id: access.user.id, p_tournament_id: tournamentId, p_event_id: eventId });
  if (!error && isPlayoffV4Workspace(data, tournamentId, eventId)) workspace = data;
 } catch { /* Separate schema gate; never fall back to a legacy writer. */ }
 return <main className="auth-shell"><section className="auth-card corrections-card"><p className="eyebrow">SOURCE-BOUND PLAYOFF RESULTS</p><h1>Five qualifiers and first-round byes</h1>
  <p><a href={`/tournament/${tournamentId}`}>Tournament</a> · <a href={`/tournament/${tournamentId}/results`}>Qualifying results</a>{accountingEntry && <> · <a href={`/tournament/${tournamentId}/events/${eventId}/${accountingEntry}`}>Unpaid accounting</a></>}</p>
  {!accountingEntry && <p role="status">The accounting route could not be established from current pool configuration. No legacy or zero-pool fallback was assumed.</p>}
  <FiveQualifierPlayoffClient actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} initialWorkspace={workspace}/><SharedDeviceSignOut/>
 </section></main>;
}
