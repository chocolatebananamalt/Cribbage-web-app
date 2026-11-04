import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const proposal = readFileSync("docs/quality/2026-10-27-proposed-versioned-settlement-v5.sql", "utf8");
const fixture = readFileSync("tests/versioned-settlement-v5.sql", "utf8");
const concurrencyRunner = readFileSync("tests/run-versioned-settlement-v5-isolated.mjs", "utf8");
const legacyReplayFixture = readFileSync("tests/settlement-v5-legacy-replay.sql", "utf8");

test("v5 canonical MRP binds one exact source without rewriting legacy history", () => {
  assert.match(proposal, /create or replace function app\.canonical_settlement_mrp_v5/);
  assert.match(proposal, /p_source \?& array\['kind','resultId','qualificationResultVersionId'\]/);
  assert.match(proposal, /receipt\.operation_type='record_standard_singles_playoff_placements_v2'/);
  assert.match(proposal, /p_source->>'kind'='playoff_outcome_v3'/);
  assert.match(proposal, /p_source->>'kind'='legacy_placement_v2'/);
  assert.match(proposal, /mrp_playoff_exit_round not in\(depth,depth\+1\)/);
  assert.match(proposal, /playedMatchWins/);
  assert.match(proposal, /byeWins/);
  assert.match(proposal, /eliminatedInRound/);
  assert.match(proposal, /bandStart/);
  assert.match(proposal, /bandEnd/);
  assert.match(proposal, /bracketSourceVersion/);
  assert.match(proposal, /legacy-complete-no-bye-v2/);
  assert.match(proposal, /check\(\(source_kind='legacy_placement_v2'[\s\S]+outcome_result_id is not null and legacy_result_id is null\)\)/);
  assert.doesNotMatch(proposal, /revoke execute on function public\.(?:record_standard_singles_playoff_placements|save_standard_singles_settlement_draft|finalize_standard_singles_settlement_manual)/);
});

test("v5 draft and final requests are exact, bounded, source-current, and financially fail-closed", () => {
  assert.match(proposal, /create or replace function app\.valid_settlement_request_v5/);
  assert.match(proposal, /count\(\*\)from jsonb_object_keys\(p_request\)\)<>8/);
  assert.match(proposal, /array\['source','expectedVersion','prizeClaims','eventIncomeMinor','eventExpenseMinor','retainedBalanceMinor','officialSourceReference','sanctioningExpenseEventId'\]/);
  assert.match(proposal, /count\(\*\)from jsonb_object_keys\(p_request->'source'\)\)<>3/);
  assert.match(proposal, /count\(\*\)from jsonb_object_keys\(item\)\)<>4/);
  for (const attestation of ["expenseLedgerReviewed", "mrpClaimsReviewed", "noAutomaticAccSubmission", "officialSourceReviewed", "payoutClaimsReviewed", "noQPoolClaimsRecorded"]) {
    assert.ok(proposal.includes(attestation), attestation);
  }
  assert.match(proposal, /p_request->'attestations' is distinct from required_attestations/);
  assert.match(proposal, /settlement_source_current_v5/);
  assert.match(proposal, /settlement_award_blocked_v5/);
  assert.match(proposal, /unsupported_award_obligations/);
  assert.match(proposal, /settlement_assessment_v5/);
  assert.match(proposal, /select total_cents::bigint from app\.event_sanctioning_fee_snapshots where event_id=p_event_id/);
  assert.doesNotMatch(proposal, /select count\(p\.id\)\*r\.rate_cents/);
  assert.match(proposal, /sanctioning_assessment_unfunded/);
  assert.match(proposal, /ledger_snapshot_changed/);
  assert.match(proposal, /non_conserving_ledger/);
  assert.match(proposal, /ledger_allocation_exceeded/);
  assert.match(proposal, /exception when sqlstate 'P0001' then/);
  assert.match(proposal, /if code is null then raise;end if/);
  assert.match(proposal, /is distinct from true then/);
  assert.doesNotMatch(proposal, /truethen/);
});

test("v5 persistence remains append-only, serialized, replay-safe, audited, and private", () => {
  for (const table of ["event_settlement_drafts_v5", "event_settlement_finals_v2", "event_settlement_conflicts_v5"]) {
    assert.match(proposal, new RegExp(`create table app\\.${table}`));
  }
  assert.match(proposal, /force row level security/);
  assert.match(proposal, /reject_immutable_history/);
  assert.match(proposal, /standard-singles-post-event:/);
  assert.match(proposal, /settlement:'\|\|p_event_id/);
  assert.match(proposal, /settlement-domain:'\|\|p_event_id/);
  assert.match(proposal, /actor_profile_id=p_actor_id and client_operation_id=p_operation_id/);
  assert.match(proposal, /receipt\.request_hash=hash then return receipt\.response_payload/);
  assert.match(proposal, /insert into app\.operation_receipts/);
  assert.match(proposal, /insert into app\.audit_events/);
  assert.match(proposal, /greatest\(coalesce\(\(select max\(version\)from app\.event_settlement_drafts_v5/);
  assert.match(proposal, /greatest\(coalesce\(\(select max\(version\)from app\.event_settlement_finals_v2/);
  assert.match(proposal, /create trigger old_settlement_domain_v5/);
  assert.match(proposal, /create trigger new_settlement_domain_v5/);
  assert.match(proposal, /grant execute on function public\.save_event_settlement_draft_v5[\s\S]+to service_role/);
  assert.match(proposal, /grant execute on function public\.finalize_event_settlement_v2[\s\S]+to service_role/);
  assert.match(proposal, /revoke all on app\.%I from public,anon,authenticated,service_role/);
});

test("rollback fixture covers v3, legacy compatibility, v5 replay, correction, and truthful blockers", () => {
  assert.match(fixture, /^begin;/m);
  assert.match(fixture, /current_database\(\)<>'fixture_0240'/);
  assert.match(fixture, /\\ir \.\.\/docs\/quality\/2026-10-27-proposed-versioned-settlement-v5\.sql/);
  for (const marker of [
    "supported legacy writer grants were not preserved",
    "supported legacy v2 write failed",
    "legacy canonical MRP or cohort derivation failed",
    "direct legacy v3 false MRP claim was not blocked",
    "legacy v1 transition prerequisite failed",
    "v5 did not adopt exact legacy draft lineage",
    "accepted legacy replay changed after v5 transition",
    "new legacy write after v5 transition was not conserved",
    "legacy probe did not roll back before v3 source",
    "supported zero-rate override failed",
    "supported cross-checker assignment failed",
    "supported zero-game cross-check finalization failed",
    "zero-assessment positive draft failed",
    "zero-assessment supported finalization failed",
    "zero-assessment positive proof did not roll back",
    "v3 canonical MRP failed",
    "unexpected SQL fault was swallowed",
    "unexpected SQL fault poisoned the operation receipt",
    "zero-ledger v5 draft failed",
    "workspace did not expose pending assessment/capability truth",
    "unauthorized v5 draft accepted",
    "null draft request accepted",
    "extra draft field accepted",
    "exact rejected v5 replay changed",
    "changed rejected v5 key did not conflict",
    "wrong result source binding accepted",
    "wrong qualification source binding accepted",
    "exact accepted v5 replay changed",
    "changed accepted v5 key did not conflict",
    "stale v5 append accepted",
    "v5 append correction failed",
    "stale corrected source accepted",
    "finalization accepted a superseded source",
    "false no-Q-pool attestation accepted",
    "unauthorized finalization created hidden state",
    "fixture cannot truthfully attest no Q-pool/award claims",
    "synthetic assessment/ledger precondition changed",
    "unfunded 16 x 300 assessment did not block",
    "unfunded finalization rejection replay changed",
    "blocked finalization persisted",
    "v5 receipt/audit conservation failed",
    "VERSIONED_SETTLEMENT_V5_POSITIVE_AND_NEGATIVE_PATHS_PASSED",
  ]) assert.ok(fixture.includes(marker), marker);

  const legacySavepoint = fixture.indexOf("savepoint legacy_canonical_probe");
  const legacyWrite = fixture.indexOf("record_standard_singles_playoff_placements_v2", legacySavepoint);
  const legacyRollback = fixture.indexOf("rollback to savepoint legacy_canonical_probe");
  const v3Write = fixture.indexOf("record_standard_singles_playoff_outcomes_v3", legacyRollback);
  assert.ok(legacySavepoint > 0 && legacySavepoint < legacyWrite && legacyWrite < legacyRollback && legacyRollback < v3Write);
  assert.match(fixture, /app\.settlement_assessment_v5\(eid\)<>4800/);
  assert.match(fixture, /'sanctioningExpenseEventId',null/);
  assert.match(fixture, /insert into app\.event_sanctioning_fee_snapshots[\s\S]+0,16,0,'override'/);
  assert.match(fixture, /insert into app\.event_sanctioning_fee_snapshots[\s\S]+300,16,4800,'setup'/);
  assert.match(fixture, /public\.assign_cross_checker_v1/);
  assert.match(fixture, /public\.finalize_cross_checking_v1/);
  assert.match(fixture, /new settlement RPC ACL matrix failed/);
  assert.match(fixture, /select public\.get_event_settlement_workspace_v5/);
  assert.match(fixture, /raise exception using errcode='XX000'/);
  assert.match(fixture, /exception when sqlstate 'XX000' then null/);
  assert.match(fixture, /expenseTotalMinor'\)::bigint<>0/);
  assert.match(fixture, /paymentTotalMinor'\)::bigint<>0/);
  assert.match(fixture, /set constraints all immediate;\s*rollback;/);
  assert.doesNotMatch(fixture, /disable trigger|session_replication_role|alter table[\s\S]{0,80}disable/i);
});

test("isolated concurrency runner gates the target and proves settlement serialization", () => {
  assert.match(concurrencyRunner, /--isolated-container/);
  assert.match(concurrencyRunner, /cribbage-0240-isolated/);
  assert.match(concurrencyRunner, /e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc/);
  assert.match(concurrencyRunner, /desktop-linux/);
  assert.match(concurrencyRunner, /NetworkMode !== "none"/);
  assert.match(concurrencyRunner, /PortBindings/);
  assert.match(concurrencyRunner, /mount\.Type === "bind"/);
  assert.match(concurrencyRunner, /public\.ecr\.aws\/supabase\/postgres:17\.11\.0\.004/);
  assert.match(concurrencyRunner, /\.replace\([\s\S]{0,140}\(\) => proposal\)/);
  assert.match(concurrencyRunner, /hashtextextended\('settlement:\$\{event\}',0\)/);
  assert.match(concurrencyRunner, /wait_event='advisory'/);
  assert.match(concurrencyRunner, /waiting === "2"/);
  for (const scenario of [
    "exact-v5-replay",
    "changed-v5-replay",
    "competing-directors",
    "legacy-v1-versus-v5",
    "legacy-rejected-exact-replay",
  ]) assert.ok(concurrencyRunner.includes(scenario), scenario);
  assert.match(concurrencyRunner, /newDrafts !== 1/);
  assert.match(concurrencyRunner, /newReceipts !== 1/);
  assert.match(concurrencyRunner, /newConflicts !== 1/);
  assert.match(concurrencyRunner, /newReceipts !== 2/);
  assert.match(concurrencyRunner, /state\.newDrafts \+ state\.oldDrafts !== 1/);
  assert.match(concurrencyRunner, /state\.oldReceipts !== 1/);
  assert.match(concurrencyRunner, /versioned-settlement-v5-concurrency\.json/);
  assert.doesNotMatch(concurrencyRunner, /https?:\/\//);
});

test("legacy v4 accepted replay is resolved before corrected canonical MRP validation", () => {
  assert.match(proposal, /definition:=pg_get_functiondef\('public\.save_standard_singles_settlement_draft_v4/);
  assert.match(proposal, /if exists\(select 1 from app\.operation_receipts[\s\S]+client_operation_id=v_inner_id\)then/);
  assert.match(proposal, /return public\.save_standard_singles_settlement_draft_v3/);
  assert.match(proposal, /v4 receipt compatibility anchor missing/);
  const proposalLoad = legacyReplayFixture.indexOf("\\ir ../docs/quality/2026-10-27-proposed-versioned-settlement-v5.sql");
  const historicalWrite = legacyReplayFixture.indexOf("old_response:=public.save_standard_singles_settlement_draft_v4");
  const exactReplay = legacyReplayFixture.indexOf("exact_replay:=public.save_standard_singles_settlement_draft_v4");
  assert.ok(historicalWrite > 0 && proposalLoad > historicalWrite && exactReplay > proposalLoad);
  for (const marker of [
    "historical automatic MRP baseline changed",
    "historical v4 draft was not accepted",
    "historical accepted v4 replay changed after canonical correction",
    "changed same-parent v4 replay bypassed child receipt conflict",
    "new operation reused historical 76-point champion claim",
    "corrected canonical automatic MRP unavailable",
    "corrected draft did not preserve historical v1 while appending v2",
    "historical v1 MRP claims became mutable",
    "SETTLEMENT_V5_LEGACY_V4_REPLAY_PASSED",
  ]) assert.ok(legacyReplayFixture.includes(marker), marker);
  assert.match(legacyReplayFixture, /'\[76,76,12,12\]'::jsonb/);
  assert.match(legacyReplayFixture, /'\[97,76,12,12\]'::jsonb/);
  assert.match(legacyReplayFixture, /set constraints all immediate;\s*rollback;/);
  assert.doesNotMatch(legacyReplayFixture, /disable trigger|session_replication_role|alter table[\s\S]{0,80}disable/i);
});
