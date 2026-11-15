import test from 'node:test';import assert from 'node:assert/strict';
import{eventPublicationSourceDigest,prepareEventPublishedProjection}from'../src/lib/results/event-published-projection.ts';
import{projectPlayerPlayoff}from'../src/lib/results/player-playoff-display.ts';
import{projectRunningPoolReadModels}from'../src/lib/results/pool-running-read-model.ts';
import{poolReadExample,id,tid,eid,stamp}from'./helpers/pool-running-read-examples.mjs';
function example(){const input={kind:'player-playoff-display-input-v2',tournamentId:tid,eventId:eid,qualificationVersionId:id(902),sourceDigest:'a'.repeat(64),sourceCurrent:true,qualificationReviewed:true,tiesResolved:true,eventType:'main',entrantCount:18,qualifierCount:5,players:Array.from({length:5},(_,i)=>({participantId:id(i+1),displayName:`Fictional Player ${i+1}`,tournamentId:`A-${i+1}`,seed:i+1})),results:[]};
 const source={kind:'event-results-publication-source-v1',tournamentId:tid,eventId:eid,bracket:{status:'available',input,display:projectPlayerPlayoff(input),origin:'synthetic-event',notice:'PRIVATE NOTES',sourceObservation:'matching-double-read-not-atomic',publicAccessGranted:false,independentPlayEstablished:false},pools:{...projectRunningPoolReadModels(tid,eid,poolReadExample(),stamp),sourceObservation:'matching-double-read-not-atomic'}};
 const head={kind:'event-results-publication-head-v1',tournamentId:tid,eventId:eid,publicationId:id(990),revision:1,state:'published',audience:'players-and-public',sections:['bracket','pools'],sourceDigest:eventPublicationSourceDigest(source)};
 return{source,head,expected:{tournamentId:tid,eventId:eid,publicationId:head.publicationId,revision:1}};}
const prepare=x=>prepareEventPublishedProjection(x.expected,x.head,structuredClone(x.head),x.source);
test('minimal contract preserves names/fixed IDs/paths but never exposes participant/account/evidence source IDs',()=>{
 const x=example(),before=structuredClone(x),r=prepare(x);assert.equal(r.status,'prepared-not-authorized');assert.equal(r.accessGranted,false);assert.equal(r.transportEnabled,false);assert.equal(r.data.sourceObservation,'pinned-supplied-heads-not-atomic');assert.equal(r.data.bracket.players[0].tournamentId,'A-1');assert.equal(r.data.bracket.rounds[0].matches.filter(m=>m.status==='bye').length,3);assert.equal(r.data.bracket.independentPlayEstablished,false);assert.equal(r.data.pools.entries[0].recordedPoolTotalMinor,1000);assert.equal(r.data.pools.projectedAmountsAreEstimates,true);
 const text=JSON.stringify(r);for(const word of['PRIVATE','participantId','accountId','profileId','receiptId','qualificationVersionId','policyId','sourceDigest','evidenceNote','consentReference',id(1),id(902)])assert(!text.includes(word),word);assert.deepEqual(x,before);
 x.source.bracket.input.players[0].displayName='changed';x.source.pools.pools[0].name='changed';assert.equal(r.data.bracket.players[0].name,'Fictional Player 1');assert.notEqual(r.data.pools.entries[0].name,'changed');
});
test('withdrawn, missing, unpublished, malformed and wrong-audience heads never render',()=>{
 for(const mutate of[h=>h.state='withdrawn',h=>h.state='draft',h=>h.audience='private',h=>h.revision=0,h=>h.extra='PRIVATE',h=>h.sections=[],h=>h.sections=['pools','pools']]){const x=example();mutate(x.head);assert.equal(prepare(x).status,'blocked');}
 const x=example();assert.equal(prepareEventPublishedProjection(x.expected,null,null,x.source).code,'publication_unavailable');
});
test('head drift, pinned revision mismatch and event/identity changes fail closed',()=>{
 const x=example();for(const mutate of[h=>h.revision++,h=>h.publicationId=id(991),h=>h.sections=['pools'],h=>h.sourceDigest='b'.repeat(64)]){const after=structuredClone(x.head);mutate(after);assert.equal(prepareEventPublishedProjection(x.expected,x.head,after,x.source).code,'publication_changed');}
 for(const mutate of[e=>e.eventId=id(999),e=>e.tournamentId=id(999),e=>e.publicationId=id(999),e=>e.revision=2]){const y=example();mutate(y.expected);assert.equal(prepare(y).code,'publication_scope_changed');}
});
test('data changes after publication require a new bound source revision, not a fresh-looking old head',()=>{
 for(const mutate of[s=>s.pools.pools[0].enteredCount=4,s=>s.pools.observedAt='2026-11-04T00:00:01.000Z',s=>s.bracket.input.players[0].displayName='new name',s=>s.bracket.origin='director-reviewed-origin-unverified']){const x=example();mutate(x.source);assert.equal(prepare(x).code,'source_changed_or_unavailable');}
});
test('stale, mismatched and unsupported source models cannot become published just by recomputing digest',()=>{
 for(const mutate of[s=>s.pools.sourceObservation='observed-source-drift',s=>s.bracket.input.sourceCurrent=false,s=>s.bracket.input.qualifierCount=65,s=>s.bracket.input.players[0].accNumber='HI1234',s=>s.pools.eventId=id(999),s=>s.bracket.sourceObservation='provided-models-not-atomic',s=>s.pools.pools[0].receiptId=id(90)]){const x=example();mutate(x.source);assert.equal(eventPublicationSourceDigest(x.source),null);assert.equal(prepare(x).status,'blocked');}
});
test('unpublished sections cannot piggyback on a published section; null is unavailable, never an empty result',()=>{
 const x=example();x.head.sections=['pools'];assert.equal(prepare(x).code,'section_not_published');x.source.bracket=null;x.head.sourceDigest=eventPublicationSourceDigest(x.source);let r=prepare(x);assert.equal(r.status,'prepared-not-authorized');assert.equal(r.data.bracket,null);
 x.source.pools=null;x.head.sourceDigest=eventPublicationSourceDigest(x.source);assert.equal(prepare(x).code,'published_data_unavailable');
});
test('unknown pool amount remains null while a real zero remains zero',()=>{
 for(const mode of['unknown','zero']){const x=example(),m=poolReadExample('side');if(mode==='zero')Object.assign(m.side.pools[0],{entries:[],paidCount:0,blockers:['unsupported_payout_domain']});x.source.bracket=null;x.head.sections=['pools'];x.source.pools={...projectRunningPoolReadModels(tid,eid,m,stamp),sourceObservation:'matching-double-read-not-atomic'};x.head.sourceDigest=eventPublicationSourceDigest(x.source);const r=prepare(x);assert.equal(r.status,'prepared-not-authorized');assert.equal(r.data.pools.entries[0].eligiblePoolTotalMinor,mode==='zero'?0:null);assert.equal(r.data.pools.awardScheduleAvailable,false);}
});
test('arbitrary private notes/display do not enter source binding or public data',()=>{
 const x=example(),digest=x.head.sourceDigest;x.source.bracket.notice='DIFFERENT PRIVATE';x.source.bracket.display={PRIVATE:true};assert.equal(eventPublicationSourceDigest(x.source),digest);const r=prepare(x);assert.equal(r.status,'prepared-not-authorized');assert(!JSON.stringify(r).includes('PRIVATE'));
});
test('coercible or boxed provenance cannot carry private object fields into public output',()=>{
 for(const origin of[{privateContact:'PRIVATE-CONTACT',toString:()=> 'synthetic-event'},new String('synthetic-event')]){const x=example();x.source.bracket.origin=origin;assert.equal(eventPublicationSourceDigest(x.source),null);const r=prepare(x);assert.equal(r.status,'blocked');assert(!JSON.stringify(r).includes('PRIVATE'));}
});
