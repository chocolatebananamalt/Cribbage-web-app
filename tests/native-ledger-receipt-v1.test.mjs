import test from'node:test';import assert from'node:assert/strict';
import{readNativeLedgerReceiptV1 as read}from'../src/lib/finance/native-ledger-receipt-v1.ts';
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(){
 const part=(bucket,amountMinor)=>({eventId:id(3),bucket,poolId:null,amountMinor,classificationReviewed:true});
 const allocations=[{sourceId:id(4),allocations:[part('regular_entry',5000)]},{sourceId:id(5),allocations:[part('operating_expense',1000)]}];
 const envelope={kind:'native-ledger-transport-v1',actorId:id(1),tournamentId:id(2),request:{kind:'native-ledger-allocation-v1',operationId:id(6),expectedRevisionId:null,sourceDigest:'a'.repeat(64),allocations,reason:'Reviewed native evidence',reviewed:true}};
 const snapshot={kind:'event-ledger-snapshot-v1',tournamentId:id(2),sourceDigest:'a'.repeat(64),sourceVersion:1,complete:true,mode:'documented_actual',eventIds:[id(3)],pools:[],sources:allocations.map((r,i)=>({...r,physicalEvidenceId:r.sourceId,kind:i?'expense':'entry_receipt',amountMinor:i?1000:5000,state:'active'}))};
 const receipt={status:'accepted',actorId:id(1),tournamentId:id(2),operationId:id(6),request:structuredClone(envelope.request),moneyMoved:false,payoutAuthorized:false,replayed:false,historicalReceipt:false,revisionId:id(7),version:1,snapshot};
 return{envelope,receipt};
}
test('persisted receipt decoder binds exact identity/request and never grants current fund or payment authority',()=>{
 const{envelope,receipt}=fixture(),before=JSON.stringify(receipt);let r=read(receipt,envelope);
 assert.equal(r.status,'allocation_receipt');assert.equal(r.requiresTrustedServerTransport,true);assert.equal(r.requiresCurrentSourceRead,true);assert.equal(r.moneyMoved,false);assert.equal(r.ledgerWriteAllowed,false);assert.equal('fundAvailable'in r,false);
 receipt.historicalReceipt=true;receipt.fundAvailable=false;r=read(receipt,envelope);assert.equal(r.status,'allocation_receipt');assert.equal(r.historicalReceipt,true);
 assert.equal(before,JSON.stringify(fixture().receipt));
});
test('thin, foreign, mutated and unsafe retained snapshots never decode as accepted evidence',()=>{
 for(const change of[r=>delete r.request,r=>r.actorId=id(99),r=>r.request.expectedRevisionId=id(99),r=>r.snapshot.sourceVersion=2,r=>r.snapshot.sources[0].amountMinor=5001,r=>r.snapshot.sources[1].allocations[0].amountMinor=6000,r=>r.snapshot.sources[1].amountMinor=6000,r=>r.snapshot.mode='simulation',r=>r.moneyMoved=true,r=>r.snapshot.sources.push(structuredClone(r.snapshot.sources[0]))]){
  const{envelope,receipt}=fixture();change(receipt);assert.equal(read(receipt,envelope).status,'unverified');
 }
});
test('terminal rejection receipt preserves full immutable request across original, GET and exact replay',()=>{
 const{envelope}=fixture();const r={status:'rejected',code:'source_changed',actorId:envelope.actorId,tournamentId:envelope.tournamentId,operationId:envelope.request.operationId,request:structuredClone(envelope.request),moneyMoved:false,payoutAuthorized:false};
 assert.equal(read(r,envelope).status,'rejected_receipt');r.historicalReceipt=true;r.fundAvailable=false;assert.equal(read(r,envelope).status,'rejected_receipt');r.replayed=true;assert.equal(read(r,envelope).status,'rejected_receipt');r.request.reason='Different';assert.equal(read(r,envelope).status,'unverified');
});
test('even internally conserving receipts cannot expose a negative regular fund or reclassify optional funds',()=>{
 let{envelope,receipt}=fixture();receipt.snapshot.sources[1].amountMinor=6000;receipt.snapshot.sources[1].allocations[0].amountMinor=6000;
 receipt.request=structuredClone(envelope.request);assert.equal(read(receipt,envelope).status,'unverified');
 ({envelope,receipt}=fixture());const allocation=receipt.snapshot.sources[0].allocations[0];allocation.bucket='q';allocation.poolId=id(8);receipt.snapshot.pools=[{poolId:id(8),eventId:id(3),kind:'q'}];receipt.snapshot.sources[1].amountMinor=0;receipt.snapshot.sources.pop();envelope.request.allocations.pop();receipt.request=structuredClone(envelope.request);
 assert.equal(read(receipt,envelope).status,'unverified');
});
