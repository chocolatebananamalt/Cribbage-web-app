import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateStandardSinglesMrpReference} from '../src/lib/results/standard-singles-mrp-reference.ts';
import {isPlayoffPlacementRequest} from '../src/lib/api/playoff-placement.ts';
import {isManualSettlementFinalizationRequest,MANUAL_SETTLEMENT_ATTESTATIONS} from '../src/lib/api/settlement-finalization.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('conditional four-player MRP arithmetic uses explicit rounds, not place-derived rounds',()=>{
 const qualifiers=[{paper:2,rank:1,points:24,round:2,q:55,p:21,total:76},{paper:1,rank:2,points:24,round:2,q:55,p:21,total:76},{paper:4,rank:3,points:22,round:1,q:5,p:7,total:12},{paper:3,rank:4,points:22,round:1,q:5,p:7,total:12}];
 for(const q of qualifiers){const result=calculateStandardSinglesMrpReference({eventType:'main',gameCount:12,qualifierCount:4,qualificationRank:q.rank,gamePoints:q.points,playoffExitRound:q.round});assert.equal(result.status,'published_schedule');assert.equal(result.qualifyingMrp,q.q);assert.equal(result.playoffMrp,q.p);assert.equal(result.totalMrp,q.total);}
});
test('official rounds-won oracle exposes champion literal-exit-round ambiguity',()=>{
 // MainMRPs.pdf: minimum7, then credit level advances for each round won.
 // Final round2 is NOT the champion credit index3. Do not label this as a played round3.
 const sourceExpected=[{rank:1,points:24,wins:2,total:97},{rank:2,points:24,wins:1,total:76},{rank:3,points:22,wins:0,total:12},{rank:4,points:22,wins:0,total:12}];
 for(const p of sourceExpected){const result=calculateStandardSinglesMrpReference({eventType:'main',gameCount:12,qualifierCount:4,qualificationRank:p.rank,gamePoints:p.points,playoffExitRound:p.wins+1});assert.equal(result.totalMrp,p.total);}
 const literalFinalRound=calculateStandardSinglesMrpReference({eventType:'main',gameCount:12,qualifierCount:4,qualificationRank:1,gamePoints:24,playoffExitRound:2});
 assert.notEqual(literalFinalRound.totalMrp,sourceExpected[0].total);
});
test('API cannot record tied semifinal exits as shared third place',()=>{
 const request={qualificationResultVersionId:id(1),expectedVersion:0,idempotencyKey:id(2),placements:[{participantId:id(3),placement:1,mrpPlayoffExitRound:2},{participantId:id(4),placement:2,mrpPlayoffExitRound:2},{participantId:id(5),placement:3,mrpPlayoffExitRound:1},{participantId:id(6),placement:3,mrpPlayoffExitRound:1}]};
 assert.equal(isPlayoffPlacementRequest(request),false);
 // A director-supplied unique ordering is codec-valid, not a policy ruling.
 assert.equal(isPlayoffPlacementRequest({...request,placements:request.placements.map((p,i)=>({...p,placement:i+1}))}),true);
});
test('zero-ledger reconciliation is only conditional; cannot cover a 4800-cent expense without funding',()=>{
 const request={settlementDraftId:id(1),settlementDraftVersion:1,qualificationResultVersionId:id(2),playoffResultVersionId:id(3),expectedFinalizationVersion:0,eventIncomeMinor:0,eventExpenseMinor:0,placementPayoutTotalMinor:0,qPoolPayoutTotalMinor:0,otherAwardTotalMinor:0,retainedBalanceMinor:0,expectedPaymentReceiptCount:0,expectedPaymentReceiptTotalMinor:0,expectedExpenseCount:0,expectedExpenseTotalMinor:0,officialSourceReference:'TEST ONLY proposed zero-ledger worksheet; not settlement approval',attestations:MANUAL_SETTLEMENT_ATTESTATIONS,idempotencyKey:id(4)};
 assert.equal(isManualSettlementFinalizationRequest(request),true);
 assert.notEqual(request.eventIncomeMinor,4800+request.retainedBalanceMinor);
 // Codec validity does not attest expense completeness or authorize a write.
});
