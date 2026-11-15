// One explicitly approved disposable LOCAL fixture. No HTTP, mounts or passwords.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import{spawnSync}from'node:child_process';
const root=process.cwd(),dir=path.join(root,'test-results/native-mixed-bindings-20261107');fs.mkdirSync(dir,{recursive:true});
const statePath=path.join(dir,'state.json'),name='cribbage-native-mixed-bindings-20261107',db='fixture_native_mixed_bindings',image='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const load=()=>fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):null;
const save=state=>fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');
function docker(args,input,allow=false){const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',windowsHide:true,maxBuffer:64*1024*1024});if(r.status!==0&&!allow)throw Error(String(r.stderr||r.stdout));return r;}
function context(){const c=JSON.parse(docker(['context','inspect','desktop-linux']).stdout);assert.equal(c.length,1);assert.equal(c[0].Endpoints.docker.Host,'npipe:////./pipe/dockerDesktopLinuxEngine');}
function inspect(state){assert.match(state.containerId,/^[a-f0-9]{64}$/);const m=JSON.parse(docker(['inspect',state.containerId]).stdout)[0];assert.equal(m.Id,state.containerId);assert.equal(m.Name,'/'+name);assert.equal(m.Config.Labels['codex.fixture'],name);assert.equal(m.Image,image);assert.equal(m.HostConfig.NetworkMode,'none');assert.equal(m.Mounts.length,0);assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);assert.equal(m.HostConfig.Privileged,false);assert.deepEqual(m.HostConfig.CapDrop,['ALL']);assert(m.HostConfig.SecurityOpt.includes('no-new-privileges'));return m;}
function sql(state,text,database=db){inspect(state);return String(docker(['exec','-i',state.containerId,'psql','-h','/tmp','-U','supabase_admin','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1'],text).stdout);}
const action=process.argv[2];context();
if(action==='create'){
 assert.equal(load(),null,'Existing state forbids another fixture');assert.equal(String(docker(['ps','-aq','--filter',`name=^/${name}$`]).stdout).trim(),'');
 const order=JSON.parse(fs.readFileSync('test-results/native-mixed-bindings-20261107/proposal-order.json','utf8'));
 const migrations=Array.from({length:56},(_,i)=>{const n=i+237,f=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));assert(f);return'database/migrations/'+f;});
 const files=[...migrations,...order.map(f=>'database/proposals/'+f)],manifest=files.map(file=>({file,sha256:hash(fs.readFileSync(file))}));
 fs.writeFileSync(path.join(dir,'install-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 const startup="initdb -D /tmp/mixed-approved-pgdata -U supabase_admin --auth=trust --no-locale --encoding=UTF8 >/tmp/approved-init.log 2>&1 && exec postgres -D /tmp/mixed-approved-pgdata -k /tmp -c listen_addresses='' -c shared_preload_libraries=pg_stat_statements";
 fs.writeFileSync(path.join(dir,'create-intent.json'),JSON.stringify({name,db,image,approvedScope:'approved disposable local-only fictional integrated draw Start scoring and recovery tests',createdAt:new Date().toISOString()},null,2));
 const r=docker(['run','-d','--pull=never','--name',name,'--label',`codex.fixture=${name}`,'--network','none','--cap-drop=ALL','--security-opt=no-new-privileges','--user','postgres','--entrypoint','/bin/sh',image,'-c',startup]);
 const state={name,db,image,containerId:String(r.stdout).trim(),createdAt:new Date().toISOString(),applied:[],databaseCreated:false,cleaned:false};save(state);inspect(state);
 let ready=false;for(let i=0;i<60;i++){if(docker(['exec',state.containerId,'pg_isready','-h','/tmp','-U','supabase_admin'],undefined,true).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert(ready);state.ready=true;save(state);console.log(JSON.stringify({created:true,containerId:state.containerId,network:'none',ports:0,mounts:0,passwords:0}));
}else{
 const state=load();assert(state&&!state.cleaned,'Owned active fixture required');inspect(state);
 if(action==='install'){
  assert(!state.inFlight,'Previous SQL outcome requires inspection before retry');
  if(!state.databaseCreated){
   const bytes=fs.readFileSync('../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump');assert.equal(hash(bytes),'e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc');
   const toc=String(docker(['exec','-i',state.containerId,'pg_restore','--list'],bytes).stdout),owners=toc.split('\n').filter(l=>!l.startsWith(';')).map(l=>l.trim().split(/\s+/).at(-1)).filter(x=>x?.startsWith('supabase_')||['postgres','pgbouncer'].includes(x));
   for(const owner of new Set([...owners,'anon','authenticated','service_role','authenticator','dashboard_user','pgbouncer'])){assert.match(owner,/^(?:postgres|pgbouncer|anon|authenticated|service_role|authenticator|dashboard_user|supabase_[a-z_]+)$/);sql(state,`do $$begin if not exists(select 1 from pg_roles where rolname='${owner}')then create role ${owner} ${owner==='postgres'?'superuser ':''}nologin;end if;end$$;`,'postgres');}
   assert.equal(sql(state,`select count(*)from pg_database where datname='${db}'`,'postgres').trim(),'0');
   docker(['exec',state.containerId,'createdb','-h','/tmp','-U','supabase_admin','-O','postgres','--template=template0',db]);state.databaseCreated=true;state.baselineRestore='in_flight';save(state);
   docker(['exec','-i',state.containerId,'pg_restore','-h','/tmp','--exit-on-error','-U','supabase_admin','-d',db],bytes);state.baselineRestore='complete';save(state);
   const counts=JSON.parse(sql(state,"select json_build_object('profiles',(select count(*)from app.profiles),'tournaments',(select count(*)from app.tournaments),'roster',(select count(*)from app.tournament_roster_entries));"));assert.deepEqual(counts,{profiles:0,tournaments:0,roster:0});state.emptyBaselineVerified=true;save(state);
  }
  assert(state.emptyBaselineVerified&&state.baselineRestore==='complete');
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'install-manifest.json'),'utf8'));
  for(const item of manifest){const bytes=fs.readFileSync(item.file);assert.equal(hash(bytes),item.sha256);if(state.applied.some(x=>x.file===item.file&&x.sha256===item.sha256))continue;state.inFlight=item;save(state);try{sql(state,'set role postgres;'+bytes.toString('utf8'));}catch(error){state.installError=String(error);save(state);throw error;}state.applied.push(item);state.inFlight=null;save(state);console.log('APPLIED',item.file);}
  state.installed=true;save(state);console.log('INSTALL COMPLETE',state.applied.length);
 }else if(action==='sql'){
  const file=path.resolve(process.argv[3]??'');assert(file.startsWith(dir+path.sep)&&fs.statSync(file).isFile(),'Only owned result SQL files');const text=fs.readFileSync(file,'utf8');console.log(sql(state,text));
 }else if(action==='cleanup'){
  const cid=state.containerId;docker(['rm','-f',cid]);assert.equal(String(docker(['ps','-aq','--filter',`id=${cid}`]).stdout).trim(),'');assert.equal(String(docker(['ps','-aq','--filter',`name=^/${name}$`]).stdout).trim(),'');state.cleaned=true;state.cleanedAt=new Date().toISOString();state.cleanupVerified=true;save(state);console.log('CLEANUP VERIFIED',cid);
 }else if(action==='status'){console.log(JSON.stringify({state,metadata:{id:state.containerId,network:'none',ports:0,mounts:0}},null,2));}
 else throw Error('Unsupported action');
}
