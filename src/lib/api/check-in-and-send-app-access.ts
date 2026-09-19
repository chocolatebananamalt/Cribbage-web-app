import { isUuid } from "./validation.ts";

/**
 * Desk check-in and activation issuance are two separate audited database
 * operations, and both key their idempotency receipt on
 * (actor_profile_id, client_operation_id) in the same app.operation_receipts
 * table (0217 line 124, 0091). Sending one operation id to both makes the
 * second call find the first call's receipt under a different request hash,
 * which returns idempotency_conflict and files a conflict evidence row. The
 * request therefore carries one operation id per step.
 */
export type CheckInAndSendAppAccessRequest = {
  eventId: string;
  rosterEntryId: string;
  expiresAt: string;
  checkInOperationId: string;
  activationOperationId: string;
};

export type CheckInStepResult =
  | { status: "checked_in" }
  | { status: "already_checked_in" }
  | { status: "rejected"; code: string };

export type AppAccessStepResult =
  | { status: "issued"; credential: string; expiresAt: string }
  | { status: "rejected"; code: string }
  | { status: "credential_unavailable" }
  | { status: "unavailable" }
  | { status: "not_attempted" };

export type CheckInAndSendAppAccessResult = {
  checkIn: CheckInStepResult;
  appAccess: AppAccessStepResult;
};

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

const credentialPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i;

// issue_roster_account_activation_v1 raises rather than returning a rejection
// when the lifetime is outside five to sixty minutes, so the route refuses that
// request here instead of turning a predictable input error into a 503. The
// bound matches src/lib/api/roster-account-activation.ts, which is what the
// standalone activation screen already sends.
const minimumLifetimeMs = 5 * 60 * 1000;
const maximumLifetimeMs = 60 * 60 * 1000;

export function isCheckInAndSendAppAccessRequest(value: unknown, now = new Date()): value is CheckInAndSendAppAccessRequest {
  if (!record(value) || !exact(value, ["eventId", "rosterEntryId", "expiresAt", "checkInOperationId", "activationOperationId"])) return false;
  if (!isUuid(value.eventId) || !isUuid(value.rosterEntryId)) return false;
  if (!isUuid(value.checkInOperationId) || !isUuid(value.activationOperationId)) return false;
  // Two steps, two receipts. A single id reused across both is the exact shape
  // that produces a check-in followed by a spurious idempotency_conflict.
  if (value.checkInOperationId === value.activationOperationId) return false;
  if (typeof value.expiresAt !== "string") return false;
  const expiry = new Date(value.expiresAt);
  if (!Number.isFinite(expiry.valueOf()) || expiry.toISOString() !== value.expiresAt) return false;
  const lifetimeMs = expiry.valueOf() - now.valueOf();
  return lifetimeMs > minimumLifetimeMs && lifetimeMs <= maximumLifetimeMs;
}

function isCheckInStep(value: unknown): value is CheckInStepResult {
  if (!record(value)) return false;
  if (value.status === "rejected") return exact(value, ["status", "code"]) && typeof value.code === "string" && value.code.length > 0;
  return exact(value, ["status"]) && (value.status === "checked_in" || value.status === "already_checked_in");
}

function isAppAccessStep(value: unknown): value is AppAccessStepResult {
  if (!record(value)) return false;
  if (value.status === "issued") {
    return exact(value, ["status", "credential", "expiresAt"])
      && typeof value.credential === "string" && credentialPattern.test(value.credential)
      && typeof value.expiresAt === "string" && Number.isFinite(new Date(value.expiresAt).valueOf());
  }
  if (value.status === "rejected") return exact(value, ["status", "code"]) && typeof value.code === "string" && value.code.length > 0;
  return exact(value, ["status"])
    && (value.status === "credential_unavailable" || value.status === "unavailable" || value.status === "not_attempted");
}

export function isCheckInAndSendAppAccessResult(value: unknown): value is CheckInAndSendAppAccessResult {
  return record(value) && exact(value, ["checkIn", "appAccess"])
    && isCheckInStep(value.checkIn) && isAppAccessStep(value.appAccess);
}

/**
 * A rejection is a real answer, so it is reported with its own cause. These
 * codes come from desk_check_in_event_v1 (0217) and the shared window guard.
 */
export function checkInRejectionMessage(code: string) {
  if (code === "window_not_open") return "Event check-in is not open for this event. Open it first, then try again.";
  if (code === "payment_or_enrollment_required") return "The player is not ready for event check-in. Confirm their event enrollment and paid-in-full payment record at the desk.";
  if (code === "already_checked_in_to_another_event") return "This player is already checked into another event that has not finished.";
  if (code === "participant_unavailable") return "This player is no longer an active participant in this event.";
  if (code === "not_director") return "Only a director or co-director can check a player in at the desk.";
  if (code === "idempotency_conflict") return "A different operation is already using this request id. Refresh and try again.";
  return "The player was not checked in. Refresh and review the current status before trying again.";
}

/**
 * Every message here starts by stating that the check-in DID happen. A
 * director who reads only the first clause must still walk away with the true
 * fact, because the player is standing at the desk and the link is the part
 * that can be retried.
 */
export function appAccessFailureMessage(step: AppAccessStepResult) {
  if (step.status === "credential_unavailable") {
    return "The player is checked in. A link for this request already exists and its secret cannot be shown a second time. Cancel it on the Player Account Activation screen, then create a new one.";
  }
  if (step.status === "rejected" && step.code === "activation_unavailable") {
    return "The player is checked in. No link was created, because this player already has an account or an unexpired link. Check the Player Account Activation screen.";
  }
  if (step.status === "rejected" && step.code === "idempotency_conflict") {
    return "The player is checked in. No link was created, because a different operation is already using this request id. Try sending app access again.";
  }
  if (step.status === "rejected") {
    return "The player is checked in. No link was created. Use the Player Account Activation screen to issue one.";
  }
  if (step.status === "not_attempted") {
    return "The player was not checked in, so no link was requested. Resolve the check-in first.";
  }
  return "The player is checked in. The link could not be created and no link was shown. Try sending app access again, or use the Player Account Activation screen.";
}
