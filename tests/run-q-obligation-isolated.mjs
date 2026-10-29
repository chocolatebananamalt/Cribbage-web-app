// Explicit disposable local target. No network connections or host mounts.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!(/^[a-f0-9]{64}$/).test(process.argv[4])) throw Error('Exact --isolated-container --container-id <64 lowercase hex> required');
const container='cribbage-qreview-local',database='fixture_qreview',expectedContainerId=process.argv[4];
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
for(const prefix of ['0237','0238','0239','0240','0241','0242','0243','0244','0245']){
 const file=fs.readdirSync('database/migrations').find(n=>n.startsWith(prefix+'_'));if(!file)throw Error('Missing local prerequisite '+prefix);
 sql('set role postgres;\n'+fs.readFileSync('database/migrations/'+file,'utf8'));
}

const {foundation}=await import('./fixtures/q-review-foundation.mjs');
try {
 sql(foundation()); console.log('PASS Q_REVIEW_FOUNDATION_READY: 96 games and real qualification, synthetic local evidence');
 for(const script of ['q-obligation-sql-acceptance.mjs','q-obligation-race.mjs','q-obligation-score-stale.mjs','q-obligation-security.mjs']) {
  const run=spawnSync(process.execPath,['--experimental-strip-types','tests/'+script],{encoding:'utf8',env:process.env});
  if(run.status!==0)throw Error(script+' failed: '+run.stderr+' '+run.stdout);
  console.log('PASS '+script);
 }
}finally{
 docker(['exec',container,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',database]);
 console.log('CLEANUP disposable fixture database removed');
}
