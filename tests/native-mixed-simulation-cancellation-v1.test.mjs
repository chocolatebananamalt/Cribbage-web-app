import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 isNativeMixedSimulationCancellationRequestV1,
 readNativeMixedCancellationReceiptV1,
} from '../src/lib/seating/native-mixed-cancellation-v1.ts';

const id=n=>`ca110000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const digest='a'.repeat(64);
const scope={actorId:id(1),tournamentId:id(2),eventId:id(3)};
const config={tables:[{tableId:'A',seatCount:18}],activePairIds:Array.from({length:9},(_,i)=>`A:${i*2+1}-${i*2+2}`),anchor:{participantId:null,seatId:'A-1',directorApproved:true},stationaryRequests:[],stationaryDecisions:[],constraints:[],maxAttempts:1};
const operationRequest={kind:'native-mixed-simulation-plan-v1',operationId:id(4),expectedAttendanceSealId:id(5),expectedAttendanceSourceDigest:digest,config,reason:'Prepare the rehearsal plan.'};
const operation={action:'plan',operationId:operationRequest.operationId,request:operationRequest};
const cancellationRequest={kind:'native-mixed-simulation-cancellation-v1',operationId:operation.operationId,action:operation.action,operationRequest,reason:'Resolve the uncertain plan write without retrying it.'};
const receipt={kind:'native-mixed-simulation-cancellation-receipt-v1',status:'cancelled_no_committed_operation',code:'simulation_operation_cancelled',...scope,operationId:operation.operationId,action:operation.action,request:operation.request,requestHash:'b'.repeat(64),cancellationReason:cancellationRequest.reason,notCommitted:true,executionNotProven:true,freshDrawAuthorized:false,normalStartAuthorized:false,currentSourceVerified:false};
const expected={scope,operation,reason:cancellationRequest.reason};

test('cancellation request and direct/historical no-commit receipts bind exact scope and operation',()=>{
 assert.equal(isNativeMixedSimulationCancellationRequestV1(cancellationRequest),true);
 assert.deepEqual(readNativeMixedCancellationReceiptV1(receipt,expected),receipt);
 const historical={...receipt,historicalReceipt:true};
 assert.deepEqual(readNativeMixedCancellationReceiptV1(historical,expected),historical);
 assert.deepEqual(readNativeMixedCancellationReceiptV1(historical,{scope,operation}),historical);
});

test('request validator rejects future keys, altered action and altered embedded operation',()=>{
 assert.equal(isNativeMixedSimulationCancellationRequestV1({...cancellationRequest,future:true}),false);
 assert.equal(isNativeMixedSimulationCancellationRequestV1({...cancellationRequest,action:'draw'}),false);
 assert.equal(isNativeMixedSimulationCancellationRequestV1({...cancellationRequest,operationRequest:{...operationRequest,operationId:id(6)}}),false);
 assert.equal(isNativeMixedSimulationCancellationRequestV1({...cancellationRequest,reason:' '}),false);
});

test('receipt rejects authority drift and never-executed or entropy claims',()=>{
 for(const changed of[
  {...receipt,notCommitted:false},
  {...receipt,executionNotProven:false},
  {...receipt,freshDrawAuthorized:true},
  {...receipt,normalStartAuthorized:true},
  {...receipt,currentSourceVerified:true},
  {...receipt,neverExecuted:true},
  {...receipt,entropyNotUsed:true},
 ])assert.equal(readNativeMixedCancellationReceiptV1(changed,expected),null);
});

test('receipt rejects wrong scope, operation, request, reason and malformed hash',()=>{
 assert.equal(readNativeMixedCancellationReceiptV1(receipt,{...expected,scope:{...scope,actorId:id(20)}}),null);
 assert.equal(readNativeMixedCancellationReceiptV1(receipt,{...expected,operation:{...operation,operationId:id(21)}}),null);
 assert.equal(readNativeMixedCancellationReceiptV1({...receipt,request:{...operationRequest,reason:'Other'}},expected),null);
 assert.equal(readNativeMixedCancellationReceiptV1(receipt,{...expected,reason:'Other cancellation'}),null);
 assert.equal(readNativeMixedCancellationReceiptV1({...receipt,requestHash:'not-a-digest'},expected),null);
});

test('SQL candidate is private, default-off, immutable and uses exact lock order',async()=>{
 const sql=await readFile(new URL('../database/proposals/native-mixed-simulation-cancellation-v1.sql',import.meta.url),'utf8');
 assert.match(sql,/native_mixed_simulation_cancellation_enabled_v1\(\)returns boolean[\s\S]*?select false/);
 assert.match(sql,/native_mixed_simulation_cancellation_recovery_enabled_v1\(\)returns boolean[\s\S]*?select false/);
 assert.match(sql,/alter table app\.native_mixed_simulation_cancellations_v1 enable row level security/);
 assert.match(sql,/alter table app\.native_mixed_simulation_cancellations_v1 force row level security/);
 assert.match(sql,/revoke all on table app\.native_mixed_simulation_cancellations_v1 from public,anon,authenticated,service_role/);
 assert.match(sql,/native_mixed_simulation_cancellations_no_truncate_v1 before truncate/);
 assert.doesNotMatch(sql,/\bgrant\b/i);
 const cancel=sql.indexOf('create function app.cancel_native_mixed_simulation_operation_v1');
 const actorLock=sql.indexOf("pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))",cancel);
 const eventLock=sql.indexOf("'native-mixed-simulation:'||tid::text||':'||eid::text",actorLock);
 const sourceLock=sql.indexOf('perform app.lock_native_mixed_simulation_sources_v1()',eventLock);
 const cancellationLock=sql.indexOf('lock table app.native_mixed_simulation_cancellations_v1 in share row exclusive mode nowait',sourceLock);
 assert.ok(cancel>=0&&actorLock>cancel&&eventLock>actorLock&&sourceLock>eventLock&&cancellationLock>sourceLock);
});

test('SQL cancellation is exact-replay, cross-domain guarded and draw-terminal without RNG or ordinary writes',async()=>{
 const sql=await readFile(new URL('../database/proposals/native-mixed-simulation-cancellation-v1.sql',import.meta.url),'utf8');
 for(const table of['native_mixed_simulation_operations_v1','native_mixed_admission_operations_v1','native_mixed_funding_operations_v1','native_mixed_attendance_operations_v1'])assert.match(sql,new RegExp(`before insert on app\\.${table}`));
 assert.match(sql,/create unique index native_mixed_simulation_one_cancelled_draw_v1[\s\S]*?where action='draw'/);
 assert.match(sql,/where c\.tournament_id=new\.tournament_id and c\.event_id=new\.event_id and c\.action='draw'/);
 assert.match(sql,/where x\.tournament_id=tid and x\.event_id=eid and x\.action='draw'/);
 assert.match(sql,/app\.native_mixed_simulation_operation_reserved_v1\(actor,op\)is true/);
 assert.match(sql,/return app\.get_native_mixed_simulation_operation_v1\(actor,tid,eid,op\)/);
 assert.match(sql,/request_payload is distinct from operation_request[\s\S]*?cancellation_reason is distinct from reason_value/);
 assert.match(sql,/native_mixed_simulation_plans_v1[\s\S]*?expectedPlanDigest[\s\S]*?expectedAttendanceSourceDigest[\s\S]*?native_mixed_simulation_plan_bound_v1/);
 assert.match(sql,/native_mixed_simulation_operations_v1[\s\S]*?action='draw'[\s\S]*?native_mixed_simulation_draws_v1[\s\S]*?native_mixed_simulation_reviews_v1[\s\S]*?native_mixed_simulation_publication_contexts_v1/);
 assert.match(sql,/random_seating_draws_v1[\s\S]*?initial_seating_publications[\s\S]*?event_schedule_publications[\s\S]*?event_play_starts/);
 assert.doesNotMatch(sql,/random_seating_candidate_v1\s*\(/);
 assert.doesNotMatch(sql,/insert into app\.(event_check_in|roster_payment|event_participant_status)/);
 assert.match(sql,/'notCommitted',true,'executionNotProven',true,'freshDrawAuthorized',false/);
});

test('read-only recovery is independently gated and returns a historical non-current receipt',async()=>{
 const sql=await readFile(new URL('../database/proposals/native-mixed-simulation-cancellation-v1.sql',import.meta.url),'utf8');
 const getter=sql.slice(sql.indexOf('create function app.get_native_mixed_simulation_cancellation_v1'));
 assert.match(getter,/native_mixed_simulation_cancellation_recovery_enabled_v1\(\)is distinct from true/);
 assert.match(getter,/role='director'\s+for key share nowait/);
 assert.match(getter,/native_mixed_simulation_operation_reserved_v1\(actor,op\)is true[\s\S]*?cancellation_history_unavailable/);
 assert.match(getter,/native_mixed_simulation_cancellation_receipt_v1\(c,true\)/);
 assert.doesNotMatch(getter,/\binsert\b|\bupdate\b|\bdelete\b/);
 assert.match(sql,/case when historical then jsonb_build_object\('historicalReceipt',true\)/);
});
