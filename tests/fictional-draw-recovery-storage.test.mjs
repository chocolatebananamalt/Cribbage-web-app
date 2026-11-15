import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {isAppRecoveryStorageKey,countAppSessionStorageRecords,clearAppSessionStorage} from '../src/lib/client-session-storage.ts';
import {createRecoveryCoordinationState,trackRecoveryWriter} from '../src/lib/recovery-coordination-state.ts';

const actors=['40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002'];
const key=(actor,action)=>`fictional-draw:${action}:${actor}:tournament:event:${action==='admit'?'admission':'reviewed-operation'}`;
function storage(){const data=new Map();return{data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}

test('actual admission/publication writer prefix counts both actors without inspecting or changing retained bytes',()=>{
 const source=fs.readFileSync('src/components/fictional-draw-action.tsx','utf8');
 assert.match(source,/key=`fictional-draw:\$\{action\}:\$\{actorId\}:\$\{tournamentId\}:\$\{eventId\}:/);
 assert.match(source,/setAppRecoveryItem\(sessionStorage,key,JSON\.stringify\(request\)\)/);
 const s=storage();for(const actor of actors)for(const action of ['admit','publish_schedule'])s.setItem(key(actor,action),JSON.stringify({actor,action,operationId:actor,confirmed:true}));
 s.setItem('unrelated-site-preference','keep');s.setItem('fictional-drawback:unrecognized','keep');s.setItem('fictional-draw','keep');
 const before=[...s.data];assert.equal(countAppSessionStorageRecords(s),4);assert.deepEqual([...s.data],before);
 for(const actor of actors)for(const action of ['admit','publish_schedule'])assert.equal(isAppRecoveryStorageKey(key(actor,action)),true);
 for(const k of ['unrelated-site-preference','fictional-drawback:unrecognized','fictional-draw'])assert.equal(isAppRecoveryStorageKey(k),false);
 // Low-level targeted clear is explicit; recognition/counting never invokes it.
 clearAppSessionStorage(s);assert.equal(countAppSessionStorageRecords(s),0);assert.deepEqual([...s.data],before.slice(4));
});

// Actual coordinator module with a ready/blocked unit lease and fictional owner
// port. This tests synchronous registry/conflict/lease behavior, not browser locks.
function coordinator(actor){
 const state=createRecoveryCoordinationState();state.ready();let owner=actor;
 const ownerPort={assertRecoveryStorageOwner:a=>{if(a!==owner)throw Error('recovery_owner_mismatch');},claimRecoveryStorageOwner:a=>{if(a!==owner)throw Error('recovery_owner_mismatch');}};
 const code=ts.transpileModule(fs.readFileSync('src/lib/recovery-write-coordinator.ts','utf8')+'\nactorId='+JSON.stringify(actor)+';',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loaded={exports:{}};vm.runInNewContext(code,{module:loaded,exports:loaded.exports,require:name=>{
  if(name.includes('recovery-owner'))return ownerPort;
  if(name.includes('client-session-storage'))return{isAppRecoveryStorageKey};
  if(name.includes('recovery-coordination-state'))return{createRecoveryCoordinationState:()=>state,trackRecoveryWriter};
  if(name.includes('recovery-diagnostic'))return{recoveryStage:async(_name,op)=>op()};
  throw Error('Unexpected dependency '+name);
 }});
 return{write:loaded.exports.setAppRecoveryItem,state,changeOwner:a=>{owner=a;}};
}

test('registered draw writes reach actual coordinator, retain exact retries and refuse conflicts/unrecognized keys',()=>{
 const s=storage();for(const actor of actors){const c=coordinator(actor);for(const action of ['admit','publish_schedule']){const k=key(actor,action),raw=JSON.stringify({action,operationId:actor});c.write(s,k,raw);c.write(s,k,raw);assert.throws(()=>c.write(s,k,raw+' '),/recovery_record_conflict/);assert.equal(s.getItem(k),raw);}}
 assert.equal(countAppSessionStorageRecords(s),4);const before=[...s.data];assert.throws(()=>coordinator(actors[0]).write(s,'fictional-drawback:new','unsupported'),/recovery_storage_key_unsupported/);assert.deepEqual([...s.data],before);
});

test('recognition never bypasses owner or draining barriers and failures preserve both actors pending work',async()=>{
 const s=storage(),a=coordinator(actors[0]),b=coordinator(actors[1]);a.write(s,key(actors[0],'admit'),'actor-a-exact');b.write(s,key(actors[1],'publish_schedule'),'actor-b-exact');const before=[...s.data];
 a.changeOwner(actors[1]);assert.throws(()=>a.write(s,key(actors[0],'admit'),'actor-a-exact'),/recovery_owner_mismatch/);
 await b.state.drain();assert.throws(()=>b.write(s,key(actors[1],'publish_schedule'),'actor-b-exact'),/barrier_closed/);
 assert.equal(countAppSessionStorageRecords(s),2);assert.deepEqual([...s.data],before);
});

test('actual sign-out safety reader treats either actor draw retries as unsafe without clearing them',async()=>{
 const source=fs.readFileSync('src/components/shared-device-sign-out.tsx','utf8'),tree=ts.createSourceFile('sign-out.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const reader=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='readLocalState');assert(reader);
 const s=storage();s.setItem(key(actors[0],'admit'),'actor-a');s.setItem(key(actors[1],'publish_schedule'),'actor-b');s.setItem('unrelated-site-preference','keep');
 const code=ts.transpileModule(reader.getText(tree)+'\nglobalThis.readState=readLocalState;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const context={window:{sessionStorage:s},countAppSessionStorageRecords,countOfflineSubmissions:async()=>0};vm.runInNewContext(code,context);
 const before=[...s.data],both=await context.readState();assert.equal(both.status,'unsafe');assert.equal(both.retryCount,2);assert.deepEqual([...s.data],before);
 // Completing actor A's own operation never makes actor B's retained work safe.
 s.removeItem(key(actors[0],'admit'));const other=await context.readState();assert.equal(other.status,'unsafe');assert.equal(other.retryCount,1);assert.equal(s.getItem(key(actors[1],'publish_schedule')),'actor-b');
 const guarded=source.indexOf('if (current.status !== "safe")'),clear=source.indexOf('clearAppSessionStorage(window.sessionStorage)');assert(guarded>=0&&clear>guarded);assert.match(source.slice(guarded,clear),/return;/);
});
