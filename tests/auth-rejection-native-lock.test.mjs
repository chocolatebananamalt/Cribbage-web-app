import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {MessageChannel} from 'node:worker_threads';import ts from 'typescript';const app=process.cwd();
function load(source,deps,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n in deps)return deps[n];throw Error('unexpected dependency '+n)},...globals});return exports;}
test('real coordinator + native Web Locks: definite rejection frees worker navigation, uncertainty retains it',async()=>{
  const controller={state:'activated',scriptURL:'https://fictional.invalid/offline-score-sw.js',postMessage(data,ports){const result=data.kind==='acc-recovery-protocol-probe-v2'?{kind:'acc-recovery-protocol-ready-v2',version:data.version,requestId:data.requestId,workerScriptURL:this.scriptURL}:{kind:'acc-recovery-window-inventory-v2',version:data.version,requestId:data.requestId,status:'ok',otherWindows:0,leaseReadyOther:0,legacyOther:0};ports[0].postMessage(result);ports[0].close();}};
  const lifecycle=load(fs.readFileSync(path.join(app,'src/lib/recovery-coordination-state.ts'),'utf8'),{});
  const coordinator=load(fs.readFileSync(path.join(app,'src/lib/recovery-write-coordinator.ts'),'utf8'),{
    './auth/recovery-owner.ts':{assertRecoveryStorageOwner(){},claimRecoveryStorageOwner(){},markUnknownRecoveryOwner(){},readRecoveryOwnerMarkers:()=>[]},
    './client-session-storage.ts':{isAppRecoveryStorageKey:()=>true},
    './recovery-coordination-state.ts':lifecycle,'./recovery-diagnostic.ts':{recoveryStage:async(_stage,op)=>op()},
  },{navigator:{locks:navigator.locks,serviceWorker:{controller,register:async()=>({update:async()=>{}}),ready:Promise.resolve(),addEventListener(){}}},window:{location:{origin:'https://fictional.invalid'},setTimeout,clearTimeout,addEventListener(){}},MessageChannel,crypto,performance});
  await coordinator.acquireRecoveryDocument(null);
  const sharedAvailable=()=>navigator.locks.request('acc-recovery-document-v2',{mode:'shared',ifAvailable:true},lock=>!!lock);
  async function attempt(uncertain){return load(fs.readFileSync(path.join(app,'src/lib/auth/recovery-auth-client.ts'),'utf8'),{
    '../recovery-write-coordinator':coordinator,'./recovery-preflight':{protectUnownedRecovery:async()=>{}},'./recovery-auth':{safeAuthNext:x=>x},'../safe-device-switch':{recoveryActionGate:{enter:()=>true,leave(){}}},
  },{Response,fetch:async()=>{if(uncertain)throw Error('fictional lost response');return Response.json({error:'sign_in_not_confirmed'},{status:401});}}).submitCoordinatedAuthentication({mode:'code',code:'fictional_code',attemptId:'40000000-0000-4000-8000-000000000001',next:'/'});}
  try{
    await coordinator.beginSafeRecoverySwitch();assert.equal(await sharedAvailable(),false,'worker navigation cannot acquire shared lock during exclusive switch');
    await attempt(false);assert.equal(await sharedAvailable(),true,'confirmed rejection restores shared lease and permits navigation');
    await attempt(true);assert.equal(await sharedAvailable(),false,'uncertain exchange remains protected');
  }finally{await coordinator.cancelSafeRecoverySwitch();await coordinator.beginSafeRecoverySwitch();coordinator.finishRecoveryAuthentication();}
});
