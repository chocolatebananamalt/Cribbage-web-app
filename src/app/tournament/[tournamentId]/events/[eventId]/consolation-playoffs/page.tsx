import { notFound } from 'next/navigation';
import { requireTournamentAccess } from '../../../../../../lib/auth/require-tournament-access';
import { createServerOnlyAdminClient } from '../../../../../../lib/supabase/private-admin';
import { isUuid } from '../../../../../../lib/api/validation';
import { isConsolationWorkspace, type Workspace } from '../../../../../../lib/api/consolation-playoff';
import { getSyntheticEventContext } from '../../../../../../lib/paper-games/synthetic-event-context';
import { SyntheticEventNotice } from '../../../../../../components/synthetic-event-notice';
import { SharedDeviceSignOut } from '../../../../../../components/shared-device-sign-out';
import ConsolationPlayoffClient from './playoff-client';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 const {tournamentId,eventId}=await params;if(!isUuid(tournamentId)||!isUuid(eventId))notFound();
 const access=await requireTournamentAccess(tournamentId);if(!['director','co_director'].includes(access.role))notFound();
 let context=null,workspace:Workspace|null=null;
 try { context=await getSyntheticEventContext(access.user.id,tournamentId);const {data,error}=await createServerOnlyAdminClient().rpc('get_consolation_playoff_workspace_v1',{actor:access.user.id,tid:tournamentId,eid:eventId});if(!error&&isConsolationWorkspace(data,tournamentId,eventId))workspace=data; } catch { /* The recording path fails closed when fixture or source cannot be confirmed. */ }
 return <main className="auth-shell"><section className="auth-card corrections-card"><p className="eyebrow">SYNTHETIC REHEARSAL</p><h1>Consolation playoff</h1><p><a href={`/tournament/${tournamentId}`}>Tournament</a> · <a href={`/tournament/${tournamentId}/results`}>Qualifying results</a></p><SyntheticEventNotice context={context}/><ConsolationPlayoffClient actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} initialWorkspace={workspace} syntheticContext={context}/><SharedDeviceSignOut/></section></main>;
}
