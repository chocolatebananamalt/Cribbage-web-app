import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';import {fileURLToPath} from 'node:url';const __dirname=path.dirname(fileURLToPath(import.meta.url));
function fixture({status=401, preflightFailure=false, uncertain=false, releaseFailure=false}={}) {
  let exclusive=false, calls=0, releases=0;
  const retained = new Map([['foreign-player-pending', 'original-fictional-bytes']]);
  const coordinator = {
    beginSafeRecoverySwitch:async()=>{exclusive=true;},
    cancelSafeRecoverySwitch:async()=>{releases++;if(releaseFailure)throw Error('fictional controller drift');exclusive=false;},
    finishRecoveryAuthentication:()=>{exclusive=false;},
  };
  const source=fs.readFileSync(path.join(__dirname,'../src/lib/auth/recovery-auth-client.ts'),'utf8');
  const exports={};
  const sandbox={exports,Response,fetch:async()=>{calls++;if(uncertain)throw Error('fictional transport loss');return Response.json({error:'sign_in_not_confirmed'},{status});},require:name=>{
    if(name.includes('recovery-write-coordinator'))return coordinator;
    if(name.includes('recovery-preflight'))return {protectUnownedRecovery:async()=>{if(preflightFailure)throw Error('fictional storage unavailable');}};
    if(name.endsWith('recovery-auth'))return {safeAuthNext:x=>x};
    if(name.endsWith('safe-device-switch'))return {recoveryActionGate:{enter:()=>true,leave:()=>{}}};
    throw Error('unexpected dependency');
  }};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
  return {submit:()=>exports.submitCoordinatedAuthentication({mode:'code',code:'fictional_code_only',attemptId:'40000000-0000-4000-8000-000000000001',next:'/'}),snapshot:()=>({exclusive,calls,releases,retained:[...retained]})};
}
for(const status of [400,401,403,409,429])test(`confirmed ${status} rejection releases navigation barrier and preserves foreign work`,async()=>{
  const f=fixture({status});const before=f.snapshot().retained;assert.equal((await f.submit()).status,'blocked');
  assert.equal(f.snapshot().exclusive,false);assert.equal(f.snapshot().releases,1);assert.equal(f.snapshot().calls,1);assert.deepEqual(f.snapshot().retained,before);
});
test('pre-request storage failure releases barrier without any credential request',async()=>{
  const f=fixture({preflightFailure:true});await assert.rejects(f.submit());assert.equal(f.snapshot().exclusive,false);assert.equal(f.snapshot().calls,0);assert.equal(f.snapshot().releases,1);
});
test('unconfirmed transport outcome remains held, reconciles once and never replays code',async()=>{
  const f=fixture({uncertain:true});assert.equal((await f.submit()).status,'blocked');assert.equal(f.snapshot().exclusive,true);assert.equal(f.snapshot().calls,2);assert.equal(f.snapshot().releases,0);
});
test('server failure remains held after unsuccessful reconciliation',async()=>{
  const f=fixture({status:503});assert.equal((await f.submit()).status,'blocked');assert.equal(f.snapshot().exclusive,true);assert.equal(f.snapshot().calls,2);assert.equal(f.snapshot().releases,0);
});
for(const status of [401,409])test(`post-request ${status} release failure returns blocked without claiming no exchange`,async()=>{
  const f=fixture({status,releaseFailure:true});const result=await f.submit();assert.equal(result.status,'blocked');assert.match(result.message,/coordination could not resume/);assert.doesNotMatch(result.message,/Nothing was exchanged/);assert.equal(f.snapshot().calls,1);assert.equal(f.snapshot().exclusive,true);
});
