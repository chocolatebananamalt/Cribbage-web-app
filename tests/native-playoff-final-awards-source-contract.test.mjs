import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../database/proposals/native-playoff-final-awards-v1.sql',import.meta.url),'utf8');

test('private candidate is default-off, force-RLS, revoked and non-disbursing',()=>{
 assert.match(sql,/native_playoff_final_awards_enabled_v1\(\).*select false/s);
 for(const table of ['native_unrestricted_income_sources_v1','native_unrestricted_income_records_v1','native_recorded_fund_reviews_v1','native_playoff_final_award_sets_v1','native_playoff_final_award_groups_v1','native_playoff_final_award_recipients_v1']){
  assert.match(sql,new RegExp(`alter table app\\.%I force row level security`));
  assert(sql.includes(`'${table}'`));
 }
 assert.match(sql,/money_moved boolean not null default false check\(not money_moved\)/);
 assert.match(sql,/finalization_authorized boolean not null default false check\(not finalization_authorized\)/);
 assert.match(sql,/revoke all on function %s from public,anon,authenticated,service_role/);
});

test('wire contracts are exact and money is derived rather than posted',()=>{
 assert.match(sql,/jsonb_object_keys\(request_value\)\)<>7/);
 assert.equal((sql.match(/jsonb_object_keys\(request_value\)\)<>9/g)||[]).length,1);
 assert.equal((sql.match(/jsonb_object_keys\(request_value\)\)<>10/g)||[]).length,1);
 assert.match(sql,/native-unrestricted-income-record-v1/);
 assert.match(sql,/native-recorded-fund-review-v1/);
 assert.match(sql,/native-playoff-final-awards-v1/);
 assert.doesNotMatch(sql,/request_value#>>'\{[^}]*amount/i);
 assert.doesNotMatch(sql,/request_value->>'amount/i);
});

test('source rebuild pins full income lineage, recorded fund and verified playoff recipients',()=>{
 for(const marker of ['income_history_changed','physical_evidence_conflict','recorded_fund_review_stale','recorded_fund_imbalance','recipient_mapping_incomplete','custom_ratio_paid_count_policy_unresolved'])assert(sql.includes(marker));
 assert.match(sql,/coalesce\(to_jsonb\(record_row\.prior_record_id\),'null'::jsonb\)/);
 assert.match(sql,/div\(raw\*2\+denominator\*500,denominator\*1000\)\*500/);
 assert.match(sql,/recipientSourceDigest.*is distinct from recipient_digest/s);
 assert.match(sql,/headVersion',income_head/);
 assert.match(sql,/unfinished_proposal_form/);
 assert.match(sql,/stale_override_plan/);
 assert.match(sql,/native_sanctioning_coverage_v1/);
 assert.match(sql,/event_play_start_id<>start_row\.id/);
 assert.match(sql,/eligible_participant_count<>start_row\.participant_count/);
 assert.match(sql,/current_event\.event_type=snapshot\.event_kind/);
 assert.match(sql,/snapshot\.rate_cents::numeric\*snapshot\.eligible_participant_count::numeric<>snapshot\.total_cents::numeric/);
 assert.match(sql,/part->>'bucket'in\('player_benefit','operating_expense'\)/);
 assert.match(sql,/sanctioning_coverage_unverified/);
 assert.match(sql,/'sanctioning',sanctioning-'status'/);
});

test('liability guard is bidirectional and final record remains historical',()=>{
 assert.match(sql,/legacy_financial_liability_exists_v1/);
 assert.match(sql,/aa_native_final_award_liability_v1/);
 assert.match(sql,/native_final_award_liability_exists/);
 assert.match(sql,/final_awards_already_recorded/);
 assert.match(sql,/'historicalReceipt',true,'currentSourceVerified',false/);
 assert.match(sql,/'awardStatus','recorded_unpaid'/);
});
