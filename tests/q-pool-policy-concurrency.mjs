// Explicit disposable local target. No network connections or host mounts.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!(/^[a-f0-9]{64}$/).test(process.argv[4])) throw Error('Exact --isolated-container --container-id <64 lowercase hex> required');
const container='cribbage-qpolicy-local',database='fixture_qpolicy_template',expectedContainerId=process.argv[4];
function docker(args,input){const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',maxBuffer:64*1024*1024});if(r.status!==0)throw Error(String(r.stderr));return String(r.stdout);}
const meta=JSON.parse(docker(['inspect',container]))[0];
if(meta.Id!==expectedContainerId||meta.State.Status!=='running'||meta.Config.Labels['codex.fixture']!==container||meta.Image!=='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706'||meta.HostConfig.NetworkMode!=='none'||Object.keys(meta.HostConfig.PortBindings??{}).length||meta.HostConfig.Binds?.length||meta.Mounts.length||meta.HostConfig.Privileged)throw Error('Disposable isolation mismatch');
const sql=(query,db=database)=>docker(['exec','-i',container,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],query);
const baseline=fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump');
if(crypto.createHash('sha256').update(baseline).digest('hex')!=='e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc')throw Error('Empty baseline hash mismatch');
const exists=sql(`select count(*) from pg_database where datname='${database}';`,'postgres').trim()==='1';
if(exists){const initialized=sql("select to_regclass('app.tournaments') is not null;").trim()==='t';if(initialized&&sql('select (select count(*) from auth.users)+(select count(*) from app.tournaments);').trim()!=='0')throw Error('Existing fixture not empty; inspect before reset');}
const toc=docker(['exec','-i',container,'pg_restore','--list'],baseline);
const owners=[...new Set(toc.split('\n').filter(l=>!l.startsWith(';')).map(l=>l.trim().split(/\s+/).at(-1)).filter(x=>x?.startsWith('supabase_')||['postgres','pgbouncer'].includes(x)))];
for(const owner of [...new Set([...owners,'anon','authenticated','service_role','authenticator','dashboard_user','pgbouncer'])]){if(!/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/.test(owner))throw Error('Invalid role');sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='${owner}') then create role ${owner} ${owner==='postgres'?'superuser':'nologin'};end if;end $$;`,'postgres');}
docker(['exec',container,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',database]);
docker(['exec',container,'createdb','-h','/tmp','-U','supabase_admin','-O','postgres','--template=template0',database]);
docker(['exec','-i',container,'pg_restore','-h','/tmp','--exit-on-error','-U','supabase_admin','-d',database],baseline);
for(const prefix of ['0237','0238','0239','0240','0241','0242','0243','0244']){
 const file=fs.readdirSync('database/migrations').find(n=>n.startsWith(prefix+'_'));if(!file)throw Error('Missing local prerequisite '+prefix);
 sql('set role postgres;\n'+fs.readFileSync('database/migrations/'+file,'utf8'));
}
const actor='a1310000-0000-4000-8000-000000000001',tid='b1310000-0000-4000-8000-000000000001',rid='d2430000-0000-4000-8000-000000000001',pool='c2430000-0000-4000-8000-000000000001';
const policy={poolVersionId:pool,method:'equal-paid-qualifiers-v1',disclosureReference:'TEST ONLY race flyer',disclosed:true};
const pub=(key,body=policy)=>`select public.publish_q_pool_policy_v1('${actor}','${tid}','${JSON.stringify(body)}','${key}');`;
const member={action:'membership',rosterEntryId:rid,expectedVersion:0,correction:false,reason:'TEST ONLY election race',pools:[{poolVersionId:pool,elected:true,consentReference:'legacy unbound consent'},{poolVersionId:'c2430000-0000-4000-8000-000000000002',elected:false,consentReference:''}]};
const elect=key=>`select public.save_q_pool_membership_v1('${actor}','${tid}','${JSON.stringify(member)}','${key}');`;
const pay=key=>`select set_config('request.jwt.claim.sub','${actor}',false);select public.record_manual_roster_payment('${tid}','${rid}',0,3500,'USD','cash',now(),'TEST ONLY race receipt','${key}');`;
function session(db,q,label){const child=spawn('docker',['--context','desktop-linux','exec','-i',container,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});let out='',err='',signal;const held=new Promise(r=>signal=r);child.stdout.on('data',x=>{out+=x;if(out.includes('LOCK_HELD'))signal();});child.stderr.on('data',x=>err+=x);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(out.trim()):reject(Error(label+': '+err)));});child.stdin.end(`set role postgres;set application_name='${label}';set statement_timeout='20s';\n`+q);return{held,done};}
async function overlap(db,queries,tag){
 const hold=session(db,`begin;select id from app.tournaments where id='${tid}' for update;select 'LOCK_HELD';select pg_sleep(6);commit;`,tag+'_hold');
 await Promise.race([hold.held,hold.done.then(()=>{throw Error('holder exited too soon');})]);
 const attempts=[session(db,queries[0],tag+'_0')];
 for(let i=0;i<25;i++){if(Number(sql(`select count(*) from pg_stat_activity where datname='${db}' and application_name='${tag}_0' and wait_event_type='Lock';`,'postgres'))===1)break;if(i===24)throw Error('first lock not observed');await new Promise(r=>setTimeout(r,70));}
 attempts.push(session(db,queries[1],tag+'_1'));
 let waiting=0;for(let i=0;i<25;i++){waiting=Number(sql(`select count(*) from pg_stat_activity where datname='${db}' and application_name in('${tag}_0','${tag}_1') and wait_event_type='Lock';`,'postgres'));if(waiting===2)break;await new Promise(r=>setTimeout(r,70));}assert.equal(waiting,2,'Both independent calls actually overlap');
 const results=await Promise.all(attempts.map(s=>s.done));await hold.done;
 return results.map(s=>JSON.parse(s.split('\n').at(-1)));
}
const scenarios=[
 ['same_policy',[pub('02440000-0000-4000-8000-000000000101'),pub('02440000-0000-4000-8000-000000000101')],r=>{assert.deepEqual(r[0],r[1]);assert.equal(r[0].status,'q_policy_published');}],
 ['different_policy',[pub('02440000-0000-4000-8000-000000000102'),pub('02440000-0000-4000-8000-000000000103')],r=>{assert.equal(r[0].status,'q_policy_published');assert.equal(r[1].code,'policy_frozen');}],
 ['receipt_first',[pay('02440000-0000-4000-8000-000000000104'),pub('02440000-0000-4000-8000-000000000105')],r=>{assert.equal(r[0].status,'payment_recorded');assert.equal(r[1].code,'collection_or_consent_already_started');}],
 ['policy_first',[pub('02440000-0000-4000-8000-000000000106'),pay('02440000-0000-4000-8000-000000000107')],r=>{assert.equal(r[0].status,'q_policy_published');assert.equal(r[1].status,'rejected');}],
 ['election_first',[elect('02440000-0000-4000-8000-000000000108'),pub('02440000-0000-4000-8000-000000000109')],r=>{assert.equal(r[0].status,'q_pool_saved');assert.equal(r[1].code,'collection_or_consent_already_started');}],
 ['policy_then_old_election',[pub('02440000-0000-4000-8000-000000000110'),elect('02440000-0000-4000-8000-000000000111')],r=>{assert.equal(r[0].status,'q_policy_published');assert.equal(r[1].status,'rejected');}],
];
try {
 for(let i=0;i<scenarios.length;i++){
  const [tag,queries,check]=scenarios[i],db=`fixture_qpolicy_race_${i}`;
  assert.equal(sql(`select count(*) from pg_database where datname='${db}';`,'postgres').trim(),'0','Inspect existing uncertain database first');
  docker(['exec',container,'createdb','-h','/tmp','-U','supabase_admin','-O','postgres','--template='+database,db]);
  try{sql('begin;'+fs.readFileSync('tests/q-pool-membership-seed.sql','utf8').replace("'Equal',500","'Equal (Pays All Equally)',500")+'\ncommit;',db);const r=await overlap(db,queries,'qp_'+i);check(r);assert.ok(Number(sql('select count(*) from app.q_pool_policies_v1;',db))<=1);console.log(tag+': actual overlap passed');}
  finally{docker(['exec',container,'dropdb','-h','/tmp','-U','supabase_admin',db]);}
 }
 console.log('Q_POLICY_SIX_REAL_OVERLAPS_PASSED');
} finally {docker(['exec',container,'dropdb','-h','/tmp','-U','supabase_admin',database]);console.log('All task race/template databases removed.');}
