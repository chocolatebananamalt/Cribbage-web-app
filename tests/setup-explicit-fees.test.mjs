import test from 'node:test';
import assert from 'node:assert/strict';
import {isSetupEvent,isRetainedSetupSaveRequest,isSetupSaveRequest,isSetupWorkspace} from '../src/lib/api/setup.ts';
import {setupFinancialTermsMatch} from '../src/lib/setup-save-verification.ts';
import {qSetupPrizeWorkspace} from './fixtures/q-setup-prize-workspace.mjs';
const id='10000000-0000-4000-8000-000000000001';
function fixture(){const workspace=qSetupPrizeWorkspace(id);const current=workspace.current;const payload=structuredClone(current);for(const k of ['revisionId','version','createdAt'])delete payload[k];for(const e of payload.events)delete e.sourceStatus;return{workspace,current,request:{expectedVersion:0,idempotencyKey:id,payload}};}
test('paid entry safeguard rejects missing, blank, zero, invalid and subminimum amounts',()=>{
 for(const kind of ['main','consolation'])for(const fee of [undefined,null,'',' ',NaN,-1,0,99,...(kind==='main'?[100,299]:[])]){const e=fixture().request.payload.events[0];e.eventKind=kind;e.entryFeeCents=fee;assert.equal(isSetupEvent(e),false,`${kind}:${String(fee)}`);}
 for(const [kind,fee] of [['main',300],['consolation',100]]){const e=fixture().request.payload.events[0];e.eventKind=kind;e.entryFeeCents=fee;assert.equal(isSetupEvent(e),true);}
});
test('free entry requires explicit boolean intent and exact zero, not a blank or inferred zero',()=>{
 const e=fixture().request.payload.events[0];e.entryFeeCents=0;assert.equal(isSetupEvent(e),false);e.freeEntry=true;assert.equal(isSetupEvent(e),true);
 for(const fee of [null,undefined,NaN,100]){e.entryFeeCents=fee;assert.equal(isSetupEvent(e),false);}
 e.entryFeeCents=0;e.freeEntry='true';assert.equal(isSetupEvent(e),false);
});
test('enabled Q and Side pools require positive explicit five-dollar increments; disabled arrays need no fee',()=>{
 for(const key of ['qPools','sidePools'])for(const fee of [undefined,null,'',' ',NaN,-500,0,100,499,501,700,500,1000]){const e=fixture().request.payload.events[0];e[key]=[{poolTypeCode:'Test',entryFeeCents:fee,note:''}];assert.equal(isSetupEvent(e),fee===500||fee===1000,`${key}:${String(fee)}`);}
 assert.equal(isSetupEvent(fixture().request.payload.events[0]),true);
});
test('legacy retained zero and nonlattice terms remain readable but cannot become a new valid save',()=>{
 const f=fixture();f.request.payload.events[0].entryFeeCents=0;f.current.events[0].entryFeeCents=0;assert.equal(isRetainedSetupSaveRequest(f.request),true);assert.equal(isSetupSaveRequest(f.request),false);assert.equal(isSetupWorkspace(f.workspace),true);
 assert.equal(setupFinancialTermsMatch(f.request,{revisionId:id,version:1},f.current),true);
 f.request.payload.events[0].freeEntry=true;assert.equal(setupFinancialTermsMatch(f.request,{revisionId:id,version:1},f.current),false);f.current.events[0].freeEntry=true;assert.equal(setupFinancialTermsMatch(f.request,{revisionId:id,version:1},f.current),true);
});
