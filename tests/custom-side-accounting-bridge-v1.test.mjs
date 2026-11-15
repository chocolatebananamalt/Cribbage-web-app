import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  calculateCustomGraduatedAmountsV3,
  customGraduatedMaximumRatioV3,
} from '../src/lib/results/custom-graduated-amounts-v3.ts';

const sql=fs.readFileSync('database/proposals/custom-side-accounting-bridge-v1.sql','utf8');
const legacyAmounts=fs.readFileSync('database/migrations/0261_side_pool_graduated_amounts_v2.sql','utf8');
const legacyRecipients=fs.readFileSync('database/migrations/0264_side_pool_unpaid_recipients_v3.sql','utf8');

test('custom Side method is explicit while the historical V2 domain stays unchanged',()=>{
 for(const token of[
  "method='graduated-acc-weighted-largest-remainder-5usd-v2'and ratio between 2 and 100",
  "method='side-custom-graduated-policy-v4'and ratio between 1 and 2147483647",
  "'amountMethod','graduated-custom-ratio-largest-remainder-5usd-v3'",
  "jsonb_build_array('side_pool_custom_operating_v4',p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_request)",
  "operation_type='side_pool_custom_operating_v4'",
  "refundPolicy','no-pool-refunds-v1'",
  'side_no_eligible_recipients',
  "new.method is distinct from'side-custom-graduated-policy-v4'",
  "o.operation_type='side_pool_custom_operating_v4'and o.outcome='accepted'",
 ])assert.ok(sql.includes(token),token);
 assert.match(sql,/The V3 amount kernel is the persisted intent contract/);
 assert.match(sql,/not adopt the workbook distribution/);
 assert.doesNotMatch(sql,/workbookSideComparisonV1|workbook-side-comparison/);
 assert.doesNotMatch(sql,/grant execute[\s\S]{0,250}to (?:anon|authenticated)/);
 assert.doesNotMatch(sql,/insert into app\.(?:side_pool_recipient_reviews_v3|prize_accounting_finals_v8|prize_accounting_finals_v9)/);
});

test('writer derives materialization, definition and full immutable setup intent',()=>{
 for(const token of[
  "count(*)from jsonb_object_keys(p_request))<>9",
  "array['action','setupSidePoolVersionId','definitionVersionId','method','ratio','amountMethod','disclosureReference','disclosed','intent']",
  "count(*)from jsonb_object_keys(intent))<>4",
  "count(*)from jsonb_object_keys(source_value))<>6",
  'tournament_setup_side_pool_materializations',
  'tournament_setup_side_pool_versions',
  'event_side_pool_definition_versions',
  'setup_custom_payout_intents_v2',
  'setup_custom_payout_batches_v2',
  "i.original_intent=p_request->'intent'",
  "i.scope='side'and i.pool_slot=s.slot",
  "e.event_kind not in('main','consolation')",
  'custom_ratio_denominator_v3 is distinct from ratio_value',
 ])assert.ok(sql.includes(token),token);
 assert.match(sql,/current_setting\('transaction_isolation'\)<>'read committed'/);
 assert.match(sql,/event-start:/);
 assert.match(sql,/role in\('director','co_director'\)/);
 assert.match(sql,/public\.save_side_custom_policy_v4/);
 assert.match(sql,/public\.get_side_custom_policy_reconciliation_v4/);
});

test('legacy source and V3 paid-card recipient authority remain the unchanged fallback',()=>{
 assert.match(sql,/pg_get_functiondef\('app\.side_pool_graduated_source_v2\(uuid,uuid,uuid\)'::regprocedure\)/);
 assert.match(sql,/FUNCTION app\.side_pool_graduated_source_pre_custom_v4/);
 assert.match(sql,/if p\.id is null or p\.method<>'side-custom-graduated-policy-v4'then return app\.side_pool_graduated_source_pre_custom_v4/);
 assert.ok(legacyAmounts.includes("calculation:=app.calculate_graduated_pool_amounts_v2(jsonb_build_object('paidCount',paid,'feeMinor',d.entry_fee_minor,'ratio',p.ratio));"));
 assert.match(legacyRecipients,/Complete paid set, never filtered by playoff qualification or arbitrary UUID order/);
 assert.match(legacyRecipients,/order by r\.game_points desc,r\.games_won desc,r\.plus_points desc/);
 assert.match(legacyRecipients,/cash_tie_policy_unresolved/);
 assert.match(legacyRecipients,/status','unpaid'/);
 assert.match(sql,/app\.calculate_custom_graduated_amounts_v3\(jsonb_build_object\('paidCount',paid,'feeMinor',d\.entry_fee_minor,'ratio',p\.ratio\)\)/);
});

test('V3 custom amount kernel conserves paid funds on the $5 lattice across the widened domain',()=>{
 for(const input of[
  {paidCount:1,feeMinor:1000,ratio:1},
  {paidCount:16,feeMinor:1000,ratio:7},
  {paidCount:30,feeMinor:500,ratio:customGraduatedMaximumRatioV3},
 ]){
  const result=calculateCustomGraduatedAmountsV3(input);
  assert.equal(result.status,'calculated');
  assert.equal(result.fundMinor,input.paidCount*input.feeMinor);
  assert.equal(result.awardsMinor.reduce((sum,value)=>sum+value,0),result.fundMinor);
  assert.ok(result.awardsMinor.every((value,index)=>value>0&&value%500===0&&(index===0||value<=result.awardsMinor[index-1])));
 }
 const zero=calculateCustomGraduatedAmountsV3({paidCount:0,feeMinor:1000,ratio:7});
 assert.equal(zero.status,'calculated');assert.equal(zero.recipientCount,0);
 assert.match(sql,/paidCount'\)::integer=0[\s\S]+side_no_eligible_recipients/);
 assert.deepEqual(calculateCustomGraduatedAmountsV3({paidCount:12,feeMinor:1000,ratio:customGraduatedMaximumRatioV3+1}),{status:'blocked',code:'unsupported_ratio'});
});

test('Satellite and combined finalization remain explicit implementation gaps',()=>{
 assert.match(sql,/Satellite and combined Q\/Side final accounting remain unsupported/);
 assert.match(sql,/e\.event_kind not in\('main','consolation'\)/);
 assert.doesNotMatch(sql,/event_kind[^\n]+satellite/);
 assert.doesNotMatch(sql,/q_obligation_sources|finalize_prize|finalize_q_accounting/);
 assert.match(sql,/app\.prize_accounting_source_pre_custom_side_v4/);
 assert.match(sql,/if not exists[\s\S]+method='side-custom-graduated-policy-v4'\)then return base;end if/);
 assert.match(sql,/custom_side_combined_accounting_unsupported/);
 assert.match(sql,/'facts','null'::jsonb/);
});
