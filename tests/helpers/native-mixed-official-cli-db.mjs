import fs from'node:fs';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';
export const dir='test-results/native-mixed-official-cli-20261107',state=JSON.parse(fs.readFileSync(dir+'/state.json'));assert(!state.cleaned);assert.equal(state.name,'cribbage-native-mixed-official-cli-20261107');assert.equal(state.db,'fixture_native_mixed_official_cli');
const run=(args,input)=>{const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,maxBuffer:32e6});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
const m=JSON.parse(run(['inspect',state.containerId]))[0],n=JSON.parse(run(['network','inspect',state.networkId]))[0];assert.equal(m.Config.Labels['codex.fixture'],state.name);assert.equal(m.Mounts.length,0);assert(n.Internal);assert.equal(n.Labels['codex.fixture'],state.name);assert.equal(m.HostConfig.PortBindings['5432/tcp'][0].HostIp,'127.0.0.1');assert.equal(Number(m.NetworkSettings.Ports['5432/tcp'][0].HostPort),state.loopbackPort);
export const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
export function sql(text,db=state.db){fs.appendFileSync(dir+'/official-trace.sql',text+'\n');return run(['exec','-i',state.containerId,'psql','-h','/tmp','-U','supabase_admin','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],text);}
export const read=(s,db)=>JSON.parse(sql(s,db)||'null');
