import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import{readNativeMixedReviewEnvelopeV1,type NativeMixedReviewContextV1}from'../finance/native-mixed-review-read-v1.ts';
import{readNativeMixedMainWorkspaceViewV1,joinNativeMixedMainRecipientsV1,nativeMixedMainRecipientsIdentifiedV1}from'../finance/native-mixed-main-workspace-view-v1.ts';
import{readNativeMixedPoolPreparationV1}from'../finance/native-mixed-pool-preparation-view-v1.ts';
import{playoffCorrectionPlainV1 as plain,playoffCorrectionSameV1 as same}from'../playoffs/native-mixed-playoff-reopen-v1.ts';
import{projectNativeMixedPoolResultsV1,type NativeMixedPoolResultsV1}from'./native-mixed-pool-results-v1.ts';
import{projectNativeMixedPoolFinalResultsV1,type NativeMixedFinalPoolAwardsV1}from'./native-mixed-pool-final-results-v1.ts';
export const nativeMixedEventResultsEnabledV1=()=>integratedTestFeatureEnabled();
export type NativeMixedResultsScopeV1=NativeMixedReviewContextV1&{eventKind:'main'|'consolation'|'satellite'|'custom';format:string};
type Person={name:string;tournamentIdNumber:string};
export type NativeMixedEventResultsV1={status:'available';simulationOnly:true;moneyMoved:false;mrpAwarded:false;officialResultsRecorded:false;sourceObservation:'matching-double-read-not-atomic';rows:(Person&{rank:number;games:number;gamePoints:number;wins:number;netSpread:number;qualifier:boolean|null})[];tieReviewRequired:boolean;qualifierCount:5;
 playoffs:{status:'unavailable'}|{status:'complete';groups:{firstPlace:number;lastPlace:number;people:Person[]}[]};
 regular:{status:'unavailable'}|{status:'pending'|'unpaid_simulated';costsReviewed:boolean;fundMinor:number;totalMinor:number|null;groups:{firstPlace:number;lastPlace:number;perPersonMinor:number;people:Person[]}[]};
 pools:NativeMixedPoolResultsV1;poolAwards:NativeMixedFinalPoolAwardsV1;
};
/** Projection only; never authentication, recalculation or an official result.
 * Called only after matching normal-auth captures. Names join immutable IDs,
 * not rank/name similarity. Sections with mismatched sources remain unknown. */
export function projectNativeMixedEventResultsV1(input:{qualification:unknown;main:unknown;preparation:unknown;poolWorkspace:unknown;poolFinal?:unknown},scope:NativeMixedResultsScopeV1):NativeMixedEventResultsV1|null{try{
 if(scope.eventKind!=='main'||scope.format!=='singles')return null;
 const context={projectRef:scope.projectRef,scope:scope.scope,sessionId:scope.sessionId},r=readNativeMixedReviewEnvelopeV1(input.qualification,context)?.review;
 const p=readNativeMixedPoolPreparationV1(input.preparation,scope.scope);if(!r||!p||p.preStart||r.fundingSourceDigest!==p.fundingSourceDigest)return null;
 const roster=[...p.digitalParticipants,...p.fictionalPaperParticipants];
 const person=(pid:string,fixed?:string):Person|null=>{const x=roster.find(x=>x.participantId===pid&&x.fixedIdStatus==='published'&&(fixed===undefined||x.fixedTournamentId===fixed));return x&&x.fixedTournamentId&&x.displayName.trim()===x.displayName&&x.displayName.trim()?{name:x.displayName,tournamentIdNumber:x.fixedTournamentId}:null;};
 const rows=[];for(const c of [...r.cards].sort((a,b)=>a.rank-b.rank)){const who=person(c.participantId,c.fixedTournamentId);if(!who)return null;rows.push({...who,rank:c.rank,games:c.games,gamePoints:c.gamePoints,wins:c.wins,netSpread:c.netSpread,qualifier:r.qualificationReady?c.rank<=r.qualifyingCount:null});}
 let playoffs:NativeMixedEventResultsV1['playoffs']={status:'unavailable'},regular:NativeMixedEventResultsV1['regular']={status:'unavailable'};
 const decoded=readNativeMixedMainWorkspaceViewV1(input.main,{tournamentId:scope.scope.tournamentId,eventId:scope.scope.eventId});
 if(decoded&&plain(input.main)){
  const raw=input.main as Record<string,unknown>,source=raw.source as {capture?:{playoffSource?:{capture?:{review?:unknown}}}}|undefined;
  const m=joinNativeMixedMainRecipientsV1(decoded,p,scope.scope.actorId);
  if(same(source?.capture?.playoffSource?.capture?.review,r)&&m.grossMinor===r.simulatedGrossMinor&&m.fundingSourceDigest===r.fundingSourceDigest&&nativeMixedMainRecipientsIdentifiedV1(m)){
   const groups=m.finishingBands.map(b=>({...b,people:m.recipients.filter(x=>x.firstPlace===b.firstPlace&&x.lastPlace===b.lastPlace).map(x=>person(x.participantId,x.fixedTournamentId))}));
   if(groups.every(g=>g.people.length===g.lastPlace-g.firstPlace+1&&g.people.every(Boolean))){
    playoffs={status:'complete',groups:groups.map(g=>({firstPlace:g.firstPlace,lastPlace:g.lastPlace,people:g.people as Person[]}))};
    regular={status:m.awards?'unpaid_simulated':'pending',costsReviewed:m.costsReviewed,fundMinor:m.netMinor,totalMinor:m.awards?.totalMinor??null,groups:m.awards?m.awards.groups.map(g=>({firstPlace:g.firstPlace,lastPlace:g.lastPlace,perPersonMinor:g.perPersonMinor,people:g.participantIds.map(pid=>person(pid)!)})):[]};
   }
  }
 }
 const pools=projectNativeMixedPoolResultsV1(input.preparation,input.poolWorkspace,scope.scope);
 const poolAwards=projectNativeMixedPoolFinalResultsV1(input.poolFinal,input.preparation,input.poolWorkspace,r,context);
 return{status:'available',simulationOnly:true,moneyMoved:false,mrpAwarded:false,officialResultsRecorded:false,sourceObservation:'matching-double-read-not-atomic',rows,tieReviewRequired:r.tieReviewRequired,qualifierCount:5,playoffs,regular,pools,poolAwards};
 }catch{return null;}}
