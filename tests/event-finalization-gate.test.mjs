import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEventFinalization } from "../src/lib/event-finalization-gate.ts";

const complete = {
  eventStatus: "pending_finalization", allConfiguredScoreVerificationPassed: true,
  hasUnresolvedDispute: false, hasPendingCorrectionApproval: false,
  seatingAndEligibilityConfirmed: true, financeAndReportingReconciled: true,
  attachmentsClassified: true, resultVersionReady: true, directorApprovalRecorded: true,
  rulesetSourceVersion: "acc-2025-ruleset-v1", scoringMethod: "digital",
};

test("only the complete configured evidence set is eligible for finalization", () => {
  assert.deepEqual(evaluateEventFinalization(complete), { finalizable: true, blockers: [] });
  assert.deepEqual(evaluateEventFinalization({ ...complete, eventStatus: "finalized" }), { finalizable: false, blockers: ["event_not_open_for_finalization"] });
});

test("each missing R-FINAL-01 gate blocks finalization", () => {
  const cases = [
    [{ allConfiguredScoreVerificationPassed: false }, "score_verification_incomplete"],
    [{ hasUnresolvedDispute: true }, "unresolved_dispute"],
    [{ hasPendingCorrectionApproval: true }, "correction_approval_pending"],
    [{ seatingAndEligibilityConfirmed: false }, "seating_or_eligibility_incomplete"],
    [{ financeAndReportingReconciled: false }, "finance_or_reporting_unreconciled"],
    [{ attachmentsClassified: false }, "attachment_classification_incomplete"],
    [{ resultVersionReady: false }, "result_version_missing"],
    [{ directorApprovalRecorded: false }, "director_approval_missing"],
    [{ rulesetSourceVersion: null }, "ruleset_source_missing"],
    [{ scoringMethod: null }, "scoring_method_missing"],
  ];
  for (const [change, blocker] of cases) {
    const decision = evaluateEventFinalization({ ...complete, ...change });
    assert.equal(decision.finalizable, false);
    assert.deepEqual(decision.blockers, [blocker]);
  }
});

test("multiple defects remain visible instead of allowing a misleading partial pass", () => {
  assert.deepEqual(evaluateEventFinalization({
    ...complete, allConfiguredScoreVerificationPassed: false, hasUnresolvedDispute: true,
    financeAndReportingReconciled: false, directorApprovalRecorded: false,
  }), {
    finalizable: false,
    blockers: ["score_verification_incomplete", "unresolved_dispute", "finance_or_reporting_unreconciled", "director_approval_missing"],
  });
});
