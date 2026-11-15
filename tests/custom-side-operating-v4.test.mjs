import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 createCustomSideOperatingOperationV4,
 customSideAmountSourceVersionV4,
 customSidePolicyMethodV4,
 customSideRefundPolicyV1,
 createCustomSidePolicyRequestV4,
 isCustomSideOperatingOperationV4,
 isCustomSidePolicyRequestV4,
 readCustomSideOperatingWorkspaceV4,
 readCustomSideProviderWriteV4,
} from '../src/lib/api/custom-side-operating-v4.ts';
import {calculateCustomGraduatedAmountsV3,customGraduatedAmountsVersionV3} from '../src/lib/results/custom-graduated-amounts-v3.ts';

const id=n=>`${String(n).padStart(8,'0')}-0000-0000-0000-${String(n).padStart(12,'0')}`;
const hash=n=>String(n).repeat(64).slice(0,64);
const actorId=id(1),tournamentId=id(2),eventId=id(3),poolId=id(4),operationId=id(5),policyId=id(6),definitionVersionId=id(7),setupSidePoolVersionId=id(8),eventClientRowId=id(9),baseSetupRevisionId=id(10),setupRevisionId=id(18);
const intent={kind:'custom-payout-intent-v1',scope:'side',ratioDenominator:7,source:{tournamentId,eventClientRowId,setupRevisionId:baseSetupRevisionId,setupVersion:1,poolSlot:1,sourceDigest:hash(4)}};
const request={action:'publish',setupSidePoolVersionId,definitionVersionId,method:customSidePolicyMethodV4,ratio:7,amountMethod:customGraduatedAmountsVersionV3,disclosureReference:'TEST ONLY reviewed Custom Side policy',disclosed:true,intent};
const operation={kind:'custom-side-operating-operation-v4',operationId,request};
const binding={kind:'custom-side-policy-binding-v4',policyId,operationReceiptId:id(11),poolId,method:customSidePolicyMethodV4,ratio:7,amountMethod:customGraduatedAmountsVersionV3,definitionVersionId,definition:{id:definitionVersionId},disclosureReference:request.disclosureReference,policyActorId:actorId,policyOperationId:operationId,policyRequestHash:hash(2),materializationId:id(12),materializationReceiptId:id(13),setupSidePoolVersionId,setupRevisionId,setupEventVersionId:id(14),eventClientRowId,poolSlot:1,customRatio:7,payoutType:null,setupBatchId:id(15),setupActorId:actorId,setupOperationId:id(16),setupRequestHash:hash(3),originalIntent:intent,baseSetupRevisionId,baseSetupVersion:1,baseSourceDigest:hash(4)};
const preparation={kind:'custom-side-policy-preparation-v4',poolId,setupSidePoolVersionId,setupRevisionId,setupEventVersionId:id(14),eventClientRowId,poolSlot:1,customRatio:7,payoutType:null,definitionVersionId,definition:{id:definitionVersionId},setupBatchId:id(15),setupActorId:actorId,setupOperationId:id(16),setupRequestHash:hash(3),originalIntent:intent,baseSetupRevisionId,baseSetupVersion:1,baseSourceDigest:hash(4),blockers:['policy_frozen'],canPublish:false};
const entries=Array.from({length:7},(_,index)=>({participantId:id(100+index),electionId:id(200+index),version:1,elected:true,dueMinor:1000,receivedMinor:1000}));
const calculation=calculateCustomGraduatedAmountsV3({paidCount:7,feeMinor:1000,ratio:7});
assert.equal(calculation.status,'calculated');
const source={definitionId:definitionVersionId,eventId,poolId,name:'TEST ONLY Side',feeMinor:1000,policy:{id:policyId,method:customSidePolicyMethodV4,ratio:7,disclosureReference:request.disclosureReference,publishedAt:'2026-11-05T00:00:00.000Z'},paidCount:7,entries,sourceDigest:hash(5),manifest:{version:'side-pool-graduated-amounts-v2',sourceVersion:customSideAmountSourceVersionV4,customAlgorithmVersion:customGraduatedAmountsVersionV3,refundPolicy:customSideRefundPolicyV1,customPolicyBinding:binding,blockers:[]},blockers:[],calculation};
const workspace={kind:'custom-side-operating-workspace-v4',actorId,tournamentId,eventId,poolId,status:'published',preparation,binding,source,proposalOnly:true,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false};

test('Custom Side V4 request is exact, intent-bound, and separate from legacy/workbook methods',()=>{
 assert.equal(isCustomSidePolicyRequestV4(request),true);
 assert.deepEqual(createCustomSideOperatingOperationV4(operationId,request),operation);
 assert.equal(isCustomSideOperatingOperationV4(operation),true);
 assert.equal(isCustomSidePolicyRequestV4({...request,method:'graduated-acc-weighted-largest-remainder-5usd-v2'}),false);
 assert.equal(isCustomSidePolicyRequestV4({...request,amountMethod:'workbook-side-comparison-v1'}),false);
 assert.equal(isCustomSidePolicyRequestV4({...request,ratio:6}),false);
 assert.equal(isCustomSidePolicyRequestV4({...request,extra:true}),false);
 assert.equal(isCustomSidePolicyRequestV4({...request,intent:{...intent,scope:'satellite'}}),false);
 const prepared={...preparation,blockers:[],canPublish:true};assert.deepEqual(createCustomSidePolicyRequestV4(prepared,request.disclosureReference),request);
 assert.equal(createCustomSidePolicyRequestV4(preparation,request.disclosureReference),null);
});

test('Custom Side workspace proves exact setup binding, V3 arithmetic and no-refund source identity',()=>{
 assert.deepEqual(readCustomSideOperatingWorkspaceV4(workspace,{actorId,tournamentId,eventId,poolId}),workspace);
 assert.equal(readCustomSideOperatingWorkspaceV4({...workspace,actorId:id(999)},{actorId,tournamentId,eventId,poolId}),null);
 assert.equal(readCustomSideOperatingWorkspaceV4({...workspace,source:{...source,calculation:{...calculation,fundMinor:7500}}},{actorId,tournamentId,eventId,poolId}),null);
 assert.equal(readCustomSideOperatingWorkspaceV4({...workspace,source:{...source,manifest:{...source.manifest,refundPolicy:'refunds-allowed'}}},{actorId,tournamentId,eventId,poolId}),null);
 assert.equal(readCustomSideOperatingWorkspaceV4({...workspace,binding:{...binding,customRatio:6}},{actorId,tournamentId,eventId,poolId}),null);
 const blockedSource={...source,sourceDigest:hash(6),blockers:['side_no_eligible_recipients'],calculation:null,manifest:{...source.manifest,blockers:['side_no_eligible_recipients']}};
 assert.ok(readCustomSideOperatingWorkspaceV4({...workspace,source:blockedSource},{actorId,tournamentId,eventId,poolId}));
 const prepared={...preparation,blockers:[],canPublish:true};assert.ok(readCustomSideOperatingWorkspaceV4({...workspace,status:'prepared',preparation:prepared,binding:null,source:null},{actorId,tournamentId,eventId,poolId}));
 assert.equal(readCustomSideOperatingWorkspaceV4({...workspace,status:'prepared',preparation:prepared},{actorId,tournamentId,eventId,poolId}),null);
});

test('write receipt is full-operation and scope bound',()=>{
 const outcome={status:'side_custom_policy_published_v4',policyId,poolId,setupSidePoolVersionId,definitionVersionId,ratio:7,amountMethod:customGraduatedAmountsVersionV3,moneyMoved:false};
 const receipt={kind:'custom-side-operating-provider-write-v4',actorId,tournamentId,eventId,poolId,operationId,operation,outcome};
 assert.deepEqual(readCustomSideProviderWriteV4(receipt,{actorId,tournamentId,eventId,poolId,operation}),receipt);
 assert.equal(readCustomSideProviderWriteV4({...receipt,operation:{...operation,request:{...request,ratio:6}}},{actorId,tournamentId,eventId,poolId,operation}),null);
 assert.equal(readCustomSideProviderWriteV4({...receipt,outcome:{...outcome,poolId:id(999)}},{actorId,tournamentId,eventId,poolId,operation}),null);
 assert.ok(readCustomSideProviderWriteV4({...receipt,outcome:null},{actorId,tournamentId,eventId,poolId,operation}));
});

test('provider SQL remains service-only and default-off',()=>{
 const sql=fs.readFileSync('database/proposals/custom-side-operating-provider-v1.sql','utf8');
 assert.match(sql,/custom_side_operating_provider_enabled_v1\(\)[\s\S]*select false/);
 assert.match(sql,/grant execute[\s\S]*to service_role/);
 assert.doesNotMatch(sql,/grant execute[\s\S]*to authenticated/);
 assert.match(sql,/save_side_custom_operating_policy_provider_v4_impl/);
 assert.match(sql,/get_side_custom_operating_reconciliation_provider_v4_impl/);
 assert.match(sql,/proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false/);
});
