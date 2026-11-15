// Approved disposable LOCAL fixture only. No HTTP, environment secrets or ports.
import fs from 'node:fs';import assert from 'node:assert/strict';import{spawnSync,spawn}from'node:child_process';
export const dir='test-results/native-mixed-pilot-reduced3-20261107';
export const state=JSON.parse(fs.readFileSync(dir+'/state.json','utf8'));
export const actor='a1310000-0000-4000-8000-000000000001',checker='a1310000-0000-4000-8000-000000000008',tid='b1310000-0000-4000-8000-000000000001';
export const quote=v=>"'"+String(v).replaceAll("'","''")+"'",json=v=>quote(JSON.stringify(v))+'::jsonb';
assert.equal(state.name,'cribbage-native-mixed-pilot-reduced3-20261107');assert.equal(state.db,'fixture_native_mixed_pilot_reduced3');assert.equal(state.cleaned,false);assert.match(state.containerId,/^[a-f0-9]{64}$/);
export function inspect(){const r=spawnSync('docker',['--context','desktop-linux','inspect',state.containerId],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);const m=JSON.parse(r.stdout)[0];assert.equal(m.Id,state.containerId);assert.equal(m.Name,'/'+state.name);assert.equal(m.Config.Labels['codex.fixture'],state.name);assert.equal(m.HostConfig.NetworkMode,'none');assert.equal(m.Mounts.length,0);assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);assert.equal(m.HostConfig.Privileged,false);assert.deepEqual(m.HostConfig.CapDrop,['ALL']);assert(m.HostConfig.SecurityOpt.includes('no-new-privileges'));return m;}
inspect();
export function sql(text){fs.appendFileSync(dir+'/scoring-trace.sql',text+'\n');const r=spawnSync('docker',['--context','desktop-linux','exec','-i',state.containerId,'psql','-h','/tmp','-U','supabase_admin','-d',state.db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',windowsHide:true,maxBuffer:32e6});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();}
export const read=text=>JSON.parse(sql(text)||'null');
export const claims=(id,role='service_role',session=null)=>`set request.jwt.claim.sub='${id}';set request.jwt.claim.role='${role}';set request.jwt.claims=${quote(JSON.stringify({role,sub:id,iss:'https://nnhcnvksxgxnpvdqjgpg.supabase.co/auth/v1',ref:'nnhcnvksxgxnpvdqjgpg',...(session?{session_id:session}:{}),exp:4102444800}))};set role ${role};`;
export function concurrentSQL(text){
 fs.appendFileSync(dir+'/scoring-trace.sql',text+'\n');
 const child=spawn('docker',['--context','desktop-linux','exec','-i',state.containerId,'psql','-h','/tmp','-U','supabase_admin','-d',state.db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',resolveFirst,rejectFirst,seen=false;
 const first=new Promise((resolve,reject)=>{resolveFirst=resolve;rejectFirst=reject;});
 const done=new Promise((resolve,reject)=>{child.on('error',e=>{rejectFirst(e);reject(e);});child.on('close',code=>{if(code!==0){const e=Error(stderr||'Concurrent local SQL failed');rejectFirst(e);reject(e);}else{if(!seen)rejectFirst(Error('No first response'));resolve(stdout.trim());}});});
 child.stdout.on('data',bytes=>{stdout+=bytes;for(const line of stdout.split('\n')){try{const value=JSON.parse(line);if(!seen&&(value?.status==='accepted'||value?.locked===true)){seen=true;resolveFirst(value);}}catch{/* Wait for a complete JSON line. */}}});child.stderr.on('data',b=>stderr+=b);child.stdin.end(text);return{first,done};
}
