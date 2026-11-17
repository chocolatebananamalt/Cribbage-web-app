import {notFound} from 'next/navigation';
import {isUuid} from '../../../../../../lib/api/validation';
import {requireTournamentAccess} from '../../../../../../lib/auth/require-tournament-access';
import {createClient} from '../../../../../../lib/supabase/server';
import {createServerOnlyAdminClient} from '../../../../../../lib/supabase/private-admin';
import {playoffProgressEnabledV37,progressEventEligibleV37} from '../../../../../../lib/playoffs/progress-v37';
import {readPlayoffProgressV37} from '../../../../../../lib/playoffs/progress-read-v37';
import {PlayoffProgressViewV37,type ProgressEventV37} from '../../../../../../components/playoff-progress-v37';
import {getTournamentResultEventSummary} from '../../../../../../lib/results/event-summary';
export const dynamic='force-dynamic';
export default async function PlayoffProgressPageV37({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 if(!playoffProgressEnabledV37())notFound();
 const p=await params;if(!isUuid(p.tournamentId)||!isUuid(p.eventId))notFound();
 const access=await requireTournamentAccess(p.tournamentId);if(access.role!=='director')notFound();
 const summary=await getTournamentResultEventSummary(access.user.id,p.tournamentId);
 if(summary.tournamentId!==p.tournamentId||new Set(summary.events.map(e=>e.eventId)).size!==summary.events.length)notFound();
 const events:ProgressEventV37[]=summary.events.filter(progressEventEligibleV37).map(e=>({eventId:e.eventId,name:e.name,kind:e.eventType as 'main'|'consolation'}));
 const event=events.find(e=>e.eventId===p.eventId);if(!event)notFound();
 const view=await readPlayoffProgressV37({enabled:playoffProgressEnabledV37,normal:createClient,service:()=>{const c=createServerOnlyAdminClient();return(n,a)=>c.rpc(n,a);},scope:{actorId:access.user.id,...p}});
 return <PlayoffProgressViewV37 view={view} {...p} event={event} events={events}/>;
}
