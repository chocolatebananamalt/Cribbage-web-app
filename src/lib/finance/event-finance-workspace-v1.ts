import {calculateEventFinanceRegistrationForecastV1} from './event-finance-registration-forecast-v1.ts';
import {calculateEventRegularFinanceV1,type RegularFinanceSourceV1,type RegularFinanceModeV1,type RegularFinanceLineV1} from '../results/event-regular-finance-v1.ts';
import {calculateMainConFundComparisonV2,type MainConFundInputV2} from '../results/maincon-fund-comparison-v2.ts';
import {calculateMainConFundProposalsV2,type MainConFundProposalSourceV2,type MainConWholeBandOverrideV2} from '../results/maincon-fund-proposals-v2.ts';
import type {MainConSourceSettingsV1} from '../results/maincon-source-model-v1.ts';
export type FinanceEditableCategoryV1='player_benefit'|'operating_expense'|'unrestricted_income';
export type FinanceNamedRecordV1={label:string;line:RegularFinanceLineV1};
export type EventFinanceWorkspaceV1={complete:true;source:RegularFinanceSourceV1;mode:RegularFinanceModeV1;tournamentName:string;eventName:string;eventKind:'main'|'consolation';startLabel:string;entryCount:number|null;paidEntryCount:number|null;qualifierCount:number|null;grossEntryMinor:number;history:FinanceNamedRecordV1[];settings:MainConSourceSettingsV1;payoutSource:MainConFundProposalSourceV2;savedAt:string|null;overrideHistory:MainConWholeBandOverrideV2[]};
export type FinanceLineFormV1={category:FinanceEditableCategoryV1;lineId:string|null;label:string;amount:string;reason:string};
export type FinanceBandFormV1={firstPlace:number;lastPlace:number;amount:string;reason:string};
export type EventFinanceEditorV1={basis:EventFinanceWorkspaceV1;history:FinanceNamedRecordV1[];overrideHistory:MainConWholeBandOverrideV2[];overrideInput:MainConFundInputV2|null;overridePlan:string|null;lineForm:FinanceLineFormV1|null;bandForm:FinanceBandFormV1|null;message:string};
export type EventFinanceActionV1={type:'add_line';category:FinanceEditableCategoryV1}|{type:'edit_line';lineId:string}|{type:'line_field';field:'label'|'amount'|'reason';value:string}|{type:'apply_line'}|{type:'void_line';lineId:string;reason:string}|{type:'cancel_line'}|{type:'edit_band';firstPlace:number;lastPlace:number}|{type:'band_field';field:'amount'|'reason';value:string}|{type:'apply_band'}|{type:'restore_band'}|{type:'cancel_band'}|{type:'review_payout_basis';reviewKey:string;reason:string;confirmed:true};
export type EventFinanceSectionViewV1={forecastPayoutType?:string;forecastIncrementFactor?:string;registrationForecast?:ReturnType<typeof calculateEventFinanceRegistrationForecastV1>;tournamentName:string;eventName:string;eventKind:'main'|'consolation';startLabel:string;modeLabel:string;entryCount:number|null;paidEntryCount:number|null;qualifierCount:number|null;savedAt:string|null;pending:boolean;blocked:boolean;message:string;warnings:string[];grossEntryMinor:number;basisFundMinor:number|null;basisBenefitsMinor:number|null;basisExpensesMinor:number|null;basisAdditionalIncomeMinor:number|null;benefitsMinor:number|null;expensesMinor:number|null;additionalIncomeMinor:number|null;fundMinor:number|null;excludedQMinor:number|null;excludedSideMinor:number|null;rows:Array<{lineId:string;category:string;label:string;amountMinor:number;basisAmountMinor:number|null;pending:boolean;voided:boolean;canEdit:boolean}>;lineForm:FinanceLineFormV1|null;bandForm:FinanceBandFormV1|null;canApplyLine:boolean;canApplyBand:boolean;canRestoreBand:boolean;payoutBands:Array<{firstPlace:number;lastPlace:number;people:number;calculatedPerPersonMinor:number;adjustedPerPersonMinor:number;bandTotalMinor:number;adjusted:boolean}>;calculatedTotalMinor:number|null;adjustedTotalMinor:number|null;differenceMinor:number|null;requestedPaidPlaces:number|null;actualPaidPlaces:number|null;positiveAwardPlaces:number|null;canEditPayout:boolean;historyRecordCount:number;overrideRecordCount:number;payoutReview?:ReturnType<typeof projectEventFinancePayoutBasisReviewV1>};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const whole=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0);
const text=(v:unknown,max=200):v is string=>typeof v==='string'&&!!v.trim()&&v===v.trim()&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const copy=<T>(v:T):T=>structuredClone(v);
const categories:FinanceEditableCategoryV1[]=['player_benefit','operating_expense','unrestricted_income'];
export function parseFinanceAmountV1(value:string):number|null{if(value.length>20||!/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(value))return null;const [a,b='']=value.split('.'),n=BigInt(a)*BigInt(100)+BigInt(b.padEnd(2,'0'));return n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):null;}
const amountText=(minor:number)=>`${Math.floor(minor/100)}.${String(minor%100).padStart(2,'0')}`;
function finance(w:EventFinanceWorkspaceV1,history:FinanceNamedRecordV1[]){return calculateEventRegularFinanceV1({source:w.source,mode:w.mode,grossEntry:{source:w.source,mode:w.mode,amountMinor:w.grossEntryMinor},history:history.map(r=>r.line)});}
function payoutInput(w:EventFinanceWorkspaceV1,fund:number):MainConFundInputV2|null{return w.qualifierCount===null||w.qualifierCount===0?null:{fundMinor:fund,qualifierCount:w.qualifierCount,settings:copy(w.settings)};}
function planningBasis(w:EventFinanceWorkspaceV1,history:FinanceNamedRecordV1[]){return canonical({basis:w,history});}
/** Compare retained planning JSON semantically; preserve its exact stored text. */
function planningBasisMatches(s:EventFinanceEditorV1){if(typeof s.overridePlan!=='string')return false;try{return canonical(JSON.parse(s.overridePlan))===planningBasis(s.basis,s.history);}catch{return false;}}
function namedRecords(value:unknown):value is FinanceNamedRecordV1[]{return Array.isArray(value)&&value.every(r=>exact(r,['label','line'])&&text(r.label));}
const optionalCategories=['q_pool_fund','side_pool_fund'];
function reboundRecord(row:FinanceNamedRecordV1,source:RegularFinanceSourceV1):FinanceNamedRecordV1{return{...copy(row),line:{...copy(row.line),source:copy(source)}};}
/** Validate a retained payout plan from the immediately prior source without
 * treating Q/Side basis evidence as editable proposal history. The database
 * adoption protocol still owns authoritative source/frame validation; this
 * client projection only permits an exact cost-source review shape. */
function retainedSourcePlan(s:EventFinanceEditorV1,basis:unknown,history:unknown):{basis:EventFinanceWorkspaceV1;history:FinanceNamedRecordV1[]}|null{
 if(!isEventFinanceWorkspaceV1(basis)||!namedRecords(history)||history.length<basis.history.length||history.length>10000||!basis.history.every((row,i)=>canonical(row)===canonical(history[i])))return null;
 const prior=basis as EventFinanceWorkspaceV1,records=history as FinanceNamedRecordV1[];
 if(prior.source.tournamentId!==s.basis.source.tournamentId||prior.source.eventId!==s.basis.source.eventId||prior.payoutSource.tournamentId!==s.basis.payoutSource.tournamentId||prior.payoutSource.eventId!==s.basis.payoutSource.eventId)return null;
 const frame=(w:EventFinanceWorkspaceV1)=>({...copy(w),source:{tournamentId:w.source.tournamentId,eventId:w.source.eventId},history:[],savedAt:null,payoutSource:{tournamentId:w.payoutSource.tournamentId,eventId:w.payoutSource.eventId,settingsSnapshotId:w.payoutSource.settingsSnapshotId,ledgerDigest:'source',resultsDigest:'source'}});
 if(canonical(frame(prior))!==canonical(frame(s.basis)))return null;
 const optional=(rows:FinanceNamedRecordV1[])=>{const selected=rows.filter(row=>optionalCategories.includes(row.line.category));return selected.some(row=>row.line.priorRecordId!==null||row.line.recordId!==row.line.lineId)?null:selected.map(row=>({label:row.label,line:{mode:row.line.mode,category:row.line.category,amountMinor:row.line.amountMinor,voided:row.line.voided,reason:row.line.reason}}));};
 const priorOptional=optional(prior.history),currentOptional=optional(s.basis.history);if(priorOptional===null||currentOptional===null||canonical(priorOptional)!==canonical(currentOptional))return null;
 const priorSuffix=records.slice(prior.history.length),currentSuffix=s.history.slice(s.basis.history.length);
 if([...priorSuffix,...currentSuffix].some(row=>!categories.includes(row.line.category as FinanceEditableCategoryV1))||priorSuffix.length>currentSuffix.length||canonical(priorSuffix.map(row=>reboundRecord(row,s.basis.source)))!==canonical(currentSuffix.slice(0,priorSuffix.length)))return null;
 return{basis:prior,history:records};
}
export function isEventFinanceWorkspaceV1(v:unknown):v is EventFinanceWorkspaceV1{
 if(!exact(v,['complete','source','mode','tournamentName','eventName','eventKind','startLabel','entryCount','paidEntryCount','qualifierCount','grossEntryMinor','history','settings','payoutSource','savedAt','overrideHistory'])||v.complete!==true||!text(v.tournamentName)||!text(v.eventName)||!text(v.startLabel)||!['main','consolation'].includes(v.eventKind as string)||![v.entryCount,v.paidEntryCount,v.qualifierCount].every(n=>n===null||whole(n))||!whole(v.grossEntryMinor)||!namedRecords(v.history)||!Array.isArray(v.overrideHistory)||!exact(v.payoutSource,['tournamentId','eventId','settingsSnapshotId','ledgerDigest','resultsDigest'])||![v.payoutSource.tournamentId,v.payoutSource.eventId,v.payoutSource.settingsSnapshotId].every(uuid)||!hash(v.payoutSource.ledgerDigest)||!hash(v.payoutSource.resultsDigest)||(v.savedAt!==null&&(typeof v.savedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(v.savedAt)||!Number.isFinite(Date.parse(v.savedAt)))))return false;
 const w=v as EventFinanceWorkspaceV1,result=finance(w,w.history);
 if(result.status==='blocked'&&!['negative_regular_fund','income_requires_review'].includes(result.code))return false;
 if(w.source.tournamentId!==w.payoutSource.tournamentId||w.source.eventId!==w.payoutSource.eventId||(w.entryCount!==null&&w.paidEntryCount!==null&&w.paidEntryCount>w.entryCount)||(w.entryCount!==null&&w.qualifierCount!==null&&w.qualifierCount>w.entryCount))return false;
 const check=calculateMainConFundComparisonV2({fundMinor:0,qualifierCount:w.qualifierCount||1,settings:w.settings});
 if(check.status==='blocked'&&!['custom_ratio_paid_count_policy_unresolved','payments_beyond_qualifiers_policy_unresolved'].includes(check.code))return false;
 if(w.overrideHistory.length){if(result.status!=='calculated'||w.qualifierCount===null)return false;const current={source:w.payoutSource,input:payoutInput(w,result.regularFundMinor)!};if(calculateMainConFundProposalsV2({...current,overrideHistory:w.overrideHistory},current).status!=='proposal_review')return false;}
 return true;
}
export function createEventFinanceEditorV1(value:unknown):EventFinanceEditorV1|null{if(!isEventFinanceWorkspaceV1(value))return null;const w=copy(value),f=finance(w,w.history);return{basis:w,history:copy(w.history),overrideHistory:copy(w.overrideHistory),overrideInput:w.overrideHistory.length&&f.status==='calculated'?payoutInput(w,f.regularFundMinor):null,overridePlan:w.overrideHistory.length?planningBasis(w,w.history):null,lineForm:null,bandForm:null,message:''};}
function currentEditor(s:EventFinanceEditorV1,current:unknown){return isEventFinanceWorkspaceV1(current)&&canonical(s.basis)===canonical(current)&&s.history.length>=s.basis.history.length&&s.basis.history.every((r,i)=>canonical(r)===canonical(s.history[i]))&&s.overrideHistory.length>=s.basis.overrideHistory.length&&s.basis.overrideHistory.every((r,i)=>canonical(r)===canonical(s.overrideHistory[i]));}
function latest(history:FinanceNamedRecordV1[]){const out=new Map<string,FinanceNamedRecordV1>();history.forEach(r=>out.set(r.line.lineId,r));return out;}
function proposal(s:EventFinanceEditorV1){const f=finance(s.basis,s.history);if(f.status!=='calculated')return{status:'blocked' as const,code:f.code};const input=payoutInput(s.basis,f.regularFundMinor);if(!input)return{status:'blocked' as const,code:'qualifier_count_pending'};if(s.overrideHistory.length&&(canonical(s.overrideInput)!==canonical(input)||!planningBasisMatches(s)))return{status:'blocked' as const,code:'payout_basis_changed'};const comparison=calculateMainConFundComparisonV2(input);if(comparison.status==='blocked')return comparison;const current={source:s.basis.payoutSource,input};return calculateMainConFundProposalsV2({...current,overrideHistory:s.overrideHistory},current);}
/** Explicit same-native-basis review only. Changed receipt/expense/allocation
 * sources need a separate audited adoption protocol and remain blocked. */
export function projectEventFinancePayoutBasisReviewV1(s:EventFinanceEditorV1,current:unknown){
 const fail=(code:string)=>({status:'blocked' as const,code});
 if(!currentEditor(s,current))return fail('source_changed');
 if(s.lineForm!==null||s.bandForm!==null)return fail('unfinished_form');
 if(!s.overrideHistory.length)return{status:'not_required' as const};
 const f=finance(s.basis,s.history);if(f.status!=='calculated')return fail(f.code);
 const input=payoutInput(s.basis,f.regularFundMinor);if(!input)return fail('qualifier_count_pending');
 if(canonical(s.overrideInput)===canonical(input)&&planningBasisMatches(s))return{status:'not_required' as const};
 let plan:unknown;try{plan=JSON.parse(s.overridePlan??'');}catch{return fail('invalid_retained_plan');}
 if(!exact(plan,['basis','history']))return fail('invalid_retained_plan');
 const retained=canonical(plan.basis)===canonical(s.basis)&&namedRecords(plan.history)&&plan.history.length>=s.basis.history.length&&plan.history.length<=s.history.length&&plan.history.every((row,i)=>canonical(row)===canonical(s.history[i]))?{basis:s.basis,history:plan.history}:retainedSourcePlan(s,plan.basis,plan.history);
 if(!retained)return fail('invalid_retained_plan');
 const before=finance(retained.basis,retained.history);if(before.status!=='calculated')return fail('invalid_retained_plan');
 const oldInput=payoutInput(retained.basis,before.regularFundMinor);if(!oldInput||canonical(oldInput)!==canonical(s.overrideInput))return fail('invalid_retained_plan');
 const oldCurrent={source:retained.basis.payoutSource,input:oldInput},old=calculateMainConFundProposalsV2({...oldCurrent,overrideHistory:s.overrideHistory},oldCurrent);
 const nextCurrent={source:s.basis.payoutSource,input},next=calculateMainConFundProposalsV2({...nextCurrent,overrideHistory:s.overrideHistory},nextCurrent);
 if(old.status!=='proposal_review'||next.status!=='proposal_review')return fail('unsupported_review');
 const reviewKey=canonical({basis:s.basis,history:s.history,overrideHistory:s.overrideHistory,overrideInput:s.overrideInput,overridePlan:s.overridePlan});
 return{status:'review_required' as const,reviewKey,previousFundMinor:oldInput.fundMinor,currentFundMinor:input.fundMinor,proposedTotalMinor:next.proposedTotalMinor,differenceMinor:next.discrepancyMinor,
  groups:next.proposedBands.map((band,i)=>({firstPlace:band.firstPlace,lastPlace:band.lastPlace,people:band.people,previousPerPersonMinor:old.proposedBands[i].perPersonMinor,afterReviewPerPersonMinor:band.perPersonMinor,sourcePerPersonMinor:band.sourcePerPersonMinor,manual:band.overrideRecordId!==null&&!band.overrideVoided})),
  issues:next.issues.map(issue=>issue.code),qualificationChanged:false as const,moneyMoved:false as const,payoutAuthorized:false as const};
}
function lineValid(f:FinanceLineFormV1|null){return !!f&&text(f.label)&&parseFinanceAmountV1(f.amount)!==null&&text(f.reason,2000);}
function bandValid(f:FinanceBandFormV1|null){const n=f&&parseFinanceAmountV1(f.amount);return !!f&&n!==null&&n%500===0&&text(f.reason,2000);}
/** Pure proposal-only reducer. No persistence, receipt, approval or payment authority.
 * Current basis and all retained history must match; changes are never rebased. */
export function reduceEventFinanceEditorV1(s:EventFinanceEditorV1,action:EventFinanceActionV1,current:unknown,makeId:()=>string):EventFinanceEditorV1{
 const next=copy(s),fail=(message:string)=>({...next,message});
 if(!currentEditor(s,current))return fail('Saved finance information changed. Your unsaved work is retained for review.');
 if(action.type==='cancel_line')return{...next,lineForm:null,message:''};if(action.type==='cancel_band')return{...next,bandForm:null,message:''};
 if(action.type==='review_payout_basis'){
  const review=projectEventFinancePayoutBasisReviewV1(s,current);
  if(review.status!=='review_required'||action.reviewKey!==review.reviewKey||action.confirmed!==true||!text(action.reason,2000))return fail('Review the current fund and amounts, then enter a reason. Nothing was changed.');
  const active=new Map<string,MainConWholeBandOverrideV2>();s.overrideHistory.forEach(record=>active.set(`${record.firstPlace}:${record.lastPlace}`,record));
  if(s.overrideHistory.length+active.size>10000)return fail('The technical history-processing limit was reached. No history was removed.');
  const ids=new Set(s.overrideHistory.map(record=>record.recordId)),added:MainConWholeBandOverrideV2[]=[];
  for(const band of review.groups){const prior=active.get(`${band.firstPlace}:${band.lastPlace}`);if(!prior)continue;const recordId=makeId();if(!uuid(recordId)||ids.has(recordId))return fail('A safe review identity is unavailable. Prior amounts remain.');ids.add(recordId);added.push({...prior,recordId,priorRecordId:prior.recordId,perPersonMinor:band.afterReviewPerPersonMinor,reason:action.reason});}
  const input=payoutInput(s.basis,review.currentFundMinor)!;
  const candidate={...next,overrideHistory:[...s.overrideHistory,...added],overrideInput:copy(input),overridePlan:planningBasis(s.basis,s.history),message:'Fund review retained with your reason. Manual amounts are unchanged. This is an unpaid proposal, not a payment.'};
  return proposal(candidate).status==='proposal_review'?candidate:fail('The reviewed proposal could not be retained safely. Prior amounts remain.');
 }
 if(action.type==='add_line'){if(!categories.includes(action.category))return fail('This fund cannot be edited here.');return{...next,lineForm:{category:action.category,lineId:null,label:'',amount:'',reason:''},message:''};}
 if(action.type==='edit_line'){const record=latest(s.history).get(action.lineId);if(!record||record.line.voided||!categories.includes(record.line.category as FinanceEditableCategoryV1))return fail('This line is unavailable for correction here.');return{...next,lineForm:{category:record.line.category as FinanceEditableCategoryV1,lineId:record.line.lineId,label:record.label,amount:amountText(record.line.amountMinor),reason:''},message:''};}
 if(action.type==='line_field'){if(next.lineForm)next.lineForm[action.field]=action.value;return next;}
 if(action.type==='band_field'){if(next.bandForm)next.bandForm[action.field]=action.value;return next;}
 if(action.type==='apply_line'||action.type==='void_line'){
  const form=action.type==='apply_line'?s.lineForm:null,prior=latest(s.history).get(action.type==='void_line'?action.lineId:form?.lineId??'');
  if(action.type==='apply_line'&&!lineValid(form))return fail('Enter a description, a non-negative USD amount and a reason.');
  if(action.type==='void_line'&&(!prior||prior.line.voided||!categories.includes(prior.line.category as FinanceEditableCategoryV1)||!text(action.reason,2000)))return fail('A valid existing line and reason are required.');
  if(s.history.length>=10000)return fail('The technical history-processing limit was reached. No record was removed or shortened.');
  const recordId=makeId(),lineId=prior?.line.lineId??makeId();if(!uuid(recordId)||!uuid(lineId))return fail('A safe record identity is unavailable.');
  const record:FinanceNamedRecordV1={label:form?.label??prior!.label,line:{recordId,lineId,priorRecordId:prior?.line.recordId??null,source:copy(s.basis.source),mode:s.basis.mode,category:form?.category??prior!.line.category,amountMinor:form?parseFinanceAmountV1(form.amount)!:0,voided:action.type==='void_line',reason:form?.reason??(action.type==='void_line'?action.reason:'')}};
  const history=[...next.history,record],f=finance(s.basis,history);if(f.status==='blocked'&&!['negative_regular_fund','income_requires_review'].includes(f.code))return fail('The line could not be retained safely. Prior history is unchanged.');
  return{...next,history,lineForm:null,message:'Applied to this unsaved proposal only. No ledger record or payment was created.'};
 }
 const p=proposal(s);if(p.status!=='proposal_review')return fail('Payout adjustment is unavailable until its fund, settings and results basis can be reviewed.');
 if(action.type==='edit_band'){const b=p.proposedBands.find(b=>b.firstPlace===action.firstPlace&&b.lastPlace===action.lastPlace);if(!b)return fail('Choose an entire finishing group.');return{...next,bandForm:{firstPlace:b.firstPlace,lastPlace:b.lastPlace,amount:amountText(b.perPersonMinor),reason:''},message:''};}
 if(action.type==='apply_band'||action.type==='restore_band'){
  const form=s.bandForm;if(!form||!text(form.reason,2000)||(action.type==='apply_band'&&!bandValid(form)))return fail('Enter an amount in $5 increments and a reason.');
  const b=p.proposedBands.find(b=>b.firstPlace===form.firstPlace&&b.lastPlace===form.lastPlace);if(!b)return fail('The finishing group changed. Keep your work for review.');
  const previous=[...s.overrideHistory].reverse().find(r=>r.firstPlace===form.firstPlace&&r.lastPlace===form.lastPlace);if(action.type==='restore_band'&&!previous)return fail('There is no prior adjustment to restore.');
  const record:MainConWholeBandOverrideV2={recordId:makeId(),firstPlace:form.firstPlace,lastPlace:form.lastPlace,priorRecordId:previous?.recordId??null,perPersonMinor:action.type==='restore_band'?b.sourcePerPersonMinor:parseFinanceAmountV1(form.amount)!,voided:action.type==='restore_band',reason:form.reason};
  const f=finance(s.basis,s.history);if(f.status!=='calculated')return fail('The fund is unavailable.');const input=payoutInput(s.basis,f.regularFundMinor)!;
  const candidate={...next,overrideHistory:[...next.overrideHistory,record],overrideInput:copy(input),overridePlan:planningBasis(s.basis,s.history),bandForm:null,message:'Whole-group adjustment retained in this unsaved proposal. No payout was made.'};if(proposal(candidate).status!=='proposal_review')return fail('The adjustment could not be retained safely. Prior amounts remain.');return candidate;
 }
 return next;
}
function optionalSourceTotal(w:EventFinanceWorkspaceV1,category:'q_pool_fund'|'side_pool_fund'){const total=[...latest(w.history).values()].filter(r=>!r.line.voided&&r.line.category===category).reduce((sum,r)=>sum+BigInt(r.line.amountMinor),BigInt(0));return total<=BigInt(Number.MAX_SAFE_INTEGER)?Number(total):null;}

/** Explicit host evidence only; generic finance workspaces do not establish event format.
 * No scope is inferred from event kind, and stale scopes never enable a forecast. */
export type EventFinanceForecastScopeV1={source:RegularFinanceSourceV1;settingsSnapshotId:string;eventKind:'main'|'consolation';styleCode:'Standard';formatCode:'standard_singles';qualificationPolicy:'regular-top-quarter-round-up'};
function forecastScopeMatches(value:unknown,w:EventFinanceWorkspaceV1):boolean{
 try{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
  const v=value as Record<string,unknown>,keys=['source','settingsSnapshotId','eventKind','styleCode','formatCode','qualificationPolicy'];
  if(Reflect.ownKeys(v).length!==keys.length||!keys.every(k=>Object.hasOwn(v,k))||v.settingsSnapshotId!==w.payoutSource.settingsSnapshotId||v.eventKind!==w.eventKind||v.styleCode!=='Standard'||v.formatCode!=='standard_singles'||v.qualificationPolicy!=='regular-top-quarter-round-up')return false;
  const source=v.source;if(!source||typeof source!=='object'||Array.isArray(source)||Object.getPrototypeOf(source)!==Object.prototype)return false;
  const q=source as Record<string,unknown>,sourceKeys=['tournamentId','eventId','sourceVersion','sourceDigest'];
  return Reflect.ownKeys(q).length===sourceKeys.length&&sourceKeys.every(k=>Object.hasOwn(q,k)&&q[k]===w.source[k as keyof RegularFinanceSourceV1]);
 }catch{return false;}
}
export function projectEventFinanceSectionV1(s:EventFinanceEditorV1,current:unknown,forecastScope?:unknown):EventFinanceSectionViewV1{
 const w=s.basis,valid=currentEditor(s,current),basisFinance=finance(w,w.history),basisRows=latest(w.history),f=finance(w,s.history),p=valid?proposal(s):{status:'blocked' as const,code:'source_changed'},warnings:string[]=[];
 const registrationForecast=valid&&w.qualifierCount===null&&w.entryCount!==null&&Number.isSafeInteger(w.entryCount)&&w.entryCount>0&&forecastScopeMatches(forecastScope,w)&&f.status==='calculated'?calculateEventFinanceRegistrationForecastV1({policy:'regular-top-quarter-round-up',eventKind:w.eventKind,eventStyle:'Standard',eventFormat:'standard_singles',officialQualifierCount:null,entryCount:w.entryCount,fundMinor:f.regularFundMinor,settings:copy(w.settings)}):undefined;
 if(!valid)warnings.push('Finance information changed. Unsaved rows and adjustments are retained; review is required before continuing.');
 if(f.status==='blocked')warnings.push(f.code==='negative_regular_fund'?'Expenses and benefits exceed available regular-event funds.':f.code==='income_requires_review'?'Restricted or unclassified income needs review before payout calculation.':'Finance totals are unavailable until the retained records are reviewed.');
 if(p.status==='blocked')warnings.push(p.code==='qualifier_count_pending'?(registrationForecast?.status==='forecast'?'Official qualifier count is pending. The registration forecast is for planning only.':'Qualifier count is pending. No playoff payout amounts are available.'):p.code==='custom_ratio_paid_count_policy_unresolved'?'Legacy 1-in-N regular-prize settings require review; no amounts have been calculated.':p.code==='payout_basis_changed'?'The financial planning basis changed after payout adjustments. Previous adjustments are retained and are not silently applied to changed information.':'Payout calculation is unavailable for the current basis.');
 if(p.status==='proposal_review'){if(p.cutoffWarning)warnings.push(p.cutoffWarning);if(!p.balanced)warnings.push(`Proposed payouts are ${amountText(Math.abs(p.discrepancyMinor))} USD ${p.discrepancyMinor>0?'over':'under'} the regular fund.`);if(p.rankOrderViolation)warnings.push('An adjusted lower finishing group receives more per person than a higher group.');if(p.zeroAwardBand)warnings.push('At least one included finishing group has a zero-dollar award.');}
 const pending=canonical(s.history)!==canonical(w.history)||canonical(s.overrideHistory)!==canonical(w.overrideHistory)||s.lineForm!==null||s.bandForm!==null;
 return{forecastIncrementFactor:registrationForecast?w.settings.factor:undefined,forecastPayoutType:registrationForecast?(w.settings.method==='graduated_all_qualifiers'?'Graduated - All Qualifiers':w.settings.method==='custom_top_paid'?`Top ${w.settings.paidPlaces} (Custom)`:`Legacy 1-in-${w.settings.ratio} - Review Required`):undefined,registrationForecast,tournamentName:w.tournamentName,eventName:w.eventName,eventKind:w.eventKind,startLabel:w.startLabel,modeLabel:w.mode==='simulation'?'Simulation - No Real Money':w.mode==='estimate'?'Estimate':'Recorded Basis - Adjustments Are Proposals',entryCount:w.entryCount,paidEntryCount:w.paidEntryCount,qualifierCount:w.qualifierCount,savedAt:w.savedAt,pending,blocked:!valid,message:s.message,warnings,grossEntryMinor:w.grossEntryMinor,basisFundMinor:basisFinance.status==='calculated'?basisFinance.regularFundMinor:null,basisBenefitsMinor:basisFinance.status==='calculated'?basisFinance.benefitsMinor:null,basisExpensesMinor:basisFinance.status==='calculated'?basisFinance.expensesMinor:null,basisAdditionalIncomeMinor:basisFinance.status==='calculated'?basisFinance.additionalIncomeMinor:null,benefitsMinor:f.status==='calculated'?f.benefitsMinor:null,expensesMinor:f.status==='calculated'?f.expensesMinor:null,additionalIncomeMinor:f.status==='calculated'?f.additionalIncomeMinor:null,fundMinor:f.status==='calculated'?f.regularFundMinor:null,excludedQMinor:optionalSourceTotal(w,'q_pool_fund'),excludedSideMinor:optionalSourceTotal(w,'side_pool_fund'),rows:[...latest(s.history).values()].map(r=>({lineId:r.line.lineId,category:r.line.category,label:r.label,amountMinor:r.line.amountMinor,basisAmountMinor:basisRows.get(r.line.lineId)?.line.amountMinor??null,pending:canonical(r)!==canonical(basisRows.get(r.line.lineId)),voided:r.line.voided,canEdit:valid&&!r.line.voided&&categories.includes(r.line.category as FinanceEditableCategoryV1)})),lineForm:copy(s.lineForm),bandForm:copy(s.bandForm),canApplyLine:valid&&lineValid(s.lineForm),canApplyBand:valid&&p.status==='proposal_review'&&bandValid(s.bandForm),canRestoreBand:valid&&p.status==='proposal_review'&&!!s.bandForm&&text(s.bandForm.reason,2000)&&s.overrideHistory.some(r=>r.firstPlace===s.bandForm!.firstPlace&&r.lastPlace===s.bandForm!.lastPlace),payoutBands:p.status==='proposal_review'?p.proposedBands.map(b=>({firstPlace:b.firstPlace,lastPlace:b.lastPlace,people:b.people,calculatedPerPersonMinor:b.sourcePerPersonMinor,adjustedPerPersonMinor:b.perPersonMinor,bandTotalMinor:b.bandTotalMinor,adjusted:b.overrideRecordId!==null&&!b.overrideVoided})):[],calculatedTotalMinor:p.status==='proposal_review'?p.sourceCalculation.roundedAwardsTotalMinor:null,adjustedTotalMinor:p.status==='proposal_review'?p.proposedTotalMinor:null,differenceMinor:p.status==='proposal_review'?p.discrepancyMinor:null,requestedPaidPlaces:p.status==='proposal_review'?p.requestedPaidPlaces:null,actualPaidPlaces:p.status==='proposal_review'?p.actualPaidPlaces:null,positiveAwardPlaces:p.status==='proposal_review'?p.positiveAwardPlaces:null,canEditPayout:valid&&p.status==='proposal_review',historyRecordCount:s.history.length,overrideRecordCount:s.overrideHistory.length,payoutReview:projectEventFinancePayoutBasisReviewV1(s,current)};
}

