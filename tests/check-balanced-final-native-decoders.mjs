// Compatibility proof for exported actual local SQL DTOs, not an independent oracle.
// No database, hosted session, provider call or payment is performed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {reconcileNativeFinalAwardSourceV1} from '../src/lib/finance/native-final-award-reconciliation-v1.ts';
import {decodeNativeFinalAwardRecordV1} from '../src/lib/finance/native-final-award-record-v1.ts';
import {readBoundOperationalProviderWriteV1} from '../src/lib/api/operational-provider-transport-v1.ts';
const run=path.resolve(process.argv[2]);
assert.equal(path.dirname(run),path.resolve('test-results'));
const load=name=>JSON.parse(fs.readFileSync(path.join(run,name),'utf8').replace(/^\uFEFF/,''));
const source=load('balanced-final-source.json'),record=load('balanced-final-record.json'),reconciliation=load('balanced-final-reconciliation.json');
const scope={actorId:source.actorId,tournamentId:source.tournamentId,eventId:source.eventId};
const sourceModel=reconcileNativeFinalAwardSourceV1(source,scope);
assert.equal(sourceModel.status,'recordable_unpaid_awards',JSON.stringify(sourceModel));
assert.equal(sourceModel.recordedFundMinor,48000);
assert.equal(sourceModel.totalAwardMinor,48000);
const recordModel=decodeNativeFinalAwardRecordV1(record,scope);
assert.equal(recordModel.status,'recorded_unpaid_awards',JSON.stringify(recordModel));
assert.equal(recordModel.totalAwardMinor,48000);
assert.equal(recordModel.currentSourceVerified,false);
const receipt=readBoundOperationalProviderWriteV1(reconciliation,'native-finance-provider-write-v1',scope.actorId,scope,reconciliation.request);
assert.ok(receipt,'actual SQL reconciliation must pass the provider receipt decoder');
assert.equal(receipt.record.outcome.awardSetId,record.awardSetId);
for(const model of [sourceModel,recordModel]){
 for(const key of ['moneyMoved','payoutAuthorized','disbursementAuthorized','finalizationAuthorized','bankReceiptVerified'])assert.equal(model[key],false);
}
const result={passed:true,scope,kind:'actual-exported-SQL-app-decoder-compatibility',sourceModelStatus:sourceModel.status,recordModelStatus:recordModel.status,providerReceiptDecoded:true,fundMinor:48000,totalAwardMinor:48000,independentArithmeticOracle:false,actualProviderSessionVerified:false,hostedChanges:false,moneyMoved:false};
fs.writeFileSync(path.join(run,'root-balanced-native-decoder-check.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
