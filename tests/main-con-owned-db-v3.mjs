// Operate only the exact currently-owned fictional fixture. No create/hosted path.
import fs from'node:fs';import crypto from'node:crypto';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';
export const dir='test-results/con-player-chain-20261112',report=JSON.parse(fs.readFileSync(dir+'/result.json'));assert.equal(report.cleaned,false);assert.match(report.containerId,/^[a-f0-9]{64}$/);
const cid=report.containerId,name='cribbage-con-player-chain-20261112',image='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706',db='fictional_modern_final';
const docker=(args,input,allow=false)=>{const r=spawnSync('C:/Users/choco/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe',['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,maxBuffer:64e6});if(!allow)assert.equal(r.status,0,String(r.stderr||r.stdout));return r;};
export function inspect(){const m=JSON.parse(docker(['inspect',cid]).stdout)[0];assert.equal(m.Id,cid);assert.equal(m.Name,'/'+name);assert.equal(m.Image,image);assert.equal(m.Config.Labels['codex.fixture'],name);assert.equal(m.HostConfig.NetworkMode,'none');assert.equal(m.Mounts.length,0);assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);assert.equal(m.HostConfig.Privileged,false);assert.equal(m.HostConfig.Tmpfs['/tmp'],'rw,noexec,nosuid,size=1073741824');}
export function sql(q){inspect();return docker(['exec','-i',cid,'psql','-h','/tmp','-U','postgres','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],q).stdout.trim();}
export const actor='a1310000-0000-4000-8000-000000000001',tid='b1310000-0000-4000-8000-000000000001',sid='be120000-0000-4000-8000-000000000001',id=n=>'be120000-0000-4000-8000-'+String(n).padStart(12,'0'),official=id(2),reviewer=id(3),lit=s=>"'"+s.replaceAll("'","''")+"'",json=v=>lit(JSON.stringify(v))+'::jsonb';export const op=()=>crypto.randomUUID();
export function raw(q,who=actor,role='service_role'){return sql('set role postgres;set request.jwt.claim.sub='+lit(who)+';set request.jwt.claim.role='+lit(role)+';set request.jwt.claims='+lit(JSON.stringify({sub:who,role,session_id:who===actor?sid:'1120'+who.slice(0,4)+who.slice(8),exp:4102444800}))+';'+q);}
export function call(q,who=actor,role='service_role'){const value=raw(q,who,role).split('\n').at(-1);return value==='t'?true:value==='f'?false:value?JSON.parse(value):null;}
export function checkpoint(stage,data){report.stage=stage;fs.writeFileSync(dir+'/'+stage+'.json',JSON.stringify(data,null,2));fs.writeFileSync(dir+'/result.json',JSON.stringify(report,null,2));}
export function cleanup(){inspect();docker(['rm','-f',cid]);assert.equal(docker(['ps','-aq','--filter','id='+cid]).stdout.trim(),'');report.cleaned=true;fs.writeFileSync(dir+'/result.json',JSON.stringify(report,null,2));}
if(process.argv[2]==='query'){assert(process.argv[3]?.startsWith('test-results/con-player-chain-20261112/'));console.log(sql(fs.readFileSync(process.argv[3],'utf8')));}
if(process.argv[2]==='cleanup'){cleanup();console.log('Exact fictional container removed and absence verified');}


