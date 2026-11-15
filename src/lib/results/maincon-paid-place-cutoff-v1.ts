/** Owner-approved whole-finishing-group expansion (2026-11-04).
 * This does not select qualifiers, calculate awards or authorize a payment. */
export function resolveMainConPaidPlaceCutoffV1(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Reflect.ownKeys(input).length !== 2
    || !Object.hasOwn(input, 'requestedPaidPlaces') || !Object.hasOwn(input, 'qualifierCount')) return { status: 'blocked' as const, code: 'invalid_input' };
  const { requestedPaidPlaces, qualifierCount } = input as Record<string, unknown>;
  if (typeof requestedPaidPlaces !== 'number' || typeof qualifierCount !== 'number' || !Number.isSafeInteger(requestedPaidPlaces)
    || !Number.isSafeInteger(qualifierCount) || requestedPaidPlaces < 1 || qualifierCount < 1 || Object.is(requestedPaidPlaces, -0) || Object.is(qualifierCount, -0)) return { status: 'blocked' as const, code: 'invalid_input' };
  if (qualifierCount > 10000) return { status: 'blocked' as const, code: 'technical_resource_bound' };
  if (requestedPaidPlaces > qualifierCount) return { status: 'blocked' as const, code: 'payments_beyond_qualifiers_policy_unresolved' };
  let firstPlace = 1, lastPlace = 1;
  while (lastPlace < requestedPaidPlaces) { firstPlace = lastPlace + 1; lastPlace = Math.min(qualifierCount, lastPlace * 2); }
  const expanded = lastPlace !== requestedPaidPlaces;
  return { status: 'resolved' as const, requestedPaidPlaces, actualPaidPlaces: lastPlace, qualifierCount, expanded,
    includedFinishingGroup: { firstPlace, lastPlace }, qualificationChanged: false as const, paymentAuthorized: false as const,
    warning: expanded ? `Requested ${requestedPaidPlaces} paid places. Suggested payout includes all players finishing ${firstPlace}–${lastPlace}, increasing paid places to ${lastPlace} because that finishing group is equal.` : null,
    fundBalanceReviewRequired: true as const };
}
