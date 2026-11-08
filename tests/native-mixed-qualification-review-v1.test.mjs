import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readPracticeQualificationFinanceReviewV1 as decode} from '../src/lib/finance/native-mixed-qualification-review-v1.ts';
const cards=JSON.parse(fs.readFileSync('tests/fixtures/native-mixed-practice-cards-v1.json'));
const id=n=>`aaaa0000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash='a'.repeat(64);
function fixture(){return{kind:'native-mixed-qualification-finance-review-v1',status:'review_available',tournamentId:id(1),eventId:id(2),startId:id(3),sourceDigest:hash,startSourceDigest:hash,fundingSourceDigest:hash,cards:structuredClone(cards),entrantCount:18,qualifyingCount:5,qualificationReady:true,tieReviewRequired:false,tieReviewReason:null,evidenceHeads:Array.from({length:108},(_,i)=>({gameId:id(i+10),revision:i%2?4:2,historyDigest:hash})),simulatedReceipts:cards.map((c,i)=>({participantId:c.participantId,receiptId:id(i+200),amountMinor:3000,sourceDigest:hash})),simulatedGrossMinor:54000,costsMinor:null,netPrizeFundMinor:null,awards:null,policyReviewRequired:true,simulationOnly:true,officialQualificationRecorded:false,mrpAwarded:false,actualMoneyReceived:false,moneyMoved:false,payoutAuthorized:false,ordinaryFinanceSource:false};}
test('private practice intake retains null costs and awards, fixed Tournament IDs and detached data',()=>{
 const v=fixture(),r=decode(v);assert(r);assert.equal(r.qualifyingCount,5);assert.equal(r.simulatedGrossMinor,54000);assert.equal(r.cards[0].fixedTournamentId,'A-13');r.cards[0].wins=0;assert.equal(v.cards[0].wins,12);
});
test('tied primary standings remain review-only without arbitrary qualified-player selection',()=>{
 const v=fixture();for(const c of v.cards)Object.assign(c,{wins:6,losses:6,gamePoints:12,positiveSpread:60,negativeSpread:60,netSpread:0,rank:1,tieCount:18});
 v.qualificationReady=false;v.tieReviewRequired=true;v.tieReviewReason='Head-to-head where applicable, then a deciding game.';
 assert(decode(v));v.qualificationReady=true;assert.equal(decode(v),null);v.qualificationReady=false;v.tieReviewReason=null;assert.equal(decode(v),null);
});
for(const [name,mutate]of Object.entries({
 'invented cost zero':v=>v.costsMinor=0,'invented net fund':v=>v.netPrizeFundMinor=54000,'awards':v=>v.awards=[],
 'official status':v=>v.officialQualificationRecorded=true,'money claim':v=>v.actualMoneyReceived=true,'authority':v=>v.payoutAuthorized=true,
 'unknown profile identifier':v=>v.cards[0].profileId=id(999),'wrong gross':v=>v.simulatedGrossMinor++,
 'duplicate receipt':v=>v.simulatedReceipts[1].receiptId=v.simulatedReceipts[0].receiptId,
 'duplicate participant receipt':v=>v.simulatedReceipts[1].participantId=v.simulatedReceipts[0].participantId,
 'unknown recipient':v=>v.simulatedReceipts[0].participantId=id(999),'incomplete game':v=>v.evidenceHeads[0].revision=3,
 'duplicate game':v=>v.evidenceHeads[1].gameId=v.evidenceHeads[0].gameId,'wrong score arithmetic':v=>v.cards[0].netSpread++,
 'duplicate card':v=>v.cards[1]=structuredClone(v.cards[0]),'wrong rank':v=>v.cards[0].rank=2,
 'invented tie':v=>v.cards[0].tieCount=2,'unreviewed shape':v=>v.qualifyingCount=4,'unsafe receipt integer':v=>v.simulatedReceipts[0].amountMinor=Number.MAX_SAFE_INTEGER+1,
}))test('private intake rejects '+name,()=>{const v=fixture();mutate(v);assert.equal(decode(v),null);});
test('SQL review is default-off and revoked, proves all raw games and sealed funding, writes no official domains',()=>{
 const s=fs.readFileSync('database/proposals/native-mixed-qualification-review-v1.sql','utf8');
 assert.match(s,/select false/);assert.match(s,/native_mixed_game_complete_with_start_v1/);assert.match(s,/native_mixed_funding_seal_source_v1/);assert.match(s,/a\.funding_source_digest=funding->>'sourceDigest'/);
 assert.match(s,/from public,anon,authenticated,service_role/);assert.doesNotMatch(s,/\b(insert into|update app\.|delete from|grant execute|set request\.jwt)/i);
 assert.match(s,/'costsMinor',null,'netPrizeFundMinor',null,'awards',null/);
});
