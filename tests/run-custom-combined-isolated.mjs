import {verifyCombinedNoRefundProjectionV10}from'./custom-combined-source-local-acceptance.mjs';
import {verifyCustomCombinedAccountingRuntimeV10}from'./custom-combined-accounting-local-acceptance.mjs';
import {verifyCustomSideAmountParityV4}from'./custom-side-accounting-bridge-local-acceptance.mjs';
// Isolated synthetic evidence SQL runner. No hosted service access.
import {verifyCustomQDraft}from'./custom-q-draft-local-acceptance.mjs';
import {verifyCustomPoolDraftV3}from'./custom-pool-draft-local-acceptance.mjs';
import {verifyCustomQAmountParityV5}from'./custom-q-accounting-bridge-local-acceptance.mjs';
import {prepareLegacySideBeforeInstallV3,assertLegacySideAfterInstallV3}from'./custom-pool-legacy-install-local-acceptance.mjs';

import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync,spawn}from'node:child_process';
if(process.argv.length!==7||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const resultDir=process.argv[6];if(process.argv[5]!=='--result-dir'||!fs.statSync(resultDir).isDirectory())throw Error('Dedicated result directory required');
const name='cribbage-custom-combined-v10-20261105',db='fixture_custom_combined_v10';
function requireLocalContext(){const r=spawnSync('docker',['context','inspect','desktop-linux'],{encoding:'utf8',timeout:5000});if(r.status!==0)throw Error('Cannot verify Docker context');const c=JSON.parse(r.stdout);if(c.length!==1||c[0].Endpoints?.docker?.Host!=='npipe:////./pipe/dockerDesktopLinuxEngine')throw Error('Explicit local Windows Docker npipe required; no context changes permitted');}
function docker(args,input){requireLocalContext();const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',maxBuffer:64*1024*1024});if(r.status!==0)throw Error(String(r.stderr));return String(r.stdout);}
const meta=JSON.parse(docker(['inspect',name]))[0];
if(meta.Id!==process.argv[4]||meta.State.Status!=='running'||meta.Config.Labels['codex.fixture']!==name||meta.Image!=='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706'||meta.HostConfig.NetworkMode!=='none'||!meta.NetworkSettings?.Networks||Object.keys(meta.NetworkSettings.Networks).some(network=>network!=='none')||Object.keys(meta.HostConfig.PortBindings??{}).length||meta.HostConfig.Binds?.length||meta.Mounts.length||meta.HostConfig.Privileged)throw Error('Disposable isolation mismatch');
const cid=meta.Id;
const assertIsolation=m=>{if(m.Id!==cid||m.State.Status!=='running'||m.Config.Labels?.['codex.fixture']!==name||m.Image!=='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706'||m.HostConfig.NetworkMode!=='none'||!m.NetworkSettings?.Networks||Object.keys(m.NetworkSettings.Networks).some(network=>network!=='none')||Object.keys(m.HostConfig.PortBindings??{}).length||m.HostConfig.Binds?.length||m.Mounts.length||m.HostConfig.Privileged)throw Error('Fresh disposable isolation mismatch');};
const sql=(q,d='postgres')=>docker(['exec','-i',cid,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',d,'-v','ON_ERROR_STOP=1'],q);
const baseline=fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump');if(crypto.createHash('sha256').update(baseline).digest('hex')!=='e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc')throw Error('Baseline mismatch');
if(sql(`select count(*)from pg_database where datname='${db}'`).trim()!=='0')throw Error('Existing database; inspect before reset');
const toc=docker(['exec','-i',cid,'pg_restore','--list'],baseline);
const owners=[...new Set(toc.split('\n').filter(l=>!l.startsWith(';')).map(l=>l.trim().split(/\s+/).at(-1)).filter(x=>x?.startsWith('supabase_')||['postgres','pgbouncer'].includes(x)))];
for(const owner of [...new Set([...owners,'anon','authenticated','service_role','authenticator','dashboard_user','pgbouncer'])]){if(!/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/.test(owner))throw Error('Invalid role');sql(`do $$begin if not exists(select 1 from pg_roles where rolname='${owner}')then create role ${owner} ${owner==='postgres'?'superuser':'nologin'};end if;end$$;`);}
docker(['exec',cid,'createdb','-h','/tmp','-U','supabase_admin','-O','postgres','--template=template0',db]);
try{
 docker(['exec','-i',cid,'pg_restore','-h','/tmp','--exit-on-error','-U','supabase_admin','-d',db],baseline);
 for(let n=237;n<=292;n++){
  const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));if(!file)throw Error('Missing migration '+n);
  const bytes=fs.readFileSync('database/migrations/'+file);console.log('APPLY LOCAL',file,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'));
  sql('set role postgres;'+bytes.toString('utf8'),db);
 }
 for(const file of ['custom-graduated-amounts-v3.sql','custom-payout-intent-journal-v2.sql','custom-payout-q-setup-save-v2.sql']){const bytes=fs.readFileSync('database/proposals/'+file);console.log('APPLY LOCAL PROPOSAL',file,crypto.createHash('sha256').update(bytes).digest('hex'));sql('set role postgres;'+bytes.toString('utf8'),db);}
 if(sql("select current_database()||':socket:'||(inet_server_addr() is null)::text",db).trim()!==db+':socket:true')throw Error('Database/socket mismatch');
 const q=(query,who='a2950000-0000-4000-8000-000000000001',role='ownerAuthenticated')=>{if(!['ownerAuthenticated','anon','authenticated','service_role'].includes(role))throw Error('Unsupported fixture role');const jwtRole=role==='ownerAuthenticated'?'authenticated':role;return sql(`set statement_timeout='12000ms';set role ${role==='ownerAuthenticated'?'postgres':role};set request.jwt.claim.role='${jwtRole}';set request.jwt.claim.sub='${who}';set request.jwt.claims='{"role":"${jwtRole}","sub":"${who}"}';`+query,db).trim();}; const read=(query,who,role)=>{const v=q(query,who,role).split('\n').filter(Boolean).at(-1);return v===undefined?null:JSON.parse(v);};
 const withHeldLock=async(lockSql,check)=>{
  // Only this exact child PID is owned. Backend idle timeout bounds cleanup
  // even if the runner/client is interrupted; no peer process is inspected.
  requireLocalContext();assertIsolation(JSON.parse(docker(['inspect',cid]))[0]);
  const child=spawn('docker',['--context','desktop-linux','exec','-i',cid,'psql','-h','/tmp','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
  let output='',errors='',closed=false;
  const closure=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>{closed=true;if(code===0)resolve();else reject(Error('Lock connection failed '+code+': '+errors));});});
  // Attach a rejection observer before awaiting the readiness marker.
  void closure.catch(()=>{});
  child.stderr.on('data',chunk=>{errors+=chunk;});
  try{
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Owned lock barrier timeout')),10000);
    child.stdout.on('data',chunk=>{output+=chunk;if(output.split(/\r?\n/).includes('LOCK_HELD')){clearTimeout(timer);resolve();}});
    child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('close',()=>{clearTimeout(timer);reject(Error('Lock connection closed before barrier '+errors));});
    child.stdin.write("set role postgres;set idle_in_transaction_session_timeout='10s';"+lockSql+'\n');
   });
   await check();
  }finally{
   if(!closed)child.stdin.end('rollback;\n\\q\n');
   let timer;try{await Promise.race([closure,new Promise((_,reject)=>{timer=setTimeout(()=>{if(!closed)child.kill();reject(Error('Owned lock child did not exit; exact child terminated'));},10000);})]);}finally{clearTimeout(timer);}
  }
 };
 const legacy=await verifyCustomQDraft({q,read,withHeldLock});const beforeInstall=prepareLegacySideBeforeInstallV3({read});const bytes=fs.readFileSync('database/proposals/custom-pool-setup-save-v3.sql');console.log('APPLY LOCAL PROPOSAL custom-pool-setup-save-v3.sql',crypto.createHash('sha256').update(bytes).digest('hex'));sql('set role postgres;'+bytes.toString('utf8'),db);const installCompatibility=assertLegacySideAfterInstallV3({read},beforeInstall);const side=await verifyCustomPoolDraftV3({q,read,withHeldLock});fs.writeFileSync(resultDir+'/side-result.json',JSON.stringify({legacy,installCompatibility,side},null,2));console.log('PASS Side draft and legacy install compatibility');fs.writeFileSync(resultDir+'/pre-custom-q-calculator.sql',q("select pg_get_functiondef('app.calculate_q_obligations_with_graduated_v4(jsonb)'::regprocedure);"));const qBridge=fs.readFileSync('database/proposals/custom-q-accounting-bridge-v1.sql');console.log('APPLY LOCAL PROPOSAL custom-q-accounting-bridge-v1.sql',crypto.createHash('sha256').update(qBridge).digest('hex'));sql('set role postgres;'+qBridge.toString('utf8'),db);const serviceSql=query=>q("set request.jwt.claim.role='service_role';set request.jwt.claims='{\"role\":\"service_role\"}';"+query);const customQAmounts=verifyCustomQAmountParityV5(serviceSql);fs.writeFileSync(resultDir+'/q-amount-parity.json',JSON.stringify(customQAmounts,null,2));for(const file of ['custom-side-accounting-bridge-v1.sql','custom-combined-accounting-v10.sql']){const bytes=fs.readFileSync('database/proposals/'+file);console.log('APPLY LOCAL PROPOSAL',file,crypto.createHash('sha256').update(bytes).digest('hex'));sql('set role postgres;'+bytes.toString('utf8'),db);}const lateLegacyCompatibility=assertLegacySideAfterInstallV3({read},beforeInstall);fs.writeFileSync(resultDir+'/post-bridge-legacy-compatibility.json',JSON.stringify(lateLegacyCompatibility,null,2));const projection=verifyCombinedNoRefundProjectionV10(serviceSql);fs.writeFileSync(resultDir+'/no-refund-projection.json',JSON.stringify(projection,null,2));const customSideAmounts=verifyCustomSideAmountParityV4(serviceSql);fs.writeFileSync(resultDir+'/side-amount-parity.json',JSON.stringify(customSideAmounts,null,2));const combined=verifyCustomCombinedAccountingRuntimeV10({sql:serviceSql,checkpoint:(stage,data)=>{if(!/^[a-z0-9_]+$/.test(stage))throw Error('Invalid checkpoint stage');fs.writeFileSync(resultDir+'/combined-'+stage+'.json',JSON.stringify(data,null,2));console.log('Combined evidence checkpoint',stage);}});const result={legacy,installCompatibility,lateLegacyCompatibility,side,customQAmounts,customSideAmounts,combined};fs.writeFileSync(resultDir+'/sql-result.json',JSON.stringify(result,null,2));console.log('PASS combined custom accounting local runtime');
}finally{const end=JSON.parse(docker(['inspect',cid]))[0];assertIsolation(end);if(sql('select current_database()',db).trim()!==db)throw Error('Cleanup DB mismatch');docker(['exec',cid,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP exact custom Q draft database removed');}
