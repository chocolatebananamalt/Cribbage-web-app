import Link from'next/link';import{notFound}from'next/navigation';
import{SharedDeviceSignOut}from'../../../../components/shared-device-sign-out';
import{PlayerPoolTotalsV1}from'../../../../components/player-pool-totals-v1';
import{requireTournamentAccess}from'../../../../lib/auth/require-tournament-access';
import{createClient}from'../../../../lib/supabase/server';
import{createServerOnlyAdminClient}from'../../../../lib/supabase/private-admin';
import{isUuid}from'../../../../lib/api/validation';
import{getTournamentResultEventSummary}from'../../../../lib/results/event-summary';
import{readPlayerPoolTotalsV1}from'../../../../lib/results/player-pool-totals-read-v1';
import{playerPoolTotalsPageEnabledV1}from'../../../../lib/results/player-pool-totals-gates-v1';
export const dynamic='force-dynamic';
const allowed=new Set(['director','co_director','player','viewer','cross_checker']);
export default async function PlayerPoolsPage({params,searchParams}:{params:Promise<{tournamentId:string}>;searchParams:Promise<{event?:string|string[]}>}){
 if(!playerPoolTotalsPageEnabledV1())notFound();const{tournamentId}=await params,{event}=await searchParams;if(!isUuid(tournamentId)||event!==undefined&&(typeof event!=='string'||!isUuid(event)))notFound();
 const access=await requireTournamentAccess(tournamentId);if(!access.roles.some(r=>allowed.has(r)))notFound();const client=await createClient(),user=await client.auth.getUser();if(user.error||user.data.user?.id!==access.user.id)notFound();
 const summary=await getTournamentResultEventSummary(access.user.id,tournamentId);if(summary.tournamentId!==tournamentId||new Set(summary.events.map(e=>e.eventId)).size!==summary.events.length)notFound();const selected=event?summary.events.find(e=>e.eventId===event):null;if(event&&!selected)notFound();
 let view=null;if(selected){const service=createServerOnlyAdminClient();view=await readPlayerPoolTotalsV1({authenticated:client,serviceRpc:(name,args)=>service.rpc(name,args),scope:{actorId:access.user.id,tournamentId,eventId:selected.eventId},enabled:playerPoolTotalsPageEnabledV1,now:()=>new Date().toISOString()});}
 const final=await client.auth.getUser(),latest=await requireTournamentAccess(tournamentId);if(final.error||final.data.user?.id!==access.user.id||latest.user.id!==access.user.id||!latest.roles.some(r=>allowed.has(r)))notFound();
 return <main className="auth-shell"><section className="auth-card standings-card"><h1>Pool Entries and Totals</h1><p>{summary.tournamentName}{selected?` — ${selected.name}`:''}</p>
 {summary.events.length?<form method="get"><label htmlFor="player-pool-event">Event</label><select id="player-pool-event" name="event" defaultValue={selected?.eventId??''} required><option value="" disabled>Choose an Event</option>{summary.events.map(e=><option key={e.eventId} value={e.eventId}>{e.name}</option>)}</select><button type="submit">Show / Refresh Pool Totals</button></form>:<p>No event is available.</p>}
 {selected&&<PlayerPoolTotalsV1 view={view} tournamentId={tournamentId} eventId={selected.eventId}/>}<Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link><SharedDeviceSignOut/></section></main>;
}
