import {
  isExpenseRecordRequest,
  isExpenseRecoveryRequest,
  isExpenseVoidRequest,
  type ExpenseRecordRequest,
  type ExpenseRecoveryRequest,
  type ExpenseVoidRequest,
} from "../api/expense.ts";

export const expenseRecoveryKindV2 = "expense-recovery-v2" as const;

export type ExpenseRecoveryEnvelopeV2 = {
  kind: typeof expenseRecoveryKindV2;
  actorId: string;
  tournamentId: string;
  operationType: ExpenseRecoveryRequest["operationType"];
  request: ExpenseRecordRequest | ExpenseVoidRequest;
};

export type LegacyExpenseRecoveryEnvelope = ExpenseRecoveryRequest & {
  kind: "expense";
  digest: string;
};

export type ParsedExpenseRecovery =
  | { status: "current"; raw: string; envelope: ExpenseRecoveryEnvelopeV2; recovery: ExpenseRecoveryRequest }
  | { status: "legacy"; raw: string; envelope: LegacyExpenseRecoveryEnvelope; recovery: ExpenseRecoveryRequest }
  | { status: "unknown"; raw: string };

const uuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);

const exact = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const object = (value: unknown): value is Record<string, unknown> => !!value
  && typeof value === "object" && !Array.isArray(value);

export function expenseRecoveryRequest(
  operationType: ExpenseRecoveryRequest["operationType"],
  request: ExpenseRecordRequest | ExpenseVoidRequest,
): ExpenseRecoveryRequest | null {
  if (operationType === "record_tournament_expense") {
    if (!isExpenseRecordRequest(request)) return null;
    return {
      operationType,
      expenseId: null,
      expectedExpenseVersion: 0,
      expenseEventId: null,
      idempotencyKey: request.idempotencyKey,
    };
  }
  if (!isExpenseVoidRequest(request)) return null;
  return {
    operationType,
    expenseId: request.expenseId,
    expectedExpenseVersion: request.expectedExpenseVersion,
    expenseEventId: request.expenseEventId,
    idempotencyKey: request.idempotencyKey,
  };
}

export function createExpenseRecoveryEnvelopeV2(
  actorId: string,
  tournamentId: string,
  operationType: ExpenseRecoveryRequest["operationType"],
  request: ExpenseRecordRequest | ExpenseVoidRequest,
): ExpenseRecoveryEnvelopeV2 | null {
  const recovery = expenseRecoveryRequest(operationType, request);
  if (!uuid(actorId) || !uuid(tournamentId) || !recovery) return null;
  return { kind: expenseRecoveryKindV2, actorId, tournamentId, operationType, request: structuredClone(request) };
}

function parseLegacy(value: unknown): LegacyExpenseRecoveryEnvelope | null {
  if (!object(value) || !exact(value, [
    "kind", "operationType", "expenseId", "expectedExpenseVersion", "expenseEventId", "idempotencyKey", "digest",
  ]) || value.kind !== "expense" || typeof value.digest !== "string"
    || !/^[a-f0-9]{64}$/.test(value.digest)) return null;
  const recovery = {
    operationType: value.operationType,
    expenseId: value.expenseId,
    expectedExpenseVersion: value.expectedExpenseVersion,
    expenseEventId: value.expenseEventId,
    idempotencyKey: value.idempotencyKey,
  };
  return isExpenseRecoveryRequest(recovery) ? { kind: "expense", digest: value.digest, ...recovery } : null;
}

export function parseExpenseRecoveryRaw(raw: string, actorId: string, tournamentId: string): ParsedExpenseRecovery {
  try {
    const value: unknown = JSON.parse(raw);
    if (object(value) && exact(value, ["kind", "actorId", "tournamentId", "operationType", "request"])
      && value.kind === expenseRecoveryKindV2 && value.actorId === actorId && value.tournamentId === tournamentId
      && uuid(actorId) && uuid(tournamentId)) {
      const operationType = value.operationType;
      if (operationType === "record_tournament_expense" || operationType === "void_tournament_expense") {
        const envelope = createExpenseRecoveryEnvelopeV2(actorId, tournamentId, operationType, value.request as never);
        const recovery = envelope && expenseRecoveryRequest(operationType, envelope.request);
        if (envelope && recovery) return { status: "current", raw, envelope, recovery };
      }
    }
    const legacy = parseLegacy(value);
    if (legacy) return { status: "legacy", raw, envelope: legacy, recovery: {
      operationType: legacy.operationType,
      expenseId: legacy.expenseId,
      expectedExpenseVersion: legacy.expectedExpenseVersion,
      expenseEventId: legacy.expenseEventId,
      idempotencyKey: legacy.idempotencyKey,
    } };
  } catch { /* Preserve malformed bytes as unknown recovery evidence. */ }
  return { status: "unknown", raw };
}

export function readExpenseRecovery(storage: Storage, key: string, actorId: string, tournamentId: string) {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : parseExpenseRecoveryRaw(raw, actorId, tournamentId);
  } catch {
    return null;
  }
}

export function exactExpenseRecoveryRequestMatches(
  pending: ParsedExpenseRecovery,
  operationType: ExpenseRecoveryRequest["operationType"],
  request: ExpenseRecordRequest | ExpenseVoidRequest,
) {
  if (pending.status !== "current" || pending.envelope.operationType !== operationType) return false;
  return JSON.stringify(pending.envelope.request) === JSON.stringify(request);
}

export function expenseRecoveryStorageKey(actorId: string, tournamentId: string) {
  return `expense-operation:${actorId}:${tournamentId}`;
}
