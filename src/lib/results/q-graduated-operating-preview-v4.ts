import {graduatedQMethodV4,type QOperatingWorkspaceV4} from '../api/q-graduated-policy-v4.ts';
import type {QOperatingWorkspaceV3} from '../api/q-operating-schedules.ts';
import {calculateGraduatedPoolAmountsV2} from './graduated-pool-amounts-v2.ts';
import {operatingWorkspacePoolPreview,type OperatingWorkspacePreview} from './q-operating-workspace-preview.ts';
import {orderQCardsV2} from './q-operating-schedule.ts';
/** Read-only current preview. Immutable server recomputation remains authority.
 * Existing versions retain their own amount calculator and history. */
export function qGraduatedOperatingPreviewV4(source:QOperatingWorkspaceV4,poolVersionId:string):OperatingWorkspacePreview|{status:'preview';fundMinor:number;awards:Array<{participantId:string;amountMinor:number}>;refunds:[];moneyMoved:false;calculation:ReturnType<typeof calculateGraduatedPoolAmountsV2>&{status:'calculated'}}{
 const policy=source.policies.find(p=>p.poolVersionId===poolVersionId);
 if(policy?.method!==graduatedQMethodV4){
  const old=operatingWorkspacePoolPreview(source as QOperatingWorkspaceV3,poolVersionId);
  if(old.status==='preview'&&old.awards.some(r=>r.amountMinor%500!==0))return{status:'blocked',code:'whole_five_awards_required'};
  return old;
 }
 if(!source.membership?.supported||source.blockers.length||!source.cards.length)return{status:'blocked',code:source.blockers.join(', ')||'current_finalized_sources_required'};
 const pool=source.membership.pools.find(p=>p.poolVersionId===poolVersionId);if(!pool)return{status:'blocked',code:'disclosed_policy_required'};
 const paid=new Set<string>();
 for(const e of source.membership.entries){
  if(e.receivedMinor>0&&!e.allocationCurrent)return{status:'blocked',code:'unresolved_receipt_allocation'};
  const p=e.pools.find(p=>p.poolVersionId===poolVersionId);if(!p)return{status:'blocked',code:'pool_membership_unavailable'};
  if(!p.elected){if(p.amountAllocatedMinor>0)return{status:'blocked',code:'refund_resolution_required'};continue;}
  const prefix=`Q policy ${policy.id}: `;
  if(!p.prePlayElected)return{status:'blocked',code:'preplay_election_required'};
  if(!p.consentReference.startsWith(prefix)||!p.consentReference.slice(prefix.length).trim())return{status:'blocked',code:'policy_acknowledgment_required'};
  if(!e.allocationCurrent||!p.paidEntryEligible||p.amountAllocatedMinor!==pool.feeMinor)return{status:'blocked',code:'partial_or_stale_contribution'};
  paid.add(e.participantId);
 }
 const calc=calculateGraduatedPoolAmountsV2({paidCount:paid.size,feeMinor:pool.feeMinor,ratio:policy.ratio});if(calc.status!=='calculated')return calc;
 const cards=source.cards.filter(c=>paid.has(c.participantId));if(cards.length!==paid.size)return{status:'blocked',code:'current_finalized_sources_required'};
 const ranked=orderQCardsV2(cards,[]);if(!ranked)return{status:'blocked',code:'cash_tie_policy_unresolved'};
 return{status:'preview',fundMinor:calc.fundMinor,awards:ranked.slice(0,calc.recipientCount).map((c,i)=>({participantId:c.participantId,amountMinor:calc.awardsMinor[i]})),refunds:[],moneyMoved:false,calculation:calc};
}
