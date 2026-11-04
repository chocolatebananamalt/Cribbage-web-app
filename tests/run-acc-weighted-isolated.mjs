// Run ONLY inside the reviewed no-network/no-port/no-mount temporary container.
import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync}from'node:child_process';
import {verifySeventeenAccounting}from'./five-main-accounting-sql-acceptance.mjs';
import {verifyFiveQualifierPlayoffV4,fivePlayoffLocalSqlAdapter}from'./five-qualifier-playoff-sql-acceptance.mjs';
import {foundationV2}from'./fixtures/q-v2-foundation.mjs';
import {actor as oldActor,tid as oldTid,quote}from'./fixtures/q-review-foundation.mjs';
import {makeAccWeightedMainFixture}from'./fixtures/acc-weighted-main-foundation.mjs';
import {verifyAccWeightedSqlCalculator,verifyAccWeightedPolicyPrepublishV3,verifyAccWeightedPolicyReplayV3}from'./acc-weighted-q-sql-acceptance.mjs';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-qaccounting-local',db='fixture_qaccounting';
function docker(args,input){const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',maxBuffer:64*1024*1024});if(r.status!==0)throw Error(String(r.stderr));return String(r.stdout);}
const meta=JSON.parse(docker(['inspect',name]))[0];
if(meta.Id!==process.argv[4]||meta.State.Status!=='running'||meta.Config.Labels['codex.fixture']!==name||meta.Image!=='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706'||meta.HostConfig.NetworkMode!=='none'||Object.keys(meta.HostConfig.PortBindings??{}).length||meta.HostConfig.Binds?.length||meta.Mounts.length||meta.HostConfig.Privileged)throw Error('Disposable isolation mismatch');
const sql=(q,d='postgres')=>docker(['exec','-i',name,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',d,'-v','ON_ERROR_STOP=1'],q);
const baseline=fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump');if(crypto.createHash('sha256').update(baseline).digest('hex')!=='e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc')throw Error('Baseline mismatch');
if(sql(`select count(*)from pg_database where datname='${db}'`).trim()!=='0')throw Error('Existing database; inspect before reset');
const toc=docker(['exec','-i',name,'pg_restore','--list'],baseline);
const owners=[...new Set(toc.split('\n').filter(l=>!l.startsWith(';')).map(l=>l.trim().split(/\s+/).at(-1)).filter(x=>x?.startsWith('supabase_')||['postgres','pgbouncer'].includes(x)))];
for(const owner of [...new Set([...owners,'anon','authenticated','service_role','authenticator','dashboard_user','pgbouncer'])]){if(!/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/.test(owner))throw Error('Invalid role');sql(`do $$begin if not exists(select 1 from pg_roles where rolname='${owner}')then create role ${owner} ${owner==='postgres'?'superuser':'nologin'};end if;end$$;`);}
docker(['exec',name,'createdb','-h','/tmp','-U','supabase_admin','-O','postgres','--template=template0',db]);
try{
 docker(['exec','-i',name,'pg_restore','-h','/tmp','--exit-on-error','-U','supabase_admin','-d',db],baseline);
 for(let n=237;n<=254;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 const adapter=fivePlayoffLocalSqlAdapter(),s=adapter.sql;
 s(foundationV2({structuredSchedule:true,pool1People:Array.from({length:16},(_,i)=>i+1),pool1Fee:1000,pool1Type:'Graduated (1-in-6)'}));
 const oldWorkspace=JSON.parse(s(`select public.get_q_obligation_review_workspace_v2('${oldActor}','${oldTid}');`));
 assert.deepEqual(oldWorkspace.blockers,[]);
 const oldRequest={expectedVersion:0,sourceDigest:oldWorkspace.sourceDigest,reason:'TEST ONLY immutable historical chart review before new formula',reviewed:true};
 assert.equal(JSON.parse(s(`select public.record_q_obligation_review_v2('${oldActor}','${oldTid}',${quote(JSON.stringify(oldRequest))},'a2550000-0000-4000-8000-000000000700');`)).status,'q_obligations_recorded_v2');
 const preserve=()=>s(`select jsonb_build_object('policies',(select jsonb_agg(to_jsonb(p)order by id)from app.q_operating_policies_v2 p where tournament_id='${oldTid}'),'review',(select jsonb_agg(to_jsonb(r)order by version)from app.q_obligation_reviews_v2 r where tournament_id='${oldTid}'),'sources',app.q_obligation_sources_v2('${oldActor}','${oldTid}'),'oldWriter',pg_get_functiondef('public.save_q_operating_policy_v2(uuid,uuid,jsonb,uuid)'::regprocedure));`);
 const historical=preserve();
 const file='database/migrations/0255_acc_weighted_q_policy_v3.sql',bytes=fs.readFileSync(file);
 console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
 sql('set role postgres;'+bytes.toString('utf8'),db);
 assert.equal(preserve(),historical,'Migration changed old policies/history/source or old writer');
 assert.equal(s(`select bool_and(not has_function_privilege(r,p.oid,'EXECUTE'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated'])r where n.nspname='public'and p.proname in('save_q_operating_policy_v3','get_q_operating_reconciliation_v3');`),'t');
 assert.equal(s(`select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('save_q_operating_policy_v3','get_q_operating_reconciliation_v3')and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'and p.proconfig @> array['search_path=""']and has_function_privilege('service_role',p.oid,'EXECUTE');`),'2');
 assert.equal(s(`select bool_and(not has_function_privilege(r,p.oid,'EXECUTE'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated','service_role'])r where n.nspname='app'and p.proname in('calculate_acc_weighted_pool_v1','calculate_q_obligations_pre_acc_v3','calculate_q_obligations_with_acc_v3');`),'t');
 assert.equal(s(`select count(*)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app'and c.relname in('q_operating_policies_v2','q_obligation_reviews_v2')and c.relrowsecurity and c.relforcerowsecurity;`),'2');
 console.log('PASS new RPC service-only ACLs, postgres owners, empty search paths and private forced-RLS histories');
 const amountProof=verifyAccWeightedSqlCalculator(s);
 const f=makeAccWeightedMainFixture();s(f.setupSql);
 verifyAccWeightedPolicyPrepublishV3({sql:s,actor:f.actor,tid:f.tid,poolVersionId:f.pool(1),request:f.policyRequest});
 const foreignPool={...f.policyRequest,poolVersionId:'c2430000-0000-4000-8000-000000000001'};
 assert.equal(JSON.parse(s(`select public.save_q_operating_policy_v3('${f.actor}','${f.tid}',${quote(JSON.stringify(foreignPool))},'a2550000-0000-4000-8000-000000000701');`)).code,'pool_version_mismatch');
 const statement=`select public.save_q_operating_policy_v3('${f.actor}','${f.tid}',${quote(JSON.stringify(f.policyRequest))},'${f.policyOperationId}');`;
 const policyRace=await adapter.race([statement,statement],f.eid,'save_q_operating_policy_v3');
 assert.equal(policyRace[0].status,'q_policy_published');assert.deepEqual(policyRace[0],policyRace[1]);
 console.log('PASS observed overlapping same-operation policy requests: one immutable policy/receipt, identical result');
 s(f.publishPoliciesSql);
 const policyProof=verifyAccWeightedPolicyReplayV3({sql:s,actor:f.actor,tid:f.tid,poolVersionId:f.pool(1),request:f.policyRequest,operationId:f.policyOperationId});
 // A separate synthetic setup proves competing operation IDs cannot create
 // two policies. Its roster never receives money or starts play.
 const remap=value=>value.replaceAll('5710000','5810000').replaceAll('5730000','5830000').replaceAll('2580000','2680000').replaceAll('-balanced@test.invalid','-balanced-race@test.invalid');
 s(remap(f.setupSql));
 const otherActor=remap(f.actor),otherTid=remap(f.tid),otherEid=remap(f.eid),otherRequest=JSON.parse(remap(JSON.stringify(f.policyRequest)));
 const competing=await adapter.race([1,2].map(n=>`select public.save_q_operating_policy_v3('${otherActor}','${otherTid}',${quote(JSON.stringify(otherRequest))},'a2680000-0000-4000-8000-${String(n).padStart(12,'0')}');`),otherEid,'save_q_operating_policy_v3');
 assert.equal(competing.filter(r=>r.status==='q_policy_published').length,1);assert.equal(competing.filter(r=>r.code==='policy_frozen').length,1);
 assert.equal(s(`select count(*)from app.q_operating_policies_v2 where tournament_id='${otherTid}';`),'1');
 console.log('PASS observed overlapping different-operation publication: one policy, one frozen conflict, no collection');
 for(const phase of ['financeSql','seatingAttendanceSql','publishSql','startSql','scoreSql','finalizeSql']){
  console.log('BEGIN balanced seventeen',phase);s(f[phase]);console.log('PASS balanced seventeen',phase);
 }
 const proof=await verifyFiveQualifierPlayoffV4({...adapter,actor:f.actor,tid:f.tid,eid:f.eid});
 fs.writeFileSync('test-results/acc-weighted-operating-sql-workspace.json',s(`select public.get_q_operating_workspace_v2('${f.actor}','${f.tid}');`));
 const accountingChecks=await verifySeventeenAccounting({...adapter,fixture:f,balanced:true});
 assert.equal(preserve(),historical,'New policy workflow changed historical chart policies/review/source/writer');
 console.log('PASS historical chart policy, unpaid review, source manifest and old writer preserved byte-for-byte');
 fs.writeFileSync('test-results/acc-weighted-main-sql-result.json',JSON.stringify({status:'PASS',amountProof,policyProof,policyRace,proof,accountingChecks,historicalSha256:crypto.createHash('sha256').update(historical).digest('hex')},null,2));
}finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP disposable balanced Main database removed');}
