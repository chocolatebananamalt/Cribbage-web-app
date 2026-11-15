// PREPARED, NOT RUN. Owner-role calls with synthetic authenticated JWT subject
// test private candidate logic, NOT real public/API capability.
import assert from 'node:assert/strict';
import {qSetupPrizeWorkspace} from './fixtures/q-setup-prize-workspace.mjs';
import {createCustomPayoutIntentV1} from '../src/lib/api/custom-payout-intent-v1.ts';
import {customQDraftConcurrencyPlan} from './custom-q-draft-concurrency-plan.mjs';
import {calculateCustomGraduatedAmountsV3} from '../src/lib/results/custom-graduated-amounts-v3.ts';
const id=n=>`a2950000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const literal=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
export async function verifyCustomQDraft({q,read,withHeldLock}){
 const actor=id(1),other=id(2),tid=id(3);let operation=10;
 // Runner's exact database/socket guard precedes entry here. Pure amount-only
 // parity runs before any synthetic people/tournament writes, as owner only.
 let amountParityCases=0;
 const parity=input=>{const sql=read(`select app.calculate_custom_graduated_amounts_v3(${literal(input)});`,actor,'ownerAuthenticated');assert.deepEqual(sql,calculateCustomGraduatedAmountsV3(input));amountParityCases++;};
 for(const paidCount of [0,1,18,21])for(const ratio of [1,7,101,2147483647])for(const feeMinor of [500,1000])parity({paidCount,ratio,feeMinor});
 for(const input of [{paidCount:18,ratio:0,feeMinor:1000},{paidCount:18,ratio:2147483648,feeMinor:1000},{paidCount:18,ratio:7,feeMinor:501}])parity(input);
 q(`insert into auth.users(id,email)values('${actor}','custom-q-director@test.invalid'),('${other}','custom-q-outsider@test.invalid');insert into app.tournaments(id,director_profile_id,name,status,registration_status)values('${tid}','${actor}','TEST ONLY Custom Q Draft','draft','closed');insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${actor}','director');`);
 const owner=(sql,who=actor)=>read(sql,who,'ownerAuthenticated'); // Explicit owner execution with authenticated JWT subject, not public access.
 const asOwner=sql=>`set request.jwt.claim.role='authenticated';set request.jwt.claims='{"role":"authenticated","sub":"${actor}"}';${sql}`;
 const base=()=>owner(asOwner(`select app.get_custom_q_setup_base_v2('${tid}');`)).base;
 function envelope(){const b=base(),{revisionId,version,createdAt,...payload}=structuredClone(qSetupPrizeWorkspace(actor).current);void revisionId;void version;void createdAt;const event=payload.events[0];delete event.sourceStatus;event.qPools=[{poolTypeCode:'Graduated (1-in-7)',entryFeeCents:1000,note:'fictional'}];event.sidePools=[];return{kind:'setup-custom-payouts-v2',base:structuredClone(b),request:{expectedVersion:b.setupVersion,payload,idempotencyKey:id(operation++)},choices:[{mainClientRowId:event.clientRowId,consolationClientRowIds:[]}],customPayouts:[createCustomPayoutIntentV1('q',7,{...b,eventClientRowId:event.clientRowId,poolSlot:1})]};}
 const save=(e,who=actor)=>owner(`set request.jwt.claim.role='authenticated';set request.jwt.claims='{"role":"authenticated","sub":"${who}"}';select app.save_custom_q_setup_draft_v2('${tid}',${literal(e)});`,who);
 const counts=()=>owner(`select jsonb_build_object('revisions',(select count(*)from app.tournament_setup_revisions where tournament_id='${tid}'),'batches',(select count(*)from app.setup_custom_payout_batches_v2 where tournament_id='${tid}'),'intents',(select count(*)from app.setup_custom_payout_intents_v2 where tournament_id='${tid}'));`);
 const first=envelope(),accepted=save(first);assert.equal(accepted.status,'custom_q_setup_draft_saved');assert.equal(accepted.moneyMoved,false);assert.deepEqual(save(first),accepted);
 assert.deepEqual(owner(asOwner(`select app.reconcile_custom_q_setup_draft_v2('${tid}',${literal(first)});`)),accepted);
 assert.deepEqual(counts(),{revisions:1,batches:1,intents:1});
 assert.equal(owner(`select to_jsonb((select ratio_denominator from app.setup_custom_payout_intents_v2 where tournament_id='${tid}'));`),7);
 const historyDigest=()=>owner(`select to_jsonb(md5((select to_jsonb(b)::text from app.setup_custom_payout_batches_v2 b where id='${accepted.batchId}')));`);
 const historical=historyDigest();
 assert.equal(save({...first,request:{...first.request,payload:{...first.request.payload,city:'Changed'}}}).code,'idempotency_conflict');
 assert.equal(save(envelope(),other).code,'not_director');
 const stale=structuredClone(first);stale.request.idempotencyKey=id(operation++);assert.equal(save(stale).code,'stale_version');assert.deepEqual(save(stale),save(stale));
 const rejected=save(stale);assert.equal(owner(`select public.save_linked_tournament_setup_v1('${tid}',${literal({kind:'setup-event-links-v1',request:stale.request,choices:stale.choices})});`).code,'idempotency_conflict');assert.equal(rejected.status,'rejected');
 for(const change of [e=>e.customPayouts=[],e=>{e.customPayouts[0].source.sourceDigest='b'.repeat(64);},e=>{e.customPayouts[0].scope='side';},e=>{e.request.payload.events[0].sidePools=[{poolTypeCode:'Legacy untyped',entryFeeCents:1000,note:''}];},e=>{e.request.payload.events[0].qPools[0].poolTypeCode='\u00a0Graduated (1-in-7)\uFEFF';e.customPayouts=[];}]){const e=structuredClone(envelope());change(e);assert.equal(save(e).status,'rejected');}
 for(const [key,value]of [['tournamentId',id(999)],['setupRevisionId',id(998)],['setupVersion',999],['eventClientRowId',id(997)],['poolSlot',2]]){
  const e=structuredClone(envelope());e.customPayouts[0].source[key]=value;const rejected=save(e);assert.equal(rejected.status,'rejected');assert.deepEqual(save(e),rejected);
  assert.equal(owner(`select public.save_linked_tournament_setup_v1('${tid}',${literal({kind:'setup-event-links-v1',request:e.request,choices:e.choices})});`).code,'idempotency_conflict');
 }
 // Deliberate owner-only test hook after core save: failure must roll back
 // core revision, receipt and journal, leaving no terminal reservation/outcome.
 const failing=envelope(),op=failing.request.idempotencyKey,before=counts();
 q(`create function app.fixture_custom_q_fail()returns trigger language plpgsql as $$begin raise exception 'fixture injected post-core failure';end$$;create trigger fixture_custom_q_fail before insert on app.setup_custom_payout_batches_v2 for each row execute function app.fixture_custom_q_fail();`);
 try{assert.throws(()=>save(failing),/fixture injected post-core failure/);}finally{q('drop trigger fixture_custom_q_fail on app.setup_custom_payout_batches_v2;drop function app.fixture_custom_q_fail();');}
 assert.deepEqual(counts(),before);assert.equal(owner(`select to_jsonb((select count(*)from app.setup_custom_q_save_reservations_v2 where actor_id='${actor}'and operation_id='${op}'));`),0);assert.equal(owner(asOwner(`select app.reconcile_custom_q_setup_draft_v2('${tid}',${literal(failing)});`)),null);
 const recovered=save(failing);assert.equal(recovered.status,'custom_q_setup_draft_saved');const recoveredCounts=counts();assert.deepEqual(save(failing),recovered);assert.deepEqual(counts(),recoveredCounts);assert.equal(historyDigest(),historical);
 assert.equal(owner(`select to_jsonb((select count(*)from app.operation_receipts where actor_profile_id='${actor}'and client_operation_id='${op}'));`),1);
 const acl=owner(`select jsonb_agg(jsonb_build_object('role',r,'execute',has_function_privilege(r,'app.save_custom_q_setup_draft_v2(uuid,jsonb)','EXECUTE'),'select',has_table_privilege(r,'app.setup_custom_q_save_reservations_v2','SELECT'),'insert',has_table_privilege(r,'app.setup_custom_payout_batches_v2','INSERT')))from unnest(array['anon','authenticated','service_role'])r;`);
 for(const row of acl){assert.equal(row.execute,false);assert.equal(row.select,false);assert.equal(row.insert,false);}
 const privateAccess=owner(`select jsonb_build_object('badTables',(select count(*)from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['anon','authenticated','service_role'])r where n.nspname='app'and c.relname in('setup_custom_q_save_reservations_v2','setup_custom_q_save_outcomes_v2','setup_custom_payout_batches_v2','setup_custom_payout_intents_v2')and(not c.relrowsecurity or not c.relforcerowsecurity or has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))),'badFunctions',(select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated','service_role'])r where n.nspname='app'and p.proname in('get_custom_q_setup_base_v2','save_custom_q_setup_draft_v2','reconcile_custom_q_setup_draft_v2','custom_payout_classification_text_v2')and(has_function_privilege(r,p.oid,'EXECUTE')or pg_get_userbyid(p.proowner)<>'postgres'or not coalesce(p.proconfig@>array['search_path=""'],false))));`);
 assert.deepEqual(privateAccess,{badTables:0,badFunctions:0});
 for(const role of ['anon','authenticated','service_role'])assert.throws(()=>q(`set role ${role};select app.save_custom_q_setup_draft_v2('${tid}',${literal(first)});`,actor,'ownerAuthenticated'),/permission denied/);
 const isolation=owner(`begin isolation level repeatable read;select app.save_custom_q_setup_draft_v2('${tid}',${literal(envelope())});rollback;`);assert.deepEqual(isolation,{status:'retry_exact',code:'isolation_not_supported'});
 assert.equal(typeof withHeldLock,'function','Concrete concurrency runner required');
 for(let index=0;index<3;index++){
  const e=envelope(),operationId=e.request.idempotencyKey,plan=customQDraftConcurrencyPlan({actorId:actor,tournamentId:tid,operationId,envelopeLiteral:literal(e)})[index];
  await withHeldLock(plan.connectionA,()=>{
   assert.deepEqual(save(e),plan.expected);
   assert.equal(owner(`select to_jsonb((select count(*)from app.setup_custom_q_save_reservations_v2 where actor_id='${actor}'and operation_id='${operationId}')+(select count(*)from app.setup_custom_q_save_outcomes_v2 where actor_id='${actor}'and operation_id='${operationId}')+(select count(*)from app.operation_receipts where actor_profile_id='${actor}'and client_operation_id='${operationId}'));`),0);
   assert.equal(owner(asOwner(`select app.reconcile_custom_q_setup_draft_v2('${tid}',${literal(e)});`)),null);
  });
  const after=save(e);assert.equal(after.status,'custom_q_setup_draft_saved');const savedCounts=counts();assert.deepEqual(save(e),after);assert.deepEqual(counts(),savedCounts);
 }
 // Old endpoint must not erase a latest-revision custom journal accidentally.
 const oldAttempt=envelope(),projected={kind:'setup-event-links-v1',request:oldAttempt.request,choices:oldAttempt.choices},beforeLegacy=counts();
 assert.equal(owner(`select public.save_linked_tournament_setup_v1('${tid}',${literal(projected)});`).status,'rejected');assert.deepEqual(counts(),beforeLegacy);
 // Empty clears must carry the posted base pin even without per-pool intents.
 for(const field of ['sourceDigest','setupRevisionId']){const badClear=envelope();badClear.customPayouts=[];badClear.request.payload.events[0].qPools[0].poolTypeCode='Equal';badClear.base[field]=field==='sourceDigest'?'f'.repeat(64):id(999);const beforeBadClear=counts();const rejectedClear=save(badClear);assert.equal(rejectedClear.status,'rejected');assert.equal(rejectedClear.code,'source_changed');assert.deepEqual(counts(),beforeBadClear);assert.deepEqual(save(badClear),rejectedClear);}
 // Explicit full-protocol clearing creates an empty immutable journal marker.
 const clear=envelope();clear.customPayouts=[];clear.request.payload.events[0].qPools[0].poolTypeCode='Equal';const cleared=save(clear);assert.equal(cleared.status,'custom_q_setup_draft_saved');assert.deepEqual(save(clear),cleared);
 assert.equal(owner(`select to_jsonb((select count(*)from app.setup_custom_payout_intents_v2 where batch_id='${cleared.batchId}'));`),0);
 const afterClear=envelope();afterClear.customPayouts=[];afterClear.request.payload.events[0].qPools[0].poolTypeCode='Graduated (1-in-6)';const oldAllowed=owner(`select public.save_linked_tournament_setup_v1('${tid}',${literal({kind:'setup-event-links-v1',request:afterClear.request,choices:afterClear.choices})});`);assert.equal(oldAllowed.status,'linked_setup_saved');
 assert.equal(historyDigest(),historical);
 return{preparedOwnerOnlyCandidate:true,publicCapability:false,amountParityCases,amountParityScope:'pure amounts only; not eligibility/accounting',validQ7:true,fullReplay:true,reconcile:true,staleAndConflict:true,missingAndWhitespaceCoverage:true,postCoreRollbackAndExactRetry:true,privateAclDenied:true,historicalDigestUnchanged:true,concurrencyBarriers:3,hostedWrites:false};
}
