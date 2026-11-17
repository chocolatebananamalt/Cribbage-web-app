import {readSelectedStepPoolWorkspaceV3,type SelectedStepPoolReviewV3} from '../finance/selected-step-pool-contract-v3.ts';
export const poolProposalResultsEnabledV38=()=>false;
export function poolProposalEventEligibleV38(event:{eventType:string;format:string;scoringMethod:string}){return event.eventType==='main'&&event.format==='standard_singles'&&event.scoringMethod==='digital';}
type Review=Pick<SelectedStepPoolReviewV3,'pools'|'qMinor'|'sideMinor'|'totalMinor'>;
export type PoolProposalResultsV38={status:'held';code:string}|{status:'historical-record';review:null}|{status:'unsaved'|'saved'|'changed-source';review:Review};
/** Proposal amounts are never read from the historical recorded branch. */
export function projectPoolProposalResultsV38(value:unknown,qualificationId:string):PoolProposalResultsV38|null{
 const w=readSelectedStepPoolWorkspaceV3(value);if(!w)return null;
 if(w.status==='held')return{status:'held',code:w.code};
 if(w.status==='recorded')return{status:'historical-record',review:null};
 if(w.review.qualificationResultVersionId!==qualificationId)return{status:'held',code:'qualification_changed'};
 const review:Review=structuredClone({pools:w.review.pools,qMinor:w.review.qMinor,sideMinor:w.review.sideMinor,totalMinor:w.review.totalMinor});
 return{status:w.proposalRevisionId!==null?'saved':w.version>0?'changed-source':'unsaved',review};
}
