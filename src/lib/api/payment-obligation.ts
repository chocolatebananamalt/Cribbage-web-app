import { isUuid } from "./validation.ts";

const exact = (value: object, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);
const whole = (value: unknown) =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 2147483647;

export type PaymentObligationEntry = {
  rosterEntryId: string;
  displayName: string;
  obligationVersion: number;
  amountOwedMinor: number | null;
  amountReceivedMinor: number;
  amountRemainingMinor: number | null;
  paymentStatus: "not_configured" | "unpaid" | "partial" | "paid" | "overpaid";
};
export type PaymentObligationWorkspace = { entries: PaymentObligationEntry[] };

function hasConsistentPaymentAmounts(item: Record<string, unknown>) {
  const owed = item.amountOwedMinor as number | null;
  const received = item.amountReceivedMinor as number;
  const remaining = item.amountRemainingMinor as number | null;
  if (owed === null) {
    return item.obligationVersion === 0 && remaining === null && item.paymentStatus === "not_configured";
  }
  if ((item.obligationVersion as number) < 1 || remaining !== Math.max(owed - received, 0)) return false;
  const expectedStatus = received === 0 && owed > 0
    ? "unpaid"
    : received < owed
      ? "partial"
      : received === owed
        ? "paid"
        : "overpaid";
  return item.paymentStatus === expectedStatus;
}

export function isPaymentObligationWorkspace(value: unknown): value is PaymentObligationWorkspace {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || !exact(value, ["entries"])
      || !Array.isArray((value as Record<string, unknown>).entries)) return false;
  return ((value as Record<string, unknown>).entries as unknown[]).every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
        || !exact(entry, ["rosterEntryId", "displayName", "obligationVersion", "amountOwedMinor", "amountReceivedMinor", "amountRemainingMinor", "paymentStatus"])) return false;
    const item = entry as Record<string, unknown>;
    return isUuid(item.rosterEntryId)
      && typeof item.displayName === "string"
      && whole(item.obligationVersion)
      && (item.amountOwedMinor === null || whole(item.amountOwedMinor))
      && whole(item.amountReceivedMinor)
      && (item.amountRemainingMinor === null || whole(item.amountRemainingMinor))
      && ["not_configured", "unpaid", "partial", "paid", "overpaid"].includes(item.paymentStatus as string)
      && hasConsistentPaymentAmounts(item);
  });
}

export type PaymentObligationRequest = { rosterEntryId: string; expectedVersion: number; amountOwedMinor: number; reason: string; idempotencyKey: string };
export function isPaymentObligationRequest(value: unknown): value is PaymentObligationRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || !exact(value, ["rosterEntryId", "expectedVersion", "amountOwedMinor", "reason", "idempotencyKey"])) return false;
  const item = value as Record<string, unknown>;
  return isUuid(item.rosterEntryId) && whole(item.expectedVersion) && whole(item.amountOwedMinor)
    && typeof item.reason === "string" && item.reason.length <= 500
    && new TextEncoder().encode(item.reason).length <= 2000 && isUuid(item.idempotencyKey);
}

export function isSavedPaymentObligation(value: unknown, request: PaymentObligationRequest) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || !exact(value, ["status", "rosterEntryId", "obligationVersion", "amountOwedMinor"])) return false;
  const item = value as Record<string, unknown>;
  return item.status === "payment_obligation_saved" && item.rosterEntryId === request.rosterEntryId
    && item.obligationVersion === request.expectedVersion + 1 && item.amountOwedMinor === request.amountOwedMinor;
}
