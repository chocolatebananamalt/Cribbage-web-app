import "server-only";

import { isUuid } from "../api/validation.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export const eventFinalizationBlockers = [
  "game_schedule_missing",
  "score_verification_incomplete",
  "scoreline_evidence_incomplete",
  "correction_approval_pending",
  "event_publication_state_not_draft",
  "ruleset_source_missing",
  "scoring_method_missing",
  "dispute_register_unavailable",
  "event_lifecycle_evidence_unavailable",
  "schedule_completeness_evidence_unavailable",
  "seating_or_eligibility_evidence_unavailable",
  "finance_or_reporting_unreconciled",
  "attachment_classification_evidence_unavailable",
  "result_version_missing",
  "director_approval_missing",
] as const;

export type EventFinalizationBlocker = (typeof eventFinalizationBlockers)[number];

type ScoreEvidence = {
  persistedGameCount: number;
  verifiedGameCount: number;
  correctedGameCount: number;
  pendingGameCount: number;
  submittedGameCount: number;
  mismatchGameCount: number;
  confirmationPendingGameCount: number;
  invalidScorelineGameCount: number;
};

type CorrectionEvidence = { legacyPendingCount: number; independentPendingCount: number };
type DisputeEvidence = { registerAvailable: false; unresolvedCount: null };
type FinanceEvidence = {
  rosterEntryCount: number;
  rosterEntriesWithLatestReceivedPaymentCount: number;
  voidedPaymentCount: number;
  unrecordedPaymentCount: number;
  paymentEventCount: number;
  operationConflictCount: number;
  reconciliationEvidenceAvailable: false;
  reconciled: false;
};
type ConfiguredEvidence = {
  tournamentStatus: "draft" | "open" | "pending_finalization" | "finalized" | "archived";
  eventLifecycleAvailable: false;
  scheduleCompletenessAvailable: false;
  seatingOrEligibilityEvidenceAvailable: false;
  eventPublicationState: "draft" | "published" | "superseded" | null;
  rulesetSourceVersion: string | null;
  rulesetApproved: boolean;
  scoringMethod: "digital" | "manual" | "imported";
  attachmentClassificationAvailable: false;
  resultVersionAvailable: false;
  directorApprovalAvailable: false;
};

export type EventFinalizationReadiness = {
  status: "blocked";
  tournamentId: string;
  eventId: string;
  tournamentName: string;
  eventName: string;
  readyForFinalization: false;
  finalizationAuthorized: false;
  blockers: EventFinalizationBlocker[];
  scores: ScoreEvidence;
  corrections: CorrectionEvidence;
  disputes: DisputeEvidence;
  finance: FinanceEvidence;
  configuredEvidence: ConfiguredEvidence;
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function whole(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isScores(value: unknown): value is ScoreEvidence {
  if (!record(value) || !exactKeys(value, [
    "persistedGameCount", "verifiedGameCount", "correctedGameCount", "pendingGameCount",
    "submittedGameCount", "mismatchGameCount", "confirmationPendingGameCount",
    "invalidScorelineGameCount",
  ]) || !Object.values(value).every(whole)) return false;
  const scores = value as Record<keyof ScoreEvidence, number>;
  return scores.persistedGameCount === scores.verifiedGameCount + scores.correctedGameCount
    + scores.pendingGameCount + scores.submittedGameCount + scores.mismatchGameCount
    + scores.confirmationPendingGameCount
    && scores.invalidScorelineGameCount <= scores.verifiedGameCount + scores.correctedGameCount;
}

function isCorrections(value: unknown): value is CorrectionEvidence {
  return record(value)
    && exactKeys(value, ["legacyPendingCount", "independentPendingCount"])
    && whole(value.legacyPendingCount) && whole(value.independentPendingCount);
}

function isDisputes(value: unknown): value is DisputeEvidence {
  return record(value) && exactKeys(value, ["registerAvailable", "unresolvedCount"])
    && value.registerAvailable === false && value.unresolvedCount === null;
}

function isFinance(value: unknown): value is FinanceEvidence {
  if (!record(value) || !exactKeys(value, [
    "rosterEntryCount", "rosterEntriesWithLatestReceivedPaymentCount", "voidedPaymentCount", "unrecordedPaymentCount",
    "paymentEventCount", "operationConflictCount", "reconciliationEvidenceAvailable", "reconciled",
  ])) return false;
  const counts = ["rosterEntryCount", "rosterEntriesWithLatestReceivedPaymentCount", "voidedPaymentCount", "unrecordedPaymentCount", "paymentEventCount", "operationConflictCount"] as const;
  return counts.every((key) => whole(value[key]))
    && value.rosterEntryCount === (value.rosterEntriesWithLatestReceivedPaymentCount as number) + (value.voidedPaymentCount as number) + (value.unrecordedPaymentCount as number)
    && value.reconciliationEvidenceAvailable === false && value.reconciled === false;
}

function isConfiguredEvidence(value: unknown): value is ConfiguredEvidence {
  return record(value) && exactKeys(value, [
    "tournamentStatus", "eventLifecycleAvailable", "scheduleCompletenessAvailable", "seatingOrEligibilityEvidenceAvailable", "eventPublicationState", "rulesetSourceVersion", "rulesetApproved",
    "scoringMethod", "attachmentClassificationAvailable", "resultVersionAvailable", "directorApprovalAvailable",
  ])
    && ["draft", "open", "pending_finalization", "finalized", "archived"].includes(value.tournamentStatus as string)
    && value.eventLifecycleAvailable === false
    && value.scheduleCompletenessAvailable === false
    && value.seatingOrEligibilityEvidenceAvailable === false
    && (value.eventPublicationState === null || ["draft", "published", "superseded"].includes(value.eventPublicationState as string))
    && (value.rulesetSourceVersion === null || text(value.rulesetSourceVersion))
    && typeof value.rulesetApproved === "boolean"
    && ["digital", "manual", "imported"].includes(value.scoringMethod as string)
    && value.attachmentClassificationAvailable === false
    && value.resultVersionAvailable === false
    && value.directorApprovalAvailable === false;
}

function sameBlocker(blockers: readonly EventFinalizationBlocker[], code: EventFinalizationBlocker, expected: boolean) {
  return blockers.includes(code) === expected;
}

export function isEventFinalizationReadiness(
  value: unknown,
  tournamentId: string,
  eventId: string,
): value is EventFinalizationReadiness {
  if (!record(value) || !exactKeys(value, [
    "status", "tournamentId", "eventId", "tournamentName", "eventName", "readyForFinalization",
    "finalizationAuthorized", "blockers", "scores", "corrections", "disputes", "finance", "configuredEvidence",
  ])) return false;
  if (value.status !== "blocked" || value.readyForFinalization !== false || value.finalizationAuthorized !== false
      || value.tournamentId !== tournamentId || value.eventId !== eventId || !isUuid(tournamentId) || !isUuid(eventId)
      || !text(value.tournamentName) || !text(value.eventName) || !Array.isArray(value.blockers)
      || !isScores(value.scores) || !isCorrections(value.corrections) || !isDisputes(value.disputes)
      || !isFinance(value.finance) || !isConfiguredEvidence(value.configuredEvidence)) return false;
  const blockers = value.blockers as EventFinalizationBlocker[];
  if (blockers.length !== new Set(blockers).size
      || !blockers.every((item) => eventFinalizationBlockers.includes(item as EventFinalizationBlocker))) return false;
  for (const required of [
    "dispute_register_unavailable", "event_lifecycle_evidence_unavailable",
    "schedule_completeness_evidence_unavailable", "seating_or_eligibility_evidence_unavailable",
    "finance_or_reporting_unreconciled",
    "attachment_classification_evidence_unavailable", "result_version_missing", "director_approval_missing",
  ] as const) if (!blockers.includes(required)) return false;
  const scores = value.scores;
  const corrections = value.corrections;
  const evidence = value.configuredEvidence;
  return sameBlocker(blockers, "game_schedule_missing", scores.persistedGameCount === 0)
    && sameBlocker(blockers, "score_verification_incomplete", scores.persistedGameCount > 0 && scores.verifiedGameCount + scores.correctedGameCount !== scores.persistedGameCount)
    && sameBlocker(blockers, "scoreline_evidence_incomplete", scores.invalidScorelineGameCount > 0)
    && sameBlocker(blockers, "correction_approval_pending", corrections.legacyPendingCount + corrections.independentPendingCount > 0)
    && sameBlocker(blockers, "event_publication_state_not_draft", evidence.eventPublicationState !== "draft")
    && sameBlocker(blockers, "ruleset_source_missing", !evidence.rulesetApproved || evidence.rulesetSourceVersion === null)
    && !blockers.includes("scoring_method_missing");
}

export async function getEventFinalizationReadiness(
  admin: RpcClient,
  actorId: string,
  tournamentId: string,
  eventId: string,
) {
  if (![actorId, tournamentId, eventId].every(isUuid)) throw new Error("Finalization readiness is unavailable.");
  const { data, error } = await admin.rpc("get_event_finalization_readiness_v1", {
    p_actor_id: actorId,
    p_tournament_id: tournamentId,
    p_event_id: eventId,
  });
  if (error) {
    throw new Error("Finalization readiness is unavailable.");
  }
  if (data === null) return null;
  if (!isEventFinalizationReadiness(data, tournamentId, eventId)) {
    throw new Error("Finalization readiness is unavailable.");
  }
  return data;
}
