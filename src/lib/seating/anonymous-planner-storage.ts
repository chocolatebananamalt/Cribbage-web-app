import { isUuid } from "../api/validation.ts";
import { isAnonymousLocalPlanInput, isLocalSeatingRequest, isLocalSeatingReceipt, canonicalLocalPlan, localRedrawReasons, type LocalSeatingRequest, type LocalSeatingReceipt, type LocalRedrawReason } from "../api/local-seating-planner.ts";
import type { LocalRandomPlanInput } from "./local-random-plan.ts";
/** Anonymous planning data only; never an auth/tournament recovery record. */
export const anonymousPlannerStorageKey = "cribbage-local-seating-plan-v1";
export type LocalPlanningAttempt = { request: LocalSeatingRequest; receipt: LocalSeatingReceipt | null };
export type AnonymousPlannerState = { kind: "anonymous-seating-draft-v1"; plannerId: string; draft: LocalRandomPlanInput; current: LocalPlanningAttempt | null; history: (LocalPlanningAttempt & { reason: LocalRedrawReason })[] };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
function attempt(v: unknown, plannerId: string, history: boolean): v is LocalPlanningAttempt {
  return record(v) && exact(v, ["request", "receipt", ...(history ? ["reason"] : [])]) && isLocalSeatingRequest(v.request) && v.request.plannerId === plannerId
    && (v.receipt === null || isLocalSeatingReceipt(v.receipt, v.request)) && (!history || localRedrawReasons.includes(v.reason as LocalRedrawReason));
}
export function isAnonymousPlannerState(v: unknown): v is AnonymousPlannerState {
  return record(v) && exact(v, ["kind", "plannerId", "draft", "current", "history"]) && v.kind === "anonymous-seating-draft-v1" && isUuid(v.plannerId) && isAnonymousLocalPlanInput(v.draft)
    && (v.current === null || attempt(v.current, v.plannerId, false) && canonicalLocalPlan(v.current.request.input) === canonicalLocalPlan(v.draft))
    && Array.isArray(v.history) && v.history.length <= 8 && v.history.every(h => attempt(h, v.plannerId as string, true))
    && new Set([...(v.current ? [(v.current as LocalPlanningAttempt).request.operationId] : []), ...v.history.map(h => h.request.operationId)]).size === v.history.length + (v.current ? 1 : 0);
}
export function readAnonymousPlannerState(storage: Pick<Storage, "getItem">): { status: "empty" } | { status: "blocked" } | { status: "saved"; value: AnonymousPlannerState; raw: string } {
  try {
    const raw = storage.getItem(anonymousPlannerStorageKey);
    if (raw === null) return { status: "empty" };
    if (raw.length > 524288) return { status: "blocked" };
    const value: unknown = JSON.parse(raw);
    return isAnonymousPlannerState(value) ? { status: "saved", value, raw } : { status: "blocked" };
  } catch { return { status: "blocked" }; }
}
/** Strict, single-key, compare-and-write storage. No arbitrary personal fields. */
export function saveAnonymousPlannerState(storage: Pick<Storage, "getItem" | "setItem">, value: AnonymousPlannerState, expectedRaw: string | null): string | null {
  try {
    if (!isAnonymousPlannerState(value)) return null;
    const before = storage.getItem(anonymousPlannerStorageKey);
    if (before !== expectedRaw || (before !== null && readAnonymousPlannerState(storage).status !== "saved")) return null;
    const raw = JSON.stringify(value);
    if (raw.length > 524288) return null;
    storage.setItem(anonymousPlannerStorageKey, raw);
    return storage.getItem(anonymousPlannerStorageKey) === raw ? raw : null;
  } catch { return null; }
}
