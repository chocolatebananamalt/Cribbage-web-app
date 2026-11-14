// One expressly authorized disposable 18-player local rehearsal database.
import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';import assert from'node:assert/strict';import{spawnSync,spawn}from'node:child_process';
const docker='C:\\Users\\choco\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe';
const name='cribbage-mixed-main-finance-current-20261105',image='sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706';
const runner='tests/run-mixed-main-finance-proof-isolated.mjs';
const runNonce=crypto.randomUUID();
const root=path.resolve('.'),resultDir=path.resolve('test-results','mixed-main-current-'+new Date().toISOString().replaceAll(':','-').replaceAll('.','-'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(process.env.DOCKER_HOST,undefined,'DOCKER_HOST override is not allowed');
function call(args,allowed=false){const r=spawnSync(docker,['--context','desktop-linux',...args],{encoding:'utf8',maxBuffer:16*1024*1024,timeout:15000});if(!allowed)assert.equal(r.status,0,String(r.stderr));return r;}
const context=spawnSync(docker,['context','inspect','desktop-linux'],{encoding:'utf8',timeout:5000});assert.equal(context.status,0);assert.equal(JSON.parse(context.stdout)[0].Endpoints.docker.Host,'npipe:////./pipe/dockerDesktopLinuxEngine');
assert.equal(call(['ps','-aq','--filter',`name=^/${name}$`]).stdout.trim(),'','Existing target must be inspected, not reused');
const baseline='../cribbage-isolated-db-20261023/empty-post-0236-baseline.dump';assert.equal(sha(fs.readFileSync(baseline)),'e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc');
const paths=new Set();
function dependency(file){const full=path.resolve(file),relative=path.relative(root,full).replaceAll('\\','/');assert(!relative.startsWith('../')&&!path.isAbsolute(relative));if(paths.has(relative))return;paths.add(relative);const text=fs.readFileSync(full,'utf8');for(const match of text.matchAll(/\b(?:from\s*|import\s*)["'](\.[^"']+)["']/g)){const target=path.resolve(path.dirname(full),match[1]);assert(fs.existsSync(target),'Missing import '+target);dependency(target);}}
dependency(runner);paths.add('tests/launch-mixed-main-finance-proof-local.mjs');
for(let n=237;n<=292;n++){const file=fs.readdirSync('database/migrations').find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));assert(file);paths.add('database/migrations/'+file);}
for(const file of['synthetic-mixed-evidence-v1.sql','synthetic-mixed-evidence-v2.sql','synthetic-mixed-main-finance-v1.sql'])paths.add('database/proposals/'+file);
for(const file of['package.json','pnpm-lock.yaml'])paths.add(file);
for(const file of['tests/q-pool-membership-seed.sql','tests/fixtures/q-review-games.json'])paths.add(file);
fs.mkdirSync(resultDir,{recursive:false});
const historicalFile='test-results/mixed-main-finance-result.json';
const historical=fs.existsSync(historicalFile)?{file:historicalFile,sha256:sha(fs.readFileSync(historicalFile))}:null;
if(historical){fs.writeFileSync(path.join(resultDir,'historical-result.frozen'),fs.readFileSync(historicalFile));fs.writeFileSync(path.join(resultDir,'historical-preservation.json'),JSON.stringify(historical,null,2));}
const manifest=[...paths].sort().map(file=>({file,sha256:sha(fs.readFileSync(file))}));fs.writeFileSync(path.join(resultDir,'source-manifest.json'),JSON.stringify(manifest,null,2));
for(const row of manifest){const output=path.join(resultDir,'frozen-inputs',row.file+'.frozen');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,fs.readFileSync(row.file));}
fs.writeFileSync(path.join(resultDir,'scope.json'),JSON.stringify({runNonce,participants:18,digital:6,paper:12,qualifyingGames:108,normalStartRequired:true,simulatedOnly:true,actualHumanSessions:false,hostedChanges:false,moneyMoved:false,baselineSha256:sha(fs.readFileSync(baseline)),sourceCount:manifest.length},null,2));
console.log('LOCAL MIXED EVIDENCE',resultDir,'frozen inputs',manifest.length);
let exitCode=1,cid=null;
try{
 const env={...process.env,PATH:path.dirname(docker)+';'+path.dirname(process.execPath)+';'+process.env.PATH};
 const child=spawn(process.execPath,[runner,resultDir,runNonce],{env,stdio:'inherit'});
 exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve(code??1));});
 for(const row of manifest)assert.equal(sha(fs.readFileSync(row.file)),row.sha256,'Source drift during run: '+row.file);
 if(historical)assert.equal(sha(fs.readFileSync(historical.file)),historical.sha256,'Historical proof changed');
}catch(error){fs.writeFileSync(path.join(resultDir,'launcher-error.txt'),String(error?.stack??error));exitCode=1;}
finally{
 const stored=path.join(resultDir,'created-container.json');if(fs.existsSync(stored))cid=JSON.parse(fs.readFileSync(stored,'utf8')).containerId;
 const byName=call(['ps','-aq','--filter',`name=^/${name}$`]).stdout.trim();
 if(byName){const m=JSON.parse(call(['inspect',byName]).stdout)[0];assert.equal(m.Id,cid??byName);assert.equal(m.Name,'/'+name);assert.equal(m.Config.Labels['codex.fixture'],name);assert.equal(m.Config.Labels['codex.run-id'],runNonce);assert.equal(m.Image,image);assert.equal(m.HostConfig.NetworkMode,'none');assert.equal(m.Mounts.length,0);assert.equal(Object.keys(m.HostConfig.PortBindings??{}).length,0);cid=m.Id;fs.writeFileSync(path.join(resultDir,'interrupted-inspect.json'),JSON.stringify(m,null,2));call(['rm','-f',cid]);}
 const absentId=!cid||call(['ps','-aq','--filter',`id=${cid}`]).stdout.trim()==='';
 const absentName=call(['ps','-aq','--filter',`name=^/${name}$`]).stdout.trim()==='';
 const cleanup={name,containerId:cid,runnerExitCode:exitCode,removed:absentId&&absentName,verifiedAbsentByIdAndName:absentId&&absentName,hostedChanges:false};
 fs.writeFileSync(path.join(resultDir,'cleanup.json'),JSON.stringify(cleanup,null,2));assert(cleanup.removed,'Exact owned-container removal not verified');
}
process.exit(exitCode);
