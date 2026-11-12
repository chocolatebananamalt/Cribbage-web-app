import { assessEventSeriesSettingsV1 } from './series-settings-v1.ts';
/** Setup can precede registration, so final original field size may be unknown.
 * Only that known conditional Main-final check can defer until playoff review.
 * This grants neither activation nor play. Actual playoff projection continues
 * using the strict original assessment and blocks unresolved field size.
 */
export function assessSeriesForSetupReviewV2(settings: unknown, context: unknown) {
  const assessment = assessEventSeriesSettingsV1(settings, context);
  const deferred = assessment.issues.filter(i => i.code === 'original_field_required' && i.round === 'final' && i.severity === 'policy_review_required');
  const blocking = assessment.issues.filter(i => !deferred.includes(i));
  const setupReviewEligible = ['known_rules_satisfied', 'informal_settings'].includes(assessment.status)
    || (assessment.status === 'review_required' && deferred.length > 0 && blocking.length === 0);
  return { assessment, setupReviewEligible, deferredRequirements: deferred.map(i => ({ code:i.code, deadline:'before_playoffs' as const,
    message:'Final original entrant count must be checked before playoffs. A two-day Main with 257 or more entrants requires a 4-of-7 final.' })),
    playoffFormatReviewReady: setupReviewEligible && deferred.length === 0, playoffStartAllowed:false as const, activationAllowed:false as const, officialApprovalClaimed:false as const };
}
