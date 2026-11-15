// Preserve old mechanics evidence; prove it cannot pass the corrected contract.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {reconcileNativeFinalAwardSourceV1} from '../src/lib/finance/native-final-award-reconciliation-v1.ts';
import {decodeNativeFinalAwardRecordV1} from '../src/lib/finance/native-final-award-record-v1.ts';
if(!process.argv[2])throw Error('Supply an existing pre-coverage local evidence directory.');
const directory=resolve(process.argv[2]),read=async name=>JSON.parse(await readFile(join(directory,name),'utf8'));
const source=await read('native-playoff-final-award-source.json'),record=await read('native-playoff-final-award-record.json');
const scope={actorId:source.actorId,tournamentId:source.tournamentId,eventId:source.eventId};
assert.equal(Object.hasOwn(source,'sanctioning'),false);
const projected=reconcileNativeFinalAwardSourceV1(source,scope),stored=decodeNativeFinalAwardRecordV1(record,scope);
assert.equal(projected.status,'blocked');assert.equal(stored.status,'blocked');
await writeFile(join(directory,'root-sanctioning-gap-rejection.json'),JSON.stringify({status:'passed',scope:'corrected-consumer-rejects-actual-precoverage-artifacts',missingSanctioningCoverage:true,sourceRejected:true,storedRecordRejected:true,oldEvidencePreserved:true,hostedChanges:false,moneyMoved:false},null,2)+'\n','utf8');
