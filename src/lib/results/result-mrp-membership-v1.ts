import { isEventRosterEnrollmentWorkspace } from '../api/event-roster-enrollment.ts';
import { projectMembershipReportingV1 } from './mrp-membership-reporting-v1.ts';

export type ResultMrpMembershipCaptureV1 = { roster: unknown; reviews: Record<string, unknown> };

/** Annotation only: never infer official membership or acceptance from a listing.
 * Identity joins use the server's unique enrolled tournament verification ID,
 * never a player name or an ACC number supplied by the browser. */
export function resultMrpMembershipV1(
  capture: ResultMrpMembershipCaptureV1 | undefined,
  scope: { tournamentId: string; eventId: string },
  row: { tournamentPlayerId: string; displayName: string },
) {
  const fallback = {
    rosterEntryId: null as string | null,
    accNumber: null as string | null,
    identifierStatus: 'acc_reference_not_collected',
    membershipReportingState: 'review_unavailable',
    mrpProposalBasis: 'app_proposed_pending_acc',
    membershipHeadId: null as string | null,
    membershipHeadDigest: null as string | null,
    membershipSourceReference: null as string | null,
    membershipObservedAt: null as string | null,
    directorReportingOverride: false,
    directorOverrideActorId: null as string | null,
    directorOverrideRecordedAt: null as string | null,
    directorOverrideReason: null as string | null,
    reportingAllowed: true,
    overrideResolutionBlocksSubmission: false,
    knownNonmember: false,
    actualMrpAwardMaximum: null as number | null,
    officialAccApprovedMrp: null,
  };
  if (!capture || !isEventRosterEnrollmentWorkspace(capture.roster)) return fallback;
  const candidates = capture.roster.roster.filter(r => r.verificationId === row.tournamentPlayerId
    && r.enrolledEventIds.includes(scope.eventId));
  if (candidates.length !== 1 || candidates[0].displayName !== row.displayName) {
    return { ...fallback, membershipReportingState: 'roster_identity_unresolved' };
  }
  const person = candidates[0];
  const annotation = projectMembershipReportingV1(capture.reviews[person.rosterEntryId], {
    ...scope, rosterEntryId: person.rosterEntryId,
  });
  if (!annotation) return { ...fallback, rosterEntryId: person.rosterEntryId };
  return {
    ...fallback,
    rosterEntryId: person.rosterEntryId,
    accNumber: annotation.observedAccNumber as string | null,
    identifierStatus: annotation.observedAccNumber ? 'observed_reference_not_verified' : fallback.identifierStatus,
    membershipReportingState: annotation.basis,
    membershipHeadId: annotation.headId,
    membershipHeadDigest: annotation.headDigest,
    membershipSourceReference: annotation.sourceReference as string | null,
    membershipObservedAt: annotation.lookupAt as string | null,
    directorReportingOverride: annotation.basis === 'director_reporting_confirmation_pending_acc_resolution',
    directorOverrideActorId: annotation.basis === 'director_reporting_confirmation_pending_acc_resolution' ? annotation.actorId : null,
    directorOverrideRecordedAt: annotation.basis === 'director_reporting_confirmation_pending_acc_resolution' ? annotation.recordedAt : null,
    directorOverrideReason: annotation.basis === 'director_reporting_confirmation_pending_acc_resolution' ? annotation.reason as string | null : null,
    knownNonmember: annotation.knownNonmember,
    mrpProposalBasis: annotation.knownNonmember ? 'hypothetical_nonmember' : 'app_proposed_pending_acc',
    actualMrpAwardMaximum: annotation.actualMrpAwardMaximum,
  };
}
