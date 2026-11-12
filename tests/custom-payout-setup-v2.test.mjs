import test from 'node:test';
import assert from 'node:assert/strict';
import * as codec from '../src/lib/api/custom-payout-setup-v2.ts';
import {createCustomPayoutIntentV1} from '../src/lib/api/custom-payout-intent-v1.ts';
import {isRetainedSetupSaveRequest} from '../src/lib/api/setup.ts';
import {isLinkedSetupSaveEnvelope} from '../src/lib/api/setup-event-links.ts';
import {qSetupPrizeWorkspace} from './fixtures/q-setup-prize-workspace.mjs';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const base={tournamentId:id(1),setupRevisionId:id(2),setupVersion:1,sourceDigest:'a'.repeat(64)};
function fixture(){
 const payload=structuredClone(qSetupPrizeWorkspace(id(3)).current);for(const k of ['revisionId','version','createdAt'])delete payload[k];
 const e=payload.events[0];delete e.sourceStatus;
 e.qPools=[{poolTypeCode:'Graduated (1-in-7)',entryFeeCents:1000,note:''},{poolTypeCode:'Equal',entryFeeCents:500,note:'unchanged'}];
 e.sidePools=[{poolTypeCode:'Named Side',entryFeeCents:1000,note:''}];
 const source={...base,eventClientRowId:e.clientRowId,poolSlot:1};
 return {kind:'setup-custom-payouts-v2',base:structuredClone(base),request:{expectedVersion:1,payload,idempotencyKey:id(4)},choices:[{mainClientRowId:e.clientRowId,consolationClientRowIds:[]}],customPayouts:[createCustomPayoutIntentV1('q',7,source),createCustomPayoutIntentV1('side',7,source)]};
}
test('new exact envelope preserves original request and Equal Q; old endpoints reject it',()=>{
 const e=fixture(),before=JSON.stringify(e);assert.equal(codec.isSetupCustomPayoutsV2(e,base),true);assert.equal(isRetainedSetupSaveRequest(e.request),true);assert.equal(isRetainedSetupSaveRequest(e),false);assert.equal(isLinkedSetupSaveEnvelope(e),false);
 const raw=codec.serializeSetupCustomPayoutsV2(e,base),saved=codec.parseSetupCustomPayoutsV2(raw,base);assert.deepEqual(saved,e);assert.equal(JSON.stringify(e),before);assert.ok(Object.isFrozen(saved.request.payload.events[0]));assert.equal(saved.request.payload.events[0].qPools[1].poolTypeCode,'Equal');
 const reordered=Object.fromEntries(Object.entries(e).reverse());assert.equal(codec.serializeSetupCustomPayoutsV2(reordered,base),raw);assert.equal(codec.parseSetupCustomPayoutsV2(JSON.stringify(e),base),null);
});
test('source, duplicate, alias, choice and contradictory advertised selections fail closed',()=>{
 for(const mutate of [e=>e.customPayouts=[],e=>e.customPayouts.push(e.customPayouts[0]),e=>e.customPayouts[0].source.sourceDigest='b'.repeat(64),e=>e.customPayouts[1].source.setupRevisionId=id(9),e=>e.request.expectedVersion++,e=>e.request.payload.events[0].qPools[0].poolTypeCode='Equal',e=>e.request.payload.events[0].sidePools[0].payoutType='graduated-1-in-6',e=>e.request.payload.events.push(structuredClone(e.request.payload.events[0])),e=>e.choices[0].mainClientRowId=id(9),e=>e.request.idempotencyKey='A0000000-0000-4000-8000-000000000001',e=>e.extra=true]){
  const e=structuredClone(fixture());mutate(e);assert.equal(codec.isSetupCustomPayoutsV2(e,base),false);
 }
 for(const key of ['tournamentId','setupRevisionId','sourceDigest'])assert.equal(codec.isSetupCustomPayoutsV2(fixture(),{...base,[key]:key==='sourceDigest'?'b'.repeat(64):id(9)}),false);
 const cyclic=fixture();cyclic.request.payload.events[0].note=cyclic;assert.equal(codec.isSetupCustomPayoutsV2(cyclic,base),false);
});
test('Satellite ratio can be retained explicitly without resolving its allocation policy',()=>{
 const e=fixture(),sat=structuredClone(e.request.payload.events[0]);sat.clientRowId=id(8);sat.eventKind='satellite';sat.qPools=[];sat.sidePools=[];sat.payoutNote='1 in 101';e.request.payload.events.push(sat);
 e.customPayouts.push(createCustomPayoutIntentV1('satellite',101,{...base,eventClientRowId:sat.clientRowId,poolSlot:null}));assert.equal(codec.isSetupCustomPayoutsV2(e,base),true);
 sat.payoutNote='Top 4';assert.equal(codec.isSetupCustomPayoutsV2(e,base),false);
});
test('full retained recovery binds actor, operation and every unchanged payload field',()=>{
 const e=fixture(),r=codec.createSetupCustomPayoutsRecoveryV2(id(10),e,base),raw=codec.serializeSetupCustomPayoutsRecoveryV2(r,base);
 assert.deepEqual(codec.parseSetupCustomPayoutsRecoveryV2(raw,id(10),id(4),base),r);assert.equal(codec.parseSetupCustomPayoutsRecoveryV2(raw,id(11),id(4),base),null);assert.equal(codec.parseSetupCustomPayoutsRecoveryV2(raw,id(10),id(5),base),null);
 const changed=structuredClone(r);changed.envelope.request.payload.events[0].qPools[1].note='changed';assert.equal(codec.setupCustomPayoutsRecoveryMatchesV2(changed,r,base),false);assert.equal(codec.setupCustomPayoutsRecoveryMatchesV2(r,r,base),true);
 assert.equal(codec.parseSetupCustomPayoutsRecoveryV2(raw,id(10),id(4),{...base,sourceDigest:'b'.repeat(64)}),null);assert.equal(codec.parseSetupCustomPayoutsRecoveryV2(raw+' ',id(10),id(4),base),null);
});
test('custom advertised choices require complete explicit intent coverage; presets and Equal remain unchanged',()=>{
 for(const scope of ['q','side']){
  const e=fixture();e.customPayouts=e.customPayouts.filter(i=>i.scope!==scope);assert.equal(codec.isSetupCustomPayoutsV2(e,base),false,`missing ${scope}`);
 }
 const e=fixture(),sat=structuredClone(e.request.payload.events[0]);sat.clientRowId=id(8);sat.eventKind='satellite';sat.qPools=[];sat.sidePools=[];sat.payoutNote='1 in 7';e.request.payload.events.push(sat);
 assert.equal(codec.isSetupCustomPayoutsV2(e,base),false,'missing Satellite');
 for(const preset of ['1 in 4','1 in 5','1 in 6','Top 4','Historical free text']){sat.payoutNote=preset;assert.equal(codec.isSetupCustomPayoutsV2(e,base),true);}
 e.request.payload.events.pop();
 for(const preset of ['Graduated (1-in-4)','Graduated (1-in-6)','Graduated (1-in-8)','Graduated (1-in-10)','Equal','Historical free text']){
  const copy=structuredClone(e);copy.request.payload.events[0].qPools[0].poolTypeCode=preset;copy.customPayouts=copy.customPayouts.filter(i=>i.scope!=='q');assert.equal(codec.isSetupCustomPayoutsV2(copy,base),true);
 }
 for(const preset of ['graduated-1-in-4','graduated-1-in-6','graduated-1-in-8','graduated-1-in-10']){
  const copy=structuredClone(e);copy.request.payload.events[0].sidePools[0].payoutType=preset;copy.customPayouts=copy.customPayouts.filter(i=>i.scope!=='side');assert.equal(codec.isSetupCustomPayoutsV2(copy,base),true);
 }
});
test('trimmed ratio-looking coverage cannot silently omit intent; retained bytes are never normalized',()=>{
 for(const text of [' Graduated (1-in-7)','Graduated (1-in-7) ','\tGraduated (1-in-7)\n']){
  const e=fixture();e.request.payload.events[0].qPools[0].poolTypeCode=text;const before=JSON.stringify(e);
  assert.equal(codec.isSetupCustomPayoutsV2(e,base),false,'intent advertisement must be canonical');e.customPayouts=e.customPayouts.filter(i=>i.scope!=='q');assert.equal(codec.isSetupCustomPayoutsV2(e,base),false,'missing Q intent');assert.ok(before.includes(JSON.stringify(text).slice(1,-1)));
 }
 for(const text of [' Graduated (1-in-4)','Graduated (1-in-6) ']){
  const e=fixture();e.request.payload.events[0].qPools[0].poolTypeCode=text;e.customPayouts=e.customPayouts.filter(i=>i.scope!=='q');const raw=codec.serializeSetupCustomPayoutsV2(e,base);assert.ok(raw);assert.equal(codec.parseSetupCustomPayoutsV2(raw,base).request.payload.events[0].qPools[0].poolTypeCode,text);
 }
 for(const text of [' 1 in 7','1 in 7 ','\t1 in 101\n',' 1 in 4','1 in 6 ']){
  const e=fixture(),sat=structuredClone(e.request.payload.events[0]);sat.clientRowId=id(8);sat.eventKind='satellite';sat.qPools=[];sat.sidePools=[];sat.payoutNote=text;e.request.payload.events.push(sat);
  const preset=['1 in 4','1 in 6'].includes(text.trim());assert.equal(codec.isSetupCustomPayoutsV2(e,base),preset);
  if(preset){const raw=codec.serializeSetupCustomPayoutsV2(e,base);assert.equal(codec.parseSetupCustomPayoutsV2(raw,base).request.payload.events[1].payoutNote,text);}
  else{e.customPayouts.push(createCustomPayoutIntentV1('satellite',text.includes('101')?101:7,{...base,eventClientRowId:sat.clientRowId,poolSlot:null}));assert.equal(codec.isSetupCustomPayoutsV2(e,base),false);}
 }
});
test('explicit full-protocol empty clear requires canonical noncustom payload and retains immutable recovery',()=>{
 const e=fixture();e.customPayouts=[];assert.equal(codec.isSetupCustomPayoutsV2(e,base),false);
 e.request.payload.events[0].qPools[0].poolTypeCode='Graduated (1-in-6)';assert.equal(codec.isSetupCustomPayoutsV2(e,base),false,'untyped Side still needs intent');
 e.request.payload.events[0].sidePools[0].payoutType='graduated-1-in-4';assert.equal(codec.isSetupCustomPayoutsV2(e,base),true);
 for(const change of [{sourceDigest:'b'.repeat(64)},{setupRevisionId:id(99)}]){const wrong=structuredClone(e);Object.assign(wrong.base,change);assert.equal(codec.isSetupCustomPayoutsV2(wrong,base),false);assert.equal(codec.createSetupCustomPayoutsRecoveryV2(id(10),wrong,base),null);}
 const missing=structuredClone(e);delete missing.base;assert.equal(codec.isSetupCustomPayoutsV2(missing,base),false);
 const recovery=codec.createSetupCustomPayoutsRecoveryV2(id(10),e,base),raw=codec.serializeSetupCustomPayoutsRecoveryV2(recovery,base),decoded=codec.parseSetupCustomPayoutsRecoveryV2(raw,id(10),id(4),base);
 assert.deepEqual(decoded.envelope.customPayouts,[]);assert.equal(decoded.envelope.request.payload.events[0].qPools[1].poolTypeCode,'Equal');assert.ok(Object.isFrozen(decoded.envelope.customPayouts));
 e.request.payload.events[0].qPools[0].poolTypeCode='Graduated (1-in-7)';assert.equal(codec.isSetupCustomPayoutsV2(e,base),false);assert.equal(decoded.envelope.request.payload.events[0].qPools[0].poolTypeCode,'Graduated (1-in-6)');assert.equal(codec.parseSetupCustomPayoutsRecoveryV2(raw,id(10),id(4),base).envelope.customPayouts.length,0);
});

test('explicit full-protocol empty event draft retains other setup fields and no dangling intents',()=>{const e=fixture();e.request.payload.events=[];e.choices=[];e.customPayouts=[];assert.equal(codec.isSetupCustomPayoutsV2(e,base),true);const restored=codec.parseSetupCustomPayoutsV2(codec.serializeSetupCustomPayoutsV2(e,base),base);assert.deepEqual(restored.request.payload.events,[]);assert.equal(restored.request.payload.venue,e.request.payload.venue);assert.deepEqual(restored.customPayouts,[]);});
