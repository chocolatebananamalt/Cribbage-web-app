// Isolated synthetic evidence SQL runner. No hosted service access.
import {verifyCustomQDraft}from'./custom-q-draft-local-acceptance.mjs';

import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync,spawn}from'node:child_process';
if(process.argv.length!==5||process.argv[2]!=='--isolated-container'||process.argv[3]!=='--container-id'||!/^[a-f0-9]{64}$/.test(process.argv[4]))throw Error('Exact disposable container identity required');
const name='cribbage-custom-q-draft-local',db='fixture_custom_q_draft_v2';
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
 const q=(query,who='a2950000-0000-4000-8000-000000000001',role='ownerAuthenticated')=>{if(!['ownerAuthenticated','anon','authenticated','service_role'].includes(role))throw Error('Unsupported fixture role');const jwtRole=role==='ownerAuthenticated'?'authenticated':role;return sql(`set statement_timeout='2500ms';set role ${role==='ownerAuthenticated'?'postgres':role};set request.jwt.claim.role='${jwtRole}';set request.jwt.claim.sub='${who}';set request.jwt.claims='{"role":"${jwtRole}","sub":"${who}"}';`+query,db).trim();}; const read=(query,who,role)=>{const v=q(query,who,role).split('\n').filter(Boolean).at(-1);return v===undefined?null:JSON.parse(v);};
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
 const result=await verifyCustomQDraft({q,read,withHeldLock});fs.writeFileSync('test-results/custom-q-draft-sql-result.json',JSON.stringify(result,null,2));console.log('PASS custom Q draft owner-only candidate',JSON.stringify(result));
}finally{const end=JSON.parse(docker(['inspect',cid]))[0];assertIsolation(end);if(sql('select current_database()',db).trim()!==db)throw Error('Cleanup DB mismatch');docker(['exec',cid,'dropdb','-h','/tmp','-U','supabase_admin','--if-exists',db]);console.log('CLEANUP exact custom Q draft database removed');}
