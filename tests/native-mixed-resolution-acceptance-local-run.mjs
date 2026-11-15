// Approved fictional local-only acceptance; cleanup always verifies owned CID.
import fs from 'node:fs';import{spawnSync}from'node:child_process';import assert from'node:assert/strict';
const dir='test-results/native-mixed-resolution-20261107',prefix='tests/native-mixed-resolution-acceptance-local-',steps=[['runtime','install'],['setup'],['flow'],['scoring','prepare'],['scoring','start'],['scoring','resolve-pending']];
let failure=null;try{for(const[name,action]of steps){const args=['--experimental-strip-types',prefix+name+'.mjs',...(action?[action]:[])],r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:32e6});fs.writeFileSync(`${dir}/${name}-${action??'run'}.log`,r.stdout+r.stderr);assert.equal(r.status,0,r.stderr||r.stdout);console.log('PASS',name,action??'run');}}
catch(error){failure=String(error);fs.writeFileSync(dir+'/acceptance-error.txt',failure);}
finally{const r=spawnSync(process.execPath,['--experimental-strip-types',prefix+'runtime.mjs','cleanup'],{encoding:'utf8',windowsHide:true,maxBuffer:8e6});fs.writeFileSync(dir+'/cleanup.log',r.stdout+r.stderr);assert.equal(r.status,0,r.stderr);const state=JSON.parse(fs.readFileSync(dir+'/state.json'));assert.equal(state.cleaned,true);assert.equal(state.cleanupVerified,true);console.log('CLEANUP VERIFIED',state.containerId);}
if(failure)throw Error(failure);
