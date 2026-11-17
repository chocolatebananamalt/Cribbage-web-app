import {createHash} from 'node:crypto';
import {readNativeMixedSimulationScheduleSourceV1,type NativeMixedSimulationScopeV1} from '../seating/native-mixed-simulation-operation-v1.ts';
import {projectOneTableMovement} from '../seating/one-table-movement.ts';
import {readNativeMixedPoolPreparationV1} from '../finance/native-mixed-pool-preparation-view-v1.ts';
import type {PairingPacketV28} from './paper-pairing-packet-v28.ts';

export type NativePairingPacketV29=PairingPacketV28&{simulationOnly:true;sourceObservation:'matching-double-read-not-atomic';normalStartAuthorized:false};
// Fields validated by the existing strict native decoder (whose public return
// type deliberately leaves nested fields unknown).
type DecodedSource={plan:{config:unknown};draw:{candidate:unknown};sourceDigest:unknown;publication:unknown;
 fixedAssignments:{assignmentId:string;participantId:string;rosterEntryId:string;fixedId:string}[];
 canonicalGames:{gameId:string;importRowNumber:number;round:number;sideAParticipantId:string;sideBParticipantId:string;sideATableSeat:string;sideBTableSeat:string}[]};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const safe=(s:string)=>!!s.trim()&&s.length<=160&&!/[\u0000-\u001f\u007f]|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|temporary\s*id\s*#\s*\d+/i.test(s.normalize('NFKC'));
/** Native source family stays separate from the ordinary schedule DTO. Names
 * join BOTH immutable roster and participant IDs; no mode/account inference. */
export function projectNativePaperPairingV29(raw:unknown,roster:unknown,scope:NativeMixedSimulationScopeV1,player?:string):NativePairingPacketV29|null {try{
 const decoded=readNativeMixedSimulationScheduleSourceV1(raw,scope),p=readNativeMixedPoolPreparationV1(roster,scope);
 if(!decoded||!p||player!==undefined&&!/^A-(?:[1-9]|1[0-8])$/.test(player))return null;
 const s=decoded as unknown as DecodedSource;
 const movement=projectOneTableMovement(s.plan.config,s.draw.candidate);if(movement.status!=='verified')return null;
 const people=[...p.digitalParticipants,...p.fictionalPaperParticipants],fixed=s.fixedAssignments;
 for(const key of ['assignmentId','participantId','rosterEntryId','fixedId'] as const)if(new Set(fixed.map(x=>x[key])).size!==18)return null;
 if(new Set(s.canonicalGames.map(x=>x.gameId)).size!==108||new Set(s.canonicalGames.map(x=>x.importRowNumber)).size!==108)return null;
 const cards=[];
 for(const f of fixed){
  const matches=people.filter(x=>x.participantId===f.participantId&&x.rosterEntryId===f.rosterEntryId&&x.fixedIdStatus==='published'&&x.fixedTournamentId===f.fixedId);
  const person=matches.length===1?matches[0]:null;if(!person||!safe(person.displayName))return null;
  const rows=[];
  for(const round of movement.rounds){
   const mine=round.players.find(x=>x.participantId===f.rosterEntryId&&x.tournamentId===f.fixedId),opponent=mine&&fixed.find(x=>x.rosterEntryId===mine.opponentId&&x.fixedId===mine.opponentTournamentId);
   if(!mine||!opponent)return null;
   const who=people.filter(x=>x.participantId===opponent.participantId&&x.rosterEntryId===opponent.rosterEntryId&&x.fixedIdStatus==='published'&&x.fixedTournamentId===opponent.fixedId);if(who.length!==1||!safe(who[0].displayName))return null;
   const games=s.canonicalGames.filter(g=>g.round===round.round&&(g.sideAParticipantId===f.participantId||g.sideBParticipantId===f.participantId));if(games.length!==1)return null;
   const g=games[0],a=g.sideAParticipantId===f.participantId;
   if((a?g.sideBParticipantId:g.sideAParticipantId)!==opponent.participantId||(a?g.sideATableSeat:g.sideBTableSeat)!==mine.currentSeat||(a?g.sideBTableSeat:g.sideATableSeat)!==round.players.find(x=>x.participantId===mine.opponentId)?.currentSeat)return null;
   rows.push({gameNumber:round.round,chair:mine.currentSeat,opponentId:opponent.fixedId,opponentName:who[0].displayName,opponentChair:a?g.sideBTableSeat:g.sideATableSeat});
  }
  if(rows.length!==12)return null;cards.push({name:person.displayName,fixedId:f.fixedId,rows});
 }
 cards.sort((a,b)=>a.fixedId.localeCompare(b.fixedId,'en',{numeric:true}));if(player&&!cards.some(c=>c.fixedId===player))return null;
 const reference=createHash('sha256').update(JSON.stringify([s.sourceDigest,s.publication,p.fundingSourceDigest,p.journalDigest,cards])).digest('hex').slice(0,16);
 return {tournamentName:'Fictional rehearsal — simulation only',eventName:'12-game test schedule',reference,cards:player?cards.filter(c=>c.fixedId===player):cards,simulationOnly:true,sourceObservation:'matching-double-read-not-atomic',normalStartAuthorized:false};
 }catch{return null;}}

export function nativePairingCapturesMatchV29(a:unknown,b:unknown){return same(a,b);}
