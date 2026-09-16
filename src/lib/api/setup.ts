import { isUuid } from "./validation.ts";
import { DEFAULT_CONSOLATION_SANCTIONING_FEE_RATE_CENTS, DEFAULT_MAIN_SANCTIONING_FEE_RATE_CENTS, MAX_SANCTIONING_FEE_RATE_CENTS } from "../sanctioning-fee.ts";

export type SetupPool = { poolTypeCode: string; entryFeeCents: number; note: string };
export type SetupEvent = {
  clientRowId: string;
  eventKind: "main" | "consolation" | "satellite" | "custom";
  displayName: string;
  startsAt: string;
  timezone: string;
  styleCode: string;
  formatCode: "standard_singles" | "team" | "doubles" | "canadian_doubles" | "custom";
  gameCount: number;
  entryFeeCents: number;
  feeIncludesNote: string;
  payoutNote: string;
  qualificationNote: string;
  eligibilityNote: string;
  mugginsStatus: "unset" | "in_effect" | "not_in_effect";
  qPools: SetupPool[];
};
export type SetupOfficial = { profileId: string; role: "director" | "co_director" };
export type SetupPayload = { tournamentName: string; city: string; venue: string; startsAt: string; endsAt: string; timezone: string; tournamentContactPhone: string; tournamentContactEmail: string; tournamentMailingAddress: string; mainSanctioningFeeRateCents: number; consolationSanctioningFeeRateCents: number; mainSanctioningFeeOverrideReason: string; mainSanctioningFeeOverrideReference: string; consolationSanctioningFeeOverrideReason: string; consolationSanctioningFeeOverrideReference: string; officials: SetupOfficial[]; events: SetupEvent[] };
export type SetupCurrentEvent = SetupEvent & { sourceStatus: "director_configured_unverified"; qPools: Array<SetupPool & { slot: 1 | 2; sourceStatus: "director_configured_unverified" }> };
export type SetupCurrent = Omit<SetupPayload, "events"> & { revisionId: string; version: number; createdAt: string; events: SetupCurrentEvent[] };
export type SetupWorkspace = { current: SetupCurrent | null; history: Array<{ version: number; createdAt: string; eventCount: number }>; sanctioningFee: { mainRateCents: number; consolationRateCents: number; mainEligibleParticipantCount: number; consolationEligibleParticipantCount: number; runningTotalCents: number; mainRateSource: "setup" | "override"; consolationRateSource: "setup" | "override" } };
export type SetupOfficialChoices = { directorProfileId: string; directorDisplayName: string; coDirectorProfileIds: string[] };
export type SetupSaveRequest = { expectedVersion: number; payload: SetupPayload; idempotencyKey: string };
export type SetupRecoveryRequest = { idempotencyKey: string };
const setupRejectionCodes = new Set([
  "authentication_required", "not_director", "idempotency_conflict", "setup_lifecycle_closed",
  "stale_version", "invalid_officials", "invalid_event", "invalid_q_pool", "invalid_request",
  "invalid_setup_payload",
]);
const rootKeys = ["tournamentName", "city", "venue", "startsAt", "endsAt", "timezone", "tournamentContactPhone", "tournamentContactEmail", "tournamentMailingAddress", "mainSanctioningFeeRateCents", "consolationSanctioningFeeRateCents", "mainSanctioningFeeOverrideReason", "mainSanctioningFeeOverrideReference", "consolationSanctioningFeeOverrideReason", "consolationSanctioningFeeOverrideReference", "officials", "events"];
const eventKeys = ["clientRowId", "eventKind", "displayName", "startsAt", "timezone", "styleCode", "formatCode", "gameCount", "entryFeeCents", "feeIncludesNote", "payoutNote", "qualificationNote", "eligibilityNote", "mugginsStatus", "qPools"];
const officialKeys = ["profileId", "role"];
const poolKeys = ["poolTypeCode", "entryFeeCents", "note"];
const own = (v: object, keys: string[]) => Object.keys(v).length === keys.length && keys.every((key) => key in v);
const text = (v: unknown, max: number, required = false) => typeof v === "string" && v.length <= max && (!required || v.trim().length > 0);
const money = (v: unknown, nullable = false) => (nullable && v === null) || (Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 100000000);
const sanctioningRate = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= MAX_SANCTIONING_FEE_RATE_CENTS;
const sanctioningTotal = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 1000000000;
const localTime = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/.test(v);
const contactPhone = (v: unknown) => typeof v === "string" && v.trim().length >= 7 && v.trim().length <= 40 && (v.match(/\d/g)?.length ?? 0) >= 7;
const contactEmail = (v: unknown) => typeof v === "string" && v.trim().length >= 3 && v.trim().length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export function isSetupEvent(value: unknown): value is SetupEvent {
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
  const ratesAreValid = sanctioningRate(x.mainSanctioningFeeRateCents) && sanctioningRate(x.consolationSanctioningFeeRateCents)
    && text(x.mainSanctioningFeeOverrideReason, 1000) && text(x.mainSanctioningFeeOverrideReference, 1000)
    && text(x.consolationSanctioningFeeOverrideReason, 1000) && text(x.consolationSanctioningFeeOverrideReference, 1000)
    && ((x.mainSanctioningFeeRateCents === DEFAULT_MAIN_SANCTIONING_FEE_RATE_CENTS) || (text(x.mainSanctioningFeeOverrideReason, 1000, true) && text(x.mainSanctioningFeeOverrideReference, 1000, true)))
    && ((x.consolationSanctioningFeeRateCents === DEFAULT_CONSOLATION_SANCTIONING_FEE_RATE_CENTS) || (text(x.consolationSanctioningFeeOverrideReason, 1000, true) && text(x.consolationSanctioningFeeOverrideReference, 1000, true)));
  return text(x.tournamentName, 200, true) && text(x.city, 160, true) && text(x.venue, 240, true) && localTime(x.startsAt) && localTime(x.endsAt) && text(x.timezone, 128, true) && contactPhone(x.tournamentContactPhone) && contactEmail(x.tournamentContactEmail) && text(x.tournamentMailingAddress, 500) && ratesAreValid
    && Array.isArray(officials) && officials.length >= 1 && officials.length <= 5 && officials.every((o) => !!o && typeof o === "object" && own(o, officialKeys) && isUuid((o as Record<string, unknown>).profileId) && ["director", "co_director"].includes((o as Record<string, unknown>).role as string))
    && Array.isArray(events) && events.length <= 32 && events.every(isSetupEvent);
}
export function isSetupRecoveryRequest(value: unknown): value is SetupRecoveryRequest { return !!value && typeof value === "object" && own(value, ["idempotencyKey"]) && isUuid((value as Record<string, unknown>).idempotencyKey); }
export function isSavedSetup(value: unknown, request: SetupSaveRequest): value is { status: "setup_draft_saved"; revisionId: string; version: number; eventCount: number } { if (!value || typeof value !== "object" || !own(value, ["status", "revisionId", "version", "eventCount", "operationalEventsCreated", "rulesetApproved", "seatingUpdated", "financeUpdated", "resultsUpdated", "payoutsCalculated", "qualifiersCalculated", "accSubmissionCreated"])) return false; const v = value as Record<string, unknown>; return v.status === "setup_draft_saved" && isUuid(v.revisionId) && v.version === request.expectedVersion + 1 && v.eventCount === (request.payload.events as unknown[]).length && ["operationalEventsCreated", "rulesetApproved", "seatingUpdated", "financeUpdated", "resultsUpdated", "payoutsCalculated", "qualifiersCalculated", "accSubmissionCreated"].every((key) => v[key] === false); }
export function isRejectedSetup(value: unknown) { return !!value && typeof value === "object" && !Array.isArray(value) && own(value, ["status", "code"]) && (value as Record<string, unknown>).status === "rejected" && typeof (value as Record<string, unknown>).code === "string" && setupRejectionCodes.has((value as Record<string, unknown>).code as string); }
export function isRecoveredSetup(value: unknown) { return !!value && typeof value === "object" && (value as Record<string, unknown>).status === "setup_draft_saved" && isUuid((value as Record<string, unknown>).revisionId) && Number.isSafeInteger((value as Record<string, unknown>).version); }
const workspaceKeys = ["current", "history", "sanctioningFee"];
const currentKeys = ["revisionId", "version", "tournamentName", "city", "venue", "startsAt", "endsAt", "timezone", "tournamentContactPhone", "tournamentContactEmail", "tournamentMailingAddress", "mainSanctioningFeeRateCents", "consolationSanctioningFeeRateCents", "mainSanctioningFeeOverrideReason", "mainSanctioningFeeOverrideReference", "consolationSanctioningFeeOverrideReason", "consolationSanctioningFeeOverrideReference", "createdAt", "officials", "events"];
const workspaceEventKeys = [...eventKeys, "sourceStatus"];
const workspacePoolKeys = ["slot", ...poolKeys, "sourceStatus"];
const historyKeys = ["version", "createdAt", "eventCount"];
const status = (value: unknown) => value === "director_configured_unverified";
function workspaceEvent(value: unknown) {
  if (!value || typeof value !== "object" || !own(value, workspaceEventKeys)) return false;
  const e = value as Record<string, unknown>;
  return isUuid(e.clientRowId) && ["main", "consolation", "satellite", "custom"].includes(e.eventKind as string)
    && text(e.displayName, 200, true) && typeof e.startsAt === "string" && text(e.timezone, 128, true)
    && text(e.styleCode, 160, true) && ["standard_singles", "team", "doubles", "canadian_doubles", "custom"].includes(e.formatCode as string)
    && Number.isSafeInteger(e.gameCount) && (e.gameCount as number) >= 1 && (e.gameCount as number) <= 99 && money(e.entryFeeCents)
    && text(e.feeIncludesNote, 1000) && text(e.payoutNote, 2000) && text(e.qualificationNote, 2000) && text(e.eligibilityNote, 2000)
    && ["unset", "in_effect", "not_in_effect"].includes(e.mugginsStatus as string) && status(e.sourceStatus)
    && Array.isArray(e.qPools) && e.qPools.length <= 2 && (["main", "consolation"].includes(e.eventKind as string) || e.qPools.length === 0)
    && Array.isArray(e.qPools) && new Set(e.qPools.map((pool) => pool && typeof pool === "object" ? (pool as Record<string, unknown>).slot : null)).size === e.qPools.length
    && e.qPools.every((pool) => !!pool && typeof pool === "object" && own(pool, workspacePoolKeys)
      && Number.isSafeInteger((pool as Record<string, unknown>).slot) && ([1, 2] as unknown[]).includes((pool as Record<string, unknown>).slot)
      && text((pool as Record<string, unknown>).poolTypeCode, 160, true) && money((pool as Record<string, unknown>).entryFeeCents)
      && text((pool as Record<string, unknown>).note, 1000) && status((pool as Record<string, unknown>).sourceStatus));
}
export function isSetupWorkspace(value: unknown): value is SetupWorkspace {
  if (!value || typeof value !== "object" || !own(value, workspaceKeys)) return false;
  const workspace = value as Record<string, unknown>;
  const sanctioningFee = workspace.sanctioningFee;
  if (!sanctioningFee || typeof sanctioningFee !== "object" || !own(sanctioningFee, ["mainRateCents", "consolationRateCents", "mainEligibleParticipantCount", "consolationEligibleParticipantCount", "runningTotalCents", "mainRateSource", "consolationRateSource"])
    || !sanctioningRate((sanctioningFee as Record<string, unknown>).mainRateCents) || !sanctioningRate((sanctioningFee as Record<string, unknown>).consolationRateCents)
    || !Number.isSafeInteger((sanctioningFee as Record<string, unknown>).mainEligibleParticipantCount) || ((sanctioningFee as Record<string, unknown>).mainEligibleParticipantCount as number) < 0
    || !Number.isSafeInteger((sanctioningFee as Record<string, unknown>).consolationEligibleParticipantCount) || ((sanctioningFee as Record<string, unknown>).consolationEligibleParticipantCount as number) < 0
    || !sanctioningTotal((sanctioningFee as Record<string, unknown>).runningTotalCents)
    || !["setup", "override"].includes(String((sanctioningFee as Record<string, unknown>).mainRateSource))
    || !["setup", "override"].includes(String((sanctioningFee as Record<string, unknown>).consolationRateSource))) return false;
  if (!Array.isArray(workspace.history) || !workspace.history.every((item) => !!item && typeof item === "object" && own(item, historyKeys)
    && Number.isSafeInteger((item as Record<string, unknown>).version) && ((item as Record<string, unknown>).version as number) >= 1
    && typeof (item as Record<string, unknown>).createdAt === "string" && Number.isSafeInteger((item as Record<string, unknown>).eventCount) && ((item as Record<string, unknown>).eventCount as number) >= 0 && ((item as Record<string, unknown>).eventCount as number) <= 32)) return false;
  if (workspace.current === null) return workspace.history.length === 0;
  if (!workspace.current || typeof workspace.current !== "object" || !own(workspace.current, currentKeys)) return false;
  const current = workspace.current as Record<string, unknown>;
  const history = workspace.history as Record<string, unknown>[];
  const currentOfficials = Array.isArray(current.officials) ? current.officials as Record<string, unknown>[] : [];
  return history.length > 0 && history[0].version === current.version && history.every((item, index) => index === 0 || item.version === (history[index - 1].version as number) - 1)
    && isUuid(current.revisionId) && Number.isSafeInteger(current.version) && (current.version as number) >= 1
    && text(current.tournamentName, 200, true) && text(current.city, 160, true) && text(current.venue, 240, true)
    && typeof current.startsAt === "string" && typeof current.endsAt === "string" && text(current.timezone, 128, true)
    && text(current.tournamentContactPhone, 40) && text(current.tournamentContactEmail, 320) && text(current.tournamentMailingAddress, 500)
    && sanctioningRate(current.mainSanctioningFeeRateCents) && sanctioningRate(current.consolationSanctioningFeeRateCents)
    && text(current.mainSanctioningFeeOverrideReason, 1000) && text(current.mainSanctioningFeeOverrideReference, 1000)
    && text(current.consolationSanctioningFeeOverrideReason, 1000) && text(current.consolationSanctioningFeeOverrideReference, 1000) && typeof current.createdAt === "string"
    && currentOfficials.length >= 1 && currentOfficials.length <= 5
    && currentOfficials.every((official) => !!official && typeof official === "object" && own(official, officialKeys) && isUuid(official.profileId) && ["director", "co_director"].includes(official.role as string))
    && currentOfficials.filter((official) => official.role === "director").length === 1 && new Set(currentOfficials.map((official) => official.profileId)).size === currentOfficials.length
    && Array.isArray(current.events) && current.events.length <= 32 && current.events.every(workspaceEvent) && history[0].eventCount === current.events.length;
}
export function isSetupOfficialChoices(value: unknown): value is SetupOfficialChoices {
  if (!value || typeof value !== "object" || !own(value, ["directorProfileId", "directorDisplayName", "coDirectorProfileIds"])) return false;
  const choices = value as Record<string, unknown>;
  return isUuid(choices.directorProfileId) && text(choices.directorDisplayName, 160, true) && Array.isArray(choices.coDirectorProfileIds)
    && choices.coDirectorProfileIds.length <= 4 && choices.coDirectorProfileIds.every(isUuid)
    && !choices.coDirectorProfileIds.includes(choices.directorProfileId) && new Set(choices.coDirectorProfileIds).size === choices.coDirectorProfileIds.length;
}
