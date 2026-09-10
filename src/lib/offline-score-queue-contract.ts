/**
 * Offline score queue protocol boundary (R-OFFLINE-01).
 *
 * This is intentionally an unconnected, pure contract. It defines the
 * immutable material an IndexedDB adapter and a future server replay wrapper
 * must bind. It does not store records, sign payloads, issue capabilities, or
 * make a score authoritative.
 *
 * Source: docs/decisions/2026-09-09-offline-score-sync-contract.md.
 */

export type OfflineQueueState = "Queued" | "PendingSync" | "Retrying" | "Conflict" | "Rejected";
export type OfflineOperationKind = "submission" | "confirmation";

type QueueBase = {
  version: 1;
  queueId: string;
  createdAtMs: number;
  clientOperationId: string;
  verifiedActorId: string;
  sessionBindingId: string;
  deviceKeyId: string;
  tournamentId: string;
  eventId: string;
  gameId: string;
  assignedSide: "a" | "b";
  expectedGameVersion: number;
  capabilityId: string;
  capabilityExpiresAtMs: number;
  payloadDigest: string;
  signature: string;
};

export type OfflineSubmissionIntent = QueueBase & {
  kind: "submission";
  submissionId: string;
  submissionSlot: 1 | 2;
  winnerSide: "a" | "b";
  margin: number;
};

export type OfflineConfirmationIntent = QueueBase & {
  kind: "confirmation";
  submissionId: string;
  matchedResultChallengeFingerprint: string;
};

export type OfflineQueueIntent = OfflineSubmissionIntent | OfflineConfirmationIntent;

export type OfflineQueueRecord = { intent: OfflineQueueIntent; state: OfflineQueueState };

export type OfflineReplayReceipt = {
  version: 1;
  queueId: string;
  clientOperationId: string;
  kind: OfflineOperationKind;
  gameId: string;
  submissionId: string;
  payloadDigest: string;
  disposition: "accepted" | "rejected" | "quarantined" | "conflict";
};

const baseKeys = ["version", "queueId", "createdAtMs", "clientOperationId", "verifiedActorId", "sessionBindingId", "deviceKeyId", "tournamentId", "eventId", "gameId", "assignedSide", "expectedGameVersion", "capabilityId", "capabilityExpiresAtMs", "payloadDigest", "signature"];
const states: readonly OfflineQueueState[] = ["Queued", "PendingSync", "Retrying", "Conflict", "Rejected"];
const digest = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const opaque = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 256;
const whole = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

export function isOfflineQueueIntent(value: unknown): value is OfflineQueueIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const validBase = item.version === 1
    && baseKeys.every((key) => Object.hasOwn(item, key))
    && opaque(item.queueId) && whole(item.createdAtMs) && opaque(item.clientOperationId)
    && opaque(item.verifiedActorId) && opaque(item.sessionBindingId) && opaque(item.deviceKeyId)
    && opaque(item.tournamentId) && opaque(item.eventId) && opaque(item.gameId)
    && ["a", "b"].includes(item.assignedSide as string) && whole(item.expectedGameVersion)
    && opaque(item.capabilityId) && whole(item.capabilityExpiresAtMs)
    && digest(item.payloadDigest) && opaque(item.signature);
  if (!validBase) return false;
  if (item.kind === "submission") {
    return exactKeys(item, [...baseKeys, "kind", "submissionId", "submissionSlot", "winnerSide", "margin"])
      && opaque(item.submissionId) && [1, 2].includes(item.submissionSlot as number)
      && ["a", "b"].includes(item.winnerSide as string)
      && Number.isSafeInteger(item.margin) && (item.margin as number) >= 1 && (item.margin as number) <= 121;
  }
  return item.kind === "confirmation"
    && exactKeys(item, [...baseKeys, "kind", "submissionId", "matchedResultChallengeFingerprint"])
    && opaque(item.submissionId) && digest(item.matchedResultChallengeFingerprint);
}

export function isOfflineQueueRecord(value: unknown): value is OfflineQueueRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, ["intent", "state"]) && isOfflineQueueIntent(item.intent) && states.includes(item.state as OfflineQueueState);
}

/** A confirmation cannot be queued without a server-issued matching challenge. */
export function canQueueOfflineIntent(intent: OfflineQueueIntent, nowMs: number) {
  if (!isOfflineQueueIntent(intent) || !whole(nowMs)) return false;
  if (intent.capabilityExpiresAtMs <= nowMs) return false;
  return intent.kind !== "confirmation" || digest(intent.matchedResultChallengeFingerprint);
}

/** Local queue state never means Verified; only an exact terminal receipt allows deletion. */
export function canDeleteOfflineQueueRecord(record: OfflineQueueRecord, receipt: unknown) {
  if (!isOfflineQueueRecord(record) || !receipt || typeof receipt !== "object" || Array.isArray(receipt)) return false;
  const value = receipt as Record<string, unknown>;
  const keys = ["version", "queueId", "clientOperationId", "kind", "gameId", "submissionId", "payloadDigest", "disposition"];
  return exactKeys(value, keys)
    && value.version === 1
    && value.queueId === record.intent.queueId
    && value.clientOperationId === record.intent.clientOperationId
    && value.kind === record.intent.kind
    && value.gameId === record.intent.gameId
    && value.submissionId === record.intent.submissionId
    && value.payloadDigest === record.intent.payloadDigest
    && ["accepted", "rejected", "quarantined", "conflict"].includes(value.disposition as string);
}
