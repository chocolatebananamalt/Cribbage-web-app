import {readPrepWorkspaceV1,type PrepScopeV1} from './modern-manual-preparation-contract-v1.ts';
import {readModernManualResultsV1} from '../results/modern-manual-playoff-results-v1.ts';
export const playoffProgressEnabledV37=()=>false;
export function progressEventEligibleV37(event:{eventType:string;format:string;scoringMethod:string}){return ['main','consolation'].includes(event.eventType)&&event.format==='standard_singles'&&event.scoringMethod==='digital';}
type Player={name:string;tournamentPlayerId:string;mode:'digital'|'paper'};
export type PlayoffProgressV37={status:'held';code:string}|{status:'available';qualifierCount:number;reviewed:boolean;started:boolean;regular:{winsRequired:number;maximumGames:number};final:{winsRequired:number;maximumGames:number};resultsAvailable:boolean;verifiedCount:number;complete:boolean;rows:{slot:number;round:string|null;players:Player[];state:'held'|'unprepared'|'waiting'|'result-unavailable'|'conflict'|'verified';code:string|null;winner:{name:string;tournamentPlayerId:string}|null}[]};
/** Read-only projection. No bracket seeding, winner advancement or payout rules. */
export function projectPlayoffProgressV37(preparation:unknown,results:unknown,scope:PrepScopeV1):PlayoffProgressV37|null{
 const p=readPrepWorkspaceV1(preparation,scope);if(!p)return null;if('status'in p)return{status:'held',code:p.code};if(!Number.isSafeInteger(p.qualifierCount))return null;
 const r=readModernManualResultsV1(results,scope,p.qualificationId);
 if(r&&r.qualifierCount!==p.qualifierCount)return null;
 const rows:Extract<PlayoffProgressV37,{status:'available'}>['rows']=[];
 for(const slot of p.slots){
  if(slot.status==='held'){rows.push({slot:slot.slot,round:null,players:[],state:'held',code:slot.code,winner:null});continue;}
  if(new Set(slot.players.map(x=>x.tournamentPlayerId)).size!==2)return null;
  const match=r?.matches.find(x=>x.slot===slot.slot);
  let state:typeof rows[number]['state']=!slot.generationCurrent?'unprepared':!match?'result-unavailable':match.status==='pending'?'waiting':'conflict';
  let winner:typeof rows[number]['winner']=null;
  if(match?.status==='verified'){
   const pair=[match.winner,match.loser];
   const bound=slot.generationCurrent&&slot.generationId===match.generationId&&slot.sourceDigest===match.sourceDigest&&new Set(pair.map(x=>x.tournamentPlayerId)).size===2&&slot.players.every(x=>pair.some(y=>y.tournamentPlayerId===x.tournamentPlayerId&&y.name===x.name));
   if(bound){state='verified';winner={name:match.winner.name,tournamentPlayerId:match.winner.tournamentPlayerId};}
   else state='conflict';
  }
  rows.push({slot:slot.slot,round:slot.round,players:slot.players,state,code:null,winner});
 }
 const verifiedCount=rows.filter(x=>x.state==='verified').length;
 return{status:'available',qualifierCount:p.qualifierCount,reviewed:p.gateReviewId!==null,started:p.startedCurrent,regular:p.regularFormat,final:p.finalFormat,resultsAvailable:r!==null,verifiedCount,complete:p.startedCurrent&&r?.complete===true&&verifiedCount===rows.length,rows};
}
