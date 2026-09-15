import { isUuid } from "./validation";

export type SidePool = { poolId: string; version: number; categoryCode: "10" | "20" | "50" | "100"; displayName: string; entryFeeMinor: number };
export type SidePoolWorkspace = { tournamentName: string; events: Array<{ eventId: string; name: string; eventType: string; pools: SidePool[] }> };
export type AddSidePoolRequest = { eventId: string; poolId: string; categoryCode: SidePool["categoryCode"]; displayName: string; entryFeeMinor: number; idempotencyKey: string };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const minor = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 100_000_000;
export function isSidePoolWorkspace(value: unknown): value is SidePoolWorkspace {
  if (!record(value) || !exact(value, ["tournamentName", "events"]) || typeof value.tournamentName !== "string" || !Array.isArray(value.events)) return false;
  return value.events.every((event) => record(event) && exact(event, ["eventId", "name", "eventType", "pools"])
    && isUuid(event.eventId) && typeof event.name === "string" && typeof event.eventType === "string" && Array.isArray(event.pools)
    && event.pools.length <= 4 && event.pools.every((pool) => record(pool) && exact(pool, ["poolId", "version", "categoryCode", "displayName", "entryFeeMinor"])
      && isUuid(pool.poolId) && Number.isSafeInteger(pool.version) && ["10", "20", "50", "100"].includes(pool.categoryCode as string)
      && typeof pool.displayName === "string" && pool.displayName.length > 0 && minor(pool.entryFeeMinor)));
}
export function isAddSidePoolRequest(value: unknown): value is AddSidePoolRequest {
  return record(value) && exact(value, ["eventId", "poolId", "categoryCode", "displayName", "entryFeeMinor", "idempotencyKey"])
    && isUuid(value.eventId) && isUuid(value.poolId) && ["10", "20", "50", "100"].includes(value.categoryCode as string)
    && typeof value.displayName === "string" && value.displayName.trim().length > 0 && value.displayName.length <= 100
    && minor(value.entryFeeMinor) && isUuid(value.idempotencyKey);
}
export function isAddedSidePool(value: unknown, request: AddSidePoolRequest) {
  return record(value) && exact(value, ["status", "eventId", "poolId", "version"]) && value.status === "side_pool_added"
    && value.eventId === request.eventId && value.poolId === request.poolId && value.version === 1;
}
export function isRejectedSidePool(value: unknown): value is { status: "rejected"; code: string } {
  return record(value) && exact(value, ["status", "code"]) && value.status === "rejected" && typeof value.code === "string";
}
