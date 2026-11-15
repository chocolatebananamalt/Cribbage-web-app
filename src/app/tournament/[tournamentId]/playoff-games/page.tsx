import Link from'next/link';import{notFound}from'next/navigation';
import{requireTournamentAccess}from'../../../../lib/auth/require-tournament-access';
import{createClient}from'../../../../lib/supabase/server';
import{requireVerifiedIdentity}from'../../../../lib/api/verified-subject';
import{selectedStepPlayerPageEnabledV3,readSelectedStepPlayerViewV3}from'../../../../lib/playoffs/selected-step-player-v3';
import{isUuid}from'../../../../lib/api/validation';
export const dynamic='force-dynamic';
export default async function PlayoffGames({params}:{params:Promise<{tournamentId:string}>}){
 if(!selectedStepPlayerPageEnabledV3())notFound();const{tournamentId}=await params;if(!isUuid(tournamentId))notFound();const access=await requireTournamentAccess(tournamentId),normal=await createClient(),before=await requireVerifiedIdentity(normal),user=await normal.auth.getUser();
 if(!before||before.subject!==access.user.id||user.error||user.data.user?.id!==before.subject)notFound();
 const result=await normal.rpc('get_selected_step_player_matches_v3',{tid:tournamentId}),after=await requireVerifiedIdentity(normal),again=await normal.auth.getUser();
 if(!after||after.subject!==before.subject||after.sessionId!==before.sessionId||again.error||again.data.user?.id!==before.subject)notFound();
 const raw:unknown=result.data;const rows:Array<{name:string;href:string;complete:boolean}>=[];
 if(!result.error&&raw&&typeof raw==='object'&&'status'in raw&&raw.status==='player_matches_available'&&'tournamentId'in raw&&raw.tournamentId===tournamentId&&'matches'in raw&&Array.isArray(raw.matches)&&raw.matches.length<=100){
  for(const item of raw.matches){if(!item||typeof item!=='object'||typeof item.eventName!=='string'||!item.view)continue;const v=item.view,view=readSelectedStepPlayerViewV3(v,{actorId:before.subject,tournamentId,eventId:v.eventId,qualificationId:v.qualificationId,slot:v.slot,generationId:v.generationId});if(view)rows.push({name:`${item.eventName} — Match ${view.slot}`,href:`/tournament/${tournamentId}/playoff-games/${view.eventId}/${view.generationId}?qualification=${view.qualificationId}&slot=${view.slot}`,complete:view.seriesComplete});}
 }
 return <main><h1>My Playoff Games</h1><p>Digital entries require both players to submit and separately confirm. Paper-card review uses the manual workflow.</p>{rows.length?<ul>{rows.map(row=><li key={row.href}><Link href={row.href}>{row.name}{row.complete?' — Series Complete':''}</Link></li>)}</ul>:<p role="status">No current authorized digital playoff match is available. Missing information is not a completed result.</p>}<Link href={`/tournament/${tournamentId}/games`}>Back to My Games</Link></main>;
}
