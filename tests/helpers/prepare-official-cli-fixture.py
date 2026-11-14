"""Official Windows CLI needs loopback TCP; all data/network resources are disposable."""
from pathlib import Path
old='native-mixed-bootstrap-atomic51';new='native-mixed-official-cli';d=Path('test-results/'+new+'-20261107');assert not(d/'state.json').exists();d.mkdir(exist_ok=True);(d/'proposal-order.json').write_text('[]')
s=Path('tests/'+old+'-acceptance-local-runtime.mjs').read_text().replace(old,new).replace('fixture_native_mixed_bootstrap_atomic51','fixture_native_mixed_official_cli')
s=s.replace("const hash=bytes=>", "const networkName=name+'-net';\nconst hash=bytes=>")
s=s.replace("assert.equal(m.HostConfig.NetworkMode,'none');", "assert.equal(m.HostConfig.NetworkMode,networkName);const net=JSON.parse(docker(['network','inspect',state.networkId]).stdout)[0];assert.equal(net.Internal,true);assert.equal(net.Labels['codex.fixture'],name);")
s=s.replace("assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);", "assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,1);assert.equal(m.HostConfig.PortBindings['5432/tcp'][0].HostIp,'127.0.0.1');")
s=s.replace("const r=docker(['run'", "const networkId=String(docker(['network','create','--internal','--label',`codex.fixture=${name}`,networkName]).stdout).trim();fs.writeFileSync(path.join(dir,'network-state.json'),JSON.stringify({networkId,name:networkName,label:name,internal:true}));\n const r=docker(['run'")
s=s.replace("'--network','none'", "'--network',networkName,'--publish','127.0.0.1::5432'")
s=s.replace("containerId:String(r.stdout).trim(),createdAt", "containerId:String(r.stdout).trim(),networkId,createdAt")
s=s.replace("&& exec postgres", "&& printf '\\\\nhost all postgres 0.0.0.0/0 trust\\\\n' >> /tmp/mixed-approved-pgdata/pg_hba.conf && exec postgres")
s=s.replace("listen_addresses=''", "listen_addresses='*'")
s=s.replace("state.ready=true;save(state);", "state.ready=true;state.loopbackPort=Number(inspect(state).NetworkSettings.Ports['5432/tcp'][0].HostPort);assert(Number.isInteger(state.loopbackPort)&&state.loopbackPort>1024);save(state);")
a=s.index("state.inFlight={file:'atomic53-closed-install'");b=s.index('  verifyLegacyWriter(',a)
s=s[:a]+"state.phase='numbered0292_before_official_cli';save(state);\n"+s[b:]
s=s.replace("state.cleaned=true;", "const net=JSON.parse(docker(['network','inspect',state.networkId]).stdout)[0];assert.equal(net.Internal,true);assert.equal(net.Labels['codex.fixture'],name);assert.equal(Object.keys(net.Containers).length,0);docker(['network','rm',state.networkId]);assert.equal(String(docker(['network','ls','-q','--filter',`id=${state.networkId}`]).stdout).trim(),'');state.networkCleanupVerified=true;state.cleaned=true;")
Path('tests/'+new+'-runtime.mjs').write_text(s,encoding='utf8')
Path('tests/helpers/'+new+'-db.mjs').write_text("""import fs from'node:fs';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';
export const dir='test-results/native-mixed-official-cli-20261107',state=JSON.parse(fs.readFileSync(dir+'/state.json'));assert(!state.cleaned);assert.equal(state.name,'cribbage-native-mixed-official-cli-20261107');assert.equal(state.db,'fixture_native_mixed_official_cli');
const run=(args,input)=>{const r=spawnSync('docker',['--context','desktop-linux',...args],{input,encoding:'utf8',windowsHide:true,maxBuffer:32e6});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
const m=JSON.parse(run(['inspect',state.containerId]))[0],n=JSON.parse(run(['network','inspect',state.networkId]))[0];assert.equal(m.Config.Labels['codex.fixture'],state.name);assert.equal(m.Mounts.length,0);assert(n.Internal);assert.equal(n.Labels['codex.fixture'],state.name);assert.equal(m.HostConfig.PortBindings['5432/tcp'][0].HostIp,'127.0.0.1');assert.equal(Number(m.NetworkSettings.Ports['5432/tcp'][0].HostPort),state.loopbackPort);
export const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
export function sql(text,db=state.db){fs.appendFileSync(dir+'/official-trace.sql',text+'\\n');return run(['exec','-i',state.containerId,'psql','-h','/tmp','-U','supabase_admin','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],text);}
export const read=(s,db)=>JSON.parse(sql(s,db)||'null');
""",encoding='utf8')
print('Prepared localhost-only internal-network fixture; CLI commands use no credentials or hosted link')
