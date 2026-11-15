import assert from 'node:assert/strict';
import test from 'node:test';
import {observeNativeMixedAttendanceV1 as observe,createNativeMixedAttendanceObservationReaderV1 as reader} from '../src/lib/seating/native-mixed-attendance-observation-v1.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clone=v=>structuredClone(v);
function sample(){
 const roster=Array.from({length:18},(_,i)=>({rosterEntryId:id(100+i),participantId:id(200+i),mode:i<6?'digital':'paper',profileId:i<6?id(300+i):null}));
 const scope={scopeId:id(4),version:1,admissionIntentId:id(5),fundingScopeId:id(6),fundingSourceDigest:'a'.repeat(64),operationalBindingId:id(7),participantCount:18,digitalCount:6,paperCount:12,sourceDigest:'b'.repeat(64)};
 const digitalConsents=roster.slice(0,6).map((r,i)=>({consentId:id(400+i),version:1,priorConsentId:null,decision:'granted',rosterEntryId:r.rosterEntryId,participantId:r.participantId,profileId:r.profileId,operationId:id(500+i),statement:'test-only-simulation-participation-v1',sourceDigest:'c'.repeat(64)}));
 const expected={actorId:id(1),sealId:id(8),tournamentId:id(2),eventId:id(3),scope,roster,
  latestConsents:digitalConsents.map(c=>({rosterEntryId:c.rosterEntryId,consentId:c.consentId,version:c.version,decision:c.decision})),
  officials:[{profileId:id(1),roles:['director']},{profileId:id(300),roles:['cross_checker']}]};
 const value={status:'source_available',kind:'native-mixed-attendance-source-v1',actorId:id(1),sealId:id(8),tournamentId:id(2),eventId:id(3),scope:clone(scope),digitalConsents,
  paperDeclaration:{declarationId:id(600),preparerId:id(1),entries:roster.slice(6).map(r=>({...r,fictional:true})),operationId:id(601),sourceDigest:'d'.repeat(64),fictional:true},
  paperReview:{reviewId:id(602),reviewerId:id(300),declarationId:id(600),operationId:id(603),sourceDigest:'e'.repeat(64),decision:'accepted-synthetic-only'},sourceDigest:'f'.repeat(64),
  ordinaryAttendanceUsed:false,paymentVerified:false,humanPresenceVerified:false,physicalPresenceVerified:false,actualMoneyReceived:false,moneyMoved:false,refundAuthorized:false,payoutAuthorized:false,finalizationAuthorized:false,normalDrawAuthorized:false,normalStartAuthorized:false};
 return{value,expected};
}
const blocked=x=>assert.equal(x.status,'blocked');
test('complete pre-draw readiness is synthetic and grants no attendance, draw, Start or identity authority',()=>{
 const {value,expected}=sample();const out=observe(value,expected);
 assert.equal(out.status,'simulation-attendance-observation');assert.equal(out.readyIdentityCount,18);
 assert.equal(out.simulationReadinessComplete,true);assert.equal(out.attendanceSourceDigest,value.sourceDigest);
 for(const key of ['databaseProvenanceVerified','identityBoundConsentVerified','independentHumanReviewVerified','ordinaryAttendanceUsed','paymentVerified','humanPresenceVerified','physicalPresenceVerified','actualMoneyReceived','moneyMoved','refundAuthorized','payoutAuthorized','finalizationAuthorized','normalDrawAuthorized','normalStartAuthorized'])assert.equal(out[key],false,key);
 assert.equal(out.sourceObservation,'provided-models-not-atomic');assert.equal(out.paperReview.reviewerId,expected.roster[0].profileId,'a Digital player may review fictional Paper subjects');
 out.paperDeclaration.entries[0].participantId=id(999);assert.notEqual(value.paperDeclaration.entries[0].participantId,id(999));
 const shuffled=clone(value);shuffled.digitalConsents.reverse();shuffled.paperDeclaration.entries.reverse();assert.equal(observe(shuffled,expected).status,'simulation-attendance-observation');
});
test('six latest identity-bound grants are required and a later revocation invalidates the old seal',()=>{
 const changes=[x=>x.digitalConsents.pop(),x=>x.digitalConsents[1]=clone(x.digitalConsents[0]),
  x=>x.digitalConsents[0].profileId=id(1),x=>x.digitalConsents[0].participantId=id(999),
  x=>x.digitalConsents[0].decision='revoked',x=>x.digitalConsents[0].statement='I played the fictional person',
  x=>x.digitalConsents[0].priorConsentId=id(999),x=>x.digitalConsents[0].version=0,
  x=>x.digitalConsents[0].fixedId='A-1',x=>x.digitalConsents[0].sourceDigest='invalid'];
 for(const change of changes){const {value,expected}=sample();change(value);blocked(observe(value,expected));}
 const data=sample();data.expected.latestConsents[0]={...data.expected.latestConsents[0],consentId:id(900),version:2,decision:'revoked'};
 assert.deepEqual(observe(data.value,data.expected),{status:'blocked',code:'self_consent_changed_or_revoked'});
 // A legitimate pre-seal regrant is versioned, never an overwrite or proxy consent.
 const regrant=sample();const c=regrant.value.digitalConsents[0];c.priorConsentId=id(901);c.version=3;
 regrant.expected.latestConsents[0].version=3;assert.equal(observe(regrant.value,regrant.expected).status,'simulation-attendance-observation');
});
test('Paper readiness requires exactly twelve fictional unlinked subjects and a distinct current cross-checker',()=>{
 const changes=[x=>x.paperDeclaration.entries.pop(),x=>x.paperDeclaration.fictional=false,
  x=>x.paperDeclaration.entries[0].profileId=id(999),x=>x.paperDeclaration.entries[0].fictional=false,
  x=>x.paperDeclaration.entries[0]=clone(x.paperDeclaration.entries[1]),x=>x.paperDeclaration.entries[0].rosterEntryId=id(100),
  x=>x.paperDeclaration.entries[0].mode='digital',x=>x.paperDeclaration.preparerId=id(300),
  x=>x.paperReview.reviewerId=id(1),x=>x.paperReview.declarationId=id(999),x=>x.paperReview.decision='human-attendance-confirmed'];
 for(const change of changes){const {value,expected}=sample();change(value);blocked(observe(value,expected));}
 const data=sample();data.expected.officials[1].roles=[];blocked(observe(data.value,data.expected));
});
test('unknown, stale, cross-event, future-publication or elevated authority is blocked rather than counted zero',()=>{
 const changes=[x=>x.eventId=id(999),x=>x.actorId=id(999),x=>x.sealId=id(999),x=>delete x.sealId,x=>x.scope.fundingSourceDigest='0'.repeat(64),x=>x.scope.schedulePublicationId=id(999),
  x=>x.scope.fixedIds=['A-1'],x=>delete x.sourceDigest,x=>x.sourceDigest='bad'];
 for(const flag of ['ordinaryAttendanceUsed','paymentVerified','humanPresenceVerified','physicalPresenceVerified','actualMoneyReceived','moneyMoved','refundAuthorized','payoutAuthorized','finalizationAuthorized','normalDrawAuthorized','normalStartAuthorized'])changes.push(x=>x[flag]=true);
 for(const change of changes){const {value,expected}=sample();change(value);blocked(observe(value,expected));}
 const {expected}=sample();blocked(observe({status:'pending'},expected));blocked(observe(null,expected));
 const bad=sample();bad.expected.roster[6].profileId=id(999);blocked(observe(bad.value,bad.expected));
 // DTO-valid borrowed IDs/digests are not proof of their database provenance.
 const borrowed=sample();borrowed.value.paperReview.reviewId=id(999);assert.equal(observe(borrowed.value,borrowed.expected).databaseProvenanceVerified,false);
});
test('private official reader denies before loading, rechecks subject and detects consent/source drift',async()=>{
 const data=sample();let reads=0;
 const models=async()=>{reads++;return data;};
 for(const roles of [[],['player'],['co_director'],['cross_checker']]){
  const denied=reader({access:async()=>({actorId:id(1),roles}),models});blocked(await denied(id(2),id(3)));
 }
 assert.equal(reads,0);
 let accessCalls=0;const revoked=reader({access:async()=>++accessCalls===1?{actorId:id(1),roles:['director']}:null,models});blocked(await revoked(id(2),id(3)));
 const wrong=reader({access:async()=>({actorId:id(1),roles:['director']}),models});blocked(await wrong(id(2),id(9)));
 const driftData=sample();reads=0;const drift=reader({access:async()=>({actorId:id(1),roles:['director']}),models:async()=>{
  if(++reads===2)driftData.expected.latestConsents[0].decision='revoked';return driftData;
 }});assert.deepEqual(await drift(id(2),id(3)),{status:'blocked',code:'attendance_source_changed'});
 const steady=reader({access:async()=>({actorId:id(1),roles:['director']}),models:async()=>sample()});
 const out=await steady(id(2),id(3));assert.equal(out.status,'simulation-attendance-observation');assert.equal(out.sourceObservation,'matching-double-read-not-atomic');assert.equal(out.normalStartAuthorized,false);
 const failed=reader({access:async()=>{throw new Error('private info');},models});assert.deepEqual(await failed(id(2),id(3)),{status:'blocked',code:'simulation_attendance_unavailable'});
});
