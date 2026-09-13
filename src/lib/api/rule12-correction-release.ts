/**
 * Migration 0140's reviewed independent-card correction workflow is required
 * for the October pilot. Server routes and service-only RPCs retain the
 * current-role, non-self, policy, lifecycle, and idempotency boundaries.
 */
export function rule12CorrectionEnabled() {
  return true;
}
