import {nativeMixedMainRecipientsIdentifiedV1} from './native-mixed-main-workspace-view-v1.ts';
import type{NativeMixedMainViewV1}from'./native-mixed-main-workspace-view-v1.ts';
import type{NativeMixedMainRequestV1}from'../api/native-mixed-main-transport-v1.ts';
export type NativeMixedMainEditorDraftV1={mode:'idle'|NativeMixedMainRequestV1['action'];basis:string;lineId:string|null;priorRecordId:string|null;category:'player_benefit'|'operating_expense'|'unrestricted_income';label:string;amountText:string;voided:boolean;amounts:[string,string,string,string];disclosure:string;coverageReason:string;reason:string;confirmed:boolean};
export type NativeMixedMainEditorActionV1={action:NativeMixedMainRequestV1['action'];data:Record<string,unknown>;reason:string;confirmed:true};
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s);
const text=(s:unknown,max:number):s is string=>typeof s==='string'&&s.length>0&&s.length<=max&&s===s.trim()&&!/[\u0000-\u001f\u007f]/.test(s);
export function nativeMixedMainEditorBasisV1(v:NativeMixedMainViewV1){return JSON.stringify([v.tournamentId,v.eventId,v.sourceDigest,v.journalDigest,v.costDigest,v.review,v.proposal,v.savedRounding,v.fundingSourceDigest,v.recipients,v.comparison]);}
/** New cost intents keep lineId null. Only the trusted host assigns an ID after
 * fresh identity and unchanged-intent checks on an explicit valid submission. */
export function newNativeMixedMainEditorDraftV1(v:NativeMixedMainViewV1|null,mode:NativeMixedMainEditorDraftV1['mode']='idle'):NativeMixedMainEditorDraftV1{return{mode,basis:v?nativeMixedMainEditorBasisV1(v):'',lineId:null,priorRecordId:null,category:'operating_expense',label:'',amountText:'',voided:false,amounts:['','','',''],disclosure:'',coverageReason:'',reason:'',confirmed:false};}
export function readNativeMixedMainMoneyTextV1(s:unknown):number|null{if(typeof s!=='string'||!/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/.test(s))return null;const [a,b='']=s.split('.'),n=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(n)&&n<=999999999999?n:null;}
export function nativeMixedMainManualTotalV1(v:NativeMixedMainViewV1,d:NativeMixedMainEditorDraftV1){const amounts=d.amounts.map(readNativeMixedMainMoneyTextV1);return amounts.some(n=>n===null)?null:amounts.reduce<number>((sum,n,i)=>sum+(n as number)*v.finishingBands[i].people,0);}
/** Presentation authoring only. The retained controller independently binds the
 * fresh view/review lease and the normal transport/SQL validates the request. */
export function buildNativeMixedMainEditorActionV1(v:NativeMixedMainViewV1|null,d:NativeMixedMainEditorDraftV1):NativeMixedMainEditorActionV1|null{
 if(!v||v.awards!==null||d.mode==='idle'||d.basis!==nativeMixedMainEditorBasisV1(v)||!text(d.reason,500)||d.confirmed!==true)return null;let data:Record<string,unknown>;
 if(d.mode==='cost-line'){const prior=v.lines.find(l=>l.lineId===d.lineId),amount=d.voided?0:readNativeMixedMainMoneyTextV1(d.amountText);if(!(d.lineId===null||uuid(d.lineId))||typeof d.voided!=='boolean'||!['player_benefit','operating_expense','unrestricted_income'].includes(d.category)||!text(d.label,200)||amount===null||(prior?(d.priorRecordId!==prior.recordId||d.category!==prior.category):d.priorRecordId!==null||d.voided))return null;
  data={lineId:d.lineId,priorRecordId:d.priorRecordId,category:d.category,label:d.label,amountMinor:amount,voided:d.voided};
 }else{if(v.savedRounding.status!=='saved_latest')return null;const unit=v.savedRounding.unitMinor;
  if(d.mode==='review-costs'){if(!text(d.coverageReason,500))return null;data={roundingUnitMinor:unit,coverage:{status:'not_applicable',reason:d.coverageReason},expectedBenefitsMinor:v.benefitsMinor,expectedExpensesMinor:v.expensesMinor,expectedIncomeMinor:v.additionalIncomeMinor,expectedNetMinor:v.netMinor,confirmed:true};}
  else{if(!v.costsReviewed||!v.review||v.review.roundingUnitMinor!==unit)return null;
   if(d.mode==='propose-awards'){const total=nativeMixedMainManualTotalV1(v,d),amounts=d.amounts.map(readNativeMixedMainMoneyTextV1);if(!nativeMixedMainAwardCoverageV2(v,amounts)||!text(d.disclosure,1000)||total!==v.netMinor||amounts.some((n,i)=>n===null||n<0||n%unit!==0||i>0&&n>(amounts[i-1] as number)))return null;data={costReviewId:v.review.id,manualPolicy:{version:amounts.some(n=>n===0)?'native-mixed-main-manual-whole-group-v2':'native-mixed-main-manual-whole-group-v1',roundingUnitMinor:unit,disclosure:d.disclosure},groups:v.finishingBands.map((b,i)=>({firstPlace:b.firstPlace,lastPlace:b.lastPlace,perPersonMinor:amounts[i]})),confirmed:true};}
   else if(d.mode==='finalize-unpaid'){if(!nativeMixedMainRecipientsIdentifiedV1(v)||!v.proposal||v.proposal.totalMinor!==v.netMinor)return null;data={costReviewId:v.review.id,awardProposalId:v.proposal.id,confirmed:true};}else return null;
  }
 }
 return{action:d.mode,data,reason:d.reason,confirmed:true};
}

/** Copy a compatible source-backed comparison into an UNSAVED manual draft.
 * This neither approves the calculator nor sends a request. Existing reviewed
 * whole-group writer remains the only persistence path. */
export function nativeMixedMainEstimateDraftV1(v:NativeMixedMainViewV1|null):NativeMixedMainEditorDraftV1|null{
 if(!v||v.awards||!v.costsReviewed||!v.review||v.savedRounding.status!=='saved_latest'||v.review.roundingUnitMinor!==v.savedRounding.unitMinor)return null;
 const c=v.comparison,unit=v.savedRounding.unitMinor;
 if(!c||c.status!=='calculated_comparison'||!c.balanced||c.reviewRequired||c.zeroAwardBand||c.fundMinor!==v.netMinor||c.roundingStepMinor!==unit||c.qualifierCount!==v.qualifierCount||c.actualPaidPlaces>v.qualifierCount||c.bands.length>v.finishingBands.length||c.bands.reduce((n,b)=>n+b.people,0)!==c.actualPaidPlaces||v.finishingBands.length!==4)return null;
 let previous=Number.MAX_SAFE_INTEGER,total=0;
 for(let i=0;i<c.bands.length;i++){const b=c.bands[i],f=v.finishingBands[i];if(b.firstPlace!==f.firstPlace||b.lastPlace!==f.lastPlace||b.people!==f.people||!Number.isSafeInteger(b.perPersonMinor)||b.perPersonMinor<=0||b.perPersonMinor%unit!==0||b.perPersonMinor>previous||b.bandTotalMinor!==b.perPersonMinor*f.people)return null;previous=b.perPersonMinor;total+=b.bandTotalMinor;}
 if(total!==v.netMinor||c.roundedAwardsTotalMinor!==total||c.discrepancyMinor!==0)return null;
 return{...newNativeMixedMainEditorDraftV1(v,'propose-awards'),amounts:v.finishingBands.map(f=>{const b=c.bands.find(b=>b.firstPlace===f.firstPlace&&b.lastPlace===f.lastPlace);return b?(b.perPersonMinor/100).toFixed(2):'0.00';}) as NativeMixedMainEditorDraftV1['amounts'],disclosure:'Director review of the saved Playoff settings estimate; whole finishing groups and saved rounding retained. No payout or disbursement authorized.'};
}

/** Zero means explicitly excluded by saved paid-place policy, never missing.
 * The trusted source comparison supplies whole-band cutoff, not typed amounts. */
export function nativeMixedMainAwardCoverageV2(v:NativeMixedMainViewV1,amounts:(number|null)[]):boolean{
 const c=v.comparison;
 if(!c||c.status!=='calculated_comparison'||c.fundMinor!==v.netMinor||c.qualifierCount!==v.qualifierCount)return !amounts.some(n=>n===0);
 if(c.actualPaidPlaces<1||c.actualPaidPlaces>v.qualifierCount)return false;
 return v.finishingBands.every((b,i)=>b.lastPlace<=c.actualPaidPlaces?amounts[i]!==null&&(amounts[i] as number)>0:b.firstPlace>c.actualPaidPlaces&&amounts[i]===0);
}
