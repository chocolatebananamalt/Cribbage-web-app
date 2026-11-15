import { isPaymentObligationRequest, type PaymentObligationRequest } from "../api/payment-obligation.ts";

const exact = (value: object, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);
const canonicalUuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);

export const paymentObligationRecoveryKindV2 = "payment-obligation-recovery-v2" as const;
export type PaymentObligationRecoveryEnvelopeV2 = {
  kind: typeof paymentObligationRecoveryKindV2;
  actorId: string;
  tournamentId: string;
  rosterEntryId: string;
  request: PaymentObligationRequest;
};
export type ParsedPaymentObligationRecovery = {
  status: "current" | "legacy";
  raw: string;
  request: PaymentObligationRequest;
} | {
  status: "unknown";
  raw: string;
};

export function paymentObligationRecoveryStorageKey(actorId: string, tournamentId: string, rosterEntryId: string) {
  return `payment-obligation:${actorId}:${tournamentId}:${rosterEntryId}`;
}

export function createPaymentObligationRecoveryEnvelopeV2(
  actorId: string,
  tournamentId: string,
  rosterEntryId: string,
  request: unknown,
): PaymentObligationRecoveryEnvelopeV2 | null {
  if (!canonicalUuid(actorId) || !canonicalUuid(tournamentId) || !isPaymentObligationRequest(request)
      || request.rosterEntryId !== rosterEntryId) return null;
  return { kind: paymentObligationRecoveryKindV2, actorId, tournamentId, rosterEntryId, request: structuredClone(request) };
}

export function parsePaymentObligationRecoveryRaw(
  raw: string,
  actorId: string,
  tournamentId: string,
  rosterEntryId: string,
): ParsedPaymentObligationRecovery {
  if (!canonicalUuid(actorId) || !canonicalUuid(tournamentId)) return { status: "unknown", raw };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "unknown", raw };
    if (exact(value, ["kind", "actorId", "tournamentId", "rosterEntryId", "request"])) {
      const item = value as Record<string, unknown>;
      const envelope = item.kind === paymentObligationRecoveryKindV2 && item.actorId === actorId
          && item.tournamentId === tournamentId && item.rosterEntryId === rosterEntryId
        ? createPaymentObligationRecoveryEnvelopeV2(actorId, tournamentId, rosterEntryId, item.request)
        : null;
      if (envelope) {
        return { status: "current", raw, request: envelope.request };
      }
      return { status: "unknown", raw };
    }
    // The original client stored the complete five-key request without a wrapper.
    // Keep it byte-for-byte and retry it directly; no migration is necessary.
    if (isPaymentObligationRequest(value) && value.rosterEntryId === rosterEntryId) {
      return { status: "legacy", raw, request: value };
    }
    return { status: "unknown", raw };
  } catch {
    return { status: "unknown", raw };
  }
}

export function readPaymentObligationRecovery(
  storage: Storage,
  key: string,
  actorId: string,
  tournamentId: string,
  rosterEntryId: string,
) {
  const raw = storage.getItem(key);
  return raw === null ? null : parsePaymentObligationRecoveryRaw(raw, actorId, tournamentId, rosterEntryId);
}
