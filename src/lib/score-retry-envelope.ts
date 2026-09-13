export type PendingScoreSubmission = {
  version: 1;
  kind: "submission";
  actorId: string;
  tournamentId: string;
  gameId: string;
  playerSide: "a" | "b";
  submissionId: string;
  idempotencyKey: string;
  submissionSlot: 1 | 2;
  winnerSide: "a" | "b";
  margin: number;
};

export function scoreSubmissionStorageKey(actorId: string, tournamentId: string, gameId: string, playerSide: "a" | "b") {
  return `acc-score:${actorId}:${tournamentId}:${gameId}:${playerSide}:submission`;
}

function isPendingScoreSubmission(value: unknown): value is PendingScoreSubmission {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const expectedKeys = ["version", "kind", "actorId", "tournamentId", "gameId", "playerSide", "submissionId", "idempotencyKey", "submissionSlot", "winnerSide", "margin"];
  return Object.keys(item).length === expectedKeys.length
    && expectedKeys.every((key) => Object.hasOwn(item, key))
    && item.version === 1
    && item.kind === "submission"
    && typeof item.actorId === "string" && item.actorId.length > 0
    && typeof item.tournamentId === "string"
    && typeof item.gameId === "string"
    && ["a", "b"].includes(item.playerSide as string)
    && typeof item.submissionId === "string"
    && typeof item.idempotencyKey === "string"
    && [1, 2].includes(item.submissionSlot as number)
    && ["a", "b"].includes(item.winnerSide as string)
    && Number.isInteger(item.margin)
    && (item.margin as number) >= 1
    && (item.margin as number) <= 121;
}

export function writePendingScoreSubmission(storage: Storage, envelope: PendingScoreSubmission) {
  try {
    storage.setItem(scoreSubmissionStorageKey(envelope.actorId, envelope.tournamentId, envelope.gameId, envelope.playerSide), JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function readPendingScoreSubmission(storage: Storage, actorId: string, tournamentId: string, gameId: string, playerSide: "a" | "b") {
  const key = scoreSubmissionStorageKey(actorId, tournamentId, gameId, playerSide);
  try {
    const raw = storage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (isPendingScoreSubmission(value) && value.actorId === actorId && value.tournamentId === tournamentId && value.gameId === gameId && value.playerSide === playerSide) return value;
    if (raw) storage.removeItem(key);
  } catch {
    // An unreadable local record is never trusted as a score mutation.
  }
  return null;
}

export function clearPendingScoreSubmission(storage: Storage, envelope: Pick<PendingScoreSubmission, "actorId" | "tournamentId" | "gameId" | "playerSide">) {
  try { storage.removeItem(scoreSubmissionStorageKey(envelope.actorId, envelope.tournamentId, envelope.gameId, envelope.playerSide)); } catch { /* The server remains authoritative. */ }
}

export function pendingSubmissionRecovery(pending: PendingScoreSubmission | null, serverSubmissionId: string | null) {
  if (!pending) return { action: "none" as const };
  if (serverSubmissionId) return { action: "clear" as const };
  return { action: "retry" as const, envelope: pending };
}

export function isDefinitiveScoreMutationFailure(status: number, payload: unknown, gameId: string, operation: "submission" | "confirmation") {
  // A session can expire after the browser has sent the request. Preserve the
  // exact envelope across 401 so the signed-in player can safely retry it.
  if ([400, 403].includes(status)) return true;
  return status === 409 && (operation === "submission"
    ? isRejectedSubmissionOperation(payload, gameId)
    : isRejectedConfirmationOperation(payload, gameId));
}
import { isRejectedConfirmationOperation, isRejectedSubmissionOperation } from "./api/game-operation.ts";
