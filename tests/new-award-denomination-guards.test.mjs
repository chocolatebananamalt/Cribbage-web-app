import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const source=readFileSync('database/migrations/0260_new_award_denomination_guards_v1.sql','utf8');
test('new-award denomination guard covers regular legacy/new drafts and new finalization of old drafts',()=>{
 for(const name of['standard_singles_settlement_placements','standard_singles_settlement_awards','standard_singles_settlement_final_versions','event_settlement_drafts_v5','event_settlement_finals_v2','q_accounting_drafts_v6','q_accounting_finals_v6','no_q_accounting_drafts_v7','no_q_accounting_finals_v7','prize_accounting_drafts_v8','prize_accounting_finals_v8'])assert.ok(source.includes("'"+name+"'"),name);
 assert.match(source,/new\.request_payload->'prizeClaims'/);assert.match(source,/new\.source_manifest->'regularSchedule'->'awards'/);assert.match(source,/assert_whole_five_standard_draft_v1\(new\.settlement_draft_id/);
});
test('Q, side, team and satellite award seams fail closed while refunds, fees and historical voids stay distinct',()=>{
 for(const name of['q_obligation_reviews_v1','q_obligation_reviews_v2','event_side_pool_policy_versions','event_side_pool_payout_versions','event_side_pool_team_payout_versions','event_side_pool_payout_reviews','event_side_pool_payout_review_versions','event_side_pool_reconciliations','satellite_result_versions','event_team_financial_contributions'])assert.ok(source.includes("'"+name+"'"),name);
 assert.match(source,/p->>'kind'='award'/);assert.match(source,/p->>'kind'is distinct from'refund'/);assert.match(source,/if not new\.voided then amount:=new\.amount_minor/);assert.match(source,/if new\.contribution_type='award'/);
 assert.match(source,/if new\.approved then/);assert.match(source,/where not voided and mod\(amount_minor,500\)<>0/);
});
test('insert-only enforcement preserves immutable old history and prior accepted replay without fabricated receipts',()=>{
 assert.match(source,/before insert on app\.%I/);assert.match(source,/errcode='P0001',message='whole_five_awards_required'/);
 assert.doesNotMatch(source,/\b(?:update|delete from) app\./i);assert.doesNotMatch(source,/insert into app\.operation_receipts|grant execute|disable trigger|session_replication_role/i);
 assert.match(source,/from public,anon,authenticated,service_role/);
});
