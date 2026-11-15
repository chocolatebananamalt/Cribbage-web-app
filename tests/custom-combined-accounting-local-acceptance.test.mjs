import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';

const source=fs.readFileSync('tests/custom-combined-accounting-local-acceptance.mjs','utf8');

test('combined V10 helper builds one deterministic Custom Q7, Equal Q and Side5 lifecycle',()=>{
 for(const token of[
  'verifyCustomCombinedAccountingRuntimeV10',
  "createCustomPayoutIntentV1('q',7",
  "createCustomPayoutIntentV1('side',5",
  'save_custom_pool_setup_draft_v3',
  'finalize_linked_tournament_setup_v1',
  'regular-prize-cohort-5usd-v3',
  'automatic-five-dollar-cohort-v3',
  'save_side_pool_graduated_election_v2',
  'qCustomPaidEntrants',
  'qEqualPaidEntrants',
  'sidePaidEntrants',
  'record_standard_singles_playoff_outcomes_v3',
  'verifyCustomQSideCombinedAccountingV10',
  "integrationVersion:'custom-pool-accounting-v10'",
 ])assert.ok(source.includes(token),token);
 assert.equal(source.includes('finalize_q_accounting_v6'),false);
 assert.equal(source.includes('insert into app.q_obligation_reviews_v2'),false);
 assert.equal(source.includes('insert into app.side_pool_recipient_reviews_v3'),false);
});

test('combined helper keeps synthetic and authority limitations explicit',()=>{
 for(const token of['syntheticFoundations:true','providerVerified:false','moneyMoved:false','combinedQSideSupportedByV10:true','standaloneSideV9Supported:false'])assert.ok(source.includes(token),token);
});
