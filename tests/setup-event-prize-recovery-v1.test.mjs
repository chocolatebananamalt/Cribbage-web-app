import test from 'node:test';import assert from 'node:assert/strict';
import {prizeSetupScenario,prizeSetupReceipt,prizeTestId as id} from './fixtures/setup-prize-replacement-v1.mjs';
import {buildPendingEventPrizeSetupV1 as build,serializePendingEventPrizeSetupV1 as serialize,parsePendingEventPrizeSetupV1 as parse,choicesFromPrizeWorkspaceV1,prizeWorkspaceCoversSetupV1,eventPrizeReadbackMatchesV1,assessEventPrizePendingResolutionV1 as resolution} from '../src/lib/setup-event-prize-recovery-v1.ts';
import {readEventPrizeAcceptedReplyV1,readEventPrizeRecordedRejectionV1,serializeEventPrizeSettingsV1,eventPrizeSettingsRequestHashV1} from '../src/lib/api/event-prize-settings-v1.ts';
const pending=s=>build(s.actorId,s.workspace,s.request,s.links,s.settings,s.prizes,'all',id(7));
test('normal Main, Consolation and Satellite authoring binds one full exact recoverable request',()=>{
 const s=prizeSetupScenario(),before=JSON.stringify(s),p=pending(s);assert(p);const raw=serialize(p);assert(raw);assert.deepEqual(parse(raw,s.actorId,s.tournamentId),p);assert.equal(parse(raw,id(99),s.tournamentId),null);assert.equal(parse(raw,s.actorId,id(99)),null);assert.equal(parse(raw+' ',s.actorId,s.tournamentId),null);assert.equal(JSON.stringify(s),before);assert.equal(p.envelope.setup.setup.request.payload.events[0].qPools[0].poolTypeCode,'Equal (Pays All Equally)');assert.equal(p.envelope.prizePlans.length,2);assert.equal(p.request.payload.events.length,3);
});
test('proven legacy absence preserves history until explicit adoption; missing retained rows cannot become defaults',()=>{
 const s=prizeSetupScenario(),c=choicesFromPrizeWorkspaceV1(s.workspace);assert(Object.values(c.settings).every(x=>x.mode==='preserve_historical'));assert(Object.values(c.prizes).every(x=>x.mode==='preserve_historical'));
 assert(build(s.actorId,s.workspace,s.request,s.links,c.settings,c.prizes,'all',id(7)));delete s.settings[s.workspace.events[0].eventClientRowId];assert.equal(pending(s),null);
});
test('source and event coverage cannot move to a foreign or stale setup',()=>{
 const s=prizeSetupScenario();assert(prizeWorkspaceCoversSetupV1(s.workspace,s.actorId,s.tournamentId,id(3),6,s.payload.events));assert.equal(prizeWorkspaceCoversSetupV1(s.workspace,s.actorId,s.tournamentId,id(3),7,s.payload.events),false);s.request.expectedVersion=5;assert.equal(pending(s),null);
});
test('complete receipt includes actor-bound prior evidence; mismatches cannot clear pending',async()=>{
 const s=prizeSetupScenario(),p=pending(s),r=await prizeSetupReceipt(p);assert(readEventPrizeAcceptedReplyV1(r.reply,p.envelope,r.hash,s.actorId));assert(eventPrizeReadbackMatchesV1(r.workspace,p,r.ack,null,r.hash));
 for(const mutate of[x=>x.binding.actorId=id(99),x=>x.binding.operationId=id(99),x=>x.binding.requestHash='e'.repeat(64),x=>delete x.priorSnapshot,x=>x.pendingCleared=true]){const bad=structuredClone(r.reply);mutate(bad);assert.equal(readEventPrizeAcceptedReplyV1(bad,p.envelope,r.hash,s.actorId),null);}
 const bad=structuredClone(r.workspace);bad.base.sourceDigest='f'.repeat(64);bad.prizes.snapshot.prizeDigest='f'.repeat(64);assert.equal(eventPrizeReadbackMatchesV1(bad,p,r.ack,null,r.hash),false);
});
test('newer saved state permits explicit resolution only for exact owned no-record or confirmed history',async()=>{
 const s=prizeSetupScenario(),p=pending(s),r=await prizeSetupReceipt(p),absent={status:'not_found',binding:r.reply.binding,pendingCleared:false,writeAuthorized:false};
 assert.equal(resolution(p,absent,s.workspace,r.hash),null);const stale=resolution(p,absent,r.workspace,r.hash);assert.equal(stale.outcome,'unapplied_stale');assert.equal(stale.automaticCleanupAllowed,false);assert.equal(resolution(p,r.reply,r.workspace,r.hash),null);
 const newer=structuredClone(r.workspace);newer.base.setupVersion++;newer.settings.snapshot.setupVersion++;newer.prizes.snapshot.setupVersion++;const v=resolution(p,r.reply,newer,r.hash);assert.equal(v.outcome,'confirmed_superseded');assert.equal(v.automaticCleanupAllowed,false);
 for(const change of[x=>x.binding.actorId=id(99),x=>x.binding.requestHash='e'.repeat(64),x=>delete x.binding,x=>x.writeAuthorized=true]){const reply=structuredClone(absent);change(reply);assert.equal(resolution(p,reply,r.workspace,r.hash),null);}assert.equal(resolution(p,{status:'outcome_unknown'},r.workspace,r.hash),null);
});
test('malformed raw values and an outer/nested operation collision remain rejected without coercion',()=>{
 const s=prizeSetupScenario();assert.equal(build(s.actorId,s.workspace,s.request,s.links,s.settings,s.prizes,'all',s.request.idempotencyKey),null);let calls=0;Object.defineProperty(s.prizes[s.workspace.events[0].eventClientRowId],'draft',{get(){calls++;throw Error('must not access');},enumerable:true});assert.equal(pending(s),null);assert.equal(calls,0);
});

test('journaled rejection allows explicit same-source resolution; attempts and contradictory full evidence cannot clear',async()=>{
 const s=prizeSetupScenario(),p=pending(s),r=await prizeSetupReceipt(p);
 const rejected={kind:'event-prize-recorded-rejection-v1',status:'rejected',code:'nested_write_rejected',binding:r.reply.binding,requestText:serializeEventPrizeSettingsV1(p.envelope,p.envelope.setup.setup.base),envelope:p.envelope,priorSnapshot:null,pendingCleared:false,writeAuthorized:false};
 assert(readEventPrizeRecordedRejectionV1(rejected,p.envelope,r.hash,s.actorId));const v=resolution(p,rejected,s.workspace,r.hash);assert.equal(v.outcome,'confirmed_rejected');assert.equal(v.automaticCleanupAllowed,false);assert.equal(v.currentVersion,p.request.expectedVersion);assert.equal(resolution(p,rejected,null,r.hash),null);
 assert.equal(resolution(p,{status:'rejected',code:'nested_write_rejected',pendingCleared:false},s.workspace,r.hash),null);
 for(const change of[x=>x.binding.actorId=id(99),x=>x.binding.requestHash='e'.repeat(64),x=>x.requestText+=' ',x=>x.envelope.prizePlans[0].draft.method='equal',x=>x.priorSnapshot=r.ack.snapshot,x=>x.writeAuthorized=true,x=>x.pendingCleared=true,x=>x.code='idempotency_conflict']){const bad=structuredClone(rejected);change(bad);assert.equal(resolution(p,bad,s.workspace,r.hash),null);}
 const wrong=structuredClone(s.workspace);wrong.base.setupRevisionId=id(99);assert.equal(resolution(p,rejected,wrong,r.hash),null);
});

test('recorded initial-details rejection can be resolved against proven version-zero absence',async()=>{
 const s=prizeSetupScenario();s.workspace.base.setupRevisionId=null;s.workspace.base.setupVersion=0;s.workspace.events=[];s.request.expectedVersion=0;s.request.payload.events=[];s.links=[];s.settings={};s.prizes={};
 const p=pending(s);assert(p);const hash=await eventPrizeSettingsRequestHashV1(p.envelope,p.envelope.setup.setup.base),raw=serializeEventPrizeSettingsV1(p.envelope,p.envelope.setup.setup.base);
 const rejected={kind:'event-prize-recorded-rejection-v1',status:'rejected',code:'nested_write_rejected',binding:{actorId:s.actorId,tournamentId:s.tournamentId,operationId:p.envelope.operationId,requestHash:hash},requestText:raw,envelope:p.envelope,priorSnapshot:null,pendingCleared:false,writeAuthorized:false};
 const v=resolution(p,rejected,s.workspace,hash);assert.equal(v.outcome,'confirmed_rejected');assert.equal(v.currentRevisionId,null);assert.equal(v.currentVersion,0);
});
