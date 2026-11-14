import Link from'next/link';
import{notFound}from'next/navigation';
import{SharedDeviceSignOut}from'../../../../components/shared-device-sign-out';
import PoolRunningSummary from'../../../../components/pool-running-summary';
import{requireTournamentAccess}from'../../../../lib/auth/require-tournament-access';
import{createClient}from'../../../../lib/supabase/server';
import{isUuid}from'../../../../lib/api/validation';
import{getTournamentResultEventSummary}from'../../../../lib/results/event-summary';
import{readExistingRunningPools}from'../../../../lib/results/pool-running-read-production';
import{runningPoolPageEnabledV1,readRunningPoolPageV1}from'../../../../lib/results/pool-running-page-v1';
export const dynamic='force-dynamic';
/** Existing official access only. This is not the future player/public feed. */
export default async function PoolTotalsPage({params,searchParams}:{params:Promise<{tournamentId:string}>;searchParams:Promise<{event?:string|string[]}>}){
 if(!runningPoolPageEnabledV1())notFound();const{tournamentId}=await params,{event}=await searchParams;if(!isUuid(tournamentId)||event!==undefined&&(typeof event!=='string'||!isUuid(event)))notFound();
 const access=await requireTournamentAccess(tournamentId);if(!access.roles.some(r=>r==='director'||r==='co_director'))notFound();
 const client=await createClient(),initial=await client.auth.getUser();if(initial.error||initial.data.user?.id!==access.user.id)notFound();
 const events=await getTournamentResultEventSummary(access.user.id,tournamentId);if(events.tournamentId!==tournamentId||new Set(events.events.map(x=>x.eventId)).size!==events.events.length)notFound();
 const selected=event?events.events.find(x=>x.eventId===event):null;if(event&&!selected)notFound();
 const checkAccess=async()=>{const a=await requireTournamentAccess(tournamentId),u=await client.auth.getUser();return u.error||u.data.user?.id!==a.user.id?null:{actorId:a.user.id,roles:a.roles};};
 const workspace=selected?await readRunningPoolPageV1({scope:{actorId:access.user.id,tournamentId,eventId:selected.eventId},enabled:runningPoolPageEnabledV1,access:checkAccess,read:readExistingRunningPools}):null;
 const finalAccess=await checkAccess();if(!finalAccess||finalAccess.actorId!==access.user.id||!finalAccess.roles.some(r=>r==='director'||r==='co_director'))notFound();
 return <main className="auth-shell"><section className="auth-card standings-card" aria-labelledby="pool-totals-title"><p className="eyebrow">PRIVATE POOL TOTALS</p><h1 id="pool-totals-title">Pool Participants and Recorded Funds</h1><p>{events.tournamentName}{selected?` — ${selected.name}`:''}</p>
 <p>This Director view shows recorded entries and amounts, not award calculations or bank confirmation. Unknown or stale values are not treated as zero.</p>
 {events.events.length?<form method="get"><label htmlFor="pool-event">Event</label><select id="pool-event" name="event" defaultValue={selected?.eventId??''} required><option value="" disabled>Choose an Event</option>{events.events.map(e=><option key={e.eventId} value={e.eventId}>{e.name}</option>)}</select><button type="submit">Show / Refresh Pool Totals</button></form>:<p role="status">No event is available for a pool summary.</p>}
 {selected&&<><p>Use Refresh to request a newer snapshot. This page does not automatically poll or guarantee an atomic live balance.</p><PoolRunningSummary workspace={workspace}/></>}
 <p>Player-wide publication is not enabled by this private page.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link><SharedDeviceSignOut/></section></main>;
}
