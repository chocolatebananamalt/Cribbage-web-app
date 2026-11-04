import { isPaperCardCaptureRequest, type PaperCardCaptureRequest } from "../api/paper-card-capture.ts";
import { isUuid } from "../api/validation.ts";
import { assertRecoveryWriteAllowed, setAppRecoveryItem } from "../recovery-write-coordinator.ts";

type PhotoScope = { actorId: string; tournamentId: string; gameId: string; cardSide: "a" | "b"; verificationId: string };
export type PendingPhotoCapture = { version: 1; actorId: string; tournamentId: string; request: PaperCardCaptureRequest };

// Nested under an already deployed financial-independent recovery prefix so
// older open clients also count this work before allowing an account switch.
export function photoRetryKey(scope: PhotoScope) {
  return `paper-game-completion:photo:${scope.actorId}:${scope.tournamentId}:${scope.gameId}:${scope.cardSide}`;
}
export function isPendingPhotoCapture(value: unknown, scope: PhotoScope): value is PendingPhotoCapture {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 4 && item.version === 1
    && isUuid(item.actorId) && item.actorId === scope.actorId
    && isUuid(item.tournamentId) && item.tournamentId === scope.tournamentId
    && isPaperCardCaptureRequest(item.request)
    && item.request.gameId === scope.gameId && item.request.cardSide === scope.cardSide
    && item.request.verificationId === scope.verificationId;
}
export function readPendingPhoto(storage: Storage, scope: PhotoScope) {
  const raw = storage.getItem(photoRetryKey(scope));
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!isPendingPhotoCapture(value, scope)) throw new Error("photo_recovery_unavailable");
  return value;
}
export function retainPendingPhoto(storage: Storage, scope: PhotoScope, request: PaperCardCaptureRequest) {
  const envelope: PendingPhotoCapture = { version: 1, actorId: scope.actorId, tournamentId: scope.tournamentId, request };
  if (!isPendingPhotoCapture(envelope, scope)) throw new Error("photo_recovery_unavailable");
  setAppRecoveryItem(storage, photoRetryKey(scope), JSON.stringify(envelope));
}
export function clearConfirmedPhoto(storage: Storage, scope: PhotoScope, request: PaperCardCaptureRequest) {
  assertRecoveryWriteAllowed();
  const pending = readPendingPhoto(storage, scope);
  if (pending && JSON.stringify(pending.request) !== JSON.stringify(request)) throw new Error("photo_recovery_conflict");
  storage.removeItem(photoRetryKey(scope));
}
export function photoMatchesPending(request: PaperCardCaptureRequest, file: { size: number; type: string }, digest: string) {
  return request.declaredByteSize === file.size && request.declaredMediaType === file.type && request.declaredSha256 === digest;
}
export function photoRejectionIsTerminal(value: unknown) {
  // These are receipted only after authorization and exact prior-operation lookup.
  // Lost role, unavailable tournament, invalid request and key conflicts cannot
  // establish that an earlier accepted upload did not occur.
  return !!value && typeof value === "object" && "code" in value && typeof value.code === "string" && ["capture_lifecycle_closed", "game_unavailable", "unsupported_event", "card_identity_unavailable", "self_capture_denied", "verification_id_mismatch"].includes(value.code);
}
export function listPendingPhotos(storage: Storage, actorId: string, tournamentId: string) {
  const entries: PendingPhotoCapture[] = [];
  const prefix = `paper-game-completion:photo:${actorId}:${tournamentId}:`;
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const value = JSON.parse(storage.getItem(key) ?? "null") as PendingPhotoCapture | null;
    if (!value?.request || !isPendingPhotoCapture(value, { actorId, tournamentId, gameId: value.request.gameId, cardSide: value.request.cardSide, verificationId: value.request.verificationId }) || key !== photoRetryKey({ actorId, tournamentId, ...value.request })) throw new Error("photo_recovery_unavailable");
    entries.push(value);
  }
  return entries;
}
