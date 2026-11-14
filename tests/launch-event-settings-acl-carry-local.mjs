// Exactly ONE explicitly approved disposable local container/database.
import fs from'node:fs';import assert from'node:assert/strict';import{spawnSync,spawn}from'node:child_process';
const name='cribbage-event-settings-acl-carry-local',image='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
assert(!fs.existsSync('test-results/event-settings-acl-carry-container.json'),'This one-fixture approval is already consumed; do not recreate it');
function docker(args,allow=false){const c=spawnSync('docker',['context','inspect','desktop-linux'],{encoding:'utf8'});assert.equal(c.status,0);assert.equal(JSON.parse(c.stdout)[0].Endpoints.docker.Host,'npipe:////./pipe/dockerDesktopLinuxEngine');const r=spawnSync('docker',['--context','desktop-linux',...args],{encoding:'utf8'});if(!allow)assert.equal(r.status,0,String(r.stderr));return r;}
assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]).stdout.trim(),'','Existing task container; do not recreate');
// Refuse to create a fixture before all prepared acceptance files exist.
for(const p of['tests/event-settings-acl-carry-scope-v3.mjs','tests/event-settings-v3-acl-carry-acceptance.mjs'])assert(fs.existsSync(p),`Not ready: ${p}`);
let cid,exitCode=1;
try{
 const startup="initdb -D /tmp/settings-pgdata -U supabase_admin --auth=trust --no-locale --encoding=UTF8 >/tmp/settings-init.log 2>&1 && exec postgres -D /tmp/settings-pgdata -k /tmp -c listen_addresses='' -c shared_preload_libraries=pg_stat_statements";
 cid=docker(['run','-d','--pull=never','--name',name,'--label',`codex.fixture=${name}`,'--network','none','--cap-drop=ALL','--security-opt=no-new-privileges','--user','postgres','--entrypoint','/bin/sh',image,'-c',startup]).stdout.trim();assert.match(cid,/^[a-f0-9]{64}$/);
 fs.writeFileSync('test-results/event-settings-acl-carry-container.json',JSON.stringify({containerId:cid,name,image,scope:'one approved local disposable database',hosted:false},null,2));
 let ready=false;for(let n=0;n<60;n++){if(docker(['exec',cid,'pg_isready','-h','/tmp','-U','supabase_admin'],true).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert(ready);
 const child=spawn(process.execPath,['--experimental-strip-types','tests/run-event-settings-acl-carry-isolated.mjs','--isolated-container','--container-id',cid],{stdio:'inherit'});
 exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 if(exitCode!==0){
  console.log('SAME approved fixture retained for diagnosis; no second database will be created.');
  const control='test-results/event-settings-acl-carry-fixture-stop.json';assert(!fs.existsSync(control),'Stale stop control');
  while(!fs.existsSync(control))await new Promise(r=>setTimeout(r,500));
  const stop=JSON.parse(fs.readFileSync(control,'utf8'));assert.equal(stop.containerId,cid);assert.equal(stop.cleanup,true);exitCode=stop.finalExitCode;
 }
}finally{
 if(cid){const m=JSON.parse(docker(['inspect',cid]).stdout)[0];assert.equal(m.Id,cid);assert.equal(m.Config.Labels['codex.fixture'],name);assert.equal(m.Image,image);assert.equal(m.HostConfig.NetworkMode,'none');assert.equal(m.Mounts.length,0);assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);assert.equal(m.HostConfig.Privileged,false);docker(['rm','-f',cid]);assert.equal(docker(['ps','-aq','--filter',`id=${cid}`]).stdout.trim(),'');assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]).stdout.trim(),'');fs.writeFileSync('test-results/event-settings-acl-carry-cleanup.json',JSON.stringify({containerId:cid,removed:true,verifiedAbsentByIdAndName:true,runnerExitCode:exitCode},null,2));console.log('CLEANUP exact approved container removed; ID/name absence verified');}
}
process.exit(exitCode??1);
