import {closeSame,closeUuid,makeCloseRequest,type CloseView,type CloseScope} from '../finance/modern-event-close-contract-v1.ts';
export const eventApprovalResultsEnabledV40=()=>false;
export function eventApprovalEventEligibleV40(e:{eventType:string;format:string;scoringMethod:string}){return ['main','consolation'].includes(e.eventType)&&e.format==='standard_singles'&&e.scoringMethod==='digital';}
export type EventApprovalResultsV40={status:'held'|'pool-review-required'|'final-approval-required'|'approval-saved-closure-unverified'|'approval-saved-play-open'|'play-closed'};
/** Input is the existing current-source transport projection, never a receipt. No source IDs or amounts leave this projection. */
export function projectEventApprovalResultsV40(v:CloseView,scope:CloseScope,qid:string):EventApprovalResultsV40|null{
 if(!v||!closeSame(v.scope,scope)||!closeUuid(qid)||v.moneyMoved!==false||v.officialMrpAwarded!==false)return null;
 if(v.status==='held')return v.review===null&&v.recordId===null?{status:'held'}:null;
 const r=v.review;if(!r||r.qualificationId!==qid||!makeCloseRequest(r,'Read current approval status'))return null;
 if(v.status==='review'&&v.recordId===null){
  if(v.code==='director_approval_required'&&r.stage==='pool')return{status:'pool-review-required'};
  if(v.code==='director_approval_required'&&['event','regular'].includes(r.stage))return{status:'final-approval-required'};
  if(v.code==='director_closure_required'&&['closure','regular-closure'].includes(r.stage)&&closeUuid(r.finalSnapshotId))return{status:'approval-saved-play-open'};
 }
 if(v.status==='recorded'&&closeUuid(v.recordId)){
  if((r.stage==='event'&&v.code==='approved_unpaid')||(r.stage==='regular'&&v.code==='regular_consolation_approved_unpaid'))return{status:'approval-saved-closure-unverified'};
  if(['closure','regular-closure'].includes(r.stage)&&v.code==='event_play_closed'&&closeUuid(r.finalSnapshotId))return{status:'play-closed'};
 }
 return null;
}
