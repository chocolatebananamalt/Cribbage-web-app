import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assembleSelectedStepPrizeSourceV3 as assemble } from '../src/lib/finance/selected-step-prize-source-v3.ts';
import { playoffPrizeBasisFixtureV2 } from './fixtures/playoff-prize-basis-v2.mjs';
const id = n => `91000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope = {actorId:id(90),tournamentId:id(1),eventId:id(2)};
function fixture() {
 const input=playoffPrizeBasisFixtureV2(),ledger=input.ledger.current;ledger.mode='documented_actual';
 for(const s of ledger.sources)s.physicalEvidenceId=s.sourceId;
 input.ledger.retained=structuredClone(ledger);
 const coverage={additionalIncome:'not_included',sanctioning:'review_required',fundCompleteness:'review_required'};
 const pin={status:'pin_available',prize:{document:input.prizeSource.snapshot},settingsBinding:{settings_snapshot_id:id(5)},eventVersion:{client_row_id:id(3),setup_revision_id:id(4)}};
 const ownership={status:'source_available',kind:'selected-step-regular-ledger-v3',...scope,sourceDigest:ledger.sourceDigest,ownershipRevisionId:id(8),ownershipVersion:3,
  capture:{ownershipSource:{capture:{nativePlayoffSource:{qualificationId:id(7),source:{prizeActivation:pin}}}}},ledger,
  funds:{regularReceiptsMinor:200000,qReceiptsMinor:10000,sideReceiptsMinor:20000,benefitsMinor:0,expensesMinor:20000,regularAllocationFundMinor:180000},coverage,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false};
 return {status:'source_available',kind:'selected-step-prize-source-v3',...scope,sourceDigest:'d'.repeat(64),revisionDomain:'selected-step-pool-ownership-v3',capture:{ownershipLedger:ownership,prizeActivation:pin,input},coverage,proposalOnly:true,moneyMoved:false,payoutAuthorized:false,finalizationAuthorized:false};
}
test('modern policy estimate consumes full conserved ownership ledger; Q/Side never enter regular fund',()=>{
 const v=fixture(),before=structuredClone(v),r=assemble(v,scope);assert(r);assert.equal(r.basis.input.fundMinor,180000);
 assert.equal(r.ledger.totals.q,10000);assert.equal(r.ledger.totals.side,20000);assert.equal(r.coverageReviewRequired,true);assert.equal(r.finalizationAllowed,false);
 assert.equal(r.revisionDomain,'selected-step-pool-ownership-v3');assert.deepEqual(v,before);
});
test('changed ownership, qualification, actor, source version or policy cannot be represented as current',()=>{
 for(const change of[v=>v.actorId=id(91),v=>v.capture.ownershipLedger.ownershipRevisionId=id(99),v=>v.capture.ownershipLedger.ownershipVersion++,
  v=>v.capture.ownershipLedger.sourceDigest='f'.repeat(64),v=>v.capture.input.qualification.currentResultVersionId=id(99),
  v=>v.capture.prizeActivation={...v.capture.prizeActivation,status:'stale'},v=>v.capture.input.binding.settingsSnapshotId=id(99),
  v=>v.capture.ownershipLedger.funds.qReceiptsMinor++,v=>v.capture.ownershipLedger.funds.regularAllocationFundMinor+=10000,
  v=>v.coverage={...v.coverage,fundCompleteness:'complete'},v=>v.payoutAuthorized=true]){
  const v=fixture();change(v);assert.equal(assemble(v,scope),null);
 }
});
test('incomplete receipt conservation, changed retained ledger and optional reclassification fail closed',()=>{
 for(const change of[v=>{v.capture.input.ledger.current.sources[0].amountMinor++;},
  v=>{v.capture.input.ledger.retained.sources[0].amountMinor++;},
  v=>{v.capture.input.ledger.current.sources[0].allocations[1].bucket='regular_entry';}]){
  const v=fixture();change(v);assert.equal(assemble(v,scope),null);
 }
});
test('SQL bridge uses actual current V3 source and journal; prior guards remain installed and no writes/grants occur',()=>{
 const s=fs.readFileSync('database/proposals/selected-step-regular-ledger-v3.sql','utf8');
 for(const token of ['select false','native_optional_finance_service_access_v2(actor,tid,eid)','selected_step_pool_ownership_source_v3(actor,tid,eid)',
  'head.source_capture is distinct from owned','ownership_journal_incomplete','receipt_not_conserved','ownership_fund_mismatch',
  'cost_coverage_incomplete','selected_step_pool_activation_pin_v3(actor,tid,eid)','public.get_standard_singles_qualification_result_v1(actor,tid,eid)',
  "'additionalIncome','not_included'","'fundCompleteness','review_required'",'from public,anon,authenticated,service_role'])assert(s.includes(token),token);
 assert.doesNotMatch(s,/create or replace|insert into|update app\.|delete from|grant execute|set_config/i);
 const old=fs.readFileSync('database/proposals/event-prize-activation-source-v1.sql','utf8');
 assert(old.includes('new_prize_accounting_required'));assert(old.includes('new_prize_playoff_integration_required'));
 assert(fs.readFileSync('database/proposals/playoff-prize-native-source-v2.sql','utf8').includes('optional_pool_bridge_required'));
});
