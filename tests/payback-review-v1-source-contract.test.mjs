import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const proposal = readFileSync("docs/quality/2026-10-27-proposed-payback-review-v1.sql", "utf8");
const fixture = readFileSync("tests/payback-review-v1.sql", "utf8");
test("registered local migration exactly matches the reviewed SQL proposal", () => {
  assert.equal(readFileSync("database/migrations/0241_payback_review_v1.sql", "utf8").replaceAll("\r\n", "\n"), proposal.replaceAll("\r\n", "\n"));
});

test("proposal is additive, append-only, RLS-protected, and service-only", () => {
  assert.match(proposal, /LOCAL REVIEWED MIGRATION\. Not applied to hosted databases/);
  for (const table of [
    "event_payback_review_requirements",
    "event_payback_reviews_v1",
    "event_payback_review_conflicts_v1",
  ]) {
    assert.match(proposal, new RegExp(`create table app\\.${table}\\(`));
    assert.match(proposal, new RegExp(`'${table}'`));
  }
  assert.match(proposal, /enable row level security/);
  assert.match(proposal, /force row level security/);
  assert.match(proposal, /reject_immutable_history/);
  assert.match(proposal, /revoke all on app\.%I from public,anon,authenticated,service_role/);
  for (const rpc of [
    "get_event_payback_workspace_v1",
    "save_event_payback_review_v1",
    "get_event_payback_reconciliation_v1",
  ]) {
    assert.match(proposal, new RegExp(`grant execute on function public\\.${rpc}[^;]+to service_role`));
    assert.match(proposal, new RegExp(`revoke all on function public\\.${rpc}[^;]+from public,anon,authenticated`));
  }
  assert.doesNotMatch(proposal, /revoke all on function public\.(?:save_standard_singles|finalize_standard_singles)/);
});

test("adoption is limited to future/new-draft positive-fee 12-game Standard Main", () => {
  assert.match(proposal, /event_kind='main'and v\.format_code='standard_singles'and v\.game_count=12 and v\.entry_fee_cents>0/);
  assert.match(proposal, /future_activation_requires_payback_review after insert on app\.tournament_setup_activations/);
  assert.match(proposal, /new_v5_draft_requires_payback_review after insert on app\.event_settlement_drafts_v5/);
  assert.match(proposal, /requirement_source in\('future_activation','new_v5_draft','explicit_review'\)/);
  assert.match(proposal, /pre-proposal drafts\/finals remain historical/);
});

test("facts snapshot binds gross receipts, current source, active expenses, and exact ledger versions", () => {
  assert.match(proposal, /app\.settlement_source_current_v5\(p_tid,p_eid,draft\.request_payload->'source'\)/);
  for (const field of [
    "obligationId",
    "obligationVersion",
    "amountOwedMinor",
    "paymentEventId",
    "paymentVersion",
    "paymentState",
    "amountReceivedMinor",
  ]) assert.match(proposal, new RegExp(`'${field}'`));
  assert.match(proposal, /count\(distinct value->>'rosterEntryId'\)/);
  assert.match(proposal, /paymentState'is distinct from'received'/);
  assert.match(proposal, /obligationId'is null/);
  assert.match(proposal, /paymentEventId'is null/);
  assert.match(proposal, /linkCount/);
  assert.match(proposal, /directRosterEntryId/);
  assert.match(proposal, /participant_count<>active_roster_count/);
  assert.match(proposal, /paymentCount'\)::integer is distinct from participant_count/);
  assert.match(proposal, /paymentTotalMinor'\)::bigint is distinct from gross/);
  assert.match(proposal, /event_type='voided'/);
  assert.match(proposal, /'ledgerSnapshot',current_ledger/);
  assert.match(proposal, /r->>'byeWins'/);
  assert.doesNotMatch(proposal, /r->>'byesWon'/);
  assert.match(proposal, /gross:=participant_count::bigint\*setup\.entry_fee_cents::bigint/);
  assert.match(proposal, /distinct on\(expense_id\)/);
  assert.match(proposal, /review\.facts_snapshot is distinct from facts/);
  assert.match(proposal, /'current',review\.draft_id::text=facts->>'draftId'/);
});

test("validator requires complete evidence and exact assessment classification without description inference", () => {
  assert.match(proposal, /basis'<>'full_entry_cash_eligible'/);
  assert.match(proposal, /count\(distinct value->>'participantId'\)/);
  assert.match(proposal, /jsonb_array_length\(p_request->'expenseClassifications'\)<>jsonb_array_length\(p_facts->'expenses'\)/);
  assert.match(proposal, /count\(distinct value->>'expenseEventId'\)/);
  assert.match(proposal, /c->>'category'='sanctioning'/);
  assert.match(proposal, /c->>'expenseEventId'=draft\.request_payload->>'sanctioningExpenseEventId'/);
  assert.match(proposal, /\(e->>'amountMinor'\)::bigint=assessment/);
  assert.doesNotMatch(proposal, /description[^\n]{0,80}(?:like|~)/i);
  for (const category of ["sanctioning", "meals", "coffee", "donuts", "pastries", "snacks", "charity", "trophies", "cards", "printing", "advertising", "postage", "telephone", "supplies", "hall_rental"])
    assert.match(proposal, new RegExp(`'${category}'`));
  assert.doesNotMatch(proposal, /'souvenirs'|'beverages'/);
});

test("total awards, equal cohorts, conservation, and 85 percent use integer arithmetic", () => {
  assert.match(proposal, /count\(\*\)from jsonb_object_keys\(p_request\)\)<>9/);
  assert.match(proposal, /p_request->>'amountBasis'<>'total_award'/);
  assert.match(proposal, /amountMinor'\)::bigint<=0/);
  assert.match(proposal, /pa->>'amountMinor'<>pb->>'amountMinor'/);
  assert.match(proposal, /pa->'prizeOrder'<>'null'::jsonb/);
  assert.match(proposal, /retainedBalanceMinor'\)::bigint<>0/);
  assert.match(proposal, /gross<>benefit\+operating\+awards/);
  assert.match(proposal, /100::numeric\*\(awards\+benefit\)<85::numeric\*gross/);
  assert.match(proposal, /awards>9007199254740991::numeric/);
  assert.match(proposal, /create function app\.minimum_payback_return_minor_v1/);
  assert.match(proposal, /ceil\(85::numeric\*p_gross\/100::numeric\)/);
  assert.match(proposal, /app\.minimum_payback_return_minor_v1\(gross\)/);
  assert.doesNotMatch(proposal, /\(85\*gross\+99\)\/100/);
});

test("review writes preserve exact retry, conflicts, audits, and current-role authority", () => {
  assert.match(proposal, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(p_actor_id::text\|\|':'\|\|p_operation_id::text,0\)\)/);
  assert.match(proposal, /role in\('director','co_director'\)for update/);
  assert.match(proposal, /receipt\.request_hash=hash then return receipt\.response_payload/);
  assert.match(proposal, /event_payback_review_conflicts_v1/);
  assert.match(proposal, /payback_review_idempotency_conflict/);
  assert.match(proposal, /source_already_finalized/);
  assert.match(proposal, /exists\(select 1 from app\.standard_singles_settlement_final_versions where tournament_id=p_tid and event_id=p_eid\)/);
  assert.match(proposal, /values\(rid,p_tournament_id,p_actor_id,'save_event_payback_review_v1'/);
});

test("required events block legacy inserts and pin an exact current review on V5 finals", () => {
  assert.match(proposal, /aaa_required_payback_legacy_draft_guard before insert on app\.standard_singles_settlement_drafts/);
  assert.match(proposal, /aaa_required_payback_legacy_final_guard before insert on app\.standard_singles_settlement_final_versions/);
  assert.match(proposal, /aaa_required_payback_v5_final_guard before insert on app\.event_settlement_finals_v2/);
  assert.match(proposal, /new\.payback_review_id:=review_id/);
  assert.match(proposal, /app\.current_event_payback_review_v1\(p_tournament_id,p_event_id,draft\.id,draft\.version\)/);
  assert.match(proposal, /payback_evidence_required/);
});

test("rollback fixture exercises funded review, rejections, replay, conflict, final pin, and ACL", () => {
  assert.equal((fixture.match(/\\ir \.\.\/database\/migrations\/0240_versioned_settlement_v5\.sql/g) ?? []).length, 1);
  assert.equal((fixture.match(/\\ir \.\.\/docs\/quality\/2026-10-27-proposed-payback-review-v1\.sql/g) ?? []).length, 1);
  assert.match(fixture, /current_database\(\)<>'fixture_0240'/);
  assert.match(fixture, /12,3000,'unset'/);
  assert.match(fixture, /eventIncomeMinor',48000,'eventExpenseMinor',4800,'retainedBalanceMinor',0/);
  assert.match(fixture, /'amountBasis','total_award'/);
  assert.match(fixture, /minimum_payback_return_minor_v1\(101\)<>86/);
  assert.match(fixture, /18000/);
  assert.equal((fixture.match(/'amountMinor',7200/g) ?? []).length, 2);
  assert.match(fixture, /payback_evidence_required/);
  assert.match(fixture, /expense_classification_required/);
  assert.match(fixture, /active roster without participant\/payment evidence was accepted/);
  assert.match(fixture, /independent extra receipt did not block facts/);
  assert.match(fixture, /voided current receipt did not block facts/);
  assert.match(fixture, /same-amount obligation append did not stale review/);
  assert.match(fixture, /stale expense ledger did not block final/);
  assert.match(fixture, /new V5 draft did not require a fresh review/);
  assert.match(fixture, /PAYBACK_REVIEW_V1_CONCURRENCY_SEED_END/);
  assert.match(fixture, /does not itself claim concurrency/);
  assert.match(fixture, /idempotency_conflict/);
  assert.match(fixture, /pre-review V5 final did not return structured payback rejection/);
  assert.match(fixture, /pre-review final rejection replay changed/);
  assert.match(fixture, /legacy draft insert bypassed required review/);
  assert.match(fixture, /legacy final insert bypassed required review/);
  assert.match(fixture, /do not claim public legacy RPC rejection mapping coverage/);
  assert.match(fixture, /stale_version/);
  assert.match(fixture, /payback_review_id=\(saved->>'reviewId'\)::uuid/);
  assert.match(fixture, /PAYBACK_REVIEW_V1_SUPPORTED_FINAL_REPLAY_AND_REJECTIONS_PASSED/);
  assert.match(fixture, /set constraints all immediate;\s*rollback;\s*$/);
  assert.doesNotMatch(fixture, /disable trigger|session_replication_role|alter table[^\n]+disable/i);
});
