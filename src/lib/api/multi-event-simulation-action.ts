import { isUuid } from "./validation.ts";

// These checks are only an additional request boundary. The database still
// owns authorization, fixture enrollment, source pins and idempotence.
type Obj = Record<string, unknown>;
function exact(value: unknown, keys: string[]): value is Obj {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}
const integer = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isSafeInteger(x) && x >= min && x <= max;
const reason = (x: unknown): x is string => typeof x === "string" && x === x.trim()
  && x.startsWith("TEST ONLY SYNTHETIC:") && x.slice(20).trim().length > 0
  && x.length <= 500 && !/[\u0000-\u001f\u007f]/.test(x);
const distinct = (values: string[]) => new Set(values).size === values.length;
const money = (x: unknown): x is number => integer(x, 1, 99_999_999);

function poolLines(value: unknown): value is {policyId: string; electionId: string; amountMinor: number}[] {
  return Array.isArray(value) && value.length <= 16 && value.every(x =>
    exact(x, ["policyId", "electionId", "amountMinor"]) && isUuid(x.policyId)
      && isUuid(x.electionId) && money(x.amountMinor))
    && distinct(value.map(x => x.policyId));
}

/** Validate strictly before forwarding to simulation-only service RPCs. */
export function isMultiEventSimulationAction(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Obj;
  if (!isUuid(v.operationId) || typeof v.action !== "string") return false;
  if (v.action === "disclose") {
    if (!exact(v, ["action", "operationId", "eventId", "request"]) || !isUuid(v.eventId)
      || !exact(v.request, ["kind", "poolDefinitionId", "method", "ratio", "disclosureReference", "disclosed"])) return false;
    const r = v.request;
    return isUuid(r.poolDefinitionId) && reason(r.disclosureReference) && r.disclosed === true
      && ((r.kind === "q" && r.method === "equal-paid-playoff-qualifiers-v2" && r.ratio === null)
        || ((r.kind === "q" || r.kind === "side") && r.method === "graduated-acc-weighted-largest-remainder-5usd-v2"
          && typeof r.ratio === "number" && (r.kind === "q" ? [4, 6] : [4, 6, 8, 10]).includes(r.ratio)));
  }
  if (v.action === "election") {
    if (!exact(v, ["action", "operationId", "eventId", "request"]) || !isUuid(v.eventId)
      || !exact(v.request, ["policyId", "participantId", "expectedVersion", "elected", "reason", "reviewed"])) return false;
    const r = v.request;
    return isUuid(r.policyId) && isUuid(r.participantId) && integer(r.expectedVersion, 0, 255)
      && typeof r.elected === "boolean" && reason(r.reason) && r.reviewed === true;
  }
  if (v.action === "receipt") {
    if (!exact(v, ["action", "operationId", "request"])
      || !exact(v.request, ["rosterEntryId", "amountMinor", "events", "reason", "reviewed"])) return false;
    const r = v.request;
    if (!isUuid(r.rosterEntryId) || !money(r.amountMinor) || !reason(r.reason) || r.reviewed !== true
      || !Array.isArray(r.events) || r.events.length < 1 || r.events.length > 32) return false;
    let sum = 0;
    for (const e of r.events) {
      if (!exact(e, ["eventId", "baseMinor", "q", "side"]) || !isUuid(e.eventId)
        || !money(e.baseMinor) || !poolLines(e.q) || e.q.length > 2 || !poolLines(e.side) || e.side.length > 6
        || !distinct([...e.q, ...e.side].map(p => p.policyId))) return false;
      sum += e.baseMinor + [...e.q, ...e.side].reduce((a, p) => a + p.amountMinor, 0);
    }
    return distinct(r.events.map(e => e.eventId)) && sum === r.amountMinor;
  }
  if (v.action === "expense") {
    if (!exact(v, ["action", "operationId", "request"]) || !exact(v.request,
      ["kind", "rosterEntryId", "amountMinor", "allocations", "reason", "reviewed"])) return false;
    const r = v.request;
    if (r.kind !== "expense" || r.rosterEntryId !== null || !money(r.amountMinor) || !reason(r.reason)
      || r.reviewed !== true || !Array.isArray(r.allocations) || r.allocations.length < 1 || r.allocations.length > 32
      || !r.allocations.every(x => exact(x, ["eventId", "amountMinor"]) && isUuid(x.eventId) && money(x.amountMinor))) return false;
    return distinct(r.allocations.map(x => x.eventId)) && r.allocations.reduce((a, x) => a + x.amountMinor, 0) === r.amountMinor;
  }
  if (v.action === "classify") {
    if (!exact(v, ["action", "operationId", "eventId", "request"]) || !isUuid(v.eventId)
      || !exact(v.request, ["expectedVersion", "sourceDigest", "classifications", "reason", "reviewed"])) return false;
    const r = v.request;
    if (!integer(r.expectedVersion, 0, 255) || typeof r.sourceDigest !== "string" || !/^[a-f0-9]{64}$/.test(r.sourceDigest)
      || !reason(r.reason) || r.reviewed !== true || !Array.isArray(r.classifications) || r.classifications.length > 4096
      || !r.classifications.every(x => exact(x, ["sourceId", "category", "amountMinor"]) && isUuid(x.sourceId)
        && ["operating", "player_benefit", "sanctioning"].includes(String(x.category)) && money(x.amountMinor))) return false;
    return distinct(r.classifications.map(x => `${x.sourceId}:${x.category}`));
  }
  return false;
}

/** An acknowledgement must match the exact saved operation before cleanup. */
export function isAcceptedSimulationResult(value: unknown, action: unknown): boolean {
  if (!isMultiEventSimulationAction(action) || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Obj, a = action as { action: string; eventId?: string; request: Obj };
  if (v.moneyMoved !== false || (a.eventId && v.eventId !== a.eventId)) return false;
  switch (a.action) {
    case "disclose": return v.status === "synthetic_pool_policy_disclosed" && v.humanConsentClaimed === false && isUuid(v.policyId) && v.kind === a.request.kind && v.poolDefinitionId === a.request.poolDefinitionId;
    case "election": return v.status === "synthetic_pool_election_recorded" && v.humanConsentClaimed === false && isUuid(v.electionId) && v.policyId === a.request.policyId && v.participantId === a.request.participantId && v.elected === a.request.elected && v.version === Number(a.request.expectedVersion) + 1;
    case "receipt": return v.status === "synthetic_pool_receipt_recorded" && v.humanConsentClaimed === false && v.accountingAvailable === false && isUuid(v.receiptId) && v.version === 1;
    case "expense": return v.status === "multi_event_source_recorded" && v.evidenceKind === "simulation" && v.kind === "expense" && isUuid(v.sourceId) && v.version === 1;
    case "classify": return v.status === "synthetic_expenses_classified" && v.accountingAvailable === false && isUuid(v.reviewId) && v.version === Number(a.request.expectedVersion) + 1;
    default: return false;
  }
}
