// Explicit disposable local target. No network connections or host mounts.
import fs from 'node:fs';
import {isQPreviewSources} from '../src/lib/results/q-pool-preview.ts';
import {previewQPools} from '../src/lib/results/q-pool-preview.ts';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!(/^[a-f0-9]{64}$/).test(process.argv[4])) throw Error('Exact --isolated-container --container-id <64 lowercase hex> required');
const container='cribbage-qpolicy-local',database='fixture_qpolicy',expectedContainerId=process.argv[4];
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
const fixture=fs.readFileSync('tests/q-pool-policy-v1.sql','utf8');
if(!/rollback;\s*$/.test(fixture))throw Error('Rollback fixture required');
const seed=fs.readFileSync('tests/q-pool-membership-seed.sql','utf8').replace("'Equal',500","'Equal (Pays All Equally)',500");
let output;
try {
 output=sql('set role postgres;\n'+fixture.replace('\\ir q-pool-membership-seed.sql',()=>seed));
 const rows=output.split('\n').filter(x=>x.startsWith('Q_POLICY_CODEC|')).map(x=>JSON.parse(x.slice('Q_POLICY_CODEC|'.length)));
 if(!output.includes('Q_POLICY_LOCAL_PASSED')||rows.length!==3||!rows.every(x=>isQPreviewSources(x,'b1310000-0000-4000-8000-000000000001')))throw Error('SQL acceptance/actual TS source codec failed');
 const first=previewQPools(rows[0])[0],refund=previewQPools(rows[1])[0],last=previewQPools(rows[2])[0];
 if(first.status!=='awards_preview'||first.fundMinor!==500||first.awards.length!==1||first.awards[0].amountMinor!==500||refund.status!=='refund_obligations_preview'||refund.refundObligations[0]?.amountMinor!==500||last.status!=='blocked'||!last.blockers.includes('partial_or_stale_contribution'))throw Error('SQL-to-calculator source invalidation failed');
 console.log('Q policy SQL + actual source codec/calculator: awards, changed qualification/refund obligations and void/stale states passed.');
 fs.writeFileSync('test-results/q-pool-policy-isolated.log',output);
} finally {
 console.log('Disposable fixture rows before database cleanup:',sql('select (select count(*) from auth.users),(select count(*) from app.tournaments);').trim());
 docker(['exec',container,'dropdb','-h','/tmp','-U','supabase_admin',database]);
 console.log('Owned disposable database removed:',sql(`select count(*) from pg_database where datname='${database}';`,'postgres').trim()==='0');
}
