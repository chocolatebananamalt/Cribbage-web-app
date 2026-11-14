// Replay ONLY the captured fictional successful local DB result. This is not a
// fresh backend read, new DB fixture, persisted proposal or payment operation.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {assemblePlayoffPrizeNativeSourceV2} from '../src/lib/finance/playoff-prize-native-read-v2.ts';
import {calculatePlayoffPrizeProposalsV2,isPlayoffPrizeProposalExtensionV2} from '../src/lib/results/playoff-prize-proposals-v2.ts';
const dir='test-results/prize-native-local-v2-20261108',run=JSON.parse(fs.readFileSync(dir+'/result.json','utf8'));
assert.equal(run.passed,true);assert.equal(run.cleaned,true);assert.equal(run.qualified?.passed,true);
const bytes=fs.readFileSync(dir+'/native-qualified-v2-positive.json'),saved=JSON.parse(bytes),capture=saved.capture;
const read=assemblePlayoffPrizeNativeSourceV2(capture,{actorId:capture.actorId,tournamentId:capture.tournamentId,eventId:capture.eventId});assert(read);
const current={source:read.basis.source,input:read.basis.input},retained={...structuredClone(current),overrideHistory:[]},initial=calculatePlayoffPrizeProposalsV2(retained,current);assert.equal(initial.status,'proposal_review');
const winner=initial.proposedBands[0],next=structuredClone(retained);next.overrideHistory.push({recordId:'a8080000-0000-4000-8000-000000009001',firstPlace:winner.firstPlace,lastPlace:winner.lastPlace,priorRecordId:null,perPersonMinor:winner.perPersonMinor+initial.roundingStepMinor,voided:false,reason:'Explicit fictional local comparison; not saved or paid'});
assert.equal(isPlayoffPrizeProposalExtensionV2(retained,next,current),true);const adjusted=calculatePlayoffPrizeProposalsV2(next,current);assert.equal(adjusted.status,'proposal_review');assert.equal(adjusted.manualDistributionChanged,true);assert.equal(adjusted.finalizationAllowed,false);assert.equal(adjusted.moneyMoved,false);
assert.equal(adjusted.proposedTotalMinor,initial.proposedTotalMinor+initial.roundingStepMinor);assert.equal(calculatePlayoffPrizeProposalsV2(next,null).status,'blocked');
const report={passed:true,artifactReplay:true,backendCurrentnessVerified:false,captureSha256:createHash('sha256').update(bytes).digest('hex'),nativeRunContainerId:run.containerId,fundMinor:initial.input.fundMinor,sourceSuggestedTotalMinor:initial.proposedTotalMinor,manuallyProposedTotalMinor:adjusted.proposedTotalMinor,discrepancyMinor:adjusted.discrepancyMinor,manualHistoryRecords:adjusted.historyRecordCount,sourceUnchanged:JSON.stringify(next.source)===JSON.stringify(retained.source),persisted:false,finalizationAllowed:false,moneyMoved:false};
fs.writeFileSync('test-results/prize-native-history-v2-artifact.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
