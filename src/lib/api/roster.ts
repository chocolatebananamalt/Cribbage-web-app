export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function isAcceptedRosterPromotion(value: unknown, decisionId: string) {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.status === "roster_entry_created" && isUuid(item.rosterEntryId) && isUuid(item.sourceClaimId) && item.approvalDecisionId === decisionId && item.profileLinked === false && item.roleGranted === false && item.eventEnrolled === false && item.paymentRecorded === false && item.checkedIn === false && item.seatAssigned === false;
}
export function isRejectedRosterPromotion(value: unknown, decisionId: string) {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.status === "rejected" && item.approvalDecisionId === decisionId && ["authentication_required", "not_director", "approved_decision_required", "claim_already_promoted", "idempotency_conflict", "roster_promotion_rejected"].includes(item.code as string);
}
