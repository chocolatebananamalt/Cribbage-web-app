import { isUuid } from "./validation";

type SetupEvent = Record<string, unknown>;
export type SetupSaveRequest = { expectedVersion: number; payload: Record<string, unknown>; idempotencyKey: string };
export type SetupRecoveryRequest = { idempotencyKey: string };
const rootKeys = ["tournamentName", "city", "venue", "startsAt", "endsAt", "timezone", "contactDetails", "sanctioningFeeCents", "officials", "events"];
const eventKeys = ["clientRowId", "eventKind", "displayName", "startsAt", "timezone", "styleCode", "formatCode", "gameCount", "entryFeeCents", "feeIncludesNote", "payoutNote", "qualificationNote", "eligibilityNote", "mugginsStatus", "qPools"];
const officialKeys = ["profileId", "role"];
const poolKeys = ["poolTypeCode", "entryFeeCents", "note"];
const own = (v: object, keys: string[]) => Object.keys(v).length === keys.length && keys.every((key) => key in v);
const text = (v: unknown, max: number, required = false) => typeof v === "string" && v.length <= max && (!required || v.trim().length > 0);
const money = (v: unknown, nullable = false) => (nullable && v === null) || (Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 100000000);
const localTime = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/.test(v);
function event(value: unknown): value is SetupEvent {
  if (!value || typeof value !== "object" || !own(value, eventKeys)) return false;
  const e = value as Record<string, unknown>; const pools = e.qPools;
  return isUuid(e.clientRowId) && ["main", "consolation", "satellite", "custom"].includes(e.eventKind as string)
    && text(e.displayName, 200, true) && localTime(e.startsAt) && text(e.timezone, 128, true)
    && text(e.styleCode, 160, true) && ["standard_singles", "team", "doubles", "canadian_doubles", "custom"].includes(e.formatCode as string)
    && Number.isSafeInteger(e.gameCount) && (e.gameCount as number) >= 1 && (e.gameCount as number) <= 99 && money(e.entryFeeCents)
    && text(e.feeIncludesNote, 1000) && text(e.payoutNote, 2000) && text(e.qualificationNote, 2000) && text(e.eligibilityNote, 2000)
    && ["unset", "in_effect", "not_in_effect"].includes(e.mugginsStatus as string) && Array.isArray(pools) && pools.length <= 2
    && pools.every((pool) => !!pool && typeof pool === "object" && own(pool, poolKeys) && text((pool as Record<string, unknown>).poolTypeCode, 160, true) && money((pool as Record<string, unknown>).entryFeeCents) && text((pool as Record<string, unknown>).note, 1000))
    && (["main", "consolation"].includes(e.eventKind as string) || pools.length === 0);
}
export function isSetupSaveRequest(value: unknown): value is SetupSaveRequest {
  if (!value || typeof value !== "object" || !own(value, ["expectedVersion", "payload", "idempotencyKey"])) return false;
  const b = value as Record<string, unknown>; const p = b.payload;
  if (!Number.isSafeInteger(b.expectedVersion) || (b.expectedVersion as number) < 0 || !isUuid(b.idempotencyKey) || !p || typeof p !== "object" || !own(p, rootKeys)) return false;
  const x = p as Record<string, unknown>; const officials = x.officials; const events = x.events;
  return text(x.tournamentName, 200, true) && text(x.city, 160, true) && text(x.venue, 240, true) && localTime(x.startsAt) && localTime(x.endsAt) && text(x.timezone, 128, true) && text(x.contactDetails, 1000) && money(x.sanctioningFeeCents, true)
    && Array.isArray(officials) && officials.length >= 1 && officials.length <= 3 && officials.every((o) => !!o && typeof o === "object" && own(o, officialKeys) && isUuid((o as Record<string, unknown>).profileId) && ["director", "co_director"].includes((o as Record<string, unknown>).role as string))
    && Array.isArray(events) && events.length <= 32 && events.every(event);
}
export function isSetupRecoveryRequest(value: unknown): value is SetupRecoveryRequest { return !!value && typeof value === "object" && own(value, ["idempotencyKey"]) && isUuid((value as Record<string, unknown>).idempotencyKey); }
export function isSavedSetup(value: unknown, request: SetupSaveRequest) { if (!value || typeof value !== "object") return false; const v = value as Record<string, unknown>; return v.status === "setup_draft_saved" && isUuid(v.revisionId) && v.version === request.expectedVersion + 1 && v.eventCount === (request.payload.events as unknown[]).length && ["operationalEventsCreated", "rulesetApproved", "seatingUpdated", "financeUpdated", "resultsUpdated", "payoutsCalculated", "qualifiersCalculated", "accSubmissionCreated"].every((key) => v[key] === false); }
export function isRejectedSetup(value: unknown) { return !!value && typeof value === "object" && (value as Record<string, unknown>).status === "rejected" && typeof (value as Record<string, unknown>).code === "string"; }
export function isRecoveredSetup(value: unknown) { return !!value && typeof value === "object" && (value as Record<string, unknown>).status === "setup_draft_saved" && isUuid((value as Record<string, unknown>).revisionId) && Number.isSafeInteger((value as Record<string, unknown>).version); }
