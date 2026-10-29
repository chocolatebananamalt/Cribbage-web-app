import assert from 'node:assert/strict';import fs from 'node:fs';import {spawn,spawnSync} from 'node:child_process';
import {actor,tid,uuid,quote} from './fixtures/q-review-foundation.mjs';
const args=['--context','desktop-linux','exec','-i','cribbage-qv2-local','psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d','fixture_qv2','-v','ON_ERROR_STOP=1'];
function sql(q){const r=spawnSync('docker',args,{input:q,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();}
function start(q){const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out.trim()):reject(Error(err)));});child.stdin.end(q);return {done,out:()=>out};}
async function until(check,ms=2000){for(const deadline=Date.now()+ms;Date.now()<deadline;){if(check())return;await new Promise(r=>setTimeout(r,25));}throw Error('Expected overlapping lock evidence not observed');}
const seed=fs.readFileSync('tests/q-pool-membership-seed.sql','utf8').replace("'Equal',500","'Equal (Pays All Equally)',500").replace("'Graduated',1000","'Equal (Pays All Equally)',1000");
sql('begin;set role postgres;'+seed+'commit;');
const common={poolVersionId:uuid('c243',1),method:'equal-paid-qualifiers-v1',disclosureReference:'TEST ONLY concurrent legacy/new',disclosed:true};
const modern={action:'publish',...common,method:'equal-paid-playoff-qualifiers-v2',ratio:null,scheduleId:null};
const hold=start(`begin;select 1 from app.tournaments where id='${tid}' for no key update;select 'LOCKED';select pg_sleep(3);commit;`);await until(()=>hold.out().includes('LOCKED'));
const a=start(`set application_name='qv2-race-a';select public.publish_q_pool_policy_v1('${actor}','${tid}',${quote(JSON.stringify(common))},'${uuid('e246',1)}');`);
const b=start(`set application_name='qv2-race-b';select public.save_q_operating_policy_v2('${actor}','${tid}',${quote(JSON.stringify(modern))},'${uuid('e246',2)}');`);
let observed=false;try{await until(()=>sql("select count(*) from pg_stat_activity where application_name in('qv2-race-a','qv2-race-b') and wait_event_type='Lock';")==='2');observed=true;}finally{await hold.done;}
const results=(await Promise.all([a.done,b.done])).map(JSON.parse);assert.equal(observed,true);assert.equal(results.filter(r=>r.status==='q_policy_published').length,1);assert.equal(results.filter(r=>r.code==='policy_frozen'||r.code==='collection_or_consent_already_started').length,1);
assert.equal(sql(`select (select count(*) from app.q_pool_policies_v1)+(select count(*) from app.q_operating_policies_v2);`),'1');
// Even the other pool cannot introduce a mixed policy domain after the winner.
const winnerLegacy=sql('select count(*) from app.q_pool_policies_v1;')==='1';
const opposite=winnerLegacy?`public.save_q_operating_policy_v2('${actor}','${tid}',${quote(JSON.stringify({...modern,poolVersionId:uuid('c243',2)}))},'${uuid('e246',3)}')`:`public.publish_q_pool_policy_v1('${actor}','${tid}',${quote(JSON.stringify({...common,poolVersionId:uuid('c243',2)}))},'${uuid('e246',3)}')`;
const crossPool=JSON.parse(sql('select '+opposite+';'));assert.equal(crossPool.status,'rejected');assert.ok(['policy_frozen','collection_or_consent_already_started'].includes(crossPool.code));
// Deterministically exercise v2-first followed by legacy publication in OTHER pool.
const seed2=seed.replaceAll('1310000','1320000').replaceAll('2430000','2440000').replaceAll('@test.invalid','-race2@test.invalid');
sql('begin;set role postgres;'+seed2+'commit;');
const actor2=actor.replace('1310000','1320000'),tid2=tid.replace('1310000','1320000');
const v2First=JSON.parse(sql(`select public.save_q_operating_policy_v2('${actor2}','${tid2}',${quote(JSON.stringify({...modern,poolVersionId:uuid('c244',1)}))},'${uuid('e246',5)}');`));assert.equal(v2First.status,'q_policy_published');
const legacyOtherPool=JSON.parse(sql(`select public.publish_q_pool_policy_v1('${actor2}','${tid2}',${quote(JSON.stringify({...common,poolVersionId:uuid('c244',2)}))},'${uuid('e246',6)}');`));assert.equal(legacyOtherPool.code,'policy_frozen');
const countBefore=sql('select count(*) from app.operation_receipts;');
const revoke=start(`begin;delete from app.tournament_roles where tournament_id='${tid}' and profile_id='${actor}' and role='director';select 'REVOKING';select pg_sleep(3);commit;`);await until(()=>revoke.out().includes('REVOKING'));
const writer=start(`set application_name='qv2-role-race';select coalesce(public.save_q_operating_policy_v2('${actor}','${tid}',${quote(JSON.stringify(modern))},'${uuid('e246',4)}')::text,'NULL');`);
try{await until(()=>sql("select count(*) from pg_stat_activity where application_name='qv2-role-race' and wait_event_type='Lock';")==='1');}finally{await revoke.done;}
assert.equal(await writer.done,'NULL');assert.equal(sql('select count(*) from app.operation_receipts;'),countBefore);
const evidence={observedOverlappingPublishWaiters:2,results,records:1,crossPoolRejection:crossPool.code,v2FirstLegacyOtherPool:legacyOtherPool.code,observedRoleWaiter:true,revokedWriter:'NULL/no operation receipt'};
fs.writeFileSync('test-results/q-operating-race-result.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
