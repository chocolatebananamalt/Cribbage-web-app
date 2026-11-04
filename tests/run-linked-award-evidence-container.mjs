// Disposable local fixture orchestrator. No hosted service, network, mounts or credentials.
import fs from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import assert from "node:assert/strict";
const name="cribbage-linked-award-evidence",image="sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706";
function docker(args,allowedFailure=false){
 const r=spawnSync("docker",["--context","desktop-linux",...args],{encoding:"utf8",maxBuffer:32*1024*1024});
 if(r.status!==0&&!allowedFailure)throw Error(r.stderr||r.stdout||"Docker operation failed");return r;
}
const existing=docker(["ps","-aq","--filter",`name=^/${name}$`]).stdout.trim();
assert.equal(existing,"","Unexpected existing fixture; inspect rather than reuse/remove");
const restored=JSON.parse(docker(["image","inspect",image]).stdout)[0];assert.equal(restored.Id,image);
let containerId=null,runStatus=null,logPath=null,resultPath=null,startedAt=new Date().toISOString(),cleanupVerified=false,runOutput='';
try{
 const startup="initdb -D /tmp/qaccounting-pgdata -U supabase_admin --auth=trust --no-locale --encoding=UTF8 >/tmp/qaccounting-init.log 2>&1 && exec postgres -D /tmp/qaccounting-pgdata -k /tmp -c listen_addresses='' -c shared_preload_libraries=pg_stat_statements";
 containerId=docker(["run","-d","--pull=never","--name",name,"--label",`codex.fixture=${name}`,"--network","none","--cap-drop=ALL","--security-opt=no-new-privileges","--user","postgres","--entrypoint","/bin/sh",image,"-c",startup]).stdout.trim();
 assert.match(containerId,/^[a-f0-9]{64}$/);
 fs.mkdirSync('test-results',{recursive:true});
 const prefix=`test-results/linked-award-evidence-${containerId}`;
 logPath=`${prefix}.log`;resultPath=`${prefix}.json`;
 fs.writeFileSync(logPath,`START ${startedAt}\nCONTAINER ${containerId}\nIMAGE ${image}\n`);
 const meta=JSON.parse(docker(["inspect",containerId]).stdout)[0];
 assert.equal(meta.Id,containerId);assert.equal(meta.Config.Labels["codex.fixture"],name);assert.equal(meta.Image,image);
 assert.equal(meta.HostConfig.NetworkMode,"none");assert.equal(meta.HostConfig.Privileged,false);assert.equal(meta.Mounts.length,0);assert.equal(Object.keys(meta.HostConfig.PortBindings??{}).length,0);assert.ok(!meta.HostConfig.Binds?.length);
 let ready=false;
 for(let i=0;i<60;i++){
  const r=docker(["exec",containerId,"pg_isready","-h","/tmp","-U","supabase_admin"],true);
  if(r.status===0){ready=true;break;}
  if(/permission denied while trying to connect|access is denied/i.test(r.stderr))throw Error(r.stderr);
  const state=JSON.parse(docker(["inspect",containerId]).stdout)[0].State;
  if(!state.Running)throw Error("Fixture startup exited: "+docker(["logs",containerId]).stdout);
  await new Promise(r=>setTimeout(r,500));
 }
 assert.ok(ready,"Fixture PostgreSQL not ready");
 console.log("PASS exact reviewed image, no-network/no-port/no-mount unprivileged fixture ready",containerId);
 const child=spawn(process.execPath,["--experimental-strip-types","tests/run-linked-award-evidence-isolated.mjs","--isolated-container","--container-id",containerId],{stdio:['ignore','pipe','pipe']});
 for(const [stream,target] of [[child.stdout,process.stdout],[child.stderr,process.stderr]])stream.on('data',chunk=>{const text=chunk.toString();runOutput+=text;fs.appendFileSync(logPath,text);target.write(chunk);});
 runStatus=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
 if(runStatus!==0)throw Error("Structured lifecycle acceptance failed: "+runStatus);
 if(!runOutput.split(/\r?\n/).some(line=>line.startsWith('FIXTURE_RESULT_JSON ')))throw Error('Missing structured lifecycle evidence');
}finally{
 if(containerId){
  const m=JSON.parse(docker(["inspect",containerId]).stdout)[0];
  assert.equal(m.Id,containerId);assert.equal(m.Config.Labels["codex.fixture"],name);assert.equal(m.Image,image);
  docker(["rm","-f",containerId]);
  assert.equal(docker(["ps","-aq","--filter",`id=${containerId}`]).stdout.trim(),"");
  cleanupVerified=true;
  const completedAt=new Date().toISOString();
  const resultLine=runOutput.split(/\r?\n/).findLast(line=>line.startsWith('FIXTURE_RESULT_JSON '));
  const result=resultLine?JSON.parse(resultLine.slice('FIXTURE_RESULT_JSON '.length)):null;
  const stages=runOutput.split(/\r?\n/).filter(line=>line.startsWith('STAGE_JSON ')).map(line=>JSON.parse(line.slice('STAGE_JSON '.length)));
  const migrations=runOutput.split(/\r?\n/).filter(line=>line.startsWith('APPLY LOCAL '));
  fs.appendFileSync(logPath,`CLEANUP ${completedAt} exact container ${containerId} removed and absence verified\n`);
  fs.writeFileSync(resultPath,JSON.stringify({startedAt,completedAt,containerId,name,image,baselineSha256:'e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc',network:'none',noPorts:true,noMounts:true,cleanupVerified,exitCode:runStatus,migrations,stages,result,logPath},null,2));
  console.log("CLEANUP exact task-created container removed; absence verified");
 }
}


