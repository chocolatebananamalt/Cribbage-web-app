import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {newEventPlayoffParametersDraftV1} from '../src/lib/playoffs/event-playoff-parameters-v1.ts';
import {createEventFinanceEditorV1} from '../src/lib/finance/event-finance-workspace-v1.ts';
import {isRestorableEventFinanceEditorV1} from '../src/lib/finance/event-finance-draft-codec-v1.ts';
import {buildNativeCostAdoptionRequestV1,planNativeCostAdoptionV1} from '../src/lib/finance/native-cost-adoption-plan-v1.ts';
import {assembleNativeOperationalFinanceV1} from '../src/lib/finance/operational-finance-native-assembler-v1.ts';
import {isOperationalFinanceSourceAdoptionRequestV1,readOperationalFinanceSourceAdoptionReceiptV1,readOperationalFinanceSourceAdoptionWorkspaceV1} from '../src/lib/api/operational-finance-source-adoption-v1.ts';

const id=n=>`e6010000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(1),tournamentId:id(2),eventId:id(3)};
const lineId=(allocationId,sourceId,bucket)=>{const md=createHash('md5').update(`operational-finance-basis-line-v1|${scope.tournamentId}|${scope.eventId}|${allocationId}|${sourceId}|${bucket}`).digest('hex');return`${md.slice(0,8)}-${md.slice(8,12)}-${md.slice(12,16)}-${md.slice(16,20)}-${md.slice(20)}`;};
function packet(sourceVersion,allocationId,sourceDigest,basisDigest){
 const coverage={additionalIncome:'unavailable',optionalPools:'isolated_regular_allocation',recordedFundAvailable:false},savedAt=`2026-11-05T1${sourceVersion}:00:00.000Z`,expenseEventId=id(20),expenseId=id(21),costLineId=lineId(allocationId,expenseEventId,'operating_expense'),source={tournamentId:scope.tournamentId,eventId:scope.eventId,sourceVersion,sourceDigest};
 const history=[{label:'Allocated Operating Expense',line:{recordId:costLineId,lineId:costLineId,priorRecordId:null,source,mode:'estimate',category:'operating_expense',amountMinor:500,voided:false,reason:'Recorded allocation basis'}}];
 const workspace={complete:true,source,mode:'estimate',tournamentName:'Fictional Trial',eventName:'Main',eventKind:'main',startLabel:'November 7, 2026',entryCount:40,paidEntryCount:null,qualifierCount:10,grossEntryMinor:5000,history,settings:{method:'graduated_all_qualifiers',factor:'1.5'},payoutSource:{tournamentId:scope.tournamentId,eventId:scope.eventId,settingsSnapshotId:id(7),ledgerDigest:sourceDigest,resultsDigest:sourceDigest},savedAt,overrideHistory:[]};
 const raw={binding:{bindingId:id(4),activationId:id(5),setupEventVersionId:id(6),settingsSnapshotId:id(7),reviewId:id(8)},event:{tournamentName:'Fictional Trial',eventName:'Main',eventKind:'main',format:'standard_singles',operationalState:'active',startLabel:'November 7, 2026'},settings:{draft:newEventPlayoffParametersDraftV1('main'),context:{sanctioned:false,durationDays:1,eventKind:'main',originalEntrants:null}},allocation:{revisionId:allocationId,version:sourceVersion,sourceDigest:'9'.repeat(64),createdAt:savedAt,eventSources:[{sourceId:id(10),physicalEvidenceId:id(10),kind:'entry_receipt',amountMinor:5000,state:'active',allocations:[{eventId:scope.eventId,bucket:'regular_entry',poolId:null,amountMinor:5000,classificationReviewed:true}]},{sourceId:expenseEventId,physicalEvidenceId:expenseEventId,kind:'expense',amountMinor:500,state:'active',allocations:[{eventId:scope.eventId,bucket:'operating_expense',poolId:null,amountMinor:500,classificationReviewed:true}]}]},counts:{activeParticipants:40,paidEligibleEntries:null},qualification:{resultVersionId:id(12),version:1,participantCount:40,qualifierCount:10},coverage};
 return{packet:{status:'source_available',kind:'operational-event-finance-source-v1',...scope,sourceDigest,raw,basis:{kind:'operational-finance-estimate-basis-v1',sourceDigest,coverage,workspace},basisDigest,proposalOnly:true,moneyMoved:false,finalizationAuthorized:false,payoutAuthorized:false},expenseEventId,expenseId,costLineId};
}
function fixture(){
 const prior=packet(1,id(30),'a'.repeat(64),'b'.repeat(64)),current=packet(2,id(31),'c'.repeat(64),'d'.repeat(64)),editor=createEventFinanceEditorV1(prior.packet.basis.workspace);assert.ok(editor);
 const lineage={lineId:prior.costLineId,origin:'native',nativeBasisLineId:prior.costLineId,sourceExpenseId:prior.expenseId,sourceExpenseEventId:prior.expenseEventId,bucket:'operating_expense',capturedAmountMinor:500,snapshotLabel:'Allocated Operating Expense',records:editor.history,latest:{recordId:prior.costLineId,amountMinor:500,voided:false,label:'Allocated Operating Expense',reason:'Recorded allocation basis',category:'operating_expense'}};
 const costRow={expenseId:prior.expenseId,expenseEventId:prior.expenseEventId,expenseVersion:1,description:'Room rental',amountMinor:500,recordedAt:'2026-11-05T10:00:00.000Z',allocations:[{eventId:scope.eventId,bucket:'operating_expense',amountMinor:500,allocationRevisionId:id(31)}],currentBasisLines:[{lineId:current.costLineId,bucket:'operating_expense',amountMinor:500,label:'Allocated Operating Expense'}]};
 return{kind:'operational-finance-source-adoption-workspace-v1',...scope,status:'available',code:null,head:{revisionId:id(40),version:1,sourceDigest:prior.packet.sourceDigest,basisDigest:prior.packet.basisDigest,nativeAllocationRevisionId:id(30),sourceCapture:prior.packet.raw,basis:prior.packet.basis,editor},currentSource:current.packet,unchangedFrameDigest:'e'.repeat(64),costLineages:[lineage],costRows:[costRow],sanctioning:null,proposalOnly:true,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false};
}

test('reconstructs a strict trusted adoption plan and exact 12-key request',()=>{
 const source=fixture();assert.ok(assembleNativeOperationalFinanceV1(source.currentSource,scope));assert.equal(isRestorableEventFinanceEditorV1(source.head.editor),true);assert.deepEqual(source.head.basis.workspace,source.head.editor.basis);assert.deepEqual(Object.keys(source).sort(),['kind','actorId','tournamentId','eventId','status','code','head','currentSource','unchangedFrameDigest','costLineages','costRows','sanctioning','proposalOnly','moneyMoved','payoutAuthorized','finalizationAuthorized'].sort());const workspace=readOperationalFinanceSourceAdoptionWorkspaceV1(source,scope);assert.ok(workspace);assert.ok(workspace.prepared);
 const cost=workspace.prepared.costs[0],line=workspace.prepared.costLineages[0];
 const dispositions=[{kind:'carry_native',priorLineId:line.lineId,currentBasisLineId:cost.lineId,currentExpenseId:cost.expenseId,currentExpenseEventId:cost.expenseEventId,bucket:cost.bucket,alias:'Room rental',reason:'Matched the immutable recorded expense.'}];
 const plan=planNativeCostAdoptionV1(workspace.prepared,dispositions);assert.equal(plan.status,'review_ready');
 const request=buildNativeCostAdoptionRequestV1(plan,id(50),'Adopt the reviewed recorded cost source.');assert.ok(request);assert.equal(isOperationalFinanceSourceAdoptionRequestV1(request),true);assert.deepEqual(Object.keys(request).sort(),['dispositions','editor','expectedCurrentBasisDigest','expectedCurrentSourceDigest','expectedPriorBasisDigest','expectedPriorRevisionId','expectedPriorSourceDigest','expectedUnchangedFrameDigest','expectedVersion','kind','operationId','reason'].sort());
});

test('trusted workspace keeps the immutable display alias carried by SQL lineage evidence',()=>{
 const source=fixture();source.costLineages[0].snapshotLabel='Room and Hall Rental';
 const workspace=readOperationalFinanceSourceAdoptionWorkspaceV1(source,scope);
 assert.equal(workspace?.prepared?.costLineages[0].snapshotLabel,'Room and Hall Rental');
 assert.equal(workspace?.prepared?.costs[0].description,'Room rental');
});

test('a blocked SQL workspace remains read-only even when all prepared source fields are valid',()=>{
 const source=fixture();source.status='blocked';source.code='source_already_finalized';
 const workspace=readOperationalFinanceSourceAdoptionWorkspaceV1(source,scope);
 assert.equal(workspace?.raw.code,'source_already_finalized');
 assert.equal(workspace?.prepared,null);
});

test('workspace rejects changed basis, forged physical anchors, duplicate anchors and unsafe authority flags',()=>{
 for(const mutate of [v=>v.costRows[0].currentBasisLines.push(structuredClone(v.costRows[0].currentBasisLines[0])),v=>v.costRows[0].expenseEventId=id(99),v=>v.currentSource.raw.allocation.eventSources[1].physicalEvidenceId=id(99),v=>v.currentSource.basis.workspace.history[0].line.amountMinor=501,v=>v.currentSource.moneyMoved=true,v=>v.head.basis.workspace.source.eventId=id(99)]){const value=fixture();mutate(value);assert.equal(readOperationalFinanceSourceAdoptionWorkspaceV1(value,scope),null);}
});

test('receipt decoder binds actor, route, operation, full request and historical currentness',()=>{
 const workspace=readOperationalFinanceSourceAdoptionWorkspaceV1(fixture(),scope);assert.ok(workspace?.prepared);const cost=workspace.prepared.costs[0],line=workspace.prepared.costLineages[0];
 const plan=planNativeCostAdoptionV1(workspace.prepared,[{kind:'carry_native',priorLineId:line.lineId,currentBasisLineId:cost.lineId,currentExpenseId:cost.expenseId,currentExpenseEventId:cost.expenseEventId,bucket:cost.bucket,alias:'Room rental',reason:'Matched the immutable recorded expense.'}]);assert.equal(plan.status,'review_ready');const request=buildNativeCostAdoptionRequestV1(plan,id(50),'Adopt the reviewed recorded cost source.');assert.ok(request);
 const outcome={status:'accepted',code:'operational_finance_source_adopted',revisionId:id(51),version:2,priorRevisionId:id(40),sourceDigest:'c'.repeat(64),basisDigest:'d'.repeat(64),adoptionId:id(52),mappingDigest:'f'.repeat(64),historicalReceipt:false,currentSourceVerified:true,actorId:scope.actorId,tournamentId:scope.tournamentId,eventId:scope.eventId,operationId:request.operationId,request,fullRequestHash:'1'.repeat(64),proposalOnly:true,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false,disbursementAuthorized:false};
 const receipt={kind:'operational-finance-source-adoption-provider-write-v1',...scope,operationId:request.operationId,request,outcome};
 assert.ok(readOperationalFinanceSourceAdoptionReceiptV1(receipt,{...scope,operationId:request.operationId},request));
 const wrong=structuredClone(receipt);wrong.outcome.request.reason='different';assert.equal(readOperationalFinanceSourceAdoptionReceiptV1(wrong,{...scope,operationId:request.operationId},request),null);
 const impossible=structuredClone(receipt);impossible.outcome.historicalReceipt=true;assert.equal(readOperationalFinanceSourceAdoptionReceiptV1(impossible,{...scope,operationId:request.operationId},request),null);
 for(const mutate of [v=>v.outcome.code='accepted',v=>v.outcome.version=3,v=>v.outcome.priorRevisionId=id(99),v=>v.outcome.sourceDigest='9'.repeat(64),v=>v.outcome.basisDigest='8'.repeat(64),v=>v.outcome.disbursementAuthorized=true]){const value=structuredClone(receipt);mutate(value);assert.equal(readOperationalFinanceSourceAdoptionReceiptV1(value,{...scope,operationId:request.operationId},request),null);}
});
