import { isUuid } from "./api/validation.ts";

export type MixedPhase = "own-ack" | "paper-capture" | "paper-review" | "hybrid-capture" | "hybrid-review";
export type MixedScope = { actorId: string; tournamentId: string; eventId: string; gameId: string; phase: MixedPhase };
export type MixedPending<T> = MixedScope & { protocol: "synthetic-mixed-ui-v1"; artifactId: string; expectedGameVersion: number; idempotencyKey: string; request: T };
export type MixedRecovery<T> = { kind: "empty" } | { kind: "blocked" } | { kind: "pending"; value: MixedPending<T>; serialized: string };
const phases = new Set(["own-ack", "paper-capture", "paper-review", "hybrid-capture", "hybrid-review"]);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const sameScope = (value: MixedScope, scope: MixedScope) => (["actorId", "tournamentId", "eventId", "gameId", "phase"] as const).every(key => value[key] === scope[key]);
export function mixedRecoveryKey(scope: MixedScope) {
  if (![scope.actorId, scope.tournamentId, scope.eventId, scope.gameId].every(isUuid) || !phases.has(scope.phase)) throw new Error("invalid_mixed_recovery_scope");
  return `synthetic-mixed-operation:${scope.actorId}:${scope.tournamentId}:${scope.eventId}:${scope.gameId}:${scope.phase}`;
}
export function isMixedPending<T>(value: unknown, scope: MixedScope, isRequest: (value: unknown) => value is T): value is MixedPending<T> {
  if (!record(value) || Object.keys(value).sort().join() !== "actorId,artifactId,eventId,expectedGameVersion,gameId,idempotencyKey,phase,protocol,request,tournamentId"
    || value.protocol !== "synthetic-mixed-ui-v1" || !sameScope(value as MixedPending<T>, scope)
    || !isUuid(value.artifactId) || !isUuid(value.idempotencyKey) || !Number.isSafeInteger(value.expectedGameVersion) || Number(value.expectedGameVersion) < 1 || !isRequest(value.request) || !record(value.request)) return false;
  const body = value.request;
  const claim = scope.phase === "own-ack" ? body : body.request;
  return record(claim) && body.idempotencyKey === value.idempotencyKey && claim.artifactId === value.artifactId && claim.expectedGameVersion === value.expectedGameVersion
    && (scope.phase === "own-ack" || (body.gameId === scope.gameId && (!("gameId" in claim) || claim.gameId === scope.gameId)));
}
/** Unknown/malformed browser state is preserved, never treated as no pending work. */
export function readMixedRecovery<T>(storage: Pick<Storage, "getItem">, scope: MixedScope, isRequest: (value: unknown) => value is T): MixedRecovery<T> {
  try {
    const serialized = storage.getItem(mixedRecoveryKey(scope));
    if (serialized === null) return { kind: "empty" };
    const value: unknown = JSON.parse(serialized);
    return isMixedPending(value, scope, isRequest) ? { kind: "pending", value, serialized } : { kind: "blocked" };
  } catch { return { kind: "blocked" }; }
}
/** A delayed response must never erase a different or newer operation. */
export function removeExactMixedRecovery(storage: Pick<Storage, "getItem" | "removeItem">, scope: MixedScope, serialized: string) {
  const key = mixedRecoveryKey(scope);
  if (storage.getItem(key) !== serialized) return false;
  storage.removeItem(key);
  return storage.getItem(key) === null;
}
