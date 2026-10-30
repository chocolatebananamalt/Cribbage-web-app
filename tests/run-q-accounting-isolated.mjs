// Run ONLY inside the reviewed no-network/no-port/no-mount temporary container.
import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync}from'node:child_process';
import assert from 'node:assert/strict';import {tid}from'./fixtures/q-review-foundation.mjs';
import {isQReviewV2Workspace}from'../src/lib/api/q-obligation-review-v2.ts';
import {isQAccountingWorkspace,isQAccountingResult,qAccountingResultMatches}from'../src/lib/api/q-accounting-v6.ts';
import {isPlayoffOutcomeWorkspace}from'../src/lib/api/playoff-outcome.ts';
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
 const functionMetadata=name=>JSON.parse(sql(`select jsonb_build_object('oid',p.oid::text,'body',p.prosrc,'acl',p.proacl::text,'owner',p.proowner::text,'config',p.proconfig,'arguments',p.proargnames,'volatility',p.provolatile,'definer',p.prosecdef)from pg_proc p where p.oid='${name}(uuid,uuid)'::regprocedure;`,db));
 let beforeBasis;
 for(let n=237;n<=249;n++){
  const f=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!f)throw Error('Missing migration '+n);
  if(n===249)beforeBasis=functionMetadata('app.event_prize_schedule_financial_basis_v1');
  sql('set role postgres;\n'+fs.readFileSync('database/migrations/'+f,'utf8'),db);
 }
 const afterBasis=functionMetadata('app.event_prize_schedule_financial_basis_v1'),cloneBasis=functionMetadata('app.event_prize_schedule_financial_basis_pre_q_v6');
 assert.equal(afterBasis.oid,beforeBasis.oid,'Original financial helper OID/dependencies changed');
 const {oid:oldOid,...oldMetadata}=beforeBasis,{oid:cloneOid,...cloneMetadata}=cloneBasis;
 assert.deepEqual(cloneMetadata,oldMetadata,'Preserved no-Q helper body/ACL/owner/config changed');
 fs.writeFileSync('test-results/q-accounting-legacy-helper-preservation.json',JSON.stringify({status:'PASS',originalOid:oldOid,preservedOid:afterBasis.oid,cloneOid,bodySha256:crypto.createHash('sha256').update(beforeBasis.body).digest('hex'),bodyAclOwnerConfigPreserved:true},null,2));
 console.log('PASS original financial helper OID retained and no-Q body/ACL/owner/config cloned exactly');
 const env={...process.env,QV2_CONTAINER:name,QV2_DATABASE:db};
 const bridgeEnv={...env,Q_BRIDGE_CONTAINER:name,Q_BRIDGE_DATABASE:db};
 for(const stage of ['--before','--after']){
  if(stage==='--after'){
   const bytes=fs.readFileSync('database/migrations/0250_qualification_playoff_source_bridge_v1.sql');
   console.log('APPLY LOCAL ONLY 0250',bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
   sql('set role postgres;\n'+bytes.toString('utf8'),db);
  }
  const proof=spawnSync(process.execPath,['--experimental-strip-types','tests/qualification-playoff-bridge-sql.mjs',stage],{encoding:'utf8',env:bridgeEnv,maxBuffer:16*1024*1024});
  if(proof.status!==0)throw Error(proof.stderr+'\n'+proof.stdout);console.log(proof.stdout);
 }
 const tieBridge=JSON.parse(fs.readFileSync('test-results/qualification-playoff-bridge-api-contract.json','utf8'));
 assert.ok(isPlayoffOutcomeWorkspace(tieBridge.playoffWorkspace,tieBridge.qualification.tournamentId,tieBridge.qualification.eventId),'Actual resolved-tie playoff workspace violates app contract');
 assert.ok(isQAccountingWorkspace(tieBridge.accountingWorkspace,tieBridge.qualification.tournamentId,tieBridge.qualification.eventId),'Actual resolved-tie accounting workspace violates app contract');
 const qualifyContract=spawnSync(process.execPath,['--conditions=react-server','--experimental-strip-types','--input-type=module','-e',"import fs from 'node:fs';import assert from 'node:assert/strict';import {isQualificationResult}from'./src/lib/api/qualification-finalization.ts';const c=JSON.parse(fs.readFileSync('test-results/qualification-playoff-bridge-api-contract.json','utf8'));for(const q of[c.qualification,c.cutoffQualification])assert.ok(isQualificationResult(q,q.tournamentId,q.eventId));console.log('PASS actual seed/cutoff tied qualification results preserve raw numeric ranks and satisfy strict app contract');"],{encoding:'utf8'});
 if(qualifyContract.status!==0)throw Error(qualifyContract.stderr);console.log(qualifyContract.stdout);
 const run=spawnSync(process.execPath,['--experimental-strip-types','tests/q-obligation-v2-sql-acceptance.mjs'],{encoding:'utf8',env,maxBuffer:16*1024*1024});
 if(run.status!==0)throw Error(run.stderr+'\n'+run.stdout);console.log(run.stdout);
 const actual=JSON.parse(fs.readFileSync('test-results/q-obligation-v2-backend-contract.json','utf8'));
 assert.ok(isQReviewV2Workspace(actual,tid),'Actual SQL Q v2 workspace violates strict app contract');
 console.log('PASS real persisted Q v2 workspace satisfies strict application validator');
 const canonical=spawnSync(process.execPath,['--experimental-strip-types','tests/q-accounting-v6-sql-acceptance.mjs'],{encoding:'utf8',env:{...env,Q_BRIDGE_CONTAINER:name,Q_BRIDGE_DATABASE:db},maxBuffer:16*1024*1024});
 if(canonical.status!==0)throw Error(canonical.stderr+'\n'+canonical.stdout);console.log(canonical.stdout);
 const contracts=JSON.parse(fs.readFileSync('test-results/q-accounting-v6-api-contract.json','utf8'));
 assert.ok(isQAccountingWorkspace(contracts.workspace,contracts.workspace.tournamentId,contracts.workspace.eventId),'Actual SQL accounting workspace violates strict app contract');
 assert.ok(isQAccountingResult(contracts.draftResult,contracts.workspace.eventId)&&qAccountingResultMatches(contracts.draftResult,'draft',contracts.draftRequest));
 assert.ok(isQAccountingResult(contracts.finalResult,contracts.workspace.eventId)&&qAccountingResultMatches(contracts.finalResult,'final',contracts.finalRequest));
 console.log('PASS actual persisted canonical accounting workspaces satisfy strict application validators');
}finally{docker(['exec',name,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP disposable Q accounting database removed');}
