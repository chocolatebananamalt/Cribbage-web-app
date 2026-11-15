import { isUuid } from "../api/validation.ts";
import { isReviewedDrawPublicationRequest, type ReviewedDrawPublicationRequest } from "./reviewed-draw-publication.ts";
export type RetainedDrawPublication = { protocol: "reviewed-native-seating-v1"; actorId: string; tournamentId: string; request: ReviewedDrawPublicationRequest };
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
export function reviewedDrawRecoveryKey(actorId: string, tournamentId: string) {
  if (!uuid(actorId) || !uuid(tournamentId)) throw new Error("invalid_reviewed_draw_scope");
  return `reviewed-native-seating:${actorId}:${tournamentId}`;
}
/** No storage writer or API caller: ownership coordinator remains required at the UI boundary. */
export function readReviewedDrawRecovery(storage: Pick<Storage, "getItem">, actorId: string, tournamentId: string):
  { kind: "empty" } | { kind: "blocked" } | { kind: "pending"; value: RetainedDrawPublication; serialized: string } {
  try {
    const serialized = storage.getItem(reviewedDrawRecoveryKey(actorId, tournamentId));
    if (serialized === null) return { kind: "empty" };
    const v: unknown = JSON.parse(serialized);
    if (!v || typeof v !== "object" || Array.isArray(v)) return { kind: "blocked" };
    const p = v as Record<string, unknown>;
    if (Object.keys(p).sort().join() !== "actorId,protocol,request,tournamentId" || p.protocol !== "reviewed-native-seating-v1"
      || p.actorId !== actorId || p.tournamentId !== tournamentId || !isReviewedDrawPublicationRequest(p.request)) return { kind: "blocked" };
    return { kind: "pending", value: p as RetainedDrawPublication, serialized };
  } catch { return { kind: "blocked" }; }
}
export function clearExactReviewedDrawRecovery(storage: Pick<Storage, "getItem" | "removeItem">, actorId: string, tournamentId: string, serialized: string) {
  const key = reviewedDrawRecoveryKey(actorId, tournamentId);
  if (storage.getItem(key) !== serialized) return false;
  storage.removeItem(key);
  return storage.getItem(key) === null;
}
