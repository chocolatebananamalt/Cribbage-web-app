import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const proposal = readFileSync("docs/quality/2026-10-27-proposed-prize-schedule-v1.sql", "utf8");
const fixture = readFileSync("tests/prize-schedule-v1.sql", "utf8");

test("registered local migration exactly matches the reviewed proposal", () => {
  assert.equal(readFileSync("database/migrations/0242_setup_prize_schedule_v1.sql", "utf8").replaceAll("\r\n", "\n"), proposal.replaceAll("\r\n", "\n"));
});

test("proposal is explicit opt-in, append-only, private, and service-only", () => {
  assert.match(proposal, /LOCAL REVIEWED MIGRATION PROPOSAL\. Not applied to hosted databases/);
  for (const table of [
    "setup_prize_schedule_streams_v1",
    "setup_prize_schedule_versions_v1",
    "event_prize_schedule_bindings_v1",
    "setup_prize_schedule_conflicts_v1",
  ]) assert.match(proposal, new RegExp(`create table app\\.${table}`));
  assert.match(proposal, /force row level security/);
  assert.match(proposal, /reject_immutable_history/);
  assert.match(proposal, /revoke all on app\.%I from public, anon, authenticated, service_role/);
  for (const rpc of [
    "get_setup_prize_schedule_v1",
    "list_tournament_prize_schedules_v1",
    "get_prize_schedule_reconciliation_v1",
    "save_setup_prize_schedule_v1",
    "get_event_prize_schedule_resolution_v1",
    "list_prize_award_summaries_v1",
  ]) {
    assert.match(proposal, new RegExp(`revoke all on function public\\.${rpc}[^;]+from public, anon, authenticated`));
    assert.match(proposal, new RegExp(`grant execute on function public\\.${rpc}[^;]+to service_role`));
  }
});

test("saved schedule contract is strict, bounded to Main 12 single-event four-player scope", () => {
  assert.match(proposal, /director-selected-prize-schedule-v1/);
  assert.match(proposal, /floor_each_weighted_share_then_assign_remainder_to_champion/);
  assert.match(proposal, /p_schedule->>'expectedQualifierCount' <> '4'/);
  assert.match(proposal, /seen @> array\['1:1', '2:2', '3:4'\]/);
  assert.match(proposal, /settings->>'eventKind' <> 'main'/);
  assert.match(proposal, /settings->>'styleCode' <> 'Standard'/);
  assert.match(proposal, /settings->>'formatCode' <> 'standard_singles'/);
  assert.match(proposal, /settings->>'gameCount' <> '12'/);
  assert.match(proposal, /settings->>'eventCount' <> '1'/);
  assert.match(proposal, /settings->>'qPoolCount' <> '0'/);
  assert.match(proposal, /settings->>'sidePoolCount' <> '0'/);
  assert.match(proposal, /current_version >= 256/);
  assert.match(proposal, /exists\(select 1 from app\.qualification_result_versions item where item\.tournament_id = p_tournament_id and item\.event_id = activation\.event_id\)/);
  assert.match(proposal, /primary key \(tournament_id, client_row_id\)/);
  assert.match(proposal, /setup_event\.setup_revision_id = \(select revision\.id/);
  assert.match(proposal, /or exists\(select 1 from app\.event_prize_schedule_bindings_v1 binding/);
});

test("save path preserves actor operation replay, authorization, locking, conflicts, and audit", () => {
  assert.match(proposal, /hashtextextended\(p_actor_id::text \|\| ':' \|\| p_operation_id::text/);
  assert.match(proposal, /role in \('director', 'co_director'\) for update/);
  assert.match(proposal, /'settlement:' \|\| activated_event_id::text/);
  assert.match(proposal, /'settlement-domain:' \|\| activated_event_id::text/);
  assert.match(proposal, /receipt\.request_hash = request_hash then return receipt\.response_payload/);
  assert.match(proposal, /setup_prize_schedule_conflicts_v1/);
  assert.match(proposal, /prize_schedule_idempotency_conflict/);
  assert.match(proposal, /prize_schedule_saved_v1/);
  assert.match(proposal, /prize_schedule_rejected/);
});

test("activation and settlement adoption are explicit and do not rewrite legacy history", () => {
  assert.match(proposal, /bind_prize_schedule_on_activation_v1 after insert on app\.tournament_setup_activations/);
  assert.match(proposal, /if not found then return new/);
  assert.match(proposal, /binding_source[^\n]+\('activation', 'reviewed_revision'\)/);
  assert.match(proposal, /aaa_prize_schedule_legacy_draft_guard before insert on app\.standard_singles_settlement_drafts/);
  assert.match(proposal, /aaa_prize_schedule_legacy_final_guard before insert on app\.standard_singles_settlement_final_versions/);
  assert.match(proposal, /aaa_prize_schedule_v5_draft_guard before insert on app\.event_settlement_drafts_v5/);
  assert.match(proposal, /event_settlement_drafts_v5 add column prize_schedule_version_id uuid/);
  assert.doesNotMatch(proposal, /update app\.event_settlement_drafts_v5/);
  assert.doesNotMatch(proposal, /revoke (?:all|execute) on function public\.(?:save_standard_singles|finalize_standard_singles)/);
});

test("V5 keeps legacy eight-field requests and requires an explicit pinned ninth key after adoption", () => {
  assert.match(proposal, /key_count not in \(8, 9\)/);
  assert.match(proposal, /key_count = 9 and not \(p_request \? 'scheduleVersionId'\)/);
  assert.match(proposal, /key_count = 8 and p_request \? 'scheduleVersionId'/);
  assert.match(proposal, /receipt lookup and request hash/);
  assert.match(proposal, /perform app\.require_event_prize_schedule_draft_v1\(p_tournament_id,p_event_id,p_request,mrp\)/);
  assert.match(proposal, /perform app\.require_event_prize_schedule_draft_v1\(p_tournament_id,p_event_id,draft\.request_payload,mrp\)/);
  assert.match(proposal, /schedule_revision_required/);
  assert.match(proposal, /schedule_claim_mismatch/);
  assert.match(proposal, /new\.prize_schedule_version_id := required_schedule_id/);
  assert.match(proposal, /claim->'prizeOrder' <> 'null'::jsonb\s+and claim->>'prizeOrder' is distinct from award->>'bandStart'/);
});

test("resolution binds current canonical rows, exact receipts, complete expenses, and conservation", () => {
  assert.match(proposal, /settlement_source_current_v5\(p_tournament_id, p_event_id, p_source\)/);
  assert.match(proposal, /canonical_settlement_mrp_v5\(p_tournament_id, p_event_id, p_source\)/);
  assert.match(proposal, /jsonb_array_length\(canonical->'rows'\) <> 4/);
  assert.match(proposal, /item->>'byeWins'/);
  assert.doesNotMatch(proposal, /item->>'byesWon'/);
  assert.match(proposal, /participant_count <> active_roster_count/);
  assert.match(proposal, /coalesce\(life\.event_type, 'active'\) <> 'withdrawn'/);
  assert.match(proposal, /amount_owed_minor/);
  assert.match(proposal, /payment_state/);
  assert.match(proposal, /paymentTotalMinor/);
  assert.match(proposal, /distinct on \(expense_id\)/);
  assert.match(proposal, /budget := gross - expense_total/);
  assert.match(proposal, /gross > 9007199254740991::numeric/);
  assert.match(proposal, /expense_total > 9007199254740991::numeric/);
  assert.match(proposal, /'weight', \(cohort->>'weight'\)::bigint/);
  assert.match(proposal, /floor\(budget \* \(cohort->>'weight'\)::numeric \/ denominator\)/);
  assert.match(proposal, /then remainder else 0 end amount/);
  assert.match(proposal, /retainedBalanceMinor'\)::numeric <> 0/);
});

test("director resolution and player summaries expose only their exact bounded shapes", () => {
  assert.match(proposal, /create function public\.get_event_prize_schedule_resolution_v1/);
  assert.match(proposal, /role in \('director', 'co_director'\)/);
  assert.match(proposal, /'roundingRemainderMinor'/);
  assert.match(proposal, /create function public\.list_prize_award_summaries_v1/);
  assert.match(proposal, /participant\.profile_id = p_actor_id or link\.profile_id = p_actor_id/);
  assert.match(proposal, /'displayName'/);
  assert.match(proposal, /'amountMinor', award->'totalAwardMinor'/);
  const summaryStart = proposal.indexOf("create function public.list_prize_award_summaries_v1");
  const summaryEnd = proposal.indexOf("revoke all on function public.get_setup_prize_schedule_v1", summaryStart);
  const summary = proposal.slice(summaryStart, summaryEnd);
  assert.doesNotMatch(summary, /grossEntryIncomeMinor|expenseTotalMinor|paymentEventId|obligationId/);
});

test("payback snapshots carry the pinned structured rule while old unstructured snapshots keep their shape", () => {
  assert.match(proposal, /rename to event_payback_facts_base_v1/);
  assert.match(proposal, /if draft\.prize_schedule_version_id is null then return facts/);
  assert.match(proposal, /'structuredSchedule', resolved/);
  assert.match(proposal, /rename to validate_event_payback_review_base_v1/);
  assert.match(proposal, /p_request->>'scheduleReference' is distinct from structured->'rule'->>'sourceReference'/);
  assert.match(proposal, /final\.payback_review_id/);
  assert.match(proposal, /app\.current_event_payback_review_v1/);
  assert.match(proposal, /source_already_finalized'',''schedule_claim_mismatch/);
  assert.match(proposal, /when ''schedule_revision_required'' then ''schedule_revision_required''/);
});

test("rollback fixture uses supported financial writers and proves the adopted schedule path", () => {
  assert.equal((fixture.match(/\\ir \.\.\/database\/migrations\/0240_versioned_settlement_v5\.sql/g) ?? []).length, 1);
  assert.equal((fixture.match(/\\ir \.\.\/docs\/quality\/2026-10-27-proposed-payback-review-v1\.sql/g) ?? []).length, 1);
  assert.equal((fixture.match(/\\ir \.\.\/docs\/quality\/2026-10-27-proposed-prize-schedule-v1\.sql/g) ?? []).length, 1);
  assert.match(fixture, /current_database\(\)<>'fixture_0240'/);
  assert.match(fixture, /public\.set_roster_payment_obligation_v1/);
  assert.match(fixture, /public\.record_manual_roster_payment/);
  assert.equal((fixture.match(/public\.record_tournament_expense\(/g) ?? []).length, 6);
  assert.match(fixture, /'expenseTotalMinor'<>'21600'/);
  assert.match(fixture, /'prizeBudgetMinor'<>'26400'/);
  for (const amount of ["9600", "7200", "4800"]) assert.match(fixture, new RegExp(`'totalAwardMinor'<>'${amount}'`));
  assert.match(fixture, /adopted event accepted draft without schedule pin/);
  assert.match(fixture, /adopted event accepted wrong schedule pin/);
  assert.match(fixture, /adopted event accepted mismatched calculated claim/);
  assert.match(fixture, /accepted schedule replay changed/);
  assert.match(fixture, /changed schedule operation did not conflict/);
  assert.match(fixture, /stale schedule append was accepted/);
  assert.match(fixture, /post-outcome schedule revision was accepted/);
  assert.match(fixture, /post-qualification schedule revision was accepted/);
  assert.match(fixture, /orphan schedule streams poisoned the bounded list reader/);
  assert.match(fixture, /authorized player award summary was not exact and sanitized/);
  assert.match(fixture, /unauthorized award summary was disclosed/);
  assert.match(fixture, /sqlerrm<>'immutable history'/);
  assert.match(fixture, /public\.get_event_prize_schedule_resolution_v1\(uuid,uuid,uuid,jsonb\)/);
  assert.match(fixture, /public\.list_prize_award_summaries_v1\(uuid,uuid\)/);
  assert.match(fixture, /has_table_privilege\(role_name,'app\.'\|\|table_name,privilege_name\)/);
  assert.match(fixture, /PRIZE_SCHEDULE_V1_SUPPORTED_RESOLUTION_PAYBACK_AND_FINAL_PASSED/);
  assert.match(fixture, /set constraints all immediate;\s*rollback;\s*$/);
  assert.doesNotMatch(fixture, /disable trigger|session_replication_role|alter table[^\n]+disable/i);
});
