import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventFinanceEditorV1} from '../src/lib/finance/event-finance-workspace-v1.ts';
import {createNativeOptionalFinanceProviderV2} from '../src/lib/api/native-optional-finance-provider-v2.ts';

const id=n=>`ab070000-0000-4000-8000-${String(n).padStart(12,'0')}`,h='a'.repeat(64),b='b'.repeat(64);
const scope={actorId:id(1),tournamentId:id(2),eventId:id(3)},proposalOperationId=id(31),ownershipOperationId=id(32);
// DTO-only synthetic fixture. It proves boundary behavior, not SQL, provider auth,
// receipts, games, payment or finalization.
function sourceFixture(){
 const source={tournamentId:scope.tournamentId,eventId:scope.eventId,sourceVersion:1,sourceDigest:h};
 const history=[['Venue','operating_expense',5000],['Q','q_pool_fund',17000],['Side','side_pool_fund',16000]].map(([label,category,amountMinor],i)=>({label,line:{recordId:id(20+i),lineId:id(20+i),priorRecordId:null,source,mode:'estimate',category,amountMinor,voided:false,reason:'Source evidence'}}));
 const w={complete:true,source,mode:'estimate',tournamentName:'TEST ONLY',eventName:'Main',eventKind:'main',startLabel:'November 5, 2026',entryCount:16,paidEntryCount:16,qualifierCount:4,grossEntryMinor:48000,history,settings:{method:'graduated_all_qualifiers',factor:'1.5'},payoutSource:{tournamentId:scope.tournamentId,eventId:scope.eventId,settingsSnapshotId:id(7),ledgerDigest:h,resultsDigest:h},savedAt:'2026-11-05T12:00:00.000Z',overrideHistory:[]};
 const ownership={status:'ownership_source_available',kind:'native-optional-pool-ownership-source-v2',...scope,sourceDigest:'c'.repeat(64),capture:{kind:'native-optional-pool-ownership-source-v2',tournamentId:scope.tournamentId,eventId:scope.eventId,refundPolicy:'no-pool-refunds-v1',nativePlayoffSource:{source:{settingsBinding:{settings_snapshot_id:id(7)}}},basis:{expenses:[{expenseEventId:id(8),description:'Venue',amountMinor:5000}]},qSource:{obligations:[{kind:'award',poolVersionId:id(9),fundMinor:17000}]},sideBasis:{manifest:[{source:{poolId:id(10),fundMinor:16000}}]},rosterReceiptPartitions:[{PRIVATE_RECEIPT:'never returned'}]},funds:{regularReceiptsMinor:48000,qReceiptsMinor:17000,sideReceiptsMinor:16000,recordedReceiptsMinor:81000},moneyMoved:false,bankReceiptVerified:false,finalizationAuthorized:false};
 ownership.capture.qSource.sourceDigest=h;Object.assign(ownership.capture.qSource.obligations[0],{status:'unpaid',rows:[{participantId:id(40),amountMinor:17000}]});ownership.capture.qReview={source_digest:h,obligations:structuredClone(ownership.capture.qSource.obligations)};
 Object.assign(ownership.capture.sideBasis.manifest[0].source,{eventId:scope.eventId,sourceDigest:h,blockers:[],obligations:[{participantId:id(40),amountMinor:16000,status:'unpaid'}]});ownership.capture.sideBasis.manifest[0].review={pool_id:id(10),event_id:scope.eventId,tournament_id:scope.tournamentId,source_digest:h,obligations:structuredClone(ownership.capture.sideBasis.manifest[0].source.obligations)};
 return{status:'source_available',kind:'native-optional-finance-source-v2',...scope,sourceDigest:h,basisDigest:b,raw:{kind:'native-optional-finance-source-v2',ownershipRevisionId:id(4),ownershipVersion:1,ownershipSource:ownership,costClassifications:[{expenseEventId:id(8),category:'operating_expense'}],settings:w.settings},basis:{kind:'native-optional-finance-basis-v2',sourceDigest:h,workspace:w,coverage:{additionalIncome:'unavailable',optionalPools:'versioned_ownership_annex',recordedFundAvailable:false}},proposalOnly:true,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false};
}
function workspaceFixture(){const source=sourceFixture();return{kind:'native-optional-finance-workspace-v2',...scope,source,currentVersion:1,current:true,history:[{revisionId:id(30),version:1,priorRevisionId:null,ownershipRevisionId:id(4),actorId:scope.actorId,operationId:id(33),sourceDigest:h,basisDigest:b,editor:createEventFinanceEditorV1(source.basis.workspace),reason:'Reviewed proposal',savedAt:'2026-11-05T12:00:00.000Z'}],proposalOnly:true,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false};}
const proposalRequest=()=>{const source=sourceFixture();return{kind:'native-optional-finance-proposal-v2',expectedVersion:1,sourceDigest:h,basisDigest:b,editor:createEventFinanceEditorV1(source.basis.workspace),reason:'Explicit Director review',reviewed:true};};
const ownershipRequest=()=>({kind:'native-optional-pool-ownership-v2',expectedVersion:0,sourceDigest:'c'.repeat(64),reason:'Explicit Director review',reviewed:true,costClassifications:[{expenseEventId:id(8),category:'operating_expense'}]});
const proposalResult=()=>({status:'optional_finance_proposal_saved_v2',revisionId:id(34),version:2,...scope,operationId:proposalOperationId,sourceDigest:h,basisDigest:b,proposalOnly:true,moneyMoved:false,payoutAuthorized:false});
const ownershipResult=()=>({status:'optional_pool_ownership_reviewed_v2',revisionId:id(35),version:1,...scope,operationId:ownershipOperationId,sourceDigest:'c'.repeat(64),moneyMoved:false,finalizationAuthorized:false});
const envelope=(action,operation,result)=>({kind:'native-optional-finance-provider-write-v2',action,...scope,operationId:operation.operationId,request:operation.request,result});
function authClient(state={actorId:scope.actorId,role:'director'}){return{auth:{getUser:async()=>({data:{user:state.actorId?{id:state.actorId}:null},error:null})},rpc:async name=>({data:name==='get_tournament_role'?state.role:null,error:null})};}

test('default-off and Director preconditions prevent every service RPC',async()=>{
 let calls=0;const disabled=createNativeOptionalFinanceProviderV2({authenticated:authClient(),serviceRpc:async()=>{calls++;return{data:workspaceFixture(),error:null};}});
 assert.equal((await disabled.workspace(scope)).error,'disabled');assert.equal(calls,0);
 const co=createNativeOptionalFinanceProviderV2({authenticated:authClient({actorId:scope.actorId,role:'co_director'}),serviceRpc:async()=>{calls++;return{data:null,error:null};},enabled:()=>true});
 assert.equal((await co.ownershipPreparation(scope)).error,'permission_required');assert.equal(calls,0);
 const foreign=createNativeOptionalFinanceProviderV2({authenticated:authClient({actorId:id(99),role:'director'}),serviceRpc:async()=>{calls++;return{data:null,error:null};},enabled:()=>true});
 assert.equal((await foreign.workspace(scope)).error,'identity_changed');assert.equal(calls,0);
});

test('workspace and ownership preparation are strict, scoped and sanitized',async()=>{
 const workspace=workspaceFixture(),source=sourceFixture().raw.ownershipSource;let value=workspace;const calls=[];
 const provider=createNativeOptionalFinanceProviderV2({authenticated:authClient(),serviceRpc:async(name,args)=>{calls.push([name,args]);return{data:value,error:null};},enabled:()=>true});
 const read=await provider.workspace(scope);assert.equal(read.error,null);assert.equal(read.data.currentVersion,1);
 value=source;const prepared=await provider.ownershipPreparation(scope);assert.equal(prepared.error,null);assert.deepEqual(prepared.data.costs,[{expenseEventId:id(8),description:'Venue',amountMinor:5000}]);assert.equal(JSON.stringify(prepared).includes('PRIVATE_RECEIPT'),false);
 assert.deepEqual(calls.map(([name])=>name),['get_native_optional_finance_workspace_provider_v2','get_native_optional_pool_ownership_source_provider_v2']);
 for(const[,args]of calls)assert.deepEqual(args,{actor:scope.actorId,tid:scope.tournamentId,eid:scope.eventId});
 value={...source,actorId:id(99)};assert.equal((await provider.ownershipPreparation(scope)).error,'invalid_response');
});

test('save and reconcile return only exact fully bound proposal and ownership envelopes',async()=>{
 const proposalOperation={operationId:proposalOperationId,request:proposalRequest()},ownershipOperation={operationId:ownershipOperationId,request:ownershipRequest()};let value;const calls=[];
 const provider=createNativeOptionalFinanceProviderV2({authenticated:authClient(),serviceRpc:async(name,args)=>{calls.push([name,args]);return{data:value,error:null};},enabled:()=>true});
 value=envelope('proposal',proposalOperation,proposalResult());assert.deepEqual((await provider.saveProposal(scope,proposalOperation)).data,value);
 value={status:'historical_operation',result:proposalResult(),currentFundAuthority:false,moneyMoved:false};assert.deepEqual((await provider.reconcileProposal(scope,proposalOperation)).data,envelope('proposal',proposalOperation,value));
 value=envelope('ownership',ownershipOperation,ownershipResult());assert.deepEqual((await provider.saveOwnership(scope,ownershipOperation)).data,value);
 value={status:'historical_operation',result:ownershipResult(),currentFundAuthority:false,moneyMoved:false};assert.deepEqual((await provider.reconcileOwnership(scope,ownershipOperation)).data,envelope('ownership',ownershipOperation,value));
 value={status:'unknown',...scope,operationId:ownershipOperationId};assert.deepEqual((await provider.reconcileOwnership(scope,ownershipOperation)).data,envelope('ownership',ownershipOperation,value));
 assert.deepEqual(calls.map(([name])=>name),['save_native_optional_finance_proposal_provider_v2','reconcile_native_optional_finance_proposal_provider_v2','save_native_optional_pool_ownership_provider_v2','reconcile_native_optional_pool_ownership_provider_v2','reconcile_native_optional_pool_ownership_provider_v2']);
 for(const[index,[,args]]of calls.entries()){const operation=index<2?proposalOperation:ownershipOperation;assert.deepEqual(args,{actor:scope.actorId,tid:scope.tournamentId,eid:scope.eventId,op:operation.operationId,request:operation.request});}
});

test('known rejected and retry outcomes remain bound while malformed authority responses are uncertain',async()=>{
 const operation={operationId:proposalOperationId,request:proposalRequest()};let value=envelope('proposal',operation,{status:'rejected',code:'stale_version'});
 const provider=createNativeOptionalFinanceProviderV2({authenticated:authClient(),serviceRpc:async()=>({data:value,error:null}),enabled:()=>true});
 assert.deepEqual((await provider.saveProposal(scope,operation)).data,value);
 value={status:'retry_exact',code:'operation_busy'};assert.deepEqual((await provider.reconcileProposal(scope,operation)).data,envelope('proposal',operation,value));
 for(const bad of[{status:'rejected',code:'made_up'},{status:'rejected',code:'stale_version'},null,{status:'historical_operation',result:proposalResult(),currentFundAuthority:true,moneyMoved:false},{status:'unknown',...scope,operationId:id(99)}]){value=bad;assert.equal((await provider.reconcileProposal(scope,operation)).error,'invalid_response');}
 value=null;assert.equal((await provider.workspace(scope)).error,'invalid_response');
 const unavailable=createNativeOptionalFinanceProviderV2({authenticated:authClient(),serviceRpc:async()=>({data:null,error:{message:'offline'}}),enabled:()=>true});assert.equal((await unavailable.workspace(scope)).error,'provider_unavailable');
});

test('foreign proposal editor scope is rejected before authentication or service RPC',async()=>{
 let authCalls=0,serviceCalls=0;const operation={operationId:proposalOperationId,request:proposalRequest()};operation.request.editor.basis.source.eventId=id(99);operation.request.editor.basis.payoutSource.eventId=id(99);
 const authenticated={auth:{getUser:async()=>{authCalls++;return{data:{user:{id:scope.actorId}},error:null};}},rpc:async()=>({data:'director',error:null})};
 const provider=createNativeOptionalFinanceProviderV2({authenticated,serviceRpc:async()=>{serviceCalls++;return{data:null,error:null};},enabled:()=>true});
 assert.equal((await provider.saveProposal(scope,operation)).error,'invalid_scope');assert.equal(authCalls,0);assert.equal(serviceCalls,0);
});

test('scope and complete operations are snapshotted before the first authentication await',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});let first=true,serviceArgs;
 const authenticated={auth:{getUser:async()=>{if(first){first=false;await gate;}return{data:{user:{id:scope.actorId}},error:null};}},rpc:async()=>({data:'director',error:null})};
 const operation={operationId:proposalOperationId,request:proposalRequest()},mutableScope=structuredClone(scope),mutableOperation=structuredClone(operation);
 const provider=createNativeOptionalFinanceProviderV2({authenticated,serviceRpc:async(_name,args)=>{serviceArgs=args;return{data:envelope('proposal',operation,proposalResult()),error:null};},enabled:()=>true});
 const pending=provider.saveProposal(mutableScope,mutableOperation);mutableScope.actorId=id(90);mutableScope.tournamentId=id(91);mutableOperation.operationId=id(92);mutableOperation.request.expectedVersion=99;mutableOperation.request.reason='Changed after call';release();
 const result=await pending;assert.equal(result.error,null);assert.equal(result.data.operationId,proposalOperationId);assert.equal(serviceArgs.actor,scope.actorId);assert.equal(serviceArgs.tid,scope.tournamentId);assert.equal(serviceArgs.op,proposalOperationId);assert.equal(serviceArgs.request.expectedVersion,1);
});

test('late identity or role changes invalidate an otherwise accepted service response',async()=>{
 const operation={operationId:proposalOperationId,request:proposalRequest()};let users=0,roles=0,serviceCalls=0;
 const authenticated={auth:{getUser:async()=>({data:{user:{id:++users===4?id(99):scope.actorId}},error:null})},rpc:async()=>({data:++roles===2?'co_director':'director',error:null})};
 const provider=createNativeOptionalFinanceProviderV2({authenticated,serviceRpc:async()=>{serviceCalls++;return{data:envelope('proposal',operation,proposalResult()),error:null};},enabled:()=>true});
 const result=await provider.saveProposal(scope,operation);assert.equal(result.error,'permission_required');assert.equal(serviceCalls,1);assert.equal(users,3);assert.equal(roles,2);
});
