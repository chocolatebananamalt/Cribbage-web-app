import { MAX_SANCTIONING_FEE_RATE_CENTS } from "../sanctioning-fee.ts";
import { isUuid } from "./validation.ts";

const own = (value: object, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
const text = (value: unknown, maximum: number) => typeof value === "string" && value.trim().length > 0 && value.length <= maximum;

export type SanctioningFeeRateOverrideRequest = { eventKind: "main" | "consolation"; rateCents: number; reason: string; idempotencyKey: string };

export function isSanctioningFeeRateOverrideRequest(value: unknown): value is SanctioningFeeRateOverrideRequest {
  if (!value || typeof value !== "object" || Array.isArray(value) || !own(value, ["eventKind", "rateCents", "reason", "idempotencyKey"])) return false;
  const request = value as Record<string, unknown>;
  return (request.eventKind === "main" || request.eventKind === "consolation")
    && Number.isSafeInteger(request.rateCents) && (request.rateCents as number) >= 0 && (request.rateCents as number) <= MAX_SANCTIONING_FEE_RATE_CENTS
    && text(request.reason, 1000) && isUuid(request.idempotencyKey);
}

// The RPC returns {status, eventKind, rateCents, version}, where version is the
// override's sequence number for this tournament. This guard looked for a
// "receipt" uuid instead, which the RPC has never returned, so every successful
// override was rejected here as a malformed response.
export function isSanctioningFeeRateOverrideResult(value: unknown, request: SanctioningFeeRateOverrideRequest) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !own(value, ["status", "eventKind", "rateCents", "version"])) return false;
  const result = value as Record<string, unknown>;
  return result.status === "sanctioning_fee_rate_overridden" && result.eventKind === request.eventKind && result.rateCents === request.rateCents
    && Number.isSafeInteger(result.version) && (result.version as number) > 0;
}

// The setup page used to answer every rejection with the same sentence,
// "Confirm the event has not started and try again", which names only one of
// the five reasons the RPC can refuse. A director who was not a director, or
// who typed the rate that was already in force, was told to check something
// that was never the problem.
export function sanctioningFeeRateRejectionMessage(code: unknown) {
  const messages: Record<string, string> = {
    rate_locked_after_start: "Play has already started for this event type, so its ACC rate is locked. The rate in force when play started is the one on the official record.",
    rate_unchanged: "That is already the rate in force. Enter a different rate, or press Cancel rate change.",
    not_director: "Only the Tournament Director or a Co-Director can change an ACC rate.",
    tournament_unavailable: "This tournament is no longer in draft or open status, so its ACC rates can no longer be changed.",
    idempotency_conflict: "A different rate change was already recorded under this request. Reload the page and check the current rate before trying again.",
    invalid_request: "The rate change was not accepted. A rate between $0.00 and $1,000.00 and a written reason are both required.",
  };
  return (typeof code === "string" ? messages[code] : undefined)
    ?? "The rate change was not applied. Reload the page to see the rate currently in force.";
}
