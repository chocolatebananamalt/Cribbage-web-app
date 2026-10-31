import {notFound} from 'next/navigation';
import {requireTournamentAccess} from '../../../../../../lib/auth/require-tournament-access';
import {getEventScheduleWorkspace} from '../../../../../../lib/events/schedule-workspace';
import {createServerOnlyAdminClient} from '../../../../../../lib/supabase/private-admin';
import {isUuid} from '../../../../../../lib/api/validation';
import {isOddFieldMakeupWorkspace,type OddFieldMakeupWorkspace} from '../../../../../../lib/api/odd-field-makeup';
import {SharedDeviceSignOut} from '../../../../../../components/shared-device-sign-out';
import OddFieldMakeupClient from './makeup-client';
export const dynamic='force-dynamic';
export default async function OddFieldMakeupPage({params}:{params:Promise<{tournamentId:string;eventId:string}>}) {
  const {tournamentId,eventId}=await params;
  if(!isUuid(tournamentId)||!isUuid(eventId))notFound();
  const access=await requireTournamentAccess(tournamentId);
  if(!['director','co_director'].includes(access.role))notFound();
  const workspace=await getEventScheduleWorkspace(access.user.id,tournamentId);
  const event=workspace.events.find(e=>e.eventId===eventId);
  if(!event||event.gameCount!==12||event.participantCount!==17||event.format!=='standard_singles'||event.scoringMethod!=='digital')notFound();
  let initial:OddFieldMakeupWorkspace|null=null;
  try {const {data,error}=await createServerOnlyAdminClient().rpc('get_odd_field_makeup_workspace_v1',{a:access.user.id,t:tournamentId,e:eventId});
    if(!error&&isOddFieldMakeupWorkspace(data,tournamentId,eventId))initial=data;
  }catch{/* Missing schema fails closed. */}
  return <main className="auth-shell"><section className="auth-card corrections-card"><p className="eyebrow">QUALIFYING MAKEUP GAMES</p>
    <h1>Seventeen players, twelve qualifying games each</h1>
    <p><a href={`/tournament/${tournamentId}/schedule`}>Game schedule and start play</a></p>
    <OddFieldMakeupClient actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} workspace={workspace} initial={initial}/>
    <SharedDeviceSignOut/>
  </section></main>;
}
