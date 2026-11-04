import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSetupEventLinks, isLinkedSetupSaveEnvelope, isLinkedSetupSaveResult, isSetupEventLinksSnapshot, isSetupEventLinksWorkspace, isLinkedSetupActivationResult } from '../src/lib/api/setup-event-links.ts';
import { isRetainedSetupSaveRequest, isSetupSaveRequest } from '../src/lib/api/setup.ts';
import { qSetupPrizeWorkspace } from './fixtures/q-setup-prize-workspace.mjs';
const ids = Array.from({length: 8}, (_, i) => `10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const [m1,m2,c1,c2,other,revision,key] = ids;
const event = (id, kind) => ({clientRowId:id,eventKind:kind});
const events = [event(m1,'main'),event(m2,'main'),event(c1,'consolation'),event(c2,'consolation'),event(other,'satellite')];
const choices = [{mainClientRowId:m1,consolationClientRowIds:[c1,c2]},{mainClientRowId:m2,consolationClientRowIds:[]}];
function envelope() {
 const payload=structuredClone(qSetupPrizeWorkspace(key).current);
 for(const k of ['revisionId','version','createdAt']) delete payload[k];
 const base=payload.events[0];
 for(const k of ['sourceStatus']) delete base[k];
 for(const p of [...base.qPools,...base.sidePools]) { delete p.slot; delete p.sourceStatus; }
 base.sidePools=[{poolTypeCode:'Historic',entryFeeCents:1000,note:''}];
 payload.events=events.map(e=>({...structuredClone(base),...e}));
 return {kind:'setup-event-links-v1',request:{expectedVersion:2,payload,idempotencyKey:key},choices:structuredClone(choices)};
}
function saved(e) { return {status:'linked_setup_saved',result:{status:'setup_draft_saved',revisionId:revision,version:3,eventCount:e.request.payload.events.length,operationalEventsCreated:false,rulesetApproved:false,seatingUpdated:false,financeUpdated:false,resultsUpdated:false,payoutsCalculated:false,qualifiersCalculated:false,accSubmissionCreated:false},links:{protocol:'setup-event-links-v1',setupRevisionId:revision,setupVersion:3,choices:structuredClone(e.choices),complete:true,associationHash:'a'.repeat(64)}}; }
test('multiple mains and children, explicit no, missing choice and orphan',()=>{
 assert.deepEqual(validateSetupEventLinks(events,choices),{valid:true,complete:true,reasons:[]});
 assert.deepEqual(validateSetupEventLinks(events,[choices[0]]),{valid:true,complete:false,reasons:['main_choice_missing']});
 assert.deepEqual(validateSetupEventLinks(events,[{...choices[0],consolationClientRowIds:[c1]},choices[1]]),{valid:true,complete:false,reasons:['consolation_unassigned']});
});
test('invalid kinds, references, duplicate rows and unexpected shapes reject',()=>{
 for(const bad of [
  [{mainClientRowId:c1,consolationClientRowIds:[]}], [{mainClientRowId:m1,consolationClientRowIds:[other]}],
  [{mainClientRowId:m1,consolationClientRowIds:[ids[7]]}], [{mainClientRowId:'bad',consolationClientRowIds:[]}],
  [choices[0],choices[0]], [{mainClientRowId:m1,consolationClientRowIds:[c1]},{mainClientRowId:m2,consolationClientRowIds:[c1]}],
  [{mainClientRowId:m1,consolationClientRowIds:[m2]}], [{...choices[0],extra:true}], [{mainClientRowId:m1,consolationClientRowIds:'bad'}]
 ]) assert.equal(validateSetupEventLinks(events,bad).valid,false);
 assert.equal(validateSetupEventLinks([...events,events[0]],choices).valid,false);
});
test('retained historical request and exact envelopes preserve original bytes',()=>{
 const e=envelope(), before=JSON.stringify(e);
 assert.equal(isRetainedSetupSaveRequest(e.request),true); assert.equal(isSetupSaveRequest(e.request),false);
 assert.equal(isLinkedSetupSaveEnvelope(e),true); assert.equal(JSON.stringify(e),before);
 assert.equal(isLinkedSetupSaveEnvelope({...e,extra:true}),false);
});
test('save acknowledgements bind revision, version, exact choices and computed completeness',()=>{
 const e=envelope(), result=saved(e); assert.equal(isLinkedSetupSaveResult(result,e),true);
 for(const change of [r=>r.result.version++,r=>r.result.eventCount++,r=>r.result.financeUpdated=true,r=>r.links.setupRevisionId=key,r=>r.links.setupVersion++,r=>r.links.complete=false,r=>r.links.choices.reverse(),r=>r.links.associationHash='x'.repeat(64),r=>r.links.extra=1,r=>r.extra=1]) {const r=structuredClone(result);change(r);assert.equal(isLinkedSetupSaveResult(r,e),false);}
 const incomplete=envelope(); incomplete.choices.pop(); const r=saved(incomplete);r.links.complete=false;assert.equal(isLinkedSetupSaveResult(r,incomplete),true);r.links.complete=true;assert.equal(isLinkedSetupSaveResult(r,incomplete),false);
 assert.equal(isSetupEventLinksSnapshot(result.links),true);assert.equal(isSetupEventLinksWorkspace({available:true,protocol:'setup-event-links-v1',current:result.links}),true);assert.equal(isSetupEventLinksWorkspace({available:true,protocol:'setup-event-links-v1',current:null,extra:1}),false);
});
test('activation acknowledgement binds old request and expected hash',()=>{
 const request={setupRevisionId:revision,expectedVersion:3,confirmed:true,idempotencyKey:key};
 const item={activationId:ids[0],setupEventVersionId:ids[1],rulesetVersionId:ids[2],eventId:ids[3],eventType:'main',name:'Main',format:'standard_singles',scoringMethod:'digital',gameCount:9};
 const result={status:'linked_setup_activated',associationHash:'a'.repeat(64),result:{status:'tournament_setup_activated',setupRevisionId:revision,setupVersion:3,eventCount:1,events:[item],roundsCreated:false,participantsEnrolled:false,seatingUpdated:false,financeUpdated:false,resultsUpdated:false,payoutsCalculated:false,qualifiersCalculated:false,accSubmissionCreated:false,registrationState:'open'}};
 assert.equal(isLinkedSetupActivationResult(result,request,'a'.repeat(64)),true);
 assert.equal(isLinkedSetupActivationResult(result,request,'b'.repeat(64)),false);
 assert.equal(isLinkedSetupActivationResult({...result,result:{...result.result,setupVersion:4}},request,'a'.repeat(64)),false);
 assert.equal(isLinkedSetupActivationResult({...result,extra:1},request,'a'.repeat(64)),false);
});
