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
