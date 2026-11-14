import test from 'node:test';
import assert from 'node:assert/strict';
import {createCustomSideProviderV1} from '../src/lib/api/custom-side-provider-v1.ts';
import {createCustomSideProviderHandlersV1} from '../src/lib/api/custom-side-provider-handlers-v1.ts';
import {createCustomSideProviderHttpV1} from '../src/lib/api/custom-side-provider-http-v1.ts';
import {calculateCustomGraduatedAmountsV3,customGraduatedAmountsVersionV3} from '../src/lib/results/custom-graduated-amounts-v3.ts';

const id=n=>`${String(n).padStart(8,'0')}-0000-0000-0000-${String(n).padStart(12,'0')}`;
const hash=n=>String(n).repeat(64).slice(0,64);
const actorId=id(1),tournamentId=id(2),eventId=id(3),poolId=id(4),operationId=id(5),policyId=id(6),definitionVersionId=id(7),setupSidePoolVersionId=id(8),eventClientRowId=id(9),baseSetupRevisionId=id(10),setupRevisionId=id(18);
const intent={kind:'custom-payout-intent-v1',scope:'side',ratioDenominator:7,source:{tournamentId,eventClientRowId,setupRevisionId:baseSetupRevisionId,setupVersion:1,poolSlot:1,sourceDigest:hash(4)}};
const request={action:'publish',setupSidePoolVersionId,definitionVersionId,method:'side-custom-graduated-policy-v4',ratio:7,amountMethod:customGraduatedAmountsVersionV3,disclosureReference:'TEST ONLY reviewed Custom Side policy',disclosed:true,intent};
const operation={kind:'custom-side-operating-operation-v4',operationId,request};
const outcome={status:'side_custom_policy_published_v4',policyId,poolId,setupSidePoolVersionId,definitionVersionId,ratio:7,amountMethod:customGraduatedAmountsVersionV3,moneyMoved:false};
const binding={kind:'custom-side-policy-binding-v4',policyId,operationReceiptId:id(11),poolId,method:'side-custom-graduated-policy-v4',ratio:7,amountMethod:customGraduatedAmountsVersionV3,definitionVersionId,definition:{id:definitionVersionId},disclosureReference:request.disclosureReference,policyActorId:actorId,policyOperationId:operationId,policyRequestHash:hash(2),materializationId:id(12),materializationReceiptId:id(13),setupSidePoolVersionId,setupRevisionId,setupEventVersionId:id(14),eventClientRowId,poolSlot:1,customRatio:7,payoutType:null,setupBatchId:id(15),setupActorId:actorId,setupOperationId:id(16),setupRequestHash:hash(3),originalIntent:intent,baseSetupRevisionId,baseSetupVersion:1,baseSourceDigest:hash(4)};
const preparation={kind:'custom-side-policy-preparation-v4',poolId,setupSidePoolVersionId,setupRevisionId,setupEventVersionId:id(14),eventClientRowId,poolSlot:1,customRatio:7,payoutType:null,definitionVersionId,definition:{id:definitionVersionId},setupBatchId:id(15),setupActorId:actorId,setupOperationId:id(16),setupRequestHash:hash(3),originalIntent:intent,baseSetupRevisionId,baseSetupVersion:1,baseSourceDigest:hash(4),blockers:['policy_frozen'],canPublish:false};
const entries=Array.from({length:7},(_,index)=>({participantId:id(100+index),electionId:id(200+index),version:1,elected:true,dueMinor:1000,receivedMinor:1000}));
const calculation=calculateCustomGraduatedAmountsV3({paidCount:7,feeMinor:1000,ratio:7});
const source={definitionId:definitionVersionId,eventId,poolId,name:'TEST ONLY Side',feeMinor:1000,policy:{id:policyId,method:'side-custom-graduated-policy-v4',ratio:7,disclosureReference:request.disclosureReference,publishedAt:'2026-11-05T00:00:00.000Z'},paidCount:7,entries,sourceDigest:hash(5),manifest:{version:'side-pool-graduated-amounts-v2',sourceVersion:'side-custom-amount-source-v4',customAlgorithmVersion:customGraduatedAmountsVersionV3,refundPolicy:'no-pool-refunds-v1',customPolicyBinding:binding,blockers:[]},blockers:[],calculation};
const workspace={kind:'custom-side-operating-workspace-v4',actorId,tournamentId,eventId,poolId,status:'published',preparation,binding,source,proposalOnly:true,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false};
const receipt={kind:'custom-side-operating-provider-write-v4',actorId,tournamentId,eventId,poolId,operationId,operation,outcome};
const scope={actorId,tournamentId,eventId,poolId};

function authClient(state={actorId}){return{auth:{getUser:async()=>({data:{user:state.actorId?{id:state.actorId}:null},error:null})},rpc:async(name)=>({data:name==='get_tournament_role'?'director':null,error:null})};}

test('server provider is disabled by default and validates actor before service RPC',async()=>{
 let calls=0;const disabled=createCustomSideProviderV1({authenticated:authClient(),serviceRpc:async()=>{calls++;return{data:workspace,error:null};}});
 assert.equal((await disabled.workspace(scope)).error,'disabled');assert.equal(calls,0);
 const foreign=createCustomSideProviderV1({authenticated:authClient({actorId:id(99)}),serviceRpc:async()=>{calls++;return{data:workspace,error:null};},enabled:()=>true});
 assert.equal((await foreign.workspace(scope)).error,'identity_changed');assert.equal(calls,0);
});

test('server provider binds workspace, save, exact reconciliation and late identity',async()=>{
 const names=[];const state={actorId};let serviceResult=workspace;
 const provider=createCustomSideProviderV1({authenticated:authClient(state),serviceRpc:async(name,args)=>{names.push([name,args]);return{data:serviceResult,error:null};},enabled:()=>true});
 assert.deepEqual((await provider.workspace(scope)).data,workspace);
 serviceResult=outcome;assert.deepEqual((await provider.save(scope,operation)).data,receipt);
 serviceResult={authorized:true,result:outcome};assert.deepEqual((await provider.reconcile(scope,operation)).data,receipt);
 serviceResult={authorized:true,result:null};assert.equal((await provider.reconcile(scope,operation)).data.outcome,null);
 assert.deepEqual(names.map(([name])=>name),['get_custom_side_operating_workspace_provider_v4','save_side_custom_operating_policy_provider_v4','get_side_custom_operating_reconciliation_provider_v4','get_side_custom_operating_reconciliation_provider_v4']);
 serviceResult=outcome;const callsBefore=names.length;const changing=createCustomSideProviderV1({authenticated:{auth:{getUser:async()=>{const value=state.actorId;state.actorId=id(99);return{data:{user:{id:value}},error:null};}},rpc:authClient().rpc},serviceRpc:async(name,args)=>{names.push([name,args]);return{data:serviceResult,error:null};},enabled:()=>true});
 state.actorId=actorId;assert.equal((await changing.save(scope,operation)).error,'identity_changed');assert.equal(names.length,callsBefore);
});

test('server provider snapshots scope and complete operation before authentication awaits',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});let first=true,serviceArgs=null;
 const authenticated={auth:{getUser:async()=>{if(first){first=false;await gate;}return{data:{user:{id:actorId}},error:null};}},rpc:async()=>({data:'director',error:null})};
 const provider=createCustomSideProviderV1({authenticated,serviceRpc:async(_name,args)=>{serviceArgs=args;return{data:outcome,error:null};},enabled:()=>true});
 const mutableScope=structuredClone(scope),mutableOperation=structuredClone(operation),pending=provider.save(mutableScope,mutableOperation);
 mutableScope.actorId=id(90);mutableScope.tournamentId=id(91);mutableOperation.operationId=id(92);mutableOperation.request.ratio=8;mutableOperation.request.intent.ratioDenominator=8;release();
 const result=await pending;assert.equal(result.error,null);assert.deepEqual(result.data,receipt);
 assert.equal(serviceArgs.p_actor_id,actorId);assert.equal(serviceArgs.p_tournament_id,tournamentId);assert.equal(serviceArgs.p_operation_id,operationId);assert.equal(serviceArgs.p_request.ratio,7);
});

test('pure handlers require actor header and complete operation for reconciliation',async()=>{
 let called=0;const port={workspace:async()=>({data:workspace,error:null}),save:async()=>({data:receipt,error:null}),reconcile:async()=>{called++;return{data:receipt,error:null};}};
 const handlers=createCustomSideProviderHandlersV1({enabled:()=>true,port:async()=>port,readJson:async request=>request.bodyValue,sameOrigin:()=>true,json:(body,init)=>({body,status:init?.status??200,headers:init?.headers}),boundary:run=>run()});
 const context={params:Promise.resolve({id:tournamentId,eventId,poolId,operationId})};
 assert.equal((await handlers.workspaceGET({method:'GET',headers:new Headers()},context)).status,403);
 const requestObject={method:'POST',headers:new Headers({'x-expected-actor-id':actorId}),bodyValue:operation};
 assert.equal((await handlers.operationPOST(requestObject,context)).status,200);assert.equal(called,1);
 const changed={...requestObject,bodyValue:{...operation,operationId:id(99)}};assert.equal((await handlers.operationPOST(changed,context)).status,400);assert.equal(called,1);
});

test('disabled HTTP adapter uses fixed scope, full body and exact response decoder',async()=>{
 const calls=[];let responseValue=workspace;
 const fetcher=async(path,init)=>{calls.push([path,init]);return new Response(JSON.stringify(responseValue),{status:200,headers:{'content-type':'application/json'}});};
 const disabled=createCustomSideProviderHttpV1(scope,{fetch:fetcher});await assert.rejects(()=>disabled.workspace(),/provider_disabled/);assert.equal(calls.length,0);
 const http=createCustomSideProviderHttpV1(scope,{enabled:()=>true,fetch:fetcher});assert.deepEqual(await http.workspace(),workspace);
 responseValue=receipt;assert.deepEqual(await http.save(operation),receipt);assert.deepEqual(await http.reconcile(operation),receipt);
 assert.deepEqual(calls.map(([path])=>path),[`/api/v1/tournaments/${tournamentId}/events/${eventId}/side-pools/${poolId}/custom-v4`,`/api/v1/tournaments/${tournamentId}/events/${eventId}/side-pools/${poolId}/custom-v4`,`/api/v1/tournaments/${tournamentId}/events/${eventId}/side-pools/${poolId}/custom-v4/operations/${operationId}`]);
 for(const[,init]of calls)assert.equal(init.headers['x-expected-actor-id'],actorId);
 assert.equal(calls[1][1].body,JSON.stringify(operation));assert.equal(calls[2][1].body,JSON.stringify(operation));
 responseValue={...receipt,actorId:id(99)};await assert.rejects(()=>http.save(operation),/invalid_provider_response/);
});

test('HTTP adapter snapshots factory scope and operation across pending response',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;}),calls=[];
 const mutableScope=structuredClone(scope),mutableOperation=structuredClone(operation);
 const http=createCustomSideProviderHttpV1(mutableScope,{enabled:()=>true,fetch:async(path,init)=>{calls.push([path,init]);await gate;return new Response(JSON.stringify(receipt),{status:200,headers:{'content-type':'application/json'}});}});
 mutableScope.actorId=id(90);mutableScope.tournamentId=id(91);const pending=http.save(mutableOperation);mutableOperation.operationId=id(92);mutableOperation.request.ratio=8;mutableOperation.request.intent.ratioDenominator=8;release();
 assert.deepEqual(await pending,receipt);assert.equal(calls[0][0],`/api/v1/tournaments/${tournamentId}/events/${eventId}/side-pools/${poolId}/custom-v4`);assert.equal(calls[0][1].headers['x-expected-actor-id'],actorId);assert.equal(calls[0][1].body,JSON.stringify(operation));
});
