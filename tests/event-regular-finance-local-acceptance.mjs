// PREPARED ONLY. Private owner execution with synthetic authenticated JWT
// subject; NOT proof of public HTTP access, ledger truth or approved money.
import assert from 'node:assert/strict';
import {calculateEventRegularFinanceV1}from'../src/lib/results/event-regular-finance-v1.ts';
const id=n=>`a2980000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`;
export async function verifyEventRegularFinanceDraftV1({q,read,withHeldLock,actorId:actor,outsiderId:other,tournamentId:tid,nextOperationId,setupEventVersionId,settingsSnapshotId}){
 const owner=(sql,who=actor)=>read(sql,who,'ownerAuthenticated');
 const base=owner(`select app.get_event_regular_finance_base_v1('${tid}','${setupEventVersionId}');`);assert.equal(base.capability,false);assert.equal(base.settingsSnapshotId,settingsSnapshotId);
 const line=(n,category,amountMinor)=>({recordId:id(100+n),lineId:id(200+n),priorRecordId:null,source:base.source,mode:'simulation',category,amountMinor,voided:false,reason:''});
 const proposal={source:base.source,mode:'simulation',grossEntry:{source:base.source,mode:'simulation',amountMinor:48000},history:[line(1,'player_benefit',14400),line(2,'operating_expense',7200),line(3,'q_pool_fund',3000)]};
 const request=(p=proposal,expectedVersion=0)=>({kind:'event-regular-finance-draft-v1',operationId:nextOperationId(),expectedVersion,settingsSnapshotId,setupEventVersionId,proposal:structuredClone(p),reason:'Synthetic draft review; no money moved'});
 const save=(v,who=actor)=>owner(`select app.save_event_regular_finance_draft_v1('${tid}',${literal(v)});`,who);
 const count=()=>owner(`select to_jsonb((select count(*)from app.event_regular_finance_revisions_v1 where tournament_id='${tid}'and setup_event_version_id='${setupEventVersionId}'));`);
 const first=request();
 // Inject the base helper's declared retry contract transaction-locally. Its
 // replacement and any accidental reservation must both disappear on rollback.
 const helperBusy=owner(`begin;create or replace function app.get_event_regular_finance_base_v1(p_tournament_id uuid,p_setup_event_version_id uuid)returns jsonb language sql security definer set search_path=''as $$select '{"status":"retry_exact","code":"source_busy"}'::jsonb$$;select app.save_event_regular_finance_draft_v1('${tid}',${literal(first)});rollback;`);
 assert.deepEqual(helperBusy,{status:'retry_exact',code:'source_busy'});assert.equal(owner(`select to_jsonb((select count(*)from app.event_regular_finance_reservations_v1 where actor_id='${actor}'and operation_id='${first.operationId}'));`),0);
 const saved=save(first);assert.equal(saved.status,'event_regular_finance_draft_saved');assert.equal(saved.validationOnlyDraft,true);assert.equal(saved.modelCalculationApproved,false);assert.equal(saved.moneyMoved,false);assert.equal(saved.finalizationAuthorized,false);assert.deepEqual(saved.envelope,first);assert.equal(count(),1);
 assert.deepEqual(save(first),saved);assert.equal(count(),1);assert.deepEqual(owner(`select app.reconcile_event_regular_finance_draft_v1('${tid}',${literal(first)});`),saved);
 const stored=owner(`select proposal from app.event_regular_finance_revisions_v1 where id='${saved.revisionId}';`);assert.deepEqual(stored,proposal);assert.equal(calculateEventRegularFinanceV1(stored).regularFundMinor,26400);
 assert.equal(save({...first,reason:'Changed same operation'}).code,'idempotency_conflict');assert.equal(save(request(),other).code,'not_director');assert.equal(save(request()).code,'stale_version');
 const changed=structuredClone(proposal),previous=changed.history[1];changed.history.push({...previous,recordId:id(301),priorRecordId:previous.recordId,amountMinor:6800,reason:'Corrected fictional amount'});
 const second=request(changed,1),secondSaved=save(second);assert.equal(secondSaved.status,'event_regular_finance_draft_saved');assert.equal(count(),2);assert.deepEqual(save(second),secondSaved);assert.equal(count(),2);
 const tampered=structuredClone(changed);tampered.history[0].amountMinor=1;assert.equal(save(request(tampered,2)).code,'history_not_append_only');
 const rebucket=structuredClone(changed),qline=rebucket.history[2];rebucket.history.push({...qline,recordId:id(302),priorRecordId:qline.recordId,category:'unrestricted_income',reason:'Cannot authorize transfer'});assert.equal(save(request(rebucket,2)).code,'invalid_proposal');
 const modes=structuredClone(changed);modes.mode='estimate';assert.equal(save(request(modes,2)).code,'invalid_proposal');
 const source=structuredClone(changed);source.source.sourceDigest='b'.repeat(64);assert.equal(save(request(source,2)).code,'invalid_proposal');
 const whitespace=structuredClone(changed);whitespace.history[3].reason='\t\n\u00a0\uFEFF';assert.equal(save(request(whitespace,2)).code,'invalid_proposal');
 const longReason=structuredClone(changed);longReason.history[3].reason='😀'.repeat(1001);assert.equal(save(request(longReason,2)).code,'invalid_proposal');
 const next=structuredClone(changed);next.history.push({...next.history[3],recordId:id(303),priorRecordId:next.history[3].recordId,amountMinor:0,voided:true,reason:'Void duplicate evidence'});const failure=request(next,2),before=count();
 q(`create function app.fixture_finance_outcome_failure()returns trigger language plpgsql as $$begin raise exception'fixture finance outcome failure';end$$;create trigger fixture_finance_outcome_failure before insert on app.event_regular_finance_outcomes_v1 for each row execute function app.fixture_finance_outcome_failure();`);
 try{assert.throws(()=>save(failure),/fixture finance outcome failure/);}finally{q('drop trigger fixture_finance_outcome_failure on app.event_regular_finance_outcomes_v1;drop function app.fixture_finance_outcome_failure();');}
 assert.equal(count(),before);assert.equal(owner(`select to_jsonb((select count(*)from app.event_regular_finance_reservations_v1 where actor_id='${actor}'and operation_id='${failure.operationId}'));`),0);assert.equal(owner(`select app.reconcile_event_regular_finance_draft_v1('${tid}',${literal(failure)});`),null);
 const recovered=save(failure);assert.equal(recovered.status,'event_regular_finance_draft_saved');assert.deepEqual(save(failure),recovered);assert.equal(count(),3);assert.deepEqual(owner(`select proposal from app.event_regular_finance_revisions_v1 where id='${saved.revisionId}';`),proposal);
 const busy=request(next,3);
 await withHeldLock(`begin;select id from app.tournaments where id='${tid}'for update;select 'LOCK_HELD';`,()=>{
  assert.deepEqual(save(busy),{status:'retry_exact',code:'source_busy'});assert.equal(owner(`select app.reconcile_event_regular_finance_draft_v1('${tid}',${literal(busy)});`),null);
  assert.equal(owner(`select to_jsonb((select count(*)from app.event_regular_finance_reservations_v1 where actor_id='${actor}'and operation_id='${busy.operationId}'));`),0);
 });
 const afterBusy=save(busy);assert.equal(afterBusy.status,'event_regular_finance_draft_saved');assert.deepEqual(save(busy),afterBusy);assert.equal(count(),4);
 const acl=owner(`select jsonb_build_object('badTables',(select count(*)from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['anon','authenticated','service_role'])r where n.nspname='app'and c.relname in('event_regular_finance_reservations_v1','event_regular_finance_revisions_v1','event_regular_finance_outcomes_v1')and(not c.relrowsecurity or not c.relforcerowsecurity or has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))),'badFunctions',(select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated','service_role'])r where n.nspname='app'and p.proname in('valid_event_regular_finance_draft_v1','get_event_regular_finance_base_v1','save_event_regular_finance_draft_v1','reconcile_event_regular_finance_draft_v1')and has_function_privilege(r,p.oid,'EXECUTE')));`);assert.deepEqual(acl,{badTables:0,badFunctions:0});
 for(const role of ['anon','authenticated','service_role']){
  assert.throws(()=>q(`set role ${role};select app.save_event_regular_finance_draft_v1('${tid}',${literal(first)});`,actor,'ownerAuthenticated'),/permission denied/);
  assert.throws(()=>q(`set role ${role};select * from app.event_regular_finance_revisions_v1;`,actor,'ownerAuthenticated'),/permission denied/);
 }
 return{privateDraftOnly:true,typedHistoryNotApprovedFund:true,saveReadReplayReconcile:true,appendOnlyCorrection:true,bucketIsolation:true,rollbackAndExactRetry:true,busyThenExactRetry:true,unchangedOriginal:true,privateAcl:true,revisionCount:4,moneyMoved:false};
}
