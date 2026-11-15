import test from 'node:test';
import assert from 'node:assert/strict';
import { isSetupSaveWithUnchangedLegacySides } from '../src/lib/setup-legacy-side-validation.ts';
import { isSetupSaveRequest } from '../src/lib/api/setup.ts';
import { qSetupPrizeWorkspace } from './fixtures/q-setup-prize-workspace.mjs';

const id='10000000-0000-4000-8000-000000000001';
function fixture() {
 const current=qSetupPrizeWorkspace(id).current;
 current.events[0].sidePools=[{slot:1,poolTypeCode:'Historic Side',entryFeeCents:1000,note:'old',sourceStatus:'director_configured_unverified'}];
 const payload=structuredClone(current);
 for(const key of ['revisionId','version','createdAt'])delete payload[key];
 for(const event of payload.events){delete event.sourceStatus;for(const pool of [...event.qPools,...event.sidePools]){delete pool.slot;delete pool.sourceStatus;}}
 return {current,request:{expectedVersion:current.version,payload,idempotencyKey:id}};
}
test('unchanged historical Side Pool permits unrelated edits without inferring or saving a policy',()=>{
 const {current,request}=fixture();request.payload.tournamentName='New test name';
 assert.equal(isSetupSaveRequest(request),false);
 assert.equal(isSetupSaveWithUnchangedLegacySides(request,current),true);
 assert.equal(Object.hasOwn(request.payload.events[0].sidePools[0],'payoutType'),false);
});
test('unchanged historical team Side Pool remains editable without assigning a new singles-only policy',()=>{
 const {current,request}=fixture();current.events[0].formatCode='doubles';request.payload.events[0].formatCode='doubles';
 assert.equal(isSetupSaveWithUnchangedLegacySides(request,current),true);
});
test('legacy exception rejects stale baseline, new or edited untyped Side Pools and unknown types',()=>{
 for(const change of [
  f=>f.request.expectedVersion++, f=>f.request.payload.events[0].sidePools[0].entryFeeCents=1500,
  f=>f.request.payload.events[0].sidePools[0].note='changed', f=>f.request.payload.events[0].sidePools[0].poolTypeCode='Other',
  f=>f.request.payload.events[0].sidePools.push({poolTypeCode:'New',entryFeeCents:1000,note:''}),
  f=>f.request.payload.events[0].sidePools[0].payoutType='equal',
  f=>f.current.events[0].sidePools[0].payoutType='graduated-1-in-4',
  f=>f.request.payload.events[0].eventKind='consolation',
  f=>f.request.payload.events[0].formatCode='doubles',
  f=>f.request.payload.events[0].styleCode='Double Elimination',
 ]){const f=fixture();change(f);assert.equal(isSetupSaveWithUnchangedLegacySides(f.request,f.current),false);}
});
