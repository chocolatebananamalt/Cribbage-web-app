import Link from'next/link';import{notFound}from'next/navigation';
import{PlayerPoolVisibilitySectionV1}from'../../../../components/player-pool-visibility-section-v1';
import{requireTournamentAccess}from'../../../../lib/auth/require-tournament-access';
import{createClient}from'../../../../lib/supabase/server';
import{isUuid}from'../../../../lib/api/validation';
import{getTournamentResultEventSummary}from'../../../../lib/results/event-summary';
import{playerPoolVisibilityPageEnabledV1,playerPoolVisibilityWritesVerifiedV1}from'../../../../lib/results/player-pool-totals-gates-v1';
export const dynamic='force-dynamic';
export default async function PoolVisibilityPage({params,searchParams}:{params:Promise<{tournamentId:string}>;searchParams:Promise<{event?:string|string[]}>}){
 if(!playerPoolVisibilityPageEnabledV1())notFound();const{tournamentId}=await params,{event}=await searchParams;if(!isUuid(tournamentId)||event!==undefined&&(typeof event!=='string'||!isUuid(event)))notFound();const access=await requireTournamentAccess(tournamentId);if(!access.roles.includes('director'))notFound();const c=await createClient(),u=await c.auth.getUser();if(u.error||u.data.user?.id!==access.user.id)notFound();
 const summary=await getTournamentResultEventSummary(access.user.id,tournamentId);if(summary.tournamentId!==tournamentId||new Set(summary.events.map(e=>e.eventId)).size!==summary.events.length)notFound();const selected=event?summary.events.find(e=>e.eventId===event):null;if(event&&!selected)notFound();
 return <main className="auth-shell"><section className="auth-card"><h1>Player Pool Visibility</h1><p>{summary.tournamentName}{selected?` — ${selected.name}`:''}</p><form method="get"><label htmlFor="visibility-event">Event</label><select id="visibility-event" name="event" defaultValue={selected?.eventId??''} required><option value="" disabled>Choose an Event</option>{summary.events.map(e=><option key={e.eventId} value={e.eventId}>{e.name}</option>)}</select><button type="submit">Open Visibility Settings</button></form>
 {selected&&<PlayerPoolVisibilitySectionV1 enabled writesVerified={playerPoolVisibilityWritesVerifiedV1()} scope={{actorId:access.user.id,tournamentId,eventId:selected.eventId}} role="director"/>}<Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link></section></main>;
}
