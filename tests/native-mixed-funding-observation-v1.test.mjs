import assert from 'node:assert/strict';
import test from 'node:test';
import {observeNativeMixedFundingV1 as observe, createNativeMixedFundingObservationReaderV1 as reader} from '../src/lib/finance/native-mixed-funding-observation-v1.ts';

const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clone=v=>structuredClone(v);
function sample(){
 const roster=Array.from({length:18},(_,i)=>({rosterEntryId:id(100+i),participantId:id(200+i),mode:i<6?'digital':'paper',profileId:i<6?id(300+i):null}));
 const scope={scopeId:id(4),version:1,admissionIntentId:id(5),admissionIntentVersion:1,admissionSourceDigest:'a'.repeat(64),operationalBindingId:id(6),entryFeeMinor:5000,participantCount:18,digitalCount:6,paperCount:12,sourceDigest:'b'.repeat(64)};
 const expected={actorId:id(1),tournamentId:id(2),eventId:id(3),scope,roster};
 const value={status:'source_available',kind:'native-mixed-funding-source-v1',actorId:id(1),tournamentId:id(2),eventId:id(3),scope:clone(scope),sourceDigest:'d'.repeat(64),
  entries:roster.map((r,i)=>({...r,version:1,fixedId:null,obligation:{obligationId:id(400+i),amountMinor:5000},receipt:{receiptId:id(500+i),amountMinor:5000,currency:'USD',method:'simulated',simulatedReceivedAt:'2026-11-05T12:00:00.000Z'},operationId:id(600+i),contextId:id(700+i),sourceDigest:'c'.repeat(64)})),
  totals:{entryCount:18,obligationMinor:90000,receiptMinor:90000},optionalPoolSourceAvailable:false,assessmentSourceAvailable:false,paidCheckInAuthorized:false,ordinaryCheckInSource:false,actualMoneyReceived:false,bankReceiptVerified:false,moneyMoved:false,refundAuthorized:false,payoutAuthorized:false,finalizationAuthorized:false};
 return{value,expected};
}
const blocked=x=>assert.equal(x.status,'blocked');
test('complete base-only funding observation preserves identity and claims no authority',()=>{
 const {value,expected}=sample(), out=observe(value,expected);
 assert.equal(out.status,'simulation-observation'); assert.equal(out.totals.receiptMinor,90000);assert.equal(out.fundingSourceDigest,value.sourceDigest);
 for(const key of ['databaseProvenanceVerified','financeAvailableV2','paidCheckInAuthorized','actualMoneyReceived','bankReceiptVerified','moneyMoved','refundAuthorized','payoutAuthorized','finalizationAuthorized'])assert.equal(out[key],false,key);
 assert.equal(out.sourceObservation,'provided-models-not-atomic');
 assert.equal(out.entries.filter(x=>x.profileId===null).length,12);
 out.entries[0].receipt.amountMinor=1; assert.equal(value.entries[0].receipt.amountMinor,5000);
 const shuffled=clone(value);shuffled.entries.reverse();assert.equal(observe(shuffled,expected).status,'simulation-observation');
 // Plausible borrowed IDs/digests are DTO-valid: output must still grant no DB authority.
 value.entries[0].receipt.receiptId=id(900);value.entries[0].sourceDigest='f'.repeat(64);
 assert.equal(observe(value,expected).databaseProvenanceVerified,false);
});
test('missing, foreign, stale and ambiguous funding identity never becomes zero or eligible',()=>{
 const cases=[x=>x.entries.pop(),x=>x.entries.push(clone(x.entries[0])),x=>x.entries[0].participantId=id(999),
  x=>x.entries[0].profileId=id(999),x=>x.entries[6].profileId=id(999),x=>x.entries[0].mode='paper',
  x=>x.entries[0].fixedId='A-1',x=>x.entries[0].version=2,x=>x.entries[1].receipt.receiptId=x.entries[0].receipt.receiptId,
  x=>x.entries[1].contextId=x.entries[0].contextId,x=>x.entries[1].operationId=x.entries[0].operationId,
  x=>x.scope.admissionIntentVersion=2,x=>x.scope.sourceDigest='e'.repeat(64),x=>x.eventId=id(999),x=>x.actorId=id(999),
  x=>delete x.sourceDigest,x=>x.sourceDigest='not-a-digest'];
 for(const change of cases){const {value,expected}=sample();change(value);blocked(observe(value,expected));}
 const {expected}=sample();blocked(observe({status:'pending'},expected));blocked(observe(null,expected));
 const bad=sample();bad.expected.roster[1]=clone(bad.expected.roster[0]);blocked(observe(bad.value,bad.expected));
});
test('fund arithmetic, currency and simulation flags fail closed without inventing pool or fee evidence',()=>{
 const cases=[x=>x.entries[0].receipt.amountMinor=4999,x=>x.entries[0].obligation.amountMinor=5001,
  x=>x.entries[0].receipt.currency='CAD',x=>x.entries[0].receipt.method='cash',x=>x.totals.receiptMinor=89999,
  x=>x.totals.obligationMinor=90001,x=>x.totals.entryCount=17,x=>x.entries[0].receipt.simulatedReceivedAt='2026-02-30T12:00:00.000Z',
  x=>x.entries[0].receipt.simulatedReceivedAt='2026-11-05T12:00:00-10:00',x=>x.entries[0].receipt.actualMoneyReceived=false];
 for(const flag of ['optionalPoolSourceAvailable','assessmentSourceAvailable','paidCheckInAuthorized','ordinaryCheckInSource','actualMoneyReceived','bankReceiptVerified','moneyMoved','refundAuthorized','payoutAuthorized','finalizationAuthorized'])cases.push(x=>x[flag]=true);
 for(const change of cases){const {value,expected}=sample();change(value);blocked(observe(value,expected));}
 for(const amount of [0,299,350,Number.MAX_SAFE_INTEGER,Infinity,NaN]){
  const {value,expected}=sample();value.scope.entryFeeMinor=expected.scope.entryFeeMinor=amount;blocked(observe(value,expected));
 }
});
test('private reader denies before models and rechecks subject, roles and loaded scope',async()=>{
 const {value,expected}=sample();let reads=0;
 const models=async()=>{reads++;return{value,expected};};
 const denied=reader({access:async()=>({actorId:id(1),roles:['player']}),models});
 blocked(await denied(id(2),id(3)));assert.equal(reads,0);
 const coDirector=reader({access:async()=>({actorId:id(1),roles:['co_director']}),models});
 blocked(await coDirector(id(2),id(3)));assert.equal(reads,0);
 const wrongScope=reader({access:async()=>({actorId:id(1),roles:['director']}),models});
 blocked(await wrongScope(id(2),id(999)));
 let calls=0;const revoked=reader({access:async()=>++calls===1?{actorId:id(1),roles:['director']}:null,models});
 blocked(await revoked(id(2),id(3)));
 calls=0;const switched=reader({access:async()=>({actorId:++calls===1?id(1):id(9),roles:['director']}),models});
 blocked(await switched(id(2),id(3)));
 const exception=reader({access:async()=>{throw new Error('private secret');},models});
 assert.deepEqual(await exception(id(2),id(3)),{status:'blocked',code:'simulation_source_unavailable'});
});
test('private double read owns copies and detects drift without implying atomicity',async()=>{
 const data=sample();let reads=0;
 const drift=reader({access:async()=>({actorId:id(1),roles:['director']}),models:async()=>{
  if(++reads===2)data.value.entries[0].sourceDigest='d'.repeat(64);return data;
 }});
 assert.deepEqual(await drift(id(2),id(3)),{status:'blocked',code:'funding_source_changed'});
 const good=sample();const steady=reader({access:async()=>({actorId:id(1),roles:['director']}),models:async()=>good});
 const out=await steady(id(2),id(3));assert.equal(out.status,'simulation-observation');
 assert.equal(out.sourceObservation,'matching-double-read-not-atomic');assert.equal(out.financeAvailableV2,false);
});
