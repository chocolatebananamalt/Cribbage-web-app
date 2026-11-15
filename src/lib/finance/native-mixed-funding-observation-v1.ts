/** Private supplied-model adapter only. No API/provider, payment, check-in,
 * native V2 source adoption or database-provenance authority is granted. */
type Scope = {
  scopeId: string; version: 1; admissionIntentId: string;
  admissionIntentVersion: number; admissionSourceDigest: string;
  operationalBindingId: string; entryFeeMinor: number;
  participantCount: 18; digitalCount: 6; paperCount: 12; sourceDigest: string;
};
type Identity = {rosterEntryId: string; participantId: string; mode: "digital" | "paper"; profileId: string | null};
export type NativeMixedFundingExpectedV1 = {
  actorId: string; tournamentId: string; eventId: string; scope: Scope; roster: Identity[];
};
const flags = ["optionalPoolSourceAvailable", "assessmentSourceAvailable", "paidCheckInAuthorized",
  "ordinaryCheckInSource", "actualMoneyReceived", "bankReceiptVerified", "moneyMoved",
  "refundAuthorized", "payoutAuthorized", "finalizationAuthorized"] as const;
type Entry = Identity & {
  version: 1; fixedId: null; obligation: {obligationId: string; amountMinor: number};
  receipt: {receiptId: string; amountMinor: number; currency: "USD"; method: "simulated"; simulatedReceivedAt: string};
  operationId: string; contextId: string; sourceDigest: string;
};
type Observation = {
  status: "simulation-observation"; kind: "native-mixed-funding-observation-v1";
  actorId: string; tournamentId: string; eventId: string; scope: Scope; entries: Entry[]; fundingSourceDigest: string;
  totals: {entryCount: 18; obligationMinor: number; receiptMinor: number};
  sourceObservation: "provided-models-not-atomic" | "matching-double-read-not-atomic";
  databaseProvenanceVerified: false; financeAvailableV2: false; paidCheckInAuthorized: false;
  actualMoneyReceived: false; bankReceiptVerified: false; moneyMoved: false;
  refundAuthorized: false; payoutAuthorized: false; finalizationAuthorized: false;
};
export type NativeMixedFundingObservationResultV1 = Observation | {status: "blocked"; code: string};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> =>
  record(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const digest = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const positive = (v: unknown): v is number => integer(v) && v > 0;
const canonical = (v: unknown): string => JSON.stringify(v, (_k, x) => x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const scopeKeys = ["scopeId", "version", "admissionIntentId", "admissionIntentVersion", "admissionSourceDigest",
  "operationalBindingId", "entryFeeMinor", "participantCount", "digitalCount", "paperCount", "sourceDigest"];
function validScope(v: unknown): v is Scope {
  return exact(v, scopeKeys) && uuid(v.scopeId) && v.version === 1 && uuid(v.admissionIntentId)
    && positive(v.admissionIntentVersion) && digest(v.admissionSourceDigest) && uuid(v.operationalBindingId)
    && integer(v.entryFeeMinor) && v.entryFeeMinor >= 300 && v.entryFeeMinor % 100 === 0
    && Number.isSafeInteger(v.entryFeeMinor * 18) && v.participantCount === 18 && v.digitalCount === 6
    && v.paperCount === 12 && digest(v.sourceDigest);
}
function validIdentity(v: unknown): v is Identity {
  return exact(v, ["rosterEntryId", "participantId", "mode", "profileId"]) && uuid(v.rosterEntryId)
    && uuid(v.participantId) && ((v.mode === "digital" && uuid(v.profileId)) || (v.mode === "paper" && v.profileId === null));
}
function identityOf(v: Record<string, unknown>): unknown {
  return {rosterEntryId: v.rosterEntryId, participantId: v.participantId, mode: v.mode, profileId: v.profileId};
}
function validExpected(v: NativeMixedFundingExpectedV1): boolean {
  if (!v || !uuid(v.actorId) || !uuid(v.tournamentId) || !uuid(v.eventId) || !validScope(v.scope)
    || !Array.isArray(v.roster) || v.roster.length !== 18 || !v.roster.every(validIdentity)) return false;
  return new Set(v.roster.map(x => x.rosterEntryId)).size === 18 && new Set(v.roster.map(x => x.participantId)).size === 18
    && v.roster.filter(x => x.mode === "digital").length === 6
    && new Set(v.roster.filter(x => x.mode === "digital").map(x => x.profileId)).size === 6;
}

/** This validates the DTO against separately retained pins, not the backend's
 * ownership, hash, audit, atomicity or freshness. Never use it as a capability. */
export function observeNativeMixedFundingV1(value: unknown, expected: NativeMixedFundingExpectedV1): NativeMixedFundingObservationResultV1 {
  const blocked = (code: string): NativeMixedFundingObservationResultV1 => ({status: "blocked", code});
  try {
    if (!validExpected(expected)) return blocked("retained_funding_scope_invalid");
    if (!exact(value, ["status", "kind", "actorId", "tournamentId", "eventId", "scope", "entries", "totals", "sourceDigest", ...flags])
      || value.status !== "source_available" || value.kind !== "native-mixed-funding-source-v1"
      || !digest(value.sourceDigest) || flags.some(k => value[k] !== false)) return blocked("simulation_source_unavailable");
    if (value.actorId !== expected.actorId || value.tournamentId !== expected.tournamentId || value.eventId !== expected.eventId
      || !validScope(value.scope) || canonical(value.scope) !== canonical(expected.scope)) return blocked("funding_scope_changed");
    if (!Array.isArray(value.entries) || value.entries.length !== 18) return blocked("complete_simulated_funding_required");
    const ids = Array.from({length: 6}, () => new Set<string>());
    for (const row of value.entries) {
      if (!exact(row, ["version", "rosterEntryId", "participantId", "mode", "profileId", "fixedId", "obligation", "receipt", "operationId", "contextId", "sourceDigest"])
        || row.version !== 1 || row.fixedId !== null || !validIdentity(identityOf(row))
        || !uuid(row.operationId) || !uuid(row.contextId) || !digest(row.sourceDigest)
        || !exact(row.obligation, ["obligationId", "amountMinor"]) || !uuid(row.obligation.obligationId)
        || row.obligation.amountMinor !== expected.scope.entryFeeMinor
        || !exact(row.receipt, ["receiptId", "amountMinor", "currency", "method", "simulatedReceivedAt"])
        || !uuid(row.receipt.receiptId) || row.receipt.amountMinor !== expected.scope.entryFeeMinor
        || row.receipt.currency !== "USD" || row.receipt.method !== "simulated"
        || typeof row.receipt.simulatedReceivedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.receipt.simulatedReceivedAt)
        || !Number.isFinite(Date.parse(row.receipt.simulatedReceivedAt))
        || new Date(row.receipt.simulatedReceivedAt).toISOString() !== row.receipt.simulatedReceivedAt)
        return blocked("simulation_entry_invalid");
      if (!expected.roster.some(x => canonical(x) === canonical(identityOf(row)))) return blocked("funding_identity_changed");
      // Identity namespaces stay distinct; each owner/operation/evidence ID
      // must nevertheless occur once within its own namespace.
      const values = [row.rosterEntryId, row.participantId, row.operationId, row.contextId, row.obligation.obligationId, row.receipt.receiptId] as string[];
      for (let i = 0; i < values.length; i++) {
        if (ids[i].has(values[i])) return blocked("funding_identity_ambiguous");
        ids[i].add(values[i]);
      }
    }
    const total = expected.scope.entryFeeMinor * 18;
    if (!exact(value.totals, ["entryCount", "obligationMinor", "receiptMinor"]) || value.totals.entryCount !== 18
      || value.totals.obligationMinor !== total || value.totals.receiptMinor !== total) return blocked("simulated_totals_mismatch");
    return {status: "simulation-observation", kind: "native-mixed-funding-observation-v1", actorId: expected.actorId,
      tournamentId: expected.tournamentId, eventId: expected.eventId, scope: copy(value.scope), entries: copy(value.entries) as Entry[],
      fundingSourceDigest: value.sourceDigest,
      totals: {entryCount: 18, obligationMinor: total, receiptMinor: total}, sourceObservation: "provided-models-not-atomic",
      databaseProvenanceVerified: false, financeAvailableV2: false, paidCheckInAuthorized: false, actualMoneyReceived: false,
      bankReceiptVerified: false, moneyMoved: false, refundAuthorized: false, payoutAuthorized: false, finalizationAuthorized: false};
  } catch { return blocked("simulation_source_invalid"); }
}

type Access = {actorId: string; roles: string[]};
type Models = {value: unknown; expected: NativeMixedFundingExpectedV1};
type Dependencies = {access: (tournamentId: string) => Promise<Access | null>;
  models: (actorId: string, tournamentId: string, eventId: string) => Promise<Models>};
/** Dependency-injected private composition. No provider is wired. A second read
 * catches observed mutation; it is not an atomic source lease. */
export function createNativeMixedFundingObservationReaderV1(d: Dependencies) {
  return async (tournamentId: string, eventId: string): Promise<NativeMixedFundingObservationResultV1> => {
    const blocked = (code: string): NativeMixedFundingObservationResultV1 => ({status: "blocked", code});
    try {
      if (!uuid(tournamentId) || !uuid(eventId)) return blocked("invalid_scope");
      const access = async () => {
        const a = await d.access(tournamentId);
        return a && uuid(a.actorId) && a.roles.includes("director") ? a : null;
      };
      const actor = await access(); if (!actor) return blocked("director_access_required");
      const first = copy(await d.models(actor.actorId, tournamentId, eventId));
      const parsed = observeNativeMixedFundingV1(first.value, first.expected);
      if (parsed.status === "blocked") return parsed;
      if (parsed.actorId !== actor.actorId || parsed.tournamentId !== tournamentId || parsed.eventId !== eventId) return blocked("loader_scope_mismatch");
      if ((await access())?.actorId !== actor.actorId) return blocked("director_access_changed");
      const second = copy(await d.models(actor.actorId, tournamentId, eventId));
      if ((await access())?.actorId !== actor.actorId) return blocked("director_access_changed");
      if (canonical(first) !== canonical(second)) return blocked("funding_source_changed");
      const result = observeNativeMixedFundingV1(second.value, second.expected);
      return result.status === "blocked" ? result : {...result, sourceObservation: "matching-double-read-not-atomic"};
    } catch { return blocked("simulation_source_unavailable"); }
  };
}
