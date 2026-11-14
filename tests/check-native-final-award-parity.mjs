// Read-only SQL-to-TypeScript parity for actual disposable database exports.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {reconcileNativeFinalAwardSourceV1} from '../src/lib/finance/native-final-award-reconciliation-v1.ts';
import {decodeNativeFinalAwardRecordV1} from '../src/lib/finance/native-final-award-record-v1.ts';
if(!process.argv[2])throw Error('Supply the completed local final-award runtime directory.');
const directory=resolve(process.argv[2]),read=async name=>JSON.parse(await readFile(join(directory,name),'utf8'));
const source=await read('native-playoff-final-award-source.json'),record=await read('native-playoff-final-award-record.json');
const before=structuredClone({source,record}),scope={actorId:source.actorId,tournamentId:source.tournamentId,eventId:source.eventId};
const projected=reconcileNativeFinalAwardSourceV1(source,scope),stored=decodeNativeFinalAwardRecordV1(record,scope);
assert.equal(projected.status,'recordable_unpaid_awards',JSON.stringify(projected));assert.equal(stored.status,'recorded_unpaid_awards',JSON.stringify(stored));
assert.equal(projected.recordedFundMinor,stored.recordedFundMinorAtCapture);assert.equal(projected.totalAwardMinor,stored.totalAwardMinor);assert.equal(stored.totalAwardMinor,record.totalMinor);
assert.equal(source.income.reviewStatus,'recorded_complete');assert(projected.recordedAdditionalIncomeMinor>0);
assert.equal(source.sanctioning.totalMinor,5400);assert.equal(source.sanctioning.rateMinor,300);assert.equal(source.sanctioning.eligibleParticipantCount,18);assert(source.sanctioning.allocatedExpenseMinor>=source.sanctioning.totalMinor);
assert.equal(projected.recordedFundMinor,source.fund.regularEntryIncomeMinor-source.fund.benefitExpenseMinor-source.fund.operatingExpenseMinor+source.fund.unrestrictedIncomeMinor);
assert.equal(stored.recipients.length,5);assert.equal(new Set(stored.recipients.map(p=>p.participantId)).size,5);assert.equal(stored.recipients.reduce((s,r)=>s+r.amountMinor,0),stored.recordedFundMinorAtCapture);
const band=stored.recipients.filter(r=>r.firstPlace===3&&r.lastPlace===4);assert.equal(band.length,2);assert.equal(new Set(band.map(r=>r.amountMinor)).size,1);
assert.equal(stored.currentSourceVerified,false);assert.equal(stored.historicalReceipt,true);assert.equal(stored.moneyMoved,false);assert.equal(stored.payoutAuthorized,false);assert.equal(stored.disbursementAuthorized,false);assert.equal(stored.bankReceiptVerified,false);assert.equal(stored.providerRuntimeVerified,false);
assert.deepEqual({source,record},before);
for(const change of [r=>r.recipients[0].amountMinor+=500,r=>r.currentSourceVerified=true,r=>r.sourceCapture.income.reviewStatus='unknown',r=>delete r.sourceCapture.sanctioning,r=>r.sourceCapture.sanctioning.expenseSourceId=null,r=>r.sourceCapture.nativeRecipientSource.playoff.matches[0].games[0].confirmations.pop()]){const r=structuredClone(record);change(r);assert.equal(decodeNativeFinalAwardRecordV1(r,scope).status,'blocked');}
await writeFile(join(directory,'root-native-final-award-parity.json'),JSON.stringify({status:'passed',scope:'actual-local-recorded-fund-source-and-durable-unpaid-award-readback',qualifierCount:5,recipientCount:stored.recipients.length,sanctioningCoverage:source.sanctioning,recordedAdditionalIncomeMinor:projected.recordedAdditionalIncomeMinor,recordedFundMinor:projected.recordedFundMinor,totalAwardMinor:stored.totalAwardMinor,equalBand:{firstPlace:3,lastPlace:4,people:2,perPersonMinor:band[0].amountMinor},sourceDigest:projected.sourceDigest,awardSetId:record.awardSetId,storedRecordDigest:stored.digest,sourceReconciliationDigest:projected.digest,historicalReceipt:true,currentSourceVerified:false,bankReceiptVerified:false,providerRuntimeVerified:false,moneyMoved:false,payoutAuthorized:false,disbursementAuthorized:false,finalizationAuthorized:false},null,2)+'\n','utf8');
