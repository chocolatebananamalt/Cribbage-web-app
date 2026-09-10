/**
 * Pure R-FINAL-01 event-finalization gate.
 *
 * This makes the required evidence explicit before a future server transaction
 * can finalize an event. It has no database authority and cannot transition an
 * event on its own.
 *
 * Sources: docs/product/production-requirements.md §5.7 and
 * docs/decisions/2026-09-09-results-finalization-contract.md.
 */

export type EventFinalizationBlocker =
  | "event_not_open_for_finalization"
  | "score_verification_incomplete"
  | "unresolved_dispute"
  | "correction_approval_pending"
  | "seating_or_eligibility_incomplete"
  | "finance_or_reporting_unreconciled"
  | "attachment_classification_incomplete"
  | "result_version_missing"
  | "director_approval_missing"
  | "ruleset_source_missing"
  | "scoring_method_missing";

export type EventFinalizationInput = {
  eventStatus: "open" | "pending_finalization" | "finalized" | "archived";
  allConfiguredScoreVerificationPassed: boolean;
  hasUnresolvedDispute: boolean;
  hasPendingCorrectionApproval: boolean;
  seatingAndEligibilityConfirmed: boolean;
  financeAndReportingReconciled: boolean;
  attachmentsClassified: boolean;
  resultVersionReady: boolean;
  directorApprovalRecorded: boolean;
  rulesetSourceVersion: string | null;
  scoringMethod: "digital" | "manual" | "imported" | null;
};

export type EventFinalizationDecision =
  | { finalizable: true; blockers: [] }
  | { finalizable: false; blockers: EventFinalizationBlocker[] };

/**
 * Preserves every rejection reason for director review. The future server
 * writer must independently derive these facts while holding its event lock.
 */
export function evaluateEventFinalization(input: EventFinalizationInput): EventFinalizationDecision {
  const blockers: EventFinalizationBlocker[] = [];
  if (!["open", "pending_finalization"].includes(input.eventStatus)) blockers.push("event_not_open_for_finalization");
  if (!input.allConfiguredScoreVerificationPassed) blockers.push("score_verification_incomplete");
  if (input.hasUnresolvedDispute) blockers.push("unresolved_dispute");
  if (input.hasPendingCorrectionApproval) blockers.push("correction_approval_pending");
  if (!input.seatingAndEligibilityConfirmed) blockers.push("seating_or_eligibility_incomplete");
  if (!input.financeAndReportingReconciled) blockers.push("finance_or_reporting_unreconciled");
  if (!input.attachmentsClassified) blockers.push("attachment_classification_incomplete");
  if (!input.resultVersionReady) blockers.push("result_version_missing");
  if (!input.directorApprovalRecorded) blockers.push("director_approval_missing");
  if (typeof input.rulesetSourceVersion !== "string" || input.rulesetSourceVersion.trim().length === 0) blockers.push("ruleset_source_missing");
  if (!(["digital", "manual", "imported"] as const).includes(input.scoringMethod as "digital" | "manual" | "imported")) blockers.push("scoring_method_missing");
  return blockers.length === 0 ? { finalizable: true, blockers: [] } : { finalizable: false, blockers };
}
