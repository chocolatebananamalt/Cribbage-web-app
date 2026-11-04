import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrizeScheduleRequest, isPrizeScheduleWorkspace, isPrizeScheduleSaved, isPrizeScheduleReconciliation, isPrizeScheduleResolution, getPrizeScheduleWorkspace, listPrizeSchedules } from '../src/lib/api/prize-schedule.ts';
import { readMediumJson, mediumJsonRequestBodyLimit } from '../src/lib/api/bounded-json.ts';
import { isSettlementV5Request } from '../src/lib/api/settlement-v5.ts';
import { countAppSessionStorageRecords } from '../src/lib/client-session-storage.ts';
const tid='40000000-0000-4000-8000-000000000001',rowId='40000000-0000-4000-8000-000000000002',sid='40000000-0000-4000-8000-000000000003';
const schedule={kind:'director-selected-prize-schedule-v1',amountBasis:'total_award',expectedQualifierCount:4,sourceReference:'TEST ONLY director choice',roundingRule:'floor_each_weighted_share_then_assign_remainder_to_champion',cohorts:[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2}]};
const request={expectedVersion:0,schedule,reviewed:true,reason:'TEST ONLY original declaration'};
const workspace={tournamentId:tid,clientRowId:rowId,currentVersion:1,activated:false,eventId:null,settingsCurrent:true,versions:[{scheduleId:sid,version:1,schedule,reason:request.reason,recordedAt:'2026-10-27T22:30:00Z'}]};
const saved={status:'prize_schedule_saved_v1',tournamentId:tid,clientRowId:rowId,scheduleId:sid,version:1};
test('exact reviewed schedule request rejects implicit policy, invalid weights and unexpected keys',()=>{
 assert.equal(isPrizeScheduleRequest(request),true);
 for(const bad of [{...request,reviewed:false},{...request,expectedVersion:2147483648},{...request,reason:' '},{...request,operationId:sid},{...request,schedule:{...schedule,cohorts:[...schedule.cohorts,{bandStart:5,bandEnd:8,weight:1}]}}]) assert.equal(isPrizeScheduleRequest(bad),false);
});
test('workspace enforces scope, complete version history and exact no-private-data envelope',()=>{
 assert.equal(isPrizeScheduleWorkspace(workspace,tid,rowId),true);
 for(const bad of [{...workspace,currentVersion:2},{...workspace,activated:true},{...workspace,expenseEvidence:[]},{...workspace,versions:[{...workspace.versions[0],recordedAt:'not a date'}]}]) assert.equal(isPrizeScheduleWorkspace(bad,tid,rowId),false);
 assert.equal(isPrizeScheduleWorkspace(workspace,rowId,tid),false);
});
test('receipt reconciliation does not treat null or an unknown envelope as saved',()=>{
 assert.equal(isPrizeScheduleSaved(saved,tid,rowId),true);
 assert.equal(isPrizeScheduleReconciliation({authorized:true,result:null},tid,rowId),true);
 assert.equal(isPrizeScheduleReconciliation({authorized:true,result:saved},tid,rowId),true);
 assert.equal(isPrizeScheduleReconciliation({authorized:true,result:{...saved,version:0}},tid,rowId),false);
 assert.equal(isPrizeScheduleReconciliation({authorized:true,result:{status:'rejected',clientRowId:rowId,code:'anything'}},tid,rowId),false);
 assert.equal(isPrizeScheduleReconciliation({authorized:false,result:saved},tid,rowId),false);
});
test('reader pins exact actor/tournament/row RPC arguments and fails closed on cross-scope data',async()=>{
 let call;
 const rpc={rpc:async(name,args)=>{call={name,args};return{data:workspace,error:null};}};
 assert.deepEqual(await getPrizeScheduleWorkspace(rpc,sid,tid,rowId),workspace);
 assert.deepEqual(call,{name:'get_setup_prize_schedule_v1',args:{p_actor_id:sid,p_tournament_id:tid,p_client_row_id:rowId}});
 assert.equal(await getPrizeScheduleWorkspace(rpc,sid,rowId,tid),null);
 assert.equal(await listPrizeSchedules({rpc:async()=>({data:[{...workspace,tournamentId:rowId}],error:null})},sid,tid),null);
});
test('V5 recognizes explicit schedule pin without changing historical eight-field requests',()=>{
 const base={source:{kind:'playoff_outcome_v3',resultId:sid,qualificationResultVersionId:rowId},expectedVersion:0,prizeClaims:[],eventIncomeMinor:0,eventExpenseMinor:0,retainedBalanceMinor:0,sanctioningExpenseEventId:null,officialSourceReference:'TEST ONLY'};
 assert.equal(isSettlementV5Request(base),true);
 assert.equal(isSettlementV5Request({...base,scheduleVersionId:sid}),true);
 assert.equal(isSettlementV5Request({...base,scheduleVersionId:null}),false);
 assert.equal(isSettlementV5Request({...base,scheduleVersionId:'latest'}),false);
 assert.equal(isSettlementV5Request({...base,scheduleVersionId:sid,implicit:true}),false);
});
test('shared-device recovery counter includes retained schedule request',()=>{
 const keys=['prize-schedule:actor:tid:row','unrelated'];
 assert.equal(countAppSessionStorageRecords({length:keys.length,key:i=>keys[i]}),1);
});
test('maximum multibyte references remain sendable through the route body limit',async()=>{
 const body={...request,reason:'界'.repeat(500),schedule:{...schedule,sourceReference:'界'.repeat(500)}};
 assert.equal(isPrizeScheduleRequest(body),true);
 const encoded=JSON.stringify(body);
 assert.ok(new TextEncoder().encode(encoded).byteLength>2048);
 assert.ok(new TextEncoder().encode(encoded).byteLength<mediumJsonRequestBodyLimit);
 assert.deepEqual(await readMediumJson(new Request('https://test.invalid',{method:'POST',headers:{'content-type':'application/json'},body:encoded})),body);
});
test('resolution validates exact weights, floor shares and champion-only cent remainder',()=>{
 const awards=[4,3,2,2].map((weight,i)=>({participantId:`40000000-0000-4000-8000-00000000000${i+4}`,bandStart:[1,2,3,3][i],bandEnd:[1,2,4,4][i],weight,totalAwardMinor:[9600,7200,4800,4800][i]}));
 const body={status:'available',scheduleVersionId:sid,grossEntryIncomeMinor:48000,expenseTotalMinor:21600,prizeBudgetMinor:26400,roundingRemainderMinor:0,awards};
 assert.equal(isPrizeScheduleResolution(body),true);
 assert.equal(isPrizeScheduleResolution({...body,roundingRemainderMinor:1}),false);
 assert.equal(isPrizeScheduleResolution({...body,awards:awards.map((a,i)=>({...a,weight:i===3?3:a.weight}))}),false);
 assert.equal(isPrizeScheduleResolution({...body,awards:awards.map((a,i)=>({...a,totalAwardMinor:a.totalAwardMinor+(i===0?1:i===1?-1:0)}))}),false);
 assert.equal(isPrizeScheduleResolution({...body,awards:awards.map(a=>({...a,weight:Number.MAX_SAFE_INTEGER}))}),false);
});
