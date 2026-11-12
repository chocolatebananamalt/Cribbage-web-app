// Explicit opt-in disposable local test runner. Never targets hosted databases.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
if(!process.argv.includes('--isolated-container'))throw Error('Explicit --isolated-container required');
const name='cribbage-0240-isolated',db='fixture_0240';
const baseline=fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump');
if(crypto.createHash('sha256').update(baseline).digest('hex')!=='e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc')throw Error('Reviewed empty baseline hash mismatch');
function run(args,input){const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',maxBuffer:64*1024*1024});if(r.status!==0)throw Error(String(r.stderr));return String(r.stdout);}
const meta=JSON.parse(run(['inspect',name]))[0];if(meta.Config.Labels['codex.fixture']!==name||meta.HostConfig.NetworkMode!=='none'||Object.keys(meta.HostConfig.PortBindings||{}).length||meta.HostConfig.Binds?.length||meta.Mounts.some(m=>m.Type==='bind')||meta.HostConfig.Privileged||meta.Config.Image!=='public.ecr.aws/supabase/postgres:17.11.0.004')throw Error('Isolation mismatch');
const sql=q=>run(['exec','-i',name,'psql','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],q);
const actor='a1310000-0000-4000-8000-000000000001',other='a1310000-0000-4000-8000-000000000006',tid='b1310000-0000-4000-8000-000000000001',eid='11310000-0000-4000-8000-000000000001',qid='a2400000-0000-4000-8000-000000000001';
const p=n=>'41310000-0000-4000-8000-'+String(n).padStart(12,'0');
const payload=note=>JSON.stringify([{winnerId:p(1),loserId:p(4),evidenceNote:'TEST ONLY semi 1'},{winnerId:p(2),loserId:p(3),evidenceNote:'TEST ONLY semi 2'},{winnerId:p(1),loserId:p(2),evidenceNote:'TEST ONLY '+note}]);
function call(who,key,version,note){return `select public.record_standard_singles_playoff_outcomes_v3('${who}','${tid}','${eid}','${qid}',${version},'${payload(note)}'::jsonb,'${key}');`;}
function concurrent(q,label){return new Promise((resolve,reject)=>{const child=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1']);let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('close',code=>code?reject(Error(err)):resolve(out.trim().split('\n').filter(x=>x.startsWith('{')).map(x=>JSON.parse(x)).at(-1)));child.stdin.end(`begin;set local lock_timeout='8s';set local statement_timeout='12s';set local request.jwt.claim.role='service_role';set local application_name='${label}';${q}commit;`);});}
async function pair(a,b){
 const blocker=spawn('docker',['--context','desktop-linux','exec','-i',name,'psql','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1']);
 let ready='';let error='';blocker.stderr.on('data',x=>error+=x);blocker.stdout.on('data',x=>ready+=x);
 blocker.stdin.write(`begin;set local statement_timeout='15s';select pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:${eid}',0));select 'BARRIER_READY';\n`);
 const until=Date.now()+6000;while(!ready.includes('BARRIER_READY')){if(Date.now()>until)throw Error('Blocker not ready '+error);await new Promise(r=>setTimeout(r,40));}
 const first=concurrent(a,'0240_race_a'),second=concurrent(b,'0240_race_b');
 let observed=false;
 try{while(Date.now()<until){const waiting=sql("select count(*) from pg_stat_activity where datname='fixture_0240' and application_name in ('0240_race_a','0240_race_b') and wait_event='advisory';").trim();if(waiting==='2'){observed=true;break;}await new Promise(r=>setTimeout(r,40));}}
 finally{blocker.stdin.end('commit;\n');}
 if(!observed){await Promise.allSettled([first,second]);throw Error('Both RPC sessions were not observed waiting inside writer');}
 return Promise.all([first,second]);
}
function setup(){
 run(['exec',name,'dropdb','-U','supabase_admin','--if-exists',db]);run(['exec',name,'createdb','-U','supabase_admin','-O','postgres','--template=template0',db]);
 run(['exec','-i',name,'pg_restore','--exit-on-error','-U','supabase_admin','-d',db],fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump'));
 for(const n of ['0237','0238','0239'])sql(fs.readFileSync('database/migrations/'+fs.readdirSync('database/migrations').find(f=>f.startsWith(n+'_')),'utf8'));
 const proposal=fs.readFileSync('docs/quality/2026-10-27-proposed-0240-playoff-outcomes-v3.sql','utf8');
 const seed=fs.readFileSync('tests/playoff-outcomes-v3.sql','utf8').split('do $$ declare actor uuid:')[0].replace('\\ir ../docs/quality/2026-10-27-proposed-0240-playoff-outcomes-v3.sql',()=>proposal);
 sql('set role postgres;'+seed+`insert into app.tournament_roles(tournament_id,profile_id,role)values('${tid}','${other}','co_director');set constraints all immediate;commit;`);
}
const key=n=>'a2400000-0000-4000-8000-'+String(n).padStart(12,'0');
const logs=[];
for(const scenario of ['competing-initial','exact-replay','changed-replay','competing-corrections']){
 setup();if(scenario==='competing-corrections')sql(`set request.jwt.claim.role='service_role';${call(actor,key(90),0,'initial')}`);
 let a,b;
 if(scenario==='competing-initial')[a,b]=await pair(call(actor,key(91),0,'a'),call(other,key(92),0,'b'));
 if(scenario==='exact-replay')[a,b]=await pair(call(actor,key(91),0,'same'),call(actor,key(91),0,'same'));
 if(scenario==='changed-replay')[a,b]=await pair(call(actor,key(91),0,'a'),call(actor,key(91),0,'b'));
 if(scenario==='competing-corrections')[a,b]=await pair(call(actor,key(91),1,'a'),call(other,key(92),1,'b'));
 const counts=JSON.parse(sql(`select json_build_object('versions',(select count(*)from app.playoff_outcome_versions_v3),'receipts',(select count(*)from app.operation_receipts where operation_type='record_standard_singles_playoff_outcomes_v3'),'conflicts',(select count(*)from app.standard_singles_playoff_result_conflicts),'audits',(select count(*)from app.audit_events where entity_type='playoff_outcome_v3'));`));
 const accepted=[a,b].filter(x=>x.status==='playoff_outcomes_recorded').length;
 if(scenario==='exact-replay'){if(JSON.stringify(a)!==JSON.stringify(b)||counts.versions!==1||counts.receipts!==1)throw Error('Exact replay conservation failed');}
 else if(scenario==='changed-replay'){if(accepted!==1||![a,b].some(x=>x.code==='idempotency_conflict')||counts.versions!==1||counts.receipts!==1||counts.conflicts!==1)throw Error('Changed replay conservation failed');}
 else {const expected=scenario==='competing-corrections'?2:1;if(accepted!==1||![a,b].some(x=>x.code==='stale_version')||counts.versions!==expected||counts.receipts!==expected+1)throw Error('Competing write conservation failed');}
 if(counts.audits!==counts.receipts+counts.conflicts)throw Error('Audit conservation failed');
 if(scenario==='competing-corrections'&&sql('select count(*) from app.playoff_outcome_versions_v3 where version=2 and supersedes_id is not null;').trim()!=='1')throw Error('Supersession failed');
 logs.push({scenario,a,b,counts});console.log(scenario,'PASS',JSON.stringify(counts));
}
fs.writeFileSync('test-results/0240-concurrency.json',JSON.stringify(logs,null,2));
