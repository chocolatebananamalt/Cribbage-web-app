import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
const source=fs.readFileSync('src/components/native-mixed-playoff-player-provider-v1.tsx','utf8');
test('normal wrapper defaults off and pins actual public environment before SDK/retained construction',()=>{
 assert.match(source,/enabled=false/);const guard=source.indexOf('if(!nativeMixedPlayoffPlayerEnvMatchesV1(captured,env))return;'),client=source.indexOf('const client=createClient()'),retained=source.indexOf('retained:createIndexedSeriesGameRetainedV1()');assert(guard>0&&client>guard&&retained>client);
 assert.match(source,/env\.url===t\.projectUrl/);assert.match(source,/hostname\.split\('\.'\)\[0\]===t\.projectRef/);assert.doesNotMatch(source,/service_role|private-admin|signOut\(/);
});
test('SSR snapshot never supplies private display; own identity/fresh read/final identity gate hydration',()=>{
 assert.doesNotMatch(source,/\.initialState|state=\{initialState\}|state:initialState/);assert.match(source,/Promise\.allSettled\(\[controller\.initialize\(\),transport\.read\(\)\]\)/);
 assert.match(source,/read\.value\.error!==null\|\|!read\.value\.data\|\|!await identity\(\)/);assert.match(source,/state:structuredClone\(read\.value\.data\)/);assert.match(source,/loaded\.owner===permit\.owner&&loaded\.epoch===permit\.epoch/);assert.match(source,/permit\.port===port/);
});
test('auth invalidates and disposes synchronously; queueMicrotask avoids auth callback lock re-entry',()=>{
 assert.match(source,/const authChanged=\(\)=>\{if\(!o\.active\)return;const n=\+\+o\.epoch;hide\(/);
 assert.match(source,/queueMicrotask\(\(\)=>\{if\(current\(n\)\)void o\.check\(n\);\}\)/);assert.match(source,/o\.controller\?\.dispose\(\)/);assert.match(source,/region\.current\.hidden=true/);assert.match(source,/unsubAuth\(\);unsubOnline\(\)/);
});
test('only explicit held-lease guarded command creates one operation, stages exact CAS then sends',()=>{
 assert.match(source,/latest\.current===lease/);assert.match(source,/JSON\.stringify\(o\.controller\.getSnapshot\(\)\)===snapshotKey/);assert.match(source,/!onlineRef\.current\|\|flight\.current/);
 assert.equal((source.match(/port\.makeOperationId\(\)/g)||[]).length,1);assert.match(source,/transport\.prepare\(port\.makeOperationId\(\),command\)/);assert.match(source,/await controller\.stage\(prepared,loaded\.state\)/);assert.match(source,/await controller\.sendExact\(\)/);
 assert.match(source,/Retry Saved Operation/);assert.match(source,/Check Saved Operation/);assert.doesNotMatch(source,/setInterval\(|(?:retained|localStorage|indexedDB)\.clear\(|deleteDatabase\(|retained\.transition\(/);
});
test('host publishes refreshed state or controller-proven state, never command acknowledgement directly',()=>{
 assert.match(source,/state=snapshot\.state\?\?loaded\.state/);assert.match(source,/state=fresh\.data/);assert.doesNotMatch(source,/state:.*receipt|state=reply\.data|setLoaded\([^\n]*initialState/);
 assert.match(source,/Mock acceptance is neither a signed-in/);assert.match(source,/No initialState is consumed/);
 const screen=fs.readFileSync('src/components/native-mixed-playoff-player-v1.tsx','utf8');for(const label of["Opponent's Entry",'Confirmed Wins','Refresh Results','Review Updated Results'])assert(screen.includes(label));assert.match(screen,/!connected&&<p className="native-mixed-playoff-limitation"/);
});
test('failed refresh revokes admission without stranding busy state; repeated connectivity does not revoke an unchanged lease',()=>{
 assert.match(source,/fresh\.error!==null\|\|!fresh\.data\)\{revoke\(o,'Current results/);assert.match(source,/const revoke=.*flight\.current=null/);assert.match(source,/const revoke=.*setBusy\(false\)/);
 assert.match(source,/if\(onlineRef\.current!==value\)\{onlineRef\.current=value;latest\.current=null;setOnline\(value\);bumpConnectivity\(n=>n\+1\);\}/);
 assert.match(source,/if\(!current\(n\)\|\|!o\.allowed\)return;flight\.current=null;setBusy\(false\);admission\.publish\(o,n,controller\);setLoaded/);
});
test('coalesced offline-online transitions force a fresh committed lease even when final boolean is unchanged',()=>{
 assert(source.includes('[,bumpConnectivity]=useState(0)'));
 assert(source.includes('latest.current=null;setOnline(value);bumpConnectivity(n=>n+1)'));
 assert(source.includes('latest.current===lease'));
});
test('external admission snapshot fails closed during stale/concurrent Loaded renders after auth revocation',()=>{
 assert.match(source,/useSyncExternalStore\(admission\.subscribe,admission\.get,admission\.server\)/);
 assert.match(source,/value\.owner===current&&value\.owner\.active&&value\.owner\.allowed&&value\.owner\.epoch===value\.epoch&&value\.owner\.controller===value\.controller/);
 assert.match(source,/const hide=.*admission\.clear\(o\)/);assert.match(source,/const revoke=.*admission\.clear\(o\)/);
 assert.match(source,/visible=!!loaded&&!!permit&&loaded\.owner===permit\.owner&&loaded\.epoch===permit\.epoch/);
});
