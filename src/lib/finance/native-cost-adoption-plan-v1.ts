import {isRestorableEventFinanceEditorV1} from './event-finance-draft-codec-v1.ts';
import {isEventFinanceWorkspaceV1,projectEventFinanceSectionV1,type EventFinanceEditorV1,type EventFinanceWorkspaceV1,type FinanceNamedRecordV1} from './event-finance-workspace-v1.ts';
import {calculateEventRegularFinanceV1} from '../results/event-regular-finance-v1.ts';
export type NativeCostBucketV1='player_benefit'|'operating_expense';
export type NativeCostLineageV1={lineId:string;origin:'native'|'manual';nativeBasisLineId:string|null;sourceExpenseId:string|null;sourceExpenseEventId:string|null;bucket:NativeCostBucketV1;capturedAmountMinor:number;snapshotLabel:string;records:FinanceNamedRecordV1[];latest:{recordId:string;amountMinor:number;voided:boolean;label:string;reason:string;category:NativeCostBucketV1}};
export type NativeCostAnchorV1={lineId:string;expenseId:string;expenseEventId:string;expenseVersion:number;description:string;recordedAt:string;expenseAmountMinor:number;bucket:NativeCostBucketV1;amountMinor:number};
export type NativeCostDispositionV1={kind:'carry_native'|'restore_native'|'replace_manual'|'introduce_recorded'|'retire_voided_manual'|'retire_zero_manual';priorLineId:string|null;currentBasisLineId:string|null;currentExpenseId:string|null;currentExpenseEventId:string|null;bucket:NativeCostBucketV1;alias:string|null;reason:string};
export type PreparedNativeCostAdoptionV1={kind:'prepared-native-cost-adoption-v1';actorId:string;tournamentId:string;eventId:string;head:{revisionId:string;version:number;sourceDigest:string;basisDigest:string;editor:EventFinanceEditorV1};current:EventFinanceWorkspaceV1;currentBasisDigest:string;currentAllocationRevisionId:string;unchangedFrameDigest:string;costLineages:NativeCostLineageV1[];costs:NativeCostAnchorV1[];proposalOnly:true;moneyMoved:false;payoutAuthorized:false};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const money=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&!Object.is(v,-0);
const text=(v:unknown,max=200):v is string=>typeof v==='string'&&!!v.trim()&&v===v.trim()&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const copy=<T>(v:T):T=>structuredClone(v);
const bucket=(v:unknown):v is NativeCostBucketV1=>v==='player_benefit'||v==='operating_expense';
const inScope=(w:EventFinanceWorkspaceV1,s:PreparedNativeCostAdoptionV1)=>w.source.tournamentId===s.tournamentId&&w.source.eventId===s.eventId&&w.payoutSource.tournamentId===s.tournamentId&&w.payoutSource.eventId===s.eventId;
/** Structural/semantic projection only. The authenticated server must assemble
 * this from locked old/current sources and independently validate the request. */
export function isPreparedNativeCostAdoptionV1(v:unknown):v is PreparedNativeCostAdoptionV1{
 if(!exact(v,['kind','actorId','tournamentId','eventId','head','current','currentBasisDigest','currentAllocationRevisionId','unchangedFrameDigest','costLineages','costs','proposalOnly','moneyMoved','payoutAuthorized'])||v.kind!=='prepared-native-cost-adoption-v1'||![v.actorId,v.tournamentId,v.eventId].every(uuid)||v.proposalOnly!==true||v.moneyMoved!==false||v.payoutAuthorized!==false||!hash(v.currentBasisDigest)||!uuid(v.currentAllocationRevisionId)||!hash(v.unchangedFrameDigest)||!exact(v.head,['revisionId','version','sourceDigest','basisDigest','editor'])||!uuid(v.head.revisionId)||!Number.isSafeInteger(v.head.version)||Number(v.head.version)<1||Number(v.head.version)>2147483646||![v.head.sourceDigest,v.head.basisDigest].every(hash)||!isRestorableEventFinanceEditorV1(v.head.editor)||!isEventFinanceWorkspaceV1(v.current)||!Array.isArray(v.costLineages)||!Array.isArray(v.costs)||v.costLineages.length>10000||v.costs.length>10000)return false;
 const s=v as PreparedNativeCostAdoptionV1,old=s.head.editor.basis,current=s.current;
 if(!inScope(old,s)||!inScope(current,s)||old.mode!=='estimate'||current.mode!=='estimate'||old.source.sourceDigest!==s.head.sourceDigest||same(old.source,current.source)||old.source.sourceDigest===current.source.sourceDigest||s.head.basisDigest===s.currentBasisDigest||old.eventKind!==current.eventKind||old.tournamentName!==current.tournamentName||old.eventName!==current.eventName||old.startLabel!==current.startLabel||current.source.sourceVersion<=old.source.sourceVersion||old.entryCount!==current.entryCount||old.paidEntryCount!==current.paidEntryCount||old.qualifierCount!==current.qualifierCount||old.grossEntryMinor!==current.grossEntryMinor||!same(old.settings,current.settings)||old.payoutSource.settingsSnapshotId!==current.payoutSource.settingsSnapshotId)return false;
 const allCostIds=new Set<string>();for(const r of s.head.editor.history)if(bucket(r.line.category))allCostIds.add(r.line.lineId);else if(r.line.category!=='unrestricted_income')return false;
 const seen=new Set<string>(),oldPhysical=new Set<string>(),oldOwners=new Map<string,string>(),oldEvents=new Map<string,string>();
 for(const l of s.costLineages){
  if(!exact(l,['lineId','origin','nativeBasisLineId','sourceExpenseId','sourceExpenseEventId','bucket','capturedAmountMinor','snapshotLabel','records','latest'])||!uuid(l.lineId)||seen.has(l.lineId)||!allCostIds.has(l.lineId)||!['native','manual'].includes(l.origin)||!bucket(l.bucket)||!money(l.capturedAmountMinor)||!text(l.snapshotLabel)||!Array.isArray(l.records)||!l.records.length||!exact(l.latest,['recordId','amountMinor','voided','label','reason','category']))return false;
  const rows=s.head.editor.history.filter(r=>r.line.lineId===l.lineId),first=rows[0],last=rows.at(-1)!;
  if(!same(rows,l.records)||!first||!bucket(last.line.category)||!same(l.latest,{recordId:last.line.recordId,amountMinor:last.line.amountMinor,voided:last.line.voided,label:last.label,reason:last.line.reason,category:last.line.category}))return false;
  const native=old.history.find(r=>r.line.lineId===l.lineId);
  if(l.origin==='native'){const key=`${l.sourceExpenseEventId}:${l.bucket}`;if(oldPhysical.has(key)||(oldOwners.has(l.sourceExpenseId!)&&oldOwners.get(l.sourceExpenseId!)!==l.sourceExpenseEventId)||(oldEvents.has(l.sourceExpenseEventId!)&&oldEvents.get(l.sourceExpenseEventId!)!==l.sourceExpenseId))return false;oldPhysical.add(key);oldOwners.set(l.sourceExpenseId!,l.sourceExpenseEventId!);oldEvents.set(l.sourceExpenseEventId!,l.sourceExpenseId!);if(!native||l.nativeBasisLineId!==l.lineId||!uuid(l.sourceExpenseId)||!uuid(l.sourceExpenseEventId)||l.bucket!==native.line.category||l.capturedAmountMinor!==native.line.amountMinor||!same(first,native))return false;}
  else if(native||l.nativeBasisLineId!==null||l.sourceExpenseId!==null||l.sourceExpenseEventId!==null||l.bucket!==last.line.category||l.capturedAmountMinor!==first.line.amountMinor)return false;
  seen.add(l.lineId);
 }
 if(seen.size!==allCostIds.size)return false;
 const targets=new Set<string>(),physical=new Set<string>(),heads=new Map<string,{eventId:string;version:number;amount:number;description:string;recordedAt:string;allocated:bigint}>(),eventOwners=new Map<string,string>();for(const c of s.costs){
  if(!exact(c,['lineId','expenseId','expenseEventId','expenseVersion','description','recordedAt','expenseAmountMinor','bucket','amountMinor'])||![c.lineId,c.expenseId,c.expenseEventId].every(uuid)||targets.has(c.lineId)||!Number.isSafeInteger(c.expenseVersion)||c.expenseVersion<1||!text(c.description,2000)||typeof c.recordedAt!=='string'||!Number.isFinite(Date.parse(c.recordedAt))||!bucket(c.bucket)||!money(c.expenseAmountMinor)||c.expenseAmountMinor<1||!money(c.amountMinor)||c.amountMinor<1||c.amountMinor>c.expenseAmountMinor)return false;
  const physicalKey=`${c.expenseEventId}:${c.bucket}`,head=heads.get(c.expenseId);if(physical.has(physicalKey)||(eventOwners.has(c.expenseEventId)&&eventOwners.get(c.expenseEventId)!==c.expenseId)||(head&&(head.eventId!==c.expenseEventId||head.version!==c.expenseVersion||head.amount!==c.expenseAmountMinor||head.description!==c.description||head.recordedAt!==c.recordedAt)))return false;physical.add(physicalKey);eventOwners.set(c.expenseEventId,c.expenseId);const total=(head?.allocated??BigInt(0))+BigInt(c.amountMinor);if(total>BigInt(c.expenseAmountMinor))return false;heads.set(c.expenseId,{eventId:c.expenseEventId,version:c.expenseVersion,amount:c.expenseAmountMinor,description:c.description,recordedAt:c.recordedAt,allocated:total});
  const base=current.history.find(r=>r.line.lineId===c.lineId);if(!base||base.line.recordId!==c.lineId||base.line.priorRecordId!==null||base.line.voided||base.line.category!==c.bucket||base.line.amountMinor!==c.amountMinor)return false;targets.add(c.lineId);
 }
 return current.history.length===targets.size&&current.history.every(r=>targets.has(r.line.lineId));
}
const dispositionKeys=['kind','priorLineId','currentBasisLineId','currentExpenseId','currentExpenseEventId','bucket','alias','reason'];
export function planNativeCostAdoptionV1(value:unknown,choices:unknown){
 const fail=(code:string)=>({status:'blocked' as const,code,proposalOnly:true as const,moneyMoved:false as const});
 if(!isPreparedNativeCostAdoptionV1(value))return fail('invalid_source');const s=value,old=s.head.editor;
 if(old.lineForm!==null||old.bandForm!==null)return fail('unfinished_retained_form');
 if(!Array.isArray(choices)||choices.length>20000)return fail('invalid_dispositions');
 const prior=new Map(s.costLineages.map(l=>[l.lineId,l])),current=new Map(s.costs.map(c=>[c.lineId,c])),usedPrior=new Set<string>(),usedCurrent=new Set<string>(),aliases:Array<{lineId:string;expenseId:string;expenseEventId:string;bucket:NativeCostBucketV1;label:string}>=[];
 for(const raw of choices){
  if(!exact(raw,dispositionKeys)||!bucket(raw.bucket)||!text(raw.reason,2000)||!['carry_native','restore_native','replace_manual','introduce_recorded','retire_voided_manual','retire_zero_manual'].includes(raw.kind as string))return fail('invalid_disposition');
  const d=raw as NativeCostDispositionV1,l=d.priorLineId===null?null:prior.get(d.priorLineId);
  if(d.priorLineId!==null&&(!l||usedPrior.has(d.priorLineId)))return fail('prior_lineage_missing_or_reused');
  if(d.kind==='retire_voided_manual'||d.kind==='retire_zero_manual'){
   if(!l||l.origin!=='manual'||d.currentBasisLineId!==null||d.currentExpenseId!==null||d.currentExpenseEventId!==null||d.alias!==null||d.bucket!==l.latest.category||(d.kind==='retire_voided_manual'?!l.latest.voided:l.latest.voided||l.latest.amountMinor!==0))return fail('invalid_retirement');
  }else{
   const c=d.currentBasisLineId===null?null:current.get(d.currentBasisLineId);
   if(!c||usedCurrent.has(c.lineId)||d.currentExpenseId!==c.expenseId||d.currentExpenseEventId!==c.expenseEventId||d.bucket!==c.bucket||!text(d.alias))return fail('current_cost_missing_or_reused');
   if(d.kind==='introduce_recorded'){if(d.priorLineId!==null)return fail('invalid_introduction');}
   else if(d.kind==='replace_manual'){if(!l||l.origin!=='manual'||l.latest.voided||l.latest.amountMinor===0)return fail('invalid_manual_replacement');}
   else if(!l||l.origin!=='native'||l.sourceExpenseId!==c.expenseId||l.sourceExpenseEventId!==c.expenseEventId||l.bucket!==c.bucket||l.capturedAmountMinor!==c.amountMinor||(d.kind==='carry_native'?l.records.length!==1:l.records.length<2))return fail('native_cost_correction_not_supported');
   usedCurrent.add(c.lineId);aliases.push({lineId:c.lineId,expenseId:c.expenseId,expenseEventId:c.expenseEventId,bucket:c.bucket,label:d.alias});
  }
  if(l)usedPrior.add(l.lineId);
 }
 if(usedPrior.size!==prior.size||usedCurrent.size!==current.size)return fail('incomplete_cost_review');
 const history=[...copy(s.current.history),...old.history.filter(r=>r.line.category==='unrestricted_income').map(r=>({...copy(r),line:{...copy(r.line),source:copy(s.current.source)}}))];
 const f=calculateEventRegularFinanceV1({source:s.current.source,mode:s.current.mode,grossEntry:{source:s.current.source,mode:s.current.mode,amountMinor:s.current.grossEntryMinor},history:history.map(r=>r.line)}),before=calculateEventRegularFinanceV1({source:old.basis.source,mode:old.basis.mode,grossEntry:{source:old.basis.source,mode:old.basis.mode,amountMinor:old.basis.grossEntryMinor},history:old.history.map(r=>r.line)});
 if(f.status!=='calculated'||before.status!=='calculated')return fail('fund_requires_review');
 const oldCosts=BigInt(before.benefitsMinor)+BigInt(before.expensesMinor),newCosts=BigInt(f.benefitsMinor)+BigInt(f.expensesMinor);if(oldCosts>BigInt(Number.MAX_SAFE_INTEGER)||newCosts>BigInt(Number.MAX_SAFE_INTEGER))return fail('unsafe_cost_total');
 const editor:EventFinanceEditorV1={basis:copy(s.current),history,overrideHistory:copy(old.overrideHistory),overrideInput:old.overrideHistory.length&&s.current.qualifierCount!==null?{fundMinor:f.regularFundMinor,qualifierCount:s.current.qualifierCount,settings:copy(s.current.settings)}:null,overridePlan:old.overrideHistory.length?canonical({basis:s.current,history}):null,lineForm:null,bandForm:null,message:old.message};
 if(!isRestorableEventFinanceEditorV1(editor))return fail('retained_overrides_require_review');
 const view=projectEventFinanceSectionV1(editor,s.current);
 if(view.blocked||view.payoutReview?.status==='blocked'||view.payoutReview?.status==='review_required')return fail('payout_review_required');
 return{status:'review_ready' as const,source:copy(s),dispositions:copy(choices) as NativeCostDispositionV1[],editor,aliases,summary:{oldFundMinor:before.regularFundMinor,newFundMinor:f.regularFundMinor,oldCostsMinor:Number(oldCosts),newCostsMinor:Number(newCosts),payoutTotalMinor:view.adjustedTotalMinor,fundDifferenceMinor:view.differenceMinor},warnings:copy(view.warnings),proposalOnly:true as const,moneyMoved:false as const,payoutAuthorized:false as const};
}
export type NativeCostAdoptionPlanV1=Extract<ReturnType<typeof planNativeCostAdoptionV1>,{status:'review_ready'}>;
export function buildNativeCostAdoptionRequestV1(plan:NativeCostAdoptionPlanV1,operationId:string,reason:string,editor:EventFinanceEditorV1=plan.editor){
 const replay=planNativeCostAdoptionV1(plan.source,plan.dispositions);if(replay.status!=='review_ready')return null;
 const s=replay.source;if(!uuid(operationId)||!text(reason,2000)||!isRestorableEventFinanceEditorV1(editor)||!same(editor.basis,s.current)||!same(editor.history,replay.editor.history)||editor.lineForm!==null||editor.bandForm!==null||editor.overrideHistory.length< s.head.editor.overrideHistory.length||!s.head.editor.overrideHistory.every((r,i)=>same(r,editor.overrideHistory[i])))return null;
 const view=projectEventFinanceSectionV1(editor,s.current);if(view.blocked||view.payoutReview?.status==='blocked'||view.payoutReview?.status==='review_required')return null;
 return{kind:'operational-finance-source-adoption-v1' as const,operationId,expectedVersion:s.head.version,expectedPriorRevisionId:s.head.revisionId,expectedPriorSourceDigest:s.head.sourceDigest,expectedPriorBasisDigest:s.head.basisDigest,expectedCurrentSourceDigest:s.current.source.sourceDigest,expectedCurrentBasisDigest:s.currentBasisDigest,expectedUnchangedFrameDigest:s.unchangedFrameDigest,dispositions:copy(plan.dispositions),editor:copy(editor),reason};
}
export type NativeCostAdoptionRequestV1=NonNullable<ReturnType<typeof buildNativeCostAdoptionRequestV1>>;
/** Recovery-body validation only; it cannot establish current source authority. */
export function isNativeCostAdoptionRequestV1(v:unknown):v is NativeCostAdoptionRequestV1{
 if(!exact(v,['kind','operationId','expectedVersion','expectedPriorRevisionId','expectedPriorSourceDigest','expectedPriorBasisDigest','expectedCurrentSourceDigest','expectedCurrentBasisDigest','expectedUnchangedFrameDigest','dispositions','editor','reason'])||v.kind!=='operational-finance-source-adoption-v1'||!uuid(v.operationId)||!Number.isSafeInteger(v.expectedVersion)||Number(v.expectedVersion)<1||Number(v.expectedVersion)>2147483646||!uuid(v.expectedPriorRevisionId)||![v.expectedPriorSourceDigest,v.expectedPriorBasisDigest,v.expectedCurrentSourceDigest,v.expectedCurrentBasisDigest,v.expectedUnchangedFrameDigest].every(hash)||!text(v.reason,2000)||!isRestorableEventFinanceEditorV1(v.editor)||v.editor.basis.source.sourceDigest!==v.expectedCurrentSourceDigest||v.editor.lineForm!==null||v.editor.bandForm!==null||!Array.isArray(v.dispositions)||v.dispositions.length>20000)return false;
 if(!v.dispositions.every(d=>exact(d,dispositionKeys)&&['carry_native','restore_native','replace_manual','introduce_recorded','retire_voided_manual','retire_zero_manual'].includes(d.kind as string)&&(d.priorLineId===null||uuid(d.priorLineId))&&(d.currentBasisLineId===null||uuid(d.currentBasisLineId))&&(d.currentExpenseId===null||uuid(d.currentExpenseId))&&(d.currentExpenseEventId===null||uuid(d.currentExpenseEventId))&&bucket(d.bucket)&&(d.alias===null||text(d.alias))&&text(d.reason,2000)))return false;
 const view=projectEventFinanceSectionV1(v.editor,v.editor.basis);return !view.blocked&&view.payoutReview?.status!=='blocked'&&view.payoutReview?.status!=='review_required';
}
