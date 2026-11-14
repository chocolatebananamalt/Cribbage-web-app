import 'server-only';
import {createHash} from 'node:crypto';
import {buildPlayoffPrizeProposalBasisV2} from './playoff-prize-proposal-basis-v2.ts';
import {projectEventLedgerV1} from './event-ledger-projection-v1.ts';
import {calculateSelectedStepPoolAmountsV3,type SelectedStepPoolPolicyV3} from '../results/selected-step-pool-amounts-v3.ts';
import {isEventPrizeResponseValueV1} from '../api/event-prize-settings-v1.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,k:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v),hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const noAuthority={writeAuthorized:false as const,financialFinalizationAllowed:false as const,currentSourceVerified:false as const,payoutAuthorized:false as const,moneyMoved:false as const};
/** New proposal domain only. The authenticated collector and versioned durable
 * writer still need integration. Existing $5 journals must not consume this.
 * Review pointers and recipient selection must come from current source readers;
 * client objects, opaque digests or this calculation never establish authority. */
export function buildSelectedStepCombinedAccountingV3(value:unknown){
 const hold=(code:string)=>({status:'blocked' as const,code,...noAuthority});
 try{
  if(!isEventPrizeResponseValueV1(value)||!exact(value,['basisInput','retainedPools','currentPools'])||!object(value.basisInput)||!Array.isArray(value.currentPools)||value.currentPools.length>100||canonical(value.retainedPools)!==canonical(value.currentPools))return hold('current_pool_sources_required');
  const b=buildPlayoffPrizeProposalBasisV2(value.basisInput);if(b.status!=='proposal_basis'||b.ledgerMode!=='documented_actual')return hold('saved_prize_and_current_ledger_required');
  const input=value.basisInput as {ledger:{current:unknown;retained:unknown};qualification:{result:{participantCount:number;qualifiers:Array<{participantId:string}>}}},ledger=projectEventLedgerV1({eventId:b.source.eventId,current:input.ledger.current,retained:input.ledger.retained});
  if(ledger.status!=='projected'||ledger.reviewRequired)return hold('current_ledger_required');
  const pools:Array<{poolId:string;kind:'q'|'side';roundingUnitMinor:100|500|1000;fundMinor:number;sourceDigest:string;recipientReviewId:string;recipients:Array<{participantId:string;tournamentPlayerId:string;amountMinor:number}>}>=[],seen=new Set<string>(),people=new Map<string,string>(),fixedIds=new Map<string,string>();let q=BigInt(0),side=BigInt(0);
  for(const p of value.currentPools){
   if(!exact(p,['poolId','kind','policyVersion','method','feeMinor','ratio','sourceDigest','recipientReviewId','qualificationResultVersionId','paidParticipantIds','recipients'])||!uuid(p.poolId)||seen.has(p.poolId)||!['q','side'].includes(p.kind as string)||p.policyVersion!=='selected-step-pool-policy-v3'||!hash(p.sourceDigest)||!uuid(p.recipientReviewId)||p.qualificationResultVersionId!==b.source.qualificationResultVersionId||!Array.isArray(p.paidParticipantIds)||p.paidParticipantIds.length>10000||!p.paidParticipantIds.every(uuid)||new Set(p.paidParticipantIds).size!==p.paidParticipantIds.length||!Array.isArray(p.recipients)||!p.recipients.length||p.recipients.length>10000)return hold('current_reviewed_pool_policy_required');
   if(p.paidParticipantIds.length>input.qualification.result.participantCount)return hold('paid_count_exceeds_event_field');
   seen.add(p.poolId);const eligible=new Set<string>(),paidIds=p.paidParticipantIds as string[];
   for(const r of p.recipients){if(!exact(r,['participantId','tournamentPlayerId'])||!uuid(r.participantId)||eligible.has(r.participantId)||!p.paidParticipantIds.includes(r.participantId)||typeof r.tournamentPlayerId!=='string'||!/^[A-Z]-[1-9][0-9]{0,3}$/.test(r.tournamentPlayerId)||people.has(r.participantId)&&people.get(r.participantId)!==r.tournamentPlayerId||fixedIds.has(r.tournamentPlayerId)&&fixedIds.get(r.tournamentPlayerId)!==r.participantId)return hold('reviewed_paid_recipient_identity_required');eligible.add(r.participantId);people.set(r.participantId,r.tournamentPlayerId);fixedIds.set(r.tournamentPlayerId,r.participantId);}
   if(p.method==='q-equal'){
    const expected=input.qualification.result.qualifiers.filter(r=>paidIds.includes(r.participantId)).map(r=>r.participantId).sort();
    if(canonical(expected)!==canonical([...eligible].sort()))return hold('all_paid_qualifiers_required_for_equal_q');
   }
   const unit=Number(b.input.plan.rounding[p.kind==='q'?'qPool':'sidePool'])*100;
   const calculated=calculateSelectedStepPoolAmountsV3({policy:{kind:p.kind,method:p.method,feeMinor:p.feeMinor,ratio:p.ratio,roundingUnitMinor:unit}as SelectedStepPoolPolicyV3,paidCount:p.paidParticipantIds.length,recipientCount:p.recipients.length});
   if(calculated.status!=='calculated')return hold(calculated.code);
   const fund=ledger.poolTotals.filter(x=>x.poolId===p.poolId&&x.kind===p.kind);if(fund.length!==1||fund[0].amountMinor!==calculated.fundMinor)return hold('pool_receipt_fund_mismatch');
   if(p.kind==='q')q+=BigInt(calculated.fundMinor);else side+=BigInt(calculated.fundMinor);
   pools.push({poolId:p.poolId,kind:p.kind as 'q'|'side',roundingUnitMinor:calculated.roundingUnitMinor,fundMinor:calculated.fundMinor,sourceDigest:p.sourceDigest as string,recipientReviewId:p.recipientReviewId,recipients:p.recipients.map((r,i)=>({participantId:r.participantId,tournamentPlayerId:r.tournamentPlayerId,amountMinor:calculated.awardsMinor[i]}))});
  }
  if(ledger.poolTotals.some(p=>p.amountMinor>0&&!seen.has(p.poolId)))return hold('complete_pool_fund_coverage_required');
  const total=BigInt(ledger.regularFundMinor)+q+side,awards=BigInt(b.comparison.roundedAwardsTotalMinor)+q+side;if(total>BigInt(Number.MAX_SAFE_INTEGER)||awards>BigInt(Number.MAX_SAFE_INTEGER))return hold('unsafe_combined_fund');
  return{status:'combined_accounting_proposal' as const,version:'selected-step-combined-accounting-v3' as const,source:b.source,sourceDigest:createHash('sha256').update(canonical({basis:value.basisInput,pools:value.currentPools})).digest('hex'),regularEstimate:b.comparison,pools,funds:{regularMinor:ledger.regularFundMinor,qMinor:Number(q),sideMinor:Number(side),totalMinor:Number(total)},awardEstimateTotalMinor:Number(awards),differenceMinor:Number(total-awards),held:b.comparison.reviewRequired,sourcePointersMustBeServerVerified:true as const,recipientOrderMustBeServerVerified:true as const,legacyAwardsUnchanged:true as const,reviewRequired:true as const,...noAuthority};
 }catch{return hold('invalid_combined_source');}
}
