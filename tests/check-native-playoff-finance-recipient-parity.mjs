// Read-only root verification of actual exported disposable DB evidence.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {projectNativeFinalRecipientEstimateV1} from '../src/lib/finance/native-playoff-recipient-v1.ts';
if(!process.argv[2])throw Error('Supply the completed local runtime directory.');
const directory=resolve(process.argv[2]),source=JSON.parse(await readFile(join(directory,'native-playoff-finance-recipient-source.json'),'utf8'));
const before=structuredClone(source),scope={actorId:source.actorId,tournamentId:source.tournamentId,eventId:source.eventId};
const result=projectNativeFinalRecipientEstimateV1(source,scope);assert.equal(result.status,'recipient_estimate',JSON.stringify(result));assert.deepEqual(source,before);
assert.equal(source.playoff.qualifierCount,5);assert.equal(source.playoff.matches.length,4);assert.equal(result.recipients.length,5);
assert.deepEqual(result.groups.map(g=>[g.firstPlace,g.lastPlace,g.participantIds.length]),[[1,1,1],[2,2,1],[3,4,2],[5,5,1]]);
assert(result.recipients.filter(p=>p.firstPlace===3).every(p=>p.amountMinor===500));
assert.equal(result.recipients.find(p=>p.firstPlace===1).participantId,source.playoff.matches.at(-1).result.winnerId);
assert.equal(result.recipients.reduce((s,p)=>s+p.amountMinor,0),result.totalMinor);assert.equal(result.moneyMoved,false);assert.equal(result.payoutAuthorized,false);assert.equal(result.independentPlayEstablished,false);
for(const change of [s=>s.playoff.matches[0].games[0].confirmations.pop(),s=>s.expectedHead.version++,s=>s.playoff.matches[0].result.winnerId=s.playoff.matches[0].result.loserId]){const altered=structuredClone(source);change(altered);assert.equal(projectNativeFinalRecipientEstimateV1(altered,scope).status,'blocked');}
await writeFile(join(directory,'root-native-recipient-parity.json'),JSON.stringify({status:'passed',scope:'actual-exported-local-locked-source-to-recipient-estimate',nativeSeries:4,qualifiers:5,verifiedGames:source.playoff.matches.reduce((s,m)=>s+m.games.length,0),acceptedActions:source.playoff.matches.reduce((s,m)=>s+m.actions.length,0),allOwnConfirmationsReplayed:true,wholeBandPerPersonMinor:500,recipientTotalMinor:result.totalMinor,proposalRevisionId:result.binding.proposalRevisionId,qualificationResultVersionId:result.binding.qualificationResultVersionId,recipientDigest:result.digest,recordedFundAvailable:false,providerRuntimeVerified:false,moneyMoved:false,payoutAuthorized:false,independentPlayEstablished:false},null,2)+'\n','utf8');
