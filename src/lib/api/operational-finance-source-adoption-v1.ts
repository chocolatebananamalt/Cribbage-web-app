import 'server-only';
import{createHash}from'node:crypto';
import {assembleNativeOperationalFinanceV1} from '../finance/operational-finance-native-assembler-v1.ts';
import {isRestorableEventFinanceEditorV1} from '../finance/event-finance-draft-codec-v1.ts';
import {
 isPreparedNativeCostAdoptionV1,
 type NativeCostAdoptionPlanV1,
 type NativeCostAnchorV1,
 type NativeCostDispositionV1,
 type NativeCostLineageV1,
 type PreparedNativeCostAdoptionV1,
} from '../finance/native-cost-adoption-plan-v1.ts';

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>object(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const whole=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&!Object.is(value,-0);
const version=(value:unknown):value is number=>whole(value)&&value>=1&&value<=2147483646;
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const bucket=(value:unknown):value is NativeCostDispositionV1['bucket']=>value==='player_benefit'||value==='operating_expense';
const canonical=(value:unknown)=>JSON.stringify(value,(_key,next)=>object(next)?Object.fromEntries(Object.keys(next).sort().map(key=>[key,next[key]])):next);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const clone=<T>(value:T):T=>structuredClone(value);

const dispositionKinds=['carry_native','restore_native','replace_manual','introduce_recorded','retire_voided_manual','retire_zero_manual'] as const;
const dispositionKeys=['kind','priorLineId','currentBasisLineId','currentExpenseId','currentExpenseEventId','bucket','alias','reason'] as const;
const requestKeys=['kind','operationId','expectedVersion','expectedPriorRevisionId','expectedPriorSourceDigest','expectedPriorBasisDigest','expectedCurrentSourceDigest','expectedCurrentBasisDigest','expectedUnchangedFrameDigest','dispositions','editor','reason'] as const;

export type OperationalFinanceSourceAdoptionRequestV1={
 kind:'operational-finance-source-adoption-v1';operationId:string;expectedVersion:number;
 expectedPriorRevisionId:string;expectedPriorSourceDigest:string;expectedPriorBasisDigest:string;
 expectedCurrentSourceDigest:string;expectedCurrentBasisDigest:string;expectedUnchangedFrameDigest:string;
 dispositions:NativeCostDispositionV1[];editor:NativeCostAdoptionPlanV1['editor'];reason:string;
};

export function isOperationalFinanceSourceAdoptionRequestV1(value:unknown):value is OperationalFinanceSourceAdoptionRequestV1{
 if(!exact(value,requestKeys)||value.kind!=='operational-finance-source-adoption-v1'||!uuid(value.operationId)||!version(value.expectedVersion)||!uuid(value.expectedPriorRevisionId)||![value.expectedPriorSourceDigest,value.expectedPriorBasisDigest,value.expectedCurrentSourceDigest,value.expectedCurrentBasisDigest,value.expectedUnchangedFrameDigest].every(hash)||!Array.isArray(value.dispositions)||value.dispositions.length>20000||!isRestorableEventFinanceEditorV1(value.editor)||!text(value.reason,2000))return false;
 return value.dispositions.every(disposition=>exact(disposition,dispositionKeys)&&dispositionKinds.includes(disposition.kind as typeof dispositionKinds[number])&&(disposition.priorLineId===null||uuid(disposition.priorLineId))&&(disposition.currentBasisLineId===null||uuid(disposition.currentBasisLineId))&&(disposition.currentExpenseId===null||uuid(disposition.currentExpenseId))&&(disposition.currentExpenseEventId===null||uuid(disposition.currentExpenseEventId))&&bucket(disposition.bucket)&&(disposition.alias===null||text(disposition.alias,200))&&text(disposition.reason,2000));
}

export type OperationalFinanceAdoptionSanctioningV1={
 snapshotId:string;eventPlayStartId:string;rateMinor:number;eligibleParticipantCount:number;totalMinor:number;
 candidates:Array<{expenseId:string;expenseEventId:string;allocatedMinor:number;bucket:'player_benefit'|'operating_expense'|null;covered:boolean}>;
};
export type OperationalFinanceSourceAdoptionRawWorkspaceV1={
 kind:'operational-finance-source-adoption-workspace-v1';actorId:string;tournamentId:string;eventId:string;
 status:'available'|'blocked';code:string|null;head:{revisionId:string;version:number;sourceDigest:string;basisDigest:string;nativeAllocationRevisionId:string;sourceCapture:Record<string,unknown>;basis:Record<string,unknown>;editor:NativeCostAdoptionPlanV1['editor']};
 currentSource:unknown;unchangedFrameDigest:string;costLineages:NativeCostLineageV1[];costRows:unknown[];
 sanctioning:OperationalFinanceAdoptionSanctioningV1|null;proposalOnly:true;moneyMoved:false;payoutAuthorized:false;finalizationAuthorized:false;
};
export type OperationalFinanceSourceAdoptionWorkspaceV1={raw:OperationalFinanceSourceAdoptionRawWorkspaceV1;prepared:PreparedNativeCostAdoptionV1|null};

function sanctioning(value:unknown):value is OperationalFinanceAdoptionSanctioningV1{
 if(value===null)return true;
 if(!exact(value,['snapshotId','eventPlayStartId','rateMinor','eligibleParticipantCount','totalMinor','candidates'])||!uuid(value.snapshotId)||!uuid(value.eventPlayStartId)||![value.rateMinor,value.eligibleParticipantCount,value.totalMinor].every(whole)||!Array.isArray(value.candidates)||value.candidates.length>10000)return false;
 const rateMinor=Number(value.rateMinor),eligibleParticipantCount=Number(value.eligibleParticipantCount),totalMinor=Number(value.totalMinor);
 return rateMinor*eligibleParticipantCount===totalMinor&&Number.isSafeInteger(totalMinor)&&value.candidates.every(candidate=>exact(candidate,['expenseId','expenseEventId','allocatedMinor','bucket','covered'])&&uuid(candidate.expenseId)&&uuid(candidate.expenseEventId)&&whole(candidate.allocatedMinor)&&(candidate.bucket===null||bucket(candidate.bucket))&&typeof candidate.covered==='boolean'&&(!candidate.covered||Number(candidate.allocatedMinor)>=totalMinor));
}

function basisLineId(tournamentId:string,eventId:string,allocationId:string,sourceId:string,bucketValue:string){const md=createHash('md5').update(`operational-finance-basis-line-v1|${tournamentId}|${eventId}|${allocationId}|${sourceId}|${bucketValue}`,'utf8').digest('hex');return`${md.slice(0,8)}-${md.slice(8,12)}-${md.slice(12,16)}-${md.slice(16,20)}-${md.slice(20)}`;}
function adoptionFrame(source:Record<string,unknown>){
 if(!object(source.raw)||!object(source.raw.allocation)||!object(source.basis)||!object(source.basis.workspace)||!Array.isArray(source.raw.allocation.eventSources))return null;
 const raw=source.raw,workspace=source.basis.workspace,regularSources=source.raw.allocation.eventSources.filter(row=>object(row)&&row.kind==='entry_receipt').sort((a,b)=>String((a as Record<string,unknown>).sourceId).localeCompare(String((b as Record<string,unknown>).sourceId)));
 return{binding:raw.binding,event:raw.event,settings:raw.settings,counts:raw.counts,qualification:raw.qualification,coverage:raw.coverage,regularSources,workspace:{complete:workspace.complete,mode:workspace.mode,tournamentName:workspace.tournamentName,eventName:workspace.eventName,eventKind:workspace.eventKind,startLabel:workspace.startLabel,entryCount:workspace.entryCount,paidEntryCount:workspace.paidEntryCount,qualifierCount:workspace.qualifierCount,grossEntryMinor:workspace.grossEntryMinor,settings:workspace.settings,settingsSnapshotId:object(workspace.payoutSource)?workspace.payoutSource.settingsSnapshotId:undefined}};
}
function flattenCosts(rows:unknown,currentSource:Record<string,unknown>,scope:{tournamentId:string;eventId:string}):NativeCostAnchorV1[]|null{
 if(!Array.isArray(rows)||rows.length>10000)return null;
 if(!object(currentSource.raw)||!object(currentSource.raw.allocation)||!uuid(currentSource.raw.allocation.revisionId)||!Array.isArray(currentSource.raw.allocation.eventSources))return null;
 const allocationId=currentSource.raw.allocation.revisionId,expenseSources=new Map<string,Record<string,unknown>>();
 for(const source of currentSource.raw.allocation.eventSources)if(object(source)&&source.kind==='expense'&&uuid(source.sourceId)&&source.physicalEvidenceId===source.sourceId&&!expenseSources.has(source.sourceId))expenseSources.set(source.sourceId,source);else if(object(source)&&source.kind==='expense')return null;
 const costs:NativeCostAnchorV1[]=[];
 for(const row of rows){
  if(!exact(row,['expenseId','expenseEventId','expenseVersion','description','amountMinor','recordedAt','allocations','currentBasisLines'])||!uuid(row.expenseId)||!uuid(row.expenseEventId)||!version(row.expenseVersion)||!text(row.description,2000)||!whole(row.amountMinor)||typeof row.recordedAt!=='string'||!Number.isFinite(Date.parse(row.recordedAt))||!Array.isArray(row.allocations)||!Array.isArray(row.currentBasisLines)||row.currentBasisLines.length>2)return null;
  const currentBasisLines=row.currentBasisLines as unknown[],allocations=row.allocations as unknown[];
  const source=expenseSources.get(row.expenseEventId);if(!source||source.amountMinor!==row.amountMinor||!Array.isArray(source.allocations)||!same(source.allocations.map(part=>object(part)?{eventId:part.eventId,bucket:part.bucket,amountMinor:part.amountMinor,allocationRevisionId:allocationId}:part).filter(part=>object(part)&&part.eventId===scope.eventId&&bucket(part.bucket)),row.allocations))return null;
  const seenBuckets=new Set<string>();let allocated=0;
  for(const line of currentBasisLines){
   if(!exact(line,['lineId','bucket','amountMinor','label'])||!uuid(line.lineId)||!bucket(line.bucket)||!whole(line.amountMinor)||line.amountMinor<1||!text(line.label,200))return null;
   if(seenBuckets.has(line.bucket)||line.lineId!==basisLineId(scope.tournamentId,scope.eventId,allocationId,row.expenseEventId,line.bucket))return null;seenBuckets.add(line.bucket);allocated+=line.amountMinor;
   costs.push({lineId:line.lineId,expenseId:row.expenseId,expenseEventId:row.expenseEventId,expenseVersion:row.expenseVersion,description:row.description,recordedAt:row.recordedAt,expenseAmountMinor:row.amountMinor,bucket:line.bucket,amountMinor:line.amountMinor});
  }
  if(allocated>row.amountMinor||allocations.length!==currentBasisLines.length||allocations.some((part,index)=>!exact(part,['eventId','bucket','amountMinor','allocationRevisionId'])||part.eventId!==scope.eventId||part.allocationRevisionId!==allocationId||!bucket(part.bucket)||!object(currentBasisLines[index])||part.bucket!==currentBasisLines[index].bucket||part.amountMinor!==currentBasisLines[index].amountMinor))return null;
  expenseSources.delete(row.expenseEventId);
 }
 return expenseSources.size===0?costs:null;
}

/** Reconstructs the planner input from the locked private SQL workspace. It does
 * not trust posted mappings, expense amounts, proposal totals, or aliases. */
export function readOperationalFinanceSourceAdoptionWorkspaceV1(value:unknown,scope:{actorId:string;tournamentId:string;eventId:string}):OperationalFinanceSourceAdoptionWorkspaceV1|null{
 if(![scope.actorId,scope.tournamentId,scope.eventId].every(uuid)||!exact(value,['kind','actorId','tournamentId','eventId','status','code','head','currentSource','unchangedFrameDigest','costLineages','costRows','sanctioning','proposalOnly','moneyMoved','payoutAuthorized','finalizationAuthorized'])||value.kind!=='operational-finance-source-adoption-workspace-v1'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||!['available','blocked'].includes(value.status as string)||(value.code!==null&&typeof value.code!=='string')||value.proposalOnly!==true||value.moneyMoved!==false||value.payoutAuthorized!==false||value.finalizationAuthorized!==false||!hash(value.unchangedFrameDigest)||!sanctioning(value.sanctioning))return null;
 if(!exact(value.head,['revisionId','version','sourceDigest','basisDigest','nativeAllocationRevisionId','sourceCapture','basis','editor'])||!uuid(value.head.revisionId)||!version(value.head.version)||!hash(value.head.sourceDigest)||!hash(value.head.basisDigest)||!uuid(value.head.nativeAllocationRevisionId)||!object(value.head.sourceCapture)||!object(value.head.sourceCapture.allocation)||!exact(value.head.basis,['kind','sourceDigest','coverage','workspace'])||!isRestorableEventFinanceEditorV1(value.head.editor)||!same(value.head.basis.workspace,value.head.editor.basis)||value.head.basis.sourceDigest!==value.head.sourceDigest)return null;
 const currentSource=value.currentSource,oldSource={status:'source_available',kind:'operational-event-finance-source-v1',...scope,sourceDigest:value.head.sourceDigest,raw:value.head.sourceCapture,basis:value.head.basis,basisDigest:value.head.basisDigest,proposalOnly:true,moneyMoved:false,finalizationAuthorized:false,payoutAuthorized:false};
 const assembly=assembleNativeOperationalFinanceV1(currentSource,scope),oldAssembly=assembleNativeOperationalFinanceV1(oldSource,scope);
 if(!assembly||!oldAssembly||!object(currentSource)||!object(currentSource.raw)||!object(currentSource.raw.allocation)||!uuid(currentSource.raw.allocation.revisionId)||value.head.nativeAllocationRevisionId!==value.head.sourceCapture.allocation?.revisionId||!same(adoptionFrame(oldSource),adoptionFrame(currentSource)))return null;
 const costs=flattenCosts(value.costRows,currentSource,scope);
 if(!costs||!Array.isArray(value.costLineages))return null;
 if(value.sanctioning!==null){const candidates=value.sanctioning.candidates,seen=new Set<string>();for(const candidate of candidates){const matching=costs.filter(cost=>cost.expenseEventId===candidate.expenseEventId);if(!matching.length||matching.some(cost=>cost.expenseId!==candidate.expenseId)||seen.has(candidate.expenseEventId)||matching.reduce((sum,cost)=>sum+cost.amountMinor,0)!==candidate.allocatedMinor||(matching.length===1?matching[0].bucket:candidate.bucket)!==candidate.bucket)return null;seen.add(candidate.expenseEventId);}if(seen.size!==new Set(costs.map(cost=>cost.expenseEventId)).size)return null;}
 const prepared:PreparedNativeCostAdoptionV1={kind:'prepared-native-cost-adoption-v1',actorId:scope.actorId,tournamentId:scope.tournamentId,eventId:scope.eventId,head:{revisionId:value.head.revisionId,version:value.head.version,sourceDigest:value.head.sourceDigest,basisDigest:value.head.basisDigest,editor:clone(value.head.editor)},current:clone(assembly.basis.workspace),currentBasisDigest:assembly.basisDigest,currentAllocationRevisionId:currentSource.raw.allocation.revisionId,unchangedFrameDigest:value.unchangedFrameDigest,costLineages:clone(value.costLineages) as NativeCostLineageV1[],costs,proposalOnly:true,moneyMoved:false,payoutAuthorized:false};
 const raw=clone(value) as OperationalFinanceSourceAdoptionRawWorkspaceV1;
 if(value.status==='available')return isPreparedNativeCostAdoptionV1(prepared)?{raw,prepared}:null;
 return{raw,prepared:null};
}

export type OperationalFinanceSourceAdoptionReceiptV1={
 kind:'operational-finance-source-adoption-provider-write-v1';actorId:string;tournamentId:string;eventId:string;
 operationId:string;request:OperationalFinanceSourceAdoptionRequestV1|null;outcome:Record<string,unknown>|null;
};
export function readOperationalFinanceSourceAdoptionReceiptV1(value:unknown,scope:{actorId:string;tournamentId:string;eventId:string;operationId:string},expectedRequest?:OperationalFinanceSourceAdoptionRequestV1):OperationalFinanceSourceAdoptionReceiptV1|null{
 if(!exact(value,['kind','actorId','tournamentId','eventId','operationId','request','outcome'])||value.kind!=='operational-finance-source-adoption-provider-write-v1'||value.actorId!==scope.actorId||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId||value.operationId!==scope.operationId||!uuid(value.operationId))return null;
 if(value.request===null&&value.outcome===null&&expectedRequest===undefined)return clone(value) as OperationalFinanceSourceAdoptionReceiptV1;
 if(!isOperationalFinanceSourceAdoptionRequestV1(value.request)||value.request.operationId!==scope.operationId||(expectedRequest!==undefined&&!same(value.request,expectedRequest))||!object(value.outcome))return null;
 const outcome=value.outcome;
 if(!['accepted','rejected','retry_exact'].includes(outcome.status as string)||typeof outcome.code!=='string'||['moneyMoved','payoutAuthorized','finalizationAuthorized','disbursementAuthorized'].some(key=>outcome[key]!==false&&outcome[key]!==undefined))return null;
 if(outcome.status!=='retry_exact'&&(outcome.actorId!==scope.actorId||outcome.tournamentId!==scope.tournamentId||outcome.eventId!==scope.eventId||outcome.operationId!==scope.operationId||!same(outcome.request,value.request)))return null;
 if(outcome.status==='accepted'&&(outcome.code!=='operational_finance_source_adopted'||!uuid(outcome.revisionId)||outcome.version!==value.request.expectedVersion+1||outcome.priorRevisionId!==value.request.expectedPriorRevisionId||!uuid(outcome.adoptionId)||outcome.sourceDigest!==value.request.expectedCurrentSourceDigest||outcome.basisDigest!==value.request.expectedCurrentBasisDigest||![outcome.mappingDigest,outcome.fullRequestHash].every(hash)||outcome.proposalOnly!==true||outcome.moneyMoved!==false||outcome.payoutAuthorized!==false||outcome.finalizationAuthorized!==false||outcome.disbursementAuthorized!==false||typeof outcome.historicalReceipt!=='boolean'||typeof outcome.currentSourceVerified!=='boolean'||outcome.historicalReceipt===outcome.currentSourceVerified))return null;
 return clone(value) as OperationalFinanceSourceAdoptionReceiptV1;
}
