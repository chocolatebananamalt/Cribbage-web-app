import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getEventFinalizationReadiness,
  isEventFinalizationReadiness,
} from "../src/lib/results/finalization-readiness.ts";

const tournamentId = "fa000000-0000-4000-8000-000000000001";
const eventId = "fa000000-0000-4000-8000-000000000002";
const actorId = "fa000000-0000-4000-8000-000000000003";
const permanentBlockers = [
  "dispute_register_unavailable",
  "event_lifecycle_evidence_unavailable",
  "schedule_completeness_evidence_unavailable",
  "seating_or_eligibility_evidence_unavailable",
  "finance_or_reporting_unreconciled",
  "attachment_classification_evidence_unavailable",
  "result_version_missing",
  "director_approval_missing",
];

const completeReport = {
  status: "blocked",
  tournamentId,
  eventId,
  tournamentName: "Synthetic Tournament",
  eventName: "Main",
  readyForFinalization: false,
  finalizationAuthorized: false,
  blockers: permanentBlockers,
  scores: {
    persistedGameCount: 2,
    verifiedGameCount: 1,
    correctedGameCount: 1,
    pendingGameCount: 0,
    submittedGameCount: 0,
    mismatchGameCount: 0,
    confirmationPendingGameCount: 0,
    invalidScorelineGameCount: 0,
  },
  corrections: { legacyPendingCount: 0, independentPendingCount: 0 },
  disputes: { registerAvailable: false, unresolvedCount: null },
  finance: {
    rosterEntryCount: 2,
    rosterEntriesWithLatestReceivedPaymentCount: 1,
    voidedPaymentCount: 0,
    unrecordedPaymentCount: 1,
    paymentEventCount: 1,
    operationConflictCount: 0,
    reconciliationEvidenceAvailable: false,
    reconciled: false,
  },
  configuredEvidence: {
    tournamentStatus: "open",
    eventLifecycleAvailable: false,
    scheduleCompletenessAvailable: false,
    seatingOrEligibilityEvidenceAvailable: false,
    eventPublicationState: "draft",
    rulesetSourceVersion: "synthetic-source-v1",
    rulesetApproved: true,
    scoringMethod: "digital",
    attachmentClassificationAvailable: false,
    resultVersionAvailable: false,
    directorApprovalAvailable: false,
  },
};

test("readiness response stays blocked and preserves only exact server-derived evidence", () => {
  assert.equal(isEventFinalizationReadiness(completeReport, tournamentId, eventId), true);
  assert.equal(isEventFinalizationReadiness({ ...completeReport, readyForFinalization: true }, tournamentId, eventId), false);
  assert.equal(isEventFinalizationReadiness({ ...completeReport, finalizationAuthorized: true }, tournamentId, eventId), false);
  assert.equal(isEventFinalizationReadiness({ ...completeReport, internalDetail: "private" }, tournamentId, eventId), false);
  assert.equal(isEventFinalizationReadiness({ ...completeReport, eventId: actorId }, tournamentId, eventId), false);
  assert.equal(isEventFinalizationReadiness({ ...completeReport, blockers: permanentBlockers.slice(1) }, tournamentId, eventId), false);
  assert.equal(isEventFinalizationReadiness({ ...completeReport, blockers: [...permanentBlockers, permanentBlockers[0]] }, tournamentId, eventId), false);
});

test("readiness validation rejects inconsistent score and correction claims while retaining payment conflicts as history", () => {
  assert.equal(isEventFinalizationReadiness({
    ...completeReport,
    scores: { ...completeReport.scores, persistedGameCount: 3 },
  }, tournamentId, eventId), false);
  assert.equal(isEventFinalizationReadiness({
    ...completeReport,
    corrections: { legacyPendingCount: 1, independentPendingCount: 0 },
  }, tournamentId, eventId), false);
  assert.equal(isEventFinalizationReadiness({
    ...completeReport,
    finance: { ...completeReport.finance, operationConflictCount: 1 },
  }, tournamentId, eventId), true);
  assert.equal(isEventFinalizationReadiness({
    ...completeReport,
    finance: { ...completeReport.finance, reconciled: true },
  }, tournamentId, eventId), false);
});

test("server adapter calls one exact scoped RPC and fails closed", async () => {
  let call;
  const report = await getEventFinalizationReadiness({
    rpc(name, args) { call = { name, args }; return Promise.resolve({ data: completeReport, error: null }); },
  }, actorId, tournamentId, eventId);
  assert.equal(report, completeReport);
  assert.deepEqual(call, {
    name: "get_event_finalization_readiness_v1",
    args: { p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId },
  });
  await assert.rejects(() => getEventFinalizationReadiness({
    rpc() { return Promise.resolve({ data: completeReport, error: { message: "transport" } }); },
  }, actorId, tournamentId, eventId), /unavailable/);
  await assert.rejects(() => getEventFinalizationReadiness({
    rpc() { return Promise.resolve({ data: { ...completeReport, blockers: [] }, error: null }); },
  }, actorId, tournamentId, eventId), /unavailable/);
  assert.equal(await getEventFinalizationReadiness({
    rpc() { return Promise.resolve({ data: null, error: null }); },
  }, actorId, tournamentId, eventId), null);
  await assert.rejects(() => getEventFinalizationReadiness({ rpc() { throw new Error("not reached"); } }, "bad", tournamentId, eventId), /unavailable/);
});

test("migration is read-only, service-only, role-checked, and explicitly incomplete", () => {
  const sql = readFileSync("database/migrations/0110_event_finalization_readiness_reader.sql", "utf8");
  assert.match(sql, /create or replace function public\.get_event_finalization_readiness_v1/);
  assert.match(sql, /stable[\s\S]*security definer[\s\S]*set search_path = ''/);
  assert.match(sql, /auth\.role\(\)[\s\S]*service_role/);
  assert.match(sql, /r\.role in \('director', 'co_director'\)/);
  assert.match(sql, /app\.canonical_games/);
  assert.match(sql, /app\.card_scorelines/);
  assert.match(sql, /app\.game_corrections/);
  assert.match(sql, /app\.independent_card_correction_lifecycles/);
  assert.match(sql, /app\.roster_payment_events/);
  assert.match(sql, /app\.roster_payment_operation_conflicts/);
  assert.match(sql, /'dispute_register_unavailable'/);
  assert.match(sql, /'event_lifecycle_evidence_unavailable'/);
  assert.match(sql, /'schedule_completeness_evidence_unavailable'/);
  assert.match(sql, /'seating_or_eligibility_evidence_unavailable'/);
  assert.match(sql, /'finance_or_reporting_unreconciled'/);
  assert.match(sql, /'readyForFinalization', false/);
  assert.match(sql, /'finalizationAuthorized', false/);
  assert.match(sql, /'reconciliationEvidenceAvailable', false/);
  assert.match(sql, /revoke all on function public\.get_event_finalization_readiness_v1\(uuid, uuid, uuid\)[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.get_event_finalization_readiness_v1\(uuid, uuid, uuid\)[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /\b(insert into|update app\.|delete from)\b/i);
  assert.doesNotMatch(sql, /'qualifiers?'|'mrp'|'qPool'|'payouts?'|'eligibility'|'exportArtifact'/i);
});

test("released API requires verified director scope before the private RPC", () => {
  const route = readFileSync("src/app/api/v1/tournaments/[id]/events/[eventId]/finalization-readiness/route.ts", "utf8");
  assert.doesNotMatch(readFileSync(".env.example", "utf8"), /ACC_EVENT_FINALIZATION_READINESS_ENABLED/);
  assert.doesNotMatch(route, /process\.env|FinalizationReadinessEnabled/);
  assert.match(route, /requireVerifiedSubject/);
  assert.match(route, /createServerOnlyAdminClient\(\)/);
  assert.match(route, /getEventFinalizationReadiness/);
  assert.match(route, /report === null[\s\S]*error: "not_found"[\s\S]*status: 404/);
  assert.doesNotMatch(route, /get_tournament_role/);
  assert.match(route, /apiJson\(report\)/);
  assert.doesNotMatch(route, /\.from\(|SUPABASE_SECRET_KEY|NEXT_PUBLIC_/);
});
