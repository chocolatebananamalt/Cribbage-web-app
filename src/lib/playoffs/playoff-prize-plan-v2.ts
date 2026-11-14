import {validIncrementFactorDraftV1} from './event-playoff-parameters-v1.ts';
import {resolveMainConPaidPlaceCutoffV1} from '../results/maincon-paid-place-cutoff-v1.ts';
export const playoffPrizeRecipientsV2=['all','top-2','top-4','top-8','top-16','top-32','top-64','top-128'] as const;
export const playoffPrizeMethodsV2=['graduated','equal','winner-multiplier','winner-takes-all'] as const;
export type PlayoffPrizePlanDraftV2={version:'playoff-prize-plan-draft-v2';recipients:typeof playoffPrizeRecipientsV2[number];method:typeof playoffPrizeMethodsV2[number];incrementFactorText:string;winnerMultiplierText:string;firstRoundComparison:'unset'|'less'|'equal'|'more';rounding:{regular:'1'|'5'|'10';qPool:'1'|'5'|'10';sidePool:'1'|'5'|'10'}};
export type PlayoffPrizeFieldV2={status:'unknown'|'known';qualifierCount:number|null;firstRoundLoserPlaces:number[]|null;entryFeeMinor:number|null};
export function newPlayoffPrizePlanDraftV2():PlayoffPrizePlanDraftV2{return{version:'playoff-prize-plan-draft-v2',recipients:'all',method:'graduated',incrementFactorText:'1.5',winnerMultiplierText:'2',firstRoundComparison:'unset',rounding:{regular:'5',qPool:'5',sidePool:'5'}};}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const whole=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0);
export function isPlayoffPrizePlanDraftV2(v:unknown):v is PlayoffPrizePlanDraftV2{return exact(v,['version','recipients','method','incrementFactorText','winnerMultiplierText','firstRoundComparison','rounding'])&&v.version==='playoff-prize-plan-draft-v2'&&playoffPrizeRecipientsV2.includes(v.recipients as PlayoffPrizePlanDraftV2['recipients'])&&playoffPrizeMethodsV2.includes(v.method as PlayoffPrizePlanDraftV2['method'])&&typeof v.incrementFactorText==='string'&&v.incrementFactorText.length<=256&&typeof v.winnerMultiplierText==='string'&&v.winnerMultiplierText.length<=256&&['unset','less','equal','more'].includes(v.firstRoundComparison as string)&&exact(v.rounding,['regular','qPool','sidePool'])&&Object.values(v.rounding).every(x=>['1','5','10'].includes(x as string));}
/** Layout/draft inspection only. Field facts must come from a reviewed bracket;
 * no bracket, membership, receipt, award, persistence or payment is inferred. */
export function inspectPlayoffPrizePlanV2(draft:unknown,field:unknown){
 const authority={persistenceAvailable:false as const,calculatedAmountsAvailable:false as const,qualificationChanged:false as const,authoritative:false as const,finalizationAllowed:false as const,payoutAuthorized:false as const,moneyMoved:false as const};
 const blocked=(code:string)=>({status:'blocked' as const,code,...authority});
 if(!isPlayoffPrizePlanDraftV2(draft))return blocked('invalid_draft');
 if(!exact(field,['status','qualifierCount','firstRoundLoserPlaces','entryFeeMinor'])||!['unknown','known'].includes(field.status as string)||(field.entryFeeMinor!==null&&!whole(field.entryFeeMinor)))return blocked('invalid_field');
 if(field.status==='unknown'&&(field.qualifierCount!==null||field.firstRoundLoserPlaces!==null))return blocked('unknown_field_with_result_claim');
 if(field.status==='known'&&(!whole(field.qualifierCount)||field.qualifierCount<1||field.qualifierCount>10000))return blocked('invalid_field');
 const q=field.qualifierCount as number|null,places=field.firstRoundLoserPlaces;
 if(places!==null&&(!Array.isArray(places)||q===null||places.length>q||places.some(p=>!whole(p)||p<2||p>q)||new Set(places).size!==places.length))return blocked('invalid_first_round_evidence');
 if(draft.method==='graduated'&&!validIncrementFactorDraftV1(draft.incrementFactorText))return blocked('invalid_factor');
 if(draft.method==='winner-multiplier'&&!validIncrementFactorDraftV1(draft.winnerMultiplierText))return blocked('invalid_winner_multiplier');
 const requested=draft.method==='winner-takes-all'?1:draft.recipients==='all'?q:Number(draft.recipients.slice(4));
 const cutoff=q!==null&&requested!==null?resolveMainConPaidPlaceCutoffV1({qualifierCount:q,requestedPaidPlaces:requested}):null;
 if(cutoff?.status==='blocked')return blocked(cutoff.code);
 const included=cutoff?.status==='resolved'?cutoff.actualPaidPlaces:null;
 const includedFirstRoundPlaces=Array.isArray(places)&&included!==null?places.filter(p=>p<=included):null;
 const eligibleMethod=draft.method==='graduated'||draft.method==='winner-multiplier';
 const comparisonVisible=eligibleMethod&&includedFirstRoundPlaces!==null&&includedFirstRoundPlaces.length>0;
 let comparisonCompatibility:'not_applicable'|'pending_entry_fee'|'choice_required'|'compatible_increment'|'incompatible_increment'|'no_equal_constraint'='not_applicable';
 if(comparisonVisible){if(field.entryFeeMinor===null||field.entryFeeMinor===0)comparisonCompatibility='pending_entry_fee';else if(draft.firstRoundComparison==='unset')comparisonCompatibility='choice_required';else comparisonCompatibility=draft.firstRoundComparison!=='equal'?'no_equal_constraint':field.entryFeeMinor%(Number(draft.rounding.regular)*100)!==0?'incompatible_increment':'compatible_increment';}
 return{status:'draft_review' as const,fieldKnown:q!==null,qualifierCount:q,requestedPaidPlaces:requested,includedPaidPlaces:included,cutoffWarning:cutoff?.status==='resolved'?cutoff.warning:null,winnerOnly:draft.method==='winner-takes-all',comparisonVisible,comparisonPending:eligibleMethod&&includedFirstRoundPlaces===null,includedFirstRoundPlaces,comparisonCompatibility,roundingStepMinor:Number(draft.rounding.regular)*100,amountsAreEstimates:true as const,...authority};
}
