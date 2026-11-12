import{readNativeMixedSimulationScheduleSourceV1}from'./native-mixed-simulation-operation-v1.ts';
import{readNativeMixedSimulationStartReceiptV1}from'./native-mixed-simulation-start-v1.ts';
import type{NativeMixedDirectorContextV1}from'./native-mixed-director-session-v1.ts';
import type{NativeMixedStartSnapshotV1}from'./native-mixed-start-session-v1.ts';
type Assignment={participantId:string;fixedId:string};
type Game={gameId:string;round:number;sideAParticipantId:string;sideBParticipantId:string;sideATableSeat:string;sideBTableSeat:string};
export async function captureNativeMixedPlayLinksV1(o:{context:NativeMixedDirectorContextV1;current:()=>boolean;snapshot:()=>NativeMixedStartSnapshotV1;checkStart:()=>Promise<boolean>;readSchedule:()=>Promise<unknown>;now?:()=>number}){
 const context=structuredClone(o.context),current=o.current,snapshot=o.snapshot,check=o.checkStart,read=o.readSchedule,clock=o.now??Date.now;
 if(!current()||!snapshot().receipt||!await check()||!current()||!snapshot().currentStarted)return null;
 const value=await read();if(!current())return null;const raw=structuredClone(value),at=clock(),links=projectNativeMixedPlayLinksV1(raw,context,snapshot(),at,at);return links?{raw,at,links}:null;
}
/** Navigation only, derived from current authenticated source and Start proof.
 * These URLs grant no access and are never evidence of a completed game. */
export function projectNativeMixedPlayLinksV1(raw:unknown,c:NativeMixedDirectorContextV1,snapshot:NativeMixedStartSnapshotV1,observedAt:number,now=Date.now()){
 if(c.projectRef!=='nnhcnvksxgxnpvdqjgpg'||!snapshot.currentStarted||!snapshot.request||!snapshot.receipt||now<observedAt||now-observedAt>30000)return null;
 const source=readNativeMixedSimulationScheduleSourceV1(raw,c.scope),receipt=readNativeMixedSimulationStartReceiptV1(snapshot.receipt,{scope:c.scope,request:snapshot.request});if(!source||!receipt)return null;
 const publication=source.publication as{contextId:string},attendance=source.attendance as{sourceDigest:string};
 if(receipt.contextId!==publication.contextId||receipt.request.expectedScheduleSourceDigest!==source.sourceDigest||receipt.request.expectedAttendanceSourceDigest!==attendance.sourceDigest)return null;
 const assignments=source.fixedAssignments as Assignment[],games=source.canonicalGames as Game[],ids=new Map(assignments.map(x=>[x.participantId,x.fixedId]));
 if(ids.size!==18||new Set(ids.values()).size!==18||[...ids.values()].some(x=>!/^A-(?:[1-9]|1[0-8])$/.test(x))||new Set(games.map(x=>x.gameId)).size!==108)return null;
 const pairs=new Set<string>(),rounds=new Set<string>(),counts=new Map<string,number>();
 for(const g of games){if(!ids.has(g.sideAParticipantId)||!ids.has(g.sideBParticipantId)||g.sideAParticipantId===g.sideBParticipantId)return null;const pair=[g.sideAParticipantId,g.sideBParticipantId].sort().join(':');if(pairs.has(pair))return null;pairs.add(pair);for(const id of[g.sideAParticipantId,g.sideBParticipantId]){const key=id+':'+g.round;if(rounds.has(key))return null;rounds.add(key);counts.set(id,(counts.get(id)??0)+1);}}
 if([...ids.keys()].some(id=>counts.get(id)!==12))return null;
 const base=`/tournament/${c.scope.tournamentId}`;
 return{playerHref:`${base}/rehearsal/${c.scope.eventId}/${receipt.startId}`,reviewHref:`/tournament/${c.scope.tournamentId}/rehearsal-review/${c.scope.eventId}`,games:games.toSorted((a,b)=>a.round-b.round||a.gameId.localeCompare(b.gameId)).map(g=>({gameId:g.gameId,round:g.round,sideA:ids.get(g.sideAParticipantId)!,sideB:ids.get(g.sideBParticipantId)!,seatA:g.sideATableSeat,seatB:g.sideBTableSeat,paperHref:`${base}/rehearsal-paper/${c.scope.eventId}/${receipt.startId}/${g.gameId}`}))};
}
