import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationalFinanceSourceAdoptionTransportV1,isNativeLedgerAllocationWireRequestV1,operationalFinanceSourceAdoptionProviderEnabledV1} from '../src/lib/api/operational-finance-source-adoption-transport-v1.ts';

const id=n=>`e6020000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actorId=id(1),tournamentId=id(2),operationId=id(3);
const request={kind:'native-ledger-allocation-v1',operationId,expectedRevisionId:null,sourceDigest:'a'.repeat(64),allocations:[],reason:'Review the complete current allocation.',reviewed:true};
const client=(rpc,getUser=async()=>({data:{user:{id:actorId}},error:null}))=>({auth:{getUser},rpc});

test('provider capability is literal false and performs no provider call by default',async()=>{
 let calls=0;const port=createOperationalFinanceSourceAdoptionTransportV1(client(async()=>{calls++;return{data:null,error:null};}));
 assert.equal(operationalFinanceSourceAdoptionProviderEnabledV1(),false);
 assert.deepEqual(await port.allocationWorkspace(tournamentId,actorId),{data:null,error:'disabled'});assert.equal(calls,0);
});

test('allocation request keeps exact immutable operation and source pins',()=>{
 assert.equal(isNativeLedgerAllocationWireRequestV1(request),true);
 for(const mutate of [v=>v.extra=true,v=>v.operationId=v.operationId.toUpperCase(),v=>v.expectedRevisionId='bad',v=>v.sourceDigest='x',v=>v.reviewed=false,v=>v.reason=' reason']){const value=structuredClone(request);mutate(value);assert.equal(isNativeLedgerAllocationWireRequestV1(value),false);}
});

test('authenticated transport rejects wrong-scope receipts and identity changes',async()=>{
 const calls=[];const wrong={kind:'native-ledger-allocation-provider-write-v1',actorId,tournamentId:id(99),operationId,request,outcome:{status:'retry_exact',code:'source_busy'}};
 const port=createOperationalFinanceSourceAdoptionTransportV1(client(async(name,args)=>{calls.push({name,args});return name==='get_tournament_role'?{data:'director',error:null}:{data:wrong,error:null};}),()=>true);
 assert.deepEqual(await port.saveAllocation(tournamentId,request,actorId),{data:null,error:'invalid_response'});assert.equal(calls.some(call=>call.name==='save_native_ledger_allocation_provider_v1'),true);
 let reads=0;const changed=createOperationalFinanceSourceAdoptionTransportV1(client(async name=>name==='get_tournament_role'?{data:'director',error:null}:{data:wrong,error:null},async()=>({data:{user:{id:reads++===0?actorId:id(9)}},error:null})),()=>true);
 assert.deepEqual(await changed.saveAllocation(tournamentId,request,actorId),{data:null,error:'identity_changed'});
});

test('allocation reconciliation rejects a foreign inner operation under the requested route',async()=>{
 const foreign={kind:'native-ledger-allocation-provider-write-v1',actorId,tournamentId,operationId,request:{...request,operationId:id(9)},outcome:{status:'retry_exact',code:'operation_incomplete'}};
 const port=createOperationalFinanceSourceAdoptionTransportV1(client(async name=>name==='get_tournament_role'?{data:'director',error:null}:{data:foreign,error:null}),()=>true);
 assert.deepEqual(await port.allocationOperation(tournamentId,operationId,actorId),{data:null,error:'invalid_response'});
});

test('expected actor mismatch stops before role or business RPC and a late switch is unknown',async()=>{
 let calls=0;const cookieB=id(8),mismatch=createOperationalFinanceSourceAdoptionTransportV1(client(async()=>{calls++;return{data:'director',error:null};},async()=>({data:{user:{id:cookieB}},error:null})),()=>true);
 assert.deepEqual(await mismatch.allocationWorkspace(tournamentId,actorId),{data:null,error:'identity_changed'});assert.equal(calls,0);
 let reads=0;const late=createOperationalFinanceSourceAdoptionTransportV1(client(async name=>{calls++;return name==='get_tournament_role'?{data:'director',error:null}:{data:null,error:null};},async()=>({data:{user:{id:reads++<2?actorId:cookieB}},error:null})),()=>true);
 assert.deepEqual(await late.allocationWorkspace(tournamentId,actorId),{data:null,error:'identity_changed'});assert.equal(calls,2,'One role check and one business RPC occur before the post-operation identity change is detected');
});
