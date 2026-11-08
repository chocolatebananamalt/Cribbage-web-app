import type {NativeMixedGameTargetV1}from'./native-mixed-game-evidence-v1.ts';
import {projectNativeMixedDigitalEntryV1,isNativeMixedDigitalEntryBindingV1,type NativeMixedDigitalEntryBindingV1} from './native-mixed-digital-entry-view-v1.ts';
import {deriveScore} from '../score.ts';
import type {createNativeMixedGameEvidenceTransportV1} from '../api/native-mixed-game-evidence-transport-v1.ts';

type Binding=NativeMixedDigitalEntryBindingV1;
export type NativeMixedPlayerCardRowV1={gameId:string;gameNumber:number;opponentName:string;opponentTournamentId:string;status:'unavailable'|'pending'|'mismatch'|'complete'|'upcoming';gamePoints:number|null;plus:number|null;minus:number|null};
export type NativeMixedPlayerCardV1={kind:'native-mixed-player-card-v1';simulationOnly:true;officialResultVerified:false;qualificationAuthorized:false;payoutAuthorized:false;player:Binding['player'];tournamentName:string;eventName:string;rows:NativeMixedPlayerCardRowV1[];completedGames:number;currentGameId:string|null;totals:{gamePoints:number;plus:number;minus:number;net:number};allSourcesAvailable:boolean};
const scope=(b:Binding)=>JSON.stringify([b.target.actorId,b.target.sessionId,b.target.projectRef,b.target.projectUrl,b.target.tournamentId,b.target.eventId,b.target.startId,b.target.startSourceDigest,[b.player.participantId,b.player.profileId,b.player.displayName,b.player.fixedTournamentId,b.player.mode],b.tournamentName,b.eventName]);
/** Own-player display only. Caller must obtain bindings from a trusted current
 * provider. Never writes ordinary scorecards or grants qualification authority.
 * Missing/unknown evidence stays unavailable, never a zero-valued result. */
export function projectNativeMixedPlayerCardV1(bindings:readonly Binding[],states:readonly unknown[]):NativeMixedPlayerCardV1|null{
 if(bindings.length!==12||states.length!==12||bindings.some(b=>!isNativeMixedDigitalEntryBindingV1(b)))return null;
 const first=bindings[0],seenGames=new Set<string>(),seenRounds=new Set<number>(),seenOpponents=new Set<string>(),seenOpponentIds=new Set<string>();
 for(const b of bindings){if(scope(b)!==scope(first)||seenGames.has(b.target.gameId)||seenRounds.has(b.gameNumber)||seenOpponents.has(b.opponent.participantId)||seenOpponentIds.has(b.opponent.fixedTournamentId))return null;seenGames.add(b.target.gameId);seenRounds.add(b.gameNumber);seenOpponents.add(b.opponent.participantId);seenOpponentIds.add(b.opponent.fixedTournamentId);}
 const rows=bindings.map((b,i):NativeMixedPlayerCardRowV1=>{
  const view=projectNativeMixedDigitalEntryV1(b,states[i]),base={gameId:b.target.gameId,gameNumber:b.gameNumber,opponentName:b.opponent.displayName,opponentTournamentId:b.opponent.fixedTournamentId,gamePoints:null,plus:null,minus:null};
  if(!view)return{...base,status:'unavailable'};
  if(view.phase!=='complete'||!view.ownResult)return{...base,status:view.phase==='mismatch'?'mismatch':view.phase==='upcoming'?'upcoming':'pending'};
  const score=deriveScore(view.ownResult.margin,view.ownResult.winnerSide===b.ownSide?'player':'opponent');
  return{...base,status:'complete',gamePoints:score.playerGamePoints,plus:score.playerPlus,minus:score.playerMinus};
 }).sort((a,b)=>a.gameNumber-b.gameNumber);
 const current=bindings.filter((b,i)=>projectNativeMixedDigitalEntryV1(b,states[i])?.state.playOrder==='current');
 if(current.length>1||rows.every(r=>r.status!=='unavailable')&&rows.some(r=>r.status!=='complete')&&current.length!==1)return null;
 const currentGameId=rows.every(r=>r.status!=='unavailable')&&current.length===1?current[0].target.gameId:null;
 const totals=rows.reduce((s,r)=>({gamePoints:s.gamePoints+(r.gamePoints??0),plus:s.plus+(r.plus??0),minus:s.minus+(r.minus??0),net:s.net+(r.plus??0)-(r.minus??0)}),{gamePoints:0,plus:0,minus:0,net:0});
 return{kind:'native-mixed-player-card-v1',simulationOnly:true,officialResultVerified:false,qualificationAuthorized:false,payoutAuthorized:false,player:structuredClone(first.player),tournamentName:first.tournamentName,eventName:first.eventName,rows,currentGameId,completedGames:rows.filter(r=>r.status==='complete').length,totals,allSourcesAvailable:rows.every(r=>r.status!=='unavailable')};
}
/** Uses the existing own-subject authenticated transport, no privileged read or
 * fallback cache. Account/session changes or disabled host return no card. */
export async function loadNativeMixedPlayerCardV1(o:{bindings:readonly Binding[];transport:ReturnType<typeof createNativeMixedGameEvidenceTransportV1>;enabled:()=>boolean;current:()=>boolean}):Promise<NativeMixedPlayerCardV1|null>{
 if(o.enabled()!==true||!o.current())return null;const bindings=structuredClone(o.bindings);
 if(!projectNativeMixedPlayerCardV1(bindings,Array(12).fill(null)))return null;
 const states:unknown[]=[];
 for(const b of bindings){if(o.enabled()!==true||!o.current())return null;try{const reply=await o.transport.state(b.target);states.push(reply.error===null?reply.data:null);}catch{states.push(null);}}
 return o.enabled()===true&&o.current()?projectNativeMixedPlayerCardV1(bindings,states):null;
}

/** Full private read chain: authenticated own metadata, then own evidence only.
 * No Director source is accepted as a substitute for the actor-bound reader. */
export async function loadNativeMixedOwnPlayerCardV1(o:{target:NativeMixedGameTargetV1;transport:ReturnType<typeof createNativeMixedGameEvidenceTransportV1>;enabled:()=>boolean;current:()=>boolean}):Promise<NativeMixedPlayerCardV1|null>{
 if(o.enabled()!==true||!o.current())return null;
 let reply;try{reply=await o.transport.bindings(structuredClone(o.target));}catch{return null;}
 if(o.enabled()!==true||!o.current()||reply.error!==null||!reply.data)return null;
 return loadNativeMixedPlayerCardV1({...o,bindings:reply.data});
}
