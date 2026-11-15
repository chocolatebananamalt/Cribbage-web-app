import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseLegacySettlementRecovery} from '../src/lib/api/legacy-settlement-recovery.ts';
import {MANUAL_SETTLEMENT_ATTESTATIONS} from '../src/lib/api/settlement-finalization.ts';
const id='10000000-0000-4000-8000-000000000001';
test('original flat legacy financial envelopes retain only the exact reconciliation key',()=>{
 const final={kind:'manual-settlement-finalization',settlementDraftId:id,settlementDraftVersion:1,qualificationResultVersionId:id,playoffResultVersionId:id,expectedFinalizationVersion:0,eventIncomeMinor:0,eventExpenseMinor:0,placementPayoutTotalMinor:0,qPoolPayoutTotalMinor:0,otherAwardTotalMinor:0,retainedBalanceMinor:0,expectedPaymentReceiptCount:0,expectedPaymentReceiptTotalMinor:0,expectedExpenseCount:0,expectedExpenseTotalMinor:0,officialSourceReference:'TEST ONLY codec fixture',attestations:MANUAL_SETTLEMENT_ATTESTATIONS,idempotencyKey:id};
 assert.deepEqual(parseLegacySettlementRecovery(JSON.stringify(final),'manual-settlement-finalization'),{idempotencyKey:id});
 assert.equal(parseLegacySettlementRecovery(JSON.stringify({kind:final.kind,request:final}),'manual-settlement-finalization'),null);
 assert.equal(parseLegacySettlementRecovery(JSON.stringify(final),'settlement-draft'),null);
 assert.equal(parseLegacySettlementRecovery('{bad','settlement-draft'),null);
});
test('pre-upgrade financial requests remain exact and uncertain absence cannot delete them',()=>{
 const source=readFileSync('src/app/tournament/[tournamentId]/events/[eventId]/settlement/legacy-settlement-recovery.tsx','utf8');
 assert.match(source,/parseLegacySettlementRecovery/);assert.match(source,/sessionStorage\.getItem\(key\)!==raw/);
 assert.match(source,/retry\?request:lookup/);assert.match(source,/Retry exact legacy request/);
 assert.doesNotMatch(source,/Discard|confirmedRaw/);
 assert.match(source,/response\.ok&&accepted/);
});
