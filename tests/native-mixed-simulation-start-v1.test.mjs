import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{isNativeMixedSimulationStartRequestV1,readNativeMixedSimulationStartReceiptV1,readNativeMixedSimulationStartOutcomeV1,readNativeMixedSimulationStartedSourceV1}from'../src/lib/seating/native-mixed-simulation-start-v1.ts';
import{startScope as scope,startRequest as request,startReceipt,startId as id}from'./helpers/native-mixed-simulation-start-example.mjs';
const expected={scope,request};const sql=readFileSync(new URL('../database/proposals/native-mixed-simulation-start-v1.sql',import.meta.url),'utf8');
const compact=sql.replace(/\s+/g,' ');

test('simulated Start request is exact and cannot claim real presence or scoring',()=>{
 assert.equal(isNativeMixedSimulationStartRequestV1(request),true);
 for(const change of [{normalStartAuthorized:true},{reason:' '},{reason:' padded '},{statement:'I attended'},{operationId:'bad'},{expectedContextId:'bad'},{expectedScheduleSourceDigest:'x'.repeat(64)},{expectedScheduleSourceDigest:1111},{expectedAttendanceSourceDigest:1111},{reason:'bad\nline'}])assert.equal(isNativeMixedSimulationStartRequestV1({...request,...change}),false);
 for(const key of Object.keys(request)){const missing={...request};delete missing[key];assert.equal(isNativeMixedSimulationStartRequestV1(missing),false);}
 const symbolic={...request,[Symbol('extra')]:true};assert.equal(isNativeMixedSimulationStartRequestV1(symbolic),false);
 const list=sql.match(/array_agg\(k order by k\).*?=array\[([^\]]+)\]/s);assert.ok(list);assert.deepEqual([...list[1].matchAll(/'([^']+)'/g)].map(x=>x[1]),Object.keys(request).sort());
});
test('receipt preserves scope, exact retained request, counts and immutable simulation-only flags',()=>{
 assert.ok(readNativeMixedSimulationStartReceiptV1(startReceipt(),expected));
 const flags=['ordinaryAttendanceUsed','normalStartAuthorized','scoringAuthorized','humanPresenceVerified','paymentVerified','moneyMoved','payoutAuthorized','finalizationAuthorized'];
 for(const key of flags)assert.equal(readNativeMixedSimulationStartReceiptV1({...startReceipt(),[key]:true},expected),null,key);
 for(const change of [{actorId:id(8)},{eventId:id(8)},{tournamentId:id(8)},{operationId:id(8)},{contextId:id(8)},{gameCount:108},{matchCount:12},{participantCount:17},{startedAt:'2026-13-01T00:00:00.000Z'},{extra:true},{simulationStarted:false},{request:{...request,reason:'Changed'}}])assert.equal(readNativeMixedSimulationStartReceiptV1({...startReceipt(),...change},expected),null);
 const raw=startReceipt(),parsed=readNativeMixedSimulationStartReceiptV1(raw,expected);raw.request.reason='mutated';assert.equal(parsed.request.reason,request.reason);
});
test('historical recovery never upgrades into current Start or score authority',()=>{
 assert.ok(readNativeMixedSimulationStartReceiptV1(startReceipt(true),{...expected,historicalOnly:true}));
 assert.equal(readNativeMixedSimulationStartReceiptV1(startReceipt(),{...expected,historicalOnly:true}),null);
 for(const change of [{historicalReceipt:true,currentSourceVerified:true},{historicalReceipt:false,currentSourceVerified:false}])assert.equal(readNativeMixedSimulationStartReceiptV1({...startReceipt(),...change},expected),null);
 const current={kind:'native-mixed-simulation-start-source-v1',...scope,receipt:startReceipt(),currentSourceVerified:true,normalStartAuthorized:false,scoringAuthorized:false};
 assert.ok(readNativeMixedSimulationStartedSourceV1(current,{...expected,startId:id(6)}));
 assert.equal(readNativeMixedSimulationStartedSourceV1({...current,receipt:startReceipt(true)},{...expected,startId:id(6)}),null);
 assert.equal(readNativeMixedSimulationStartedSourceV1(current,{...expected,startId:id(9)}),null);
 assert.equal(readNativeMixedSimulationStartedSourceV1({...current,scoringAuthorized:true},{...expected,startId:id(6)}),null);
});
test('unknown outcomes and unsupported flags stay closed',()=>{
 assert.deepEqual(readNativeMixedSimulationStartOutcomeV1({status:'retry_exact',code:'source_busy'},expected),{status:'retry_exact',code:'source_busy'});
 for(const v of [null,{status:'accepted'},{status:'rejected',code:'invented'},{status:'rejected',code:'publication_or_readiness_changed',scoringAuthorized:true}])assert.equal(readNativeMixedSimulationStartOutcomeV1(v,expected),null);
 assert.deepEqual(readNativeMixedSimulationStartOutcomeV1({status:'rejected',code:'publication_or_readiness_changed'},expected),{status:'rejected',code:'publication_or_readiness_changed'});
});
test('SQL stays private default-off immutable and never creates ordinary attendance or score authority',()=>{
 assert.match(compact,/start_enabled_v1\(\).*?select false/);assert.match(compact,/start_recovery_enabled_v1\(\).*?select false/);
 assert.doesNotMatch(sql,/grant execute/i);for(const field of ['expectedAttendanceSourceDigest','expectedScheduleSourceDigest'])assert.ok(sql.includes(`jsonb_typeof(v->'${field}')='string'`));assert.match(sql,/force row level security/);assert.match(sql,/reject_immutable_history/);
 assert.doesNotMatch(sql,/(?:insert into|update|delete from) app\.(?:event_play_starts|roster_check_in_events|event_check_in_events|event_check_in_windows|event_participant_status_events|score_submissions|score_confirmations|roster_payment_events)/i);
 assert.doesNotMatch(sql,/update app\.operation_receipts/i);
 const functions=[...sql.matchAll(/create function (app\.[a-z0-9_]+)\(/g)].map(x=>x[1]);const acl=sql.slice(sql.lastIndexOf('do $$declare p regprocedure'));for(const fn of functions)assert.ok(acl.includes(fn),fn);
 for(const key of ['ordinaryAttendanceUsed','normalStartAuthorized','scoringAuthorized','humanPresenceVerified','paymentVerified','moneyMoved','payoutAuthorized','finalizationAuthorized'])assert.ok(compact.includes(`'${key}',false`));
});
test('SQL binds current native publication, pending games, global operation receipt and nonself evidence',()=>{
 assert.match(compact,/for share nowait/);assert.match(compact,/native-mixed-simulation:'\|\|tid::text/);assert.match(compact,/native_mixed_simulation_operation_reserved_v1\(actor,op\)/);
 assert.match(compact,/source:=app\.native_mixed_simulation_schedule_source_v1\(actor,tid,eid\)/);
 assert.match(compact,/source#>>'\{publication,contextId\}'is distinct from request->>'expectedContextId'/);
 assert.match(compact,/native_mixed_admission_score_history_empty_v1\(tid,eid\)is distinct from true/);
 assert.match(compact,/state<>'pending'/);assert.match(compact,/r\.response_payload=app\.native_mixed_simulation_start_receipt_v1\(s\)/);
 assert.match(compact,/a\.after_state=r\.response_payload/);assert.match(compact,/source is distinct from s\.source_capture/);
 const writer=sql.slice(sql.indexOf('create function app.record_native_mixed_simulation_start_v1'),sql.indexOf('create function app.get_native_mixed_simulation_start_operation_v1'));
 assert.ok(writer.indexOf('select*into old')<writer.indexOf('source:=app.'));assert.ok(writer.indexOf('response:=')<writer.indexOf('insert into app.operation_receipts'));
 const recovery=sql.slice(sql.indexOf('create function app.get_native_mixed_simulation_start_operation_v1'),sql.indexOf('create function app.get_native_mixed_simulation_started_source_v1'));
 assert.doesNotMatch(recovery,/app\.native_mixed_simulation_start_enabled_v1|schedule_source_v1/);assert.match(recovery,/'historicalReceipt',true,'currentSourceVerified',false/);
});
