import {calculatePlayoffPrizeComparisonV2} from './playoff-prize-comparison-v2.ts';
import {isEventPrizeResponseValueV1} from '../api/event-prize-settings-v1.ts';
import type {PlayoffPrizePlanDraftV2,PlayoffPrizeFieldV2} from '../playoffs/playoff-prize-plan-v2.ts';
import type {MainConWholeBandOverrideV2} from './maincon-fund-proposals-v2.ts';

/** The exact source returned by buildPlayoffPrizeProposalBasisV2. These are
 * content pins, not client-issued authority or proof of a provider/ledger read. */
export type PlayoffPrizeProposalSourceV2={tournamentId:string;eventId:string;eventClientRowId:string;eventKind:'main'|'consolation';setupRevisionId:string;settingsSnapshotId:string;settingsDigest:string;prizeSnapshotId:string;prizeDigest:string;allocationRevisionId:string;qualificationResultVersionId:string;ledgerDigest:string;resultsDigest:string};
export type PlayoffPrizeProposalInputV2={plan:PlayoffPrizePlanDraftV2;field:PlayoffPrizeFieldV2;fundMinor:number};
export type PlayoffPrizeWholeBandOverrideV2=MainConWholeBandOverrideV2;
export type PlayoffPrizeCurrentV2={source:PlayoffPrizeProposalSourceV2;input:PlayoffPrizeProposalInputV2};
export type PlayoffPrizeProposalV2=PlayoffPrizeCurrentV2&{overrideHistory:PlayoffPrizeWholeBandOverrideV2[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const whole=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const sourceKeys=['tournamentId','eventId','eventClientRowId','eventKind','setupRevisionId','settingsSnapshotId','settingsDigest','prizeSnapshotId','prizeDigest','allocationRevisionId','qualificationResultVersionId','ledgerDigest','resultsDigest'];
function source(v:unknown):v is PlayoffPrizeProposalSourceV2{return exact(v,sourceKeys)&&['main','consolation'].includes(v.eventKind as string)&&['tournamentId','eventId','eventClientRowId','setupRevisionId','settingsSnapshotId','prizeSnapshotId','allocationRevisionId','qualificationResultVersionId'].every(k=>uuid(v[k]))&&['settingsDigest','prizeDigest','ledgerDigest','resultsDigest'].every(k=>hash(v[k]));}
const noAuthority={authoritative:false as const,writeAuthorized:false as const,recipientAssignmentAllowed:false as const,finalizationAllowed:false as const,payoutAuthorized:false as const,paymentAuthorized:false as const,moneyMoved:false as const,qualificationChanged:false as const};

/** Pure source-bound manual proposal. Reuses the established whole-band record,
 * latest-prior correction/void/reopen and unchanged-prefix semantics, with V2
 * comparison math and its selected regular increment. A void restores SOURCE
 * comparison amounts, not the preceding manual value. Nothing is rebalanced.
 * Full retained inputs remain untouched on every success/rejection path. */
export function calculatePlayoffPrizeProposalsV2(retained:unknown,expectedCurrent:unknown){
 const fail=(code:string)=>({status:'blocked' as const,code,retainedUnchanged:true as const,...noAuthority});
 try{
  // Read/history budget only. This does not raise an outgoing save/API limit.
  if(!isEventPrizeResponseValueV1(retained)||!isEventPrizeResponseValueV1(expectedCurrent)||!exact(retained,['source','input','overrideHistory'])||!source(retained.source)||!Array.isArray(retained.overrideHistory))return fail('invalid_input');
  if(!exact(expectedCurrent,['source','input'])||!source(expectedCurrent.source))return fail('current_basis_unavailable');
  if(retained.overrideHistory.length>10000)return fail('technical_history_bound');
  const currentCalculation=calculatePlayoffPrizeComparisonV2(expectedCurrent.input);if(currentCalculation.status!=='calculated_comparison')return fail('current_basis_unavailable');
  if(canonical({source:retained.source,input:retained.input})!==canonical(expectedCurrent))return fail('stale_source_or_input');
  const calculated=calculatePlayoffPrizeComparisonV2(retained.input);if(calculated.status!=='calculated_comparison')return fail(calculated.code);
  const input=retained.input as PlayoffPrizeProposalInputV2,step=calculated.roundingStepMinor;
  const bands=new Map(calculated.bands.map(b=>[`${b.firstPlace}:${b.lastPlace}`,b])),latest=new Map<string,PlayoffPrizeWholeBandOverrideV2>(),ids=new Set<string>();
  for(const value of retained.overrideHistory){
   if(!exact(value,['recordId','firstPlace','lastPlace','priorRecordId','perPersonMinor','voided','reason'])||!uuid(value.recordId)||!whole(value.firstPlace)||!whole(value.lastPlace)||!whole(value.perPersonMinor)||value.perPersonMinor%step!==0||typeof value.voided!=='boolean'||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>2000||!(value.priorRecordId===null||uuid(value.priorRecordId)))return fail('invalid_override');
   const record=value as PlayoffPrizeWholeBandOverrideV2,key=`${record.firstPlace}:${record.lastPlace}`;
   if(!bands.has(key))return fail('override_must_cover_exact_finishing_band');
   const previous=latest.get(key);
   if(ids.has(record.recordId)||(!previous&&(record.priorRecordId!==null||record.voided))||(previous&&record.priorRecordId!==previous.recordId))return fail('invalid_override_lineage');
   ids.add(record.recordId);latest.set(key,record);
  }
  let total=BigInt(0);
  const proposedBands=calculated.bands.map(b=>{
   const override=latest.get(`${b.firstPlace}:${b.lastPlace}`),active=!!override&&!override.voided;
   const perPersonMinor=active?override.perPersonMinor:b.perPersonMinor,bandTotal=BigInt(perPersonMinor)*BigInt(b.people);total+=bandTotal;
   return{firstPlace:b.firstPlace,lastPlace:b.lastPlace,people:b.people,sourcePerPersonMinor:b.perPersonMinor,perPersonMinor,bandTotalMinor:bandTotal,overrideState:!override?'absent' as const:override.voided?'voided' as const:'active' as const,overrideRecordId:override?.recordId??null,overrideVoided:override?.voided??false};
  });
  if(total>BigInt(Number.MAX_SAFE_INTEGER)||proposedBands.some(b=>b.bandTotalMinor>BigInt(Number.MAX_SAFE_INTEGER)))return fail('unsafe_total');
  // Explicit excluded whole bands are not missing awards or editable overrides.
  // This describes finishing-place groups, never seeds, identities or outcomes.
  const excludedBands:Array<{firstPlace:number;lastPlace:number;people:number;perPersonMinor:0;bandTotalMinor:0;status:'excluded_by_saved_paid_places'}>=[];
  for(let first=1;first<=calculated.qualifierCount;first=first===1?2:first*2-1){const last=Math.min(calculated.qualifierCount,first===1?1:(first-1)*2);if(first>calculated.actualPaidPlaces)excludedBands.push({firstPlace:first,lastPlace:last,people:last-first+1,perPersonMinor:0,bandTotalMinor:0,status:'excluded_by_saved_paid_places'});}
  const discrepancy=Number(total-BigInt(input.fundMinor)),zeroAwardBand=proposedBands.some(b=>b.perPersonMinor===0),rankOrderViolation=proposedBands.some((b,i)=>i>0&&b.perPersonMinor>proposedBands[i-1].perPersonMinor);
  const manualDistributionChanged=proposedBands.some(b=>b.perPersonMinor!==b.sourcePerPersonMinor);
  const equalTreatmentViolation=input.plan.method==='equal'&&proposedBands.some(b=>b.perPersonMinor!==proposedBands[0].perPersonMinor);
  let winnerMultiplierRelationReviewRequired=false;
  if(input.plan.method==='winner-multiplier'&&manualDistributionChanged&&proposedBands.length>1){
   const [i,d='']=input.plan.winnerMultiplierText.split('.'),den=BigInt(10)**BigInt(d.length),num=BigInt(i)*den+BigInt(d||'0'),others=proposedBands.slice(1),base=others[0].perPersonMinor;
   winnerMultiplierRelationReviewRequired=others.some(b=>b.perPersonMinor!==base)||BigInt(proposedBands[0].perPersonMinor)*den!==BigInt(base)*num;
  }
  // A review flag, not a declaration that natural source rounding broke policy.
  // Unchanged rounded source amounts never trigger a manual-method warning.
  const methodRelationReviewRequired=manualDistributionChanged&&input.plan.method!=='winner-takes-all';
  let comparison=calculated.comparison;
  if(comparison==='satisfied'||comparison==='not_satisfied'){
   const included=proposedBands.filter(b=>input.field.firstRoundLoserPlaces!.some(p=>p>=b.firstPlace&&p<=b.lastPlace)),fee=input.field.entryFeeMinor!;
   comparison=included.every(b=>input.plan.firstRoundComparison==='less'?b.perPersonMinor<fee:input.plan.firstRoundComparison==='more'?b.perPersonMinor>fee:b.perPersonMinor===fee)?'satisfied':'not_satisfied';
  }
  const issues:Array<{code:string;differenceMinor?:number;comparison?:typeof comparison}>=[];
  if(discrepancy!==0)issues.push({code:'unbalanced',differenceMinor:discrepancy});
  if(rankOrderViolation)issues.push({code:'rank_order_violation'});
  if(zeroAwardBand)issues.push({code:'zero_award_band'});
  if(manualDistributionChanged)issues.push({code:'manual_distribution_changed'});
  if(equalTreatmentViolation)issues.push({code:'equal_treatment_violation'});
  if(methodRelationReviewRequired)issues.push({code:'selected_method_review_required'});
  if(winnerMultiplierRelationReviewRequired)issues.push({code:'winner_multiplier_relation_review_required'});
  if(!['not_applicable','satisfied'].includes(comparison))issues.push({code:'first_round_intention_review_required',comparison});
  return{status:'proposal_review' as const,version:'playoff-prize-source-bound-whole-band-proposals-v2' as const,source:structuredClone(retained.source),input:structuredClone(input),sourceCalculation:calculated,
   requestedPaidPlaces:calculated.requestedPaidPlaces,actualPaidPlaces:calculated.actualPaidPlaces,positiveAwardPlaces:proposedBands.reduce((count,b)=>count+(b.perPersonMinor>0?b.people:0),0),cutoffWarning:calculated.cutoffWarning,
   excludedBands,excludedPlaces:excludedBands.reduce((n,b)=>n+b.people,0),
   proposedBands:proposedBands.map(b=>({...b,bandTotalMinor:Number(b.bandTotalMinor)})),proposedTotalMinor:Number(total),discrepancyMinor:discrepancy,balanced:discrepancy===0,zeroAwardBand,rankOrderViolation,
   manualDistributionChanged,equalTreatmentViolation,methodRelationReviewRequired,winnerMultiplierRelationReviewRequired,comparison,roundingStepMinor:step,historyRecordCount:retained.overrideHistory.length,issues,reviewRequired:retained.overrideHistory.length>0||issues.length>0,retainedUnchanged:true as const,...noAuthority};
 }catch{return fail('invalid_input');}
}

/** Persistence/recovery must supply the complete old history. A suffix alone
 * cannot prove an extension. No helper rebases to a changed source or input. */
export function isPlayoffPrizeProposalExtensionV2(previous:unknown,next:unknown,expectedCurrent:unknown):boolean{
 if(calculatePlayoffPrizeProposalsV2(previous,expectedCurrent).status!=='proposal_review'||calculatePlayoffPrizeProposalsV2(next,expectedCurrent).status!=='proposal_review')return false;
 const a=previous as PlayoffPrizeProposalV2,b=next as PlayoffPrizeProposalV2;
 return b.overrideHistory.length>=a.overrideHistory.length&&a.overrideHistory.every((record,index)=>canonical(record)===canonical(b.overrideHistory[index]));
}
