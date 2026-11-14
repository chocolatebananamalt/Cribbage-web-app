import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const operational=readFileSync('database/proposals/event-settings-operational-activation-v1.sql','utf8');
const finance=readFileSync('database/proposals/event-settings-finance-backstop-v1.sql','utf8');
const base=readFileSync('database/proposals/event-settings-activation-guard-v1.sql','utf8');
// Inventory and source-anchor regressions, not PostgreSQL installation or a
// substitute for real roles, concurrent callers and whole-transaction rollback.
test('operational candidate retains service checks and grants no access or claim switching',()=>{
 assert.match(operational,/UNEXECUTED PRIVATE OPERATIONAL ACTIVATION CANDIDATE/);
 assert.doesNotMatch(operational,/\bgrant\s+(execute|all|select|insert|update|delete)\b/i);
 assert.doesNotMatch(operational,/set_config|set\s+role\s|request\.jwt\.claims/i);
 assert.ok((operational.match(/auth\.role\(\)/g)??[]).length>=2);
 assert.match(base,/unique\(actor_id,operation_id,tournament_id\)/);
 assert.match(operational,/unsupported_operational_scope/);assert.match(operational,/mixed_legacy_scope_unsupported/);
 assert.match(operational,/create function app\.event_settings_operational_activation_enabled_v1\(\)returns boolean\s+language sql immutable set search_path=''as \$\$select false\$\$/);
 assert.ok(operational.indexOf("'activation_runtime_acceptance_required'")<operational.indexOf('insert into app.event_settings_operational_attempts_v1'));
});
test('private cloning is guarded by exact-once anchors and old prize bodies remain fallbacks',()=>{
 assert.match(operational,/Operational finalizer clone header changed/);
 assert.match(operational,/Operational finalizer declaration-count anchor changed/);
 assert.match(operational,/Prize activation BEFORE trigger anchor changed/);
 assert.match(operational,/Prize activation AFTER trigger anchor changed/);
 assert.doesNotMatch(operational,/drop\s+trigger/i);
 assert.match(operational,/source_busy','isolation_not_supported'.*return jsonb_build_object\('status','retry_exact'/);
 assert.match(operational,/event_settings_operational_postcondition_failed/);
});
test('new configured accounting is blocked on all 15 authoritative paths without disabling independent pool estimates',()=>{
 const targets=['standard_singles_settlement_drafts','standard_singles_settlement_final_versions','event_settlement_drafts_v5','event_settlement_finals_v2','q_accounting_drafts_v6','q_accounting_finals_v6','no_q_accounting_drafts_v7','no_q_accounting_finals_v7','prize_accounting_drafts_v8','prize_accounting_finals_v8','prize_accounting_drafts_v9','prize_accounting_finals_v9','multi_event_unpaid_drafts_v1','multi_event_unpaid_finals_v1','multi_event_joint_finals_v1'];
 for(const table of targets)assert.ok(finance.includes(`'${table}'`));
 assert.match(finance,/count\(\*\)=15/);assert.match(finance,/tg_table_name='multi_event_joint_finals_v1'/);
 assert.match(finance,/event_settings_finance_integration_required/);
 assert.doesNotMatch(finance,/q_obligation_reviews|side_pool_amount|side_pool_recipient/);
 assert.match(operational,/event_settings_finance_guard_available_v1/);assert.match(operational,/finance_backstop_required/);
 assert.doesNotMatch(finance,/\bgrant\s+(execute|all|select|insert|update|delete)\b/i);
});
