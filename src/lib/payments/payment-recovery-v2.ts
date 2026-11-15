import {
  isPaymentRecordRequest,
  isPaymentRecoveryRequest,
  isPaymentVoidRequest,
  type PaymentRecordRequest,
  type PaymentRecoveryRequest,
  type PaymentVoidRequest,
} from "../api/payment.ts";

export const paymentRecoveryKindV2 = "payment-recovery-v2" as const;

export type PaymentRecoveryEnvelopeV2 = {
  kind: typeof paymentRecoveryKindV2;
  actorId: string;
  tournamentId: string;
  operationType: PaymentRecoveryRequest["operationType"];
  request: PaymentRecordRequest | PaymentVoidRequest;
};

export type LegacyPaymentRecoveryEnvelope = PaymentRecoveryRequest & {
  kind: "payment";
  digest: string;
};

export type ParsedPaymentRecovery =
  | { status: "current"; raw: string; envelope: PaymentRecoveryEnvelopeV2; recovery: PaymentRecoveryRequest }
  | { status: "legacy"; raw: string; envelope: LegacyPaymentRecoveryEnvelope; recovery: PaymentRecoveryRequest }
  | { status: "unknown"; raw: string };

const uuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value
  && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

export function paymentRecoveryRequest(
  operationType: PaymentRecoveryRequest["operationType"],
  request: PaymentRecordRequest | PaymentVoidRequest,
): PaymentRecoveryRequest | null {
  if (operationType === "record_manual_roster_payment") {
    if (!object(request) || !exact(request, ["rosterEntryId", "expectedPaymentVersion", "amountMinor", "paymentMethod", "paymentReceivedAt", "note", "idempotencyKey"])
      || !isPaymentRecordRequest(request)) return null;
    return {
      rosterEntryId: request.rosterEntryId,
      operationType,
      expectedPaymentVersion: request.expectedPaymentVersion,
      paymentEventId: null,
      idempotencyKey: request.idempotencyKey,
    };
  }
  if (!object(request) || !exact(request, ["rosterEntryId", "expectedPaymentVersion", "paymentEventId", "voidReason", "idempotencyKey"])
    || !isPaymentVoidRequest(request)) return null;
  return {
    rosterEntryId: request.rosterEntryId,
    operationType,
    expectedPaymentVersion: request.expectedPaymentVersion,
    paymentEventId: request.paymentEventId,
    idempotencyKey: request.idempotencyKey,
  };
}

export function createPaymentRecoveryEnvelopeV2(
  actorId: string,
  tournamentId: string,
  operationType: PaymentRecoveryRequest["operationType"],
  request: PaymentRecordRequest | PaymentVoidRequest,
): PaymentRecoveryEnvelopeV2 | null {
  if (!uuid(actorId) || !uuid(tournamentId) || !paymentRecoveryRequest(operationType, request)) return null;
  return { kind: paymentRecoveryKindV2, actorId, tournamentId, operationType, request: structuredClone(request) };
}

function parseLegacy(value: unknown): LegacyPaymentRecoveryEnvelope | null {
  if (!object(value) || !exact(value, [
    "kind", "digest", "rosterEntryId", "operationType", "expectedPaymentVersion", "paymentEventId", "idempotencyKey",
  ]) || value.kind !== "payment" || typeof value.digest !== "string" || !/^[a-f0-9]{64}$/.test(value.digest)) return null;
  const recovery = {
    rosterEntryId: value.rosterEntryId,
    operationType: value.operationType,
    expectedPaymentVersion: value.expectedPaymentVersion,
    paymentEventId: value.paymentEventId,
    idempotencyKey: value.idempotencyKey,
  };
  return isPaymentRecoveryRequest(recovery) ? { kind: "payment", digest: value.digest, ...recovery } : null;
}

export function parsePaymentRecoveryRaw(raw: string, actorId: string, tournamentId: string): ParsedPaymentRecovery {
  try {
    const value: unknown = JSON.parse(raw);
    if (object(value) && exact(value, ["kind", "actorId", "tournamentId", "operationType", "request"])
      && value.kind === paymentRecoveryKindV2 && value.actorId === actorId && value.tournamentId === tournamentId
      && uuid(actorId) && uuid(tournamentId)
      && (value.operationType === "record_manual_roster_payment" || value.operationType === "void_manual_roster_payment")) {
      const envelope = createPaymentRecoveryEnvelopeV2(actorId, tournamentId, value.operationType, value.request as never);
      const recovery = envelope && paymentRecoveryRequest(value.operationType, envelope.request);
      if (envelope && recovery) return { status: "current", raw, envelope, recovery };
    }
    const legacy = parseLegacy(value);
    if (legacy) return { status: "legacy", raw, envelope: legacy, recovery: {
      rosterEntryId: legacy.rosterEntryId,
      operationType: legacy.operationType,
      expectedPaymentVersion: legacy.expectedPaymentVersion,
      paymentEventId: legacy.paymentEventId,
      idempotencyKey: legacy.idempotencyKey,
    } };
  } catch { /* Preserve malformed bytes as unknown evidence. */ }
  return { status: "unknown", raw };
}

export function readPaymentRecovery(storage: Storage, key: string, actorId: string, tournamentId: string) {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : parsePaymentRecoveryRaw(raw, actorId, tournamentId);
  } catch { return null; }
}

export function exactPaymentRecoveryRequestMatches(
  pending: ParsedPaymentRecovery,
  operationType: PaymentRecoveryRequest["operationType"],
  request: PaymentRecordRequest | PaymentVoidRequest,
) {
  return pending.status === "current" && pending.envelope.operationType === operationType
    && JSON.stringify(pending.envelope.request) === JSON.stringify(request);
}

export function paymentRecoveryStorageKey(actorId: string, tournamentId: string) {
  return `payment-operation:${actorId}:${tournamentId}`;
}
