// For the exact isolated fixture only; never a shared database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {foundation,actor,tid,eid,uuid,quote} from './fixtures/q-review-foundation.mjs';
import {isQOperatingWorkspaceV2,isQOperatingResultV2} from '../src/lib/api/q-operating-schedules.ts';
const sql=q=>{const r=spawnSync('docker',['--context','desktop-linux','exec','-i','cribbage-qv2-local','psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d','fixture_qv2','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
const checks=[];
// Build the same complete synthetic verified-game fixture through v2 disclosure.
const games=JSON.parse(fs.readFileSync('tests/fixtures/q-review-games.json','utf8')).matches;
const adjusted=games.map((m,i)=>i===games.findIndex(m=>m.winner===4)?{...m,margin:m.margin-10}:m);
let seed=foundation({games:adjusted,pool1People:[1,2,3,4,16],pool1Fee:1000,pool1Type:'Graduated (1-in-6)'});
for(let i=1;i<=2;i++){
 const original={poolVersionId:uuid('c243',i),method:'equal-paid-qualifiers-v1',disclosureReference:'TEST ONLY reviewed policy '+i,disclosed:true};
 const replacement={action:'publish',poolVersionId:uuid('c243',i),method:i===1?'graduated-paid-card-rank-v2':'equal-paid-playoff-qualifiers-v2',ratio:i===1?6:null,scheduleId:i===1?'friend-q-p2-10-6-v1':null,disclosureReference:original.disclosureReference,disclosed:true};
 assert.ok(seed.includes(quote(JSON.stringify(original))));seed=seed.replace(quote(JSON.stringify(original)),quote(JSON.stringify(replacement)));
}
seed=seed.replaceAll('public.publish_q_pool_policy_v1','public.save_q_operating_policy_v2').replaceAll('app.q_pool_policies_v1','app.q_operating_policies_v2');
sql(seed);
const workspace=()=>JSON.parse(sql(`select public.get_q_operating_workspace_v2('${actor}','${tid}');`));
let w=workspace();assert.ok(isQOperatingWorkspaceV2(w,tid));assert.equal(w.cards.length,16);assert.equal(w.policies.length,2);assert.deepEqual(w.blockers,[]);assert.equal(w.cards.filter(c=>c.qualified).length,4);
assert.equal(sql(`select count(*) from app.q_pool_policies_v1 where tournament_id='${tid}';`),'0');
assert.equal(workspace().sourceDigest,w.sourceDigest);checks.push('real complete source includes all 16 cards, four qualifiers and v2 disclosure; stable source digest');
const call=(r,n,who=actor)=>JSON.parse(sql(`select public.save_q_operating_policy_v2('${who}','${tid}',${quote(JSON.stringify(r))},'${uuid('f246',n)}');`)||'null');
const req={action:'publish',poolVersionId:uuid('c243',1),method:'equal-paid-playoff-qualifiers-v2',ratio:null,scheduleId:null,disclosureReference:'TEST ONLY repeated frozen policy',disclosed:true};
let result=call(req,1);assert.ok(isQOperatingResultV2(result));assert.equal(result.code,'policy_frozen');assert.deepEqual(call(req,1),result);assert.equal(call({...req,disclosureReference:'changed'},1).code,'idempotency_conflict');
assert.equal(call(req,2,'a1310000-0000-4000-8000-000000000006'),null);
assert.equal(JSON.parse(sql(`select public.get_q_operating_reconciliation_v2('${actor}','${tid}','${uuid('f246',1)}');`)).result.code,'policy_frozen');
checks.push('frozen policy, exact replay, changed replay, co-director denial and actor-scoped reconciliation');
const cut={action:'cut',poolVersionId:uuid('c243',1),expectedSourceDigest:'0'.repeat(64),participantIdsLowFirst:[uuid('f243',1),uuid('f243',2)],reason:'TEST ONLY observed physical cut'};
assert.equal(call(cut,3).code,'stale_source');assert.equal(call({...cut,poolVersionId:uuid('c243',2),expectedSourceDigest:w.sourceDigest},4).code,'policy_required');
assert.equal(call({...cut,participantIdsLowFirst:null},5).code,'invalid_request');checks.push('stale/malformed cut and equal-method cut rejection');
assert.equal(sql(`select count(*) from app.q_cut_attestations_v2;`),'0');
const observed={...cut,expectedSourceDigest:w.sourceDigest,participantIdsLowFirst:[uuid('f243',4),uuid('f243',3)]};
const saved=call(observed,6);assert.equal(saved.status,'q_cut_recorded');assert.deepEqual(call(observed,6),saved);
assert.equal(call({...observed,participantIdsLowFirst:[...observed.participantIdsLowFirst].reverse()},7).code,'cut_already_recorded');
assert.equal(workspace().cuts.length,1);assert.equal(workspace().sourceDigest,w.sourceDigest);
checks.push('real numeric Q tie distinct from playoff net order: one immutable source-bound cut, replay and conflicting-order rejection');
assert.equal(sql(`select count(*) from information_schema.role_table_grants where table_schema='app' and table_name in('q_operating_policies_v2','q_cut_attestations_v2') and grantee in('anon','authenticated','service_role');`),'0');
assert.equal(sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('get_q_operating_workspace_v2','save_q_operating_policy_v2','get_q_operating_reconciliation_v2') and has_function_privilege('authenticated',p.oid,'EXECUTE');`),'0');
assert.equal(sql(`select count(*) from app.q_obligation_reviews_v1;`),'0');
sql(`begin;do $$begin begin update app.q_operating_policies_v2 set disclosure_reference='bad';raise exception 'mutation unexpectedly allowed';exception when raise_exception then if sqlerrm='mutation unexpectedly allowed' then raise;end if;end;end$$;rollback;`);
checks.push('private table/service-only RPC access, immutable policy and no obligation/payment-state writer');
// A source-history change invalidates old cut tokens even if amounts remain equal.
const before=w.sourceDigest;sql(`begin;set role postgres;insert into app.q_pool_allocation_versions_v1(tournament_id,event_id,roster_entry_id,version,membership_version_id,receipt_id,obligation_version,setup_event_version_id,request,actor_id,operation_receipt_id)select tournament_id,event_id,roster_entry_id,version+1,membership_version_id,receipt_id,obligation_version,setup_event_version_id,request,actor_id,operation_receipt_id from app.q_pool_allocation_versions_v1 where roster_entry_id='${uuid('d243',1)}' order by version desc limit 1;commit;`);
w=workspace();assert.notEqual(w.sourceDigest,before);assert.equal(w.cuts.length,0);checks.push('allocation history revision invalidates exact source token/cut while preserving immutable history');
fs.writeFileSync('test-results/q-operating-sql-result.json',JSON.stringify({checks,eventId:eid,cards:w.cards.length,policies:w.policies.length},null,2));console.log(JSON.stringify({checks}));
