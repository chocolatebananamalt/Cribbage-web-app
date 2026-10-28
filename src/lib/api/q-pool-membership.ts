import { isUuid } from "./validation.ts";

export type QPoolMembershipPool = {
  poolVersionId: string;
  slot: 1 | 2;
  name: string;
  feeMinor: number;
};
export type QPoolMemberPool = {
  poolVersionId: string;
  prePlayElected: boolean;
  elected: boolean;
  consentReference: string;
  amountOwedMinor: number;
  amountAllocatedMinor: number;
  paidEntryEligible: boolean;
};
export type QPoolMembershipEntry = {
  rosterEntryId: string;
  participantId: string;
  displayName: string;
  membershipVersion: number;
  membershipVersionId: string | null;
  pools: QPoolMemberPool[];
  allocationVersion: number;
  receiptId: string | null;
  receiptVersion: number;
  receivedMinor: number;
  obligationVersion: number;
  obligationMinor: number | null;
  allocationCurrent: boolean;
  baseAllocatedMinor: number;
  reason: string | null;
};
export type QPoolMembershipWorkspace = {
  tournamentId: string;
  eventId: string;
  eventName: string;
  canCorrect: boolean;
  started: boolean;
  supported: boolean;
  blockedReason: string | null;
  baseFeeMinor: number;
  pools: QPoolMembershipPool[];
  entries: QPoolMembershipEntry[];
};
export type QPoolMutation = {
  action: "membership" | "allocation";
  rosterEntryId: string;
  expectedVersion: number;
  correction: boolean;
  reason: string;
} & ({
  action: "membership";
  pools: Array<{ poolVersionId: string; elected: boolean; consentReference: string }>;
} | {
  action: "allocation";
  membershipVersionId: string;
  receiptId: string;
  obligationVersion: number;
  baseMinor: number;
  pools: Array<{ poolVersionId: string; amountMinor: number }>;
});
export type QPoolMutationResult =
  | { status: "q_pool_saved"; action: QPoolMutation["action"]; rosterEntryId: string; version: number; versionId: string }
  | { status: "rejected"; code: string; rosterEntryId: string };

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): value is UnknownRecord => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: UnknownRecord, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const safeMinor = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const positiveInt = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0;
const reasonText = (value: unknown) => typeof value === "string" && !!value.trim() && value.trim().length <= 500;

function isPool(value: unknown, requirePositiveFee: boolean): value is QPoolMembershipPool {
  return record(value) && exact(value, ["poolVersionId", "slot", "name", "feeMinor"])
    && isUuid(value.poolVersionId) && [1, 2].includes(value.slot as number)
    && typeof value.name === "string" && !!value.name.trim() && value.name.length <= 331
    && (requirePositiveFee ? positiveInt(value.feeMinor) : safeMinor(value.feeMinor));
}
function isEntryPool(value: unknown): value is QPoolMemberPool {
  return record(value) && exact(value, ["poolVersionId", "prePlayElected", "elected", "consentReference", "amountOwedMinor", "amountAllocatedMinor", "paidEntryEligible"])
    && isUuid(value.poolVersionId) && typeof value.prePlayElected === "boolean" && typeof value.elected === "boolean"
    && typeof value.consentReference === "string" && value.consentReference.length <= 500
    && safeMinor(value.amountOwedMinor) && safeMinor(value.amountAllocatedMinor)
    && typeof value.paidEntryEligible === "boolean";
}
function isEntry(value: unknown): value is QPoolMembershipEntry {
  return record(value) && exact(value, ["rosterEntryId", "participantId", "displayName", "membershipVersion", "membershipVersionId", "pools", "allocationVersion", "receiptId", "receiptVersion", "receivedMinor", "obligationVersion", "obligationMinor", "allocationCurrent", "baseAllocatedMinor", "reason"])
    && isUuid(value.rosterEntryId) && isUuid(value.participantId) && typeof value.displayName === "string"
    && Number.isSafeInteger(value.membershipVersion) && (value.membershipVersion as number) >= 0
    && (value.membershipVersion === 0 ? value.membershipVersionId === null : isUuid(value.membershipVersionId))
    && Array.isArray(value.pools) && value.pools.every(isEntryPool) && unique(value.pools.map((pool) => pool.poolVersionId))
    && Number.isSafeInteger(value.allocationVersion) && (value.allocationVersion as number) >= 0
    && (value.receiptId === null || isUuid(value.receiptId)) && Number.isSafeInteger(value.receiptVersion) && (value.receiptVersion as number) >= 0
    && safeMinor(value.receivedMinor) && Number.isSafeInteger(value.obligationVersion) && (value.obligationVersion as number) >= 0
    && (value.obligationMinor === null || safeMinor(value.obligationMinor))
    && typeof value.allocationCurrent === "boolean" && safeMinor(value.baseAllocatedMinor)
    && (value.reason === null || typeof value.reason === "string");
}
function unique(values: string[]) { return new Set(values).size === values.length; }

export function isQPoolMembershipWorkspace(value: unknown, tournamentId?: string): value is QPoolMembershipWorkspace {
  if (!record(value) || !exact(value, ["tournamentId", "eventId", "eventName", "canCorrect", "started", "supported", "blockedReason", "baseFeeMinor", "pools", "entries"])) return false;
  if (!isUuid(value.tournamentId) || (tournamentId !== undefined && value.tournamentId !== tournamentId)
    || !isUuid(value.eventId) || typeof value.eventName !== "string" || typeof value.canCorrect !== "boolean"
    || typeof value.started !== "boolean" || typeof value.supported !== "boolean"
    || (value.blockedReason !== null && typeof value.blockedReason !== "string") || !safeMinor(value.baseFeeMinor)
    || !Array.isArray(value.pools) || value.pools.length > 2 || !value.pools.every((pool) => isPool(pool, value.supported as boolean))
    || !Array.isArray(value.entries) || !value.entries.every(isEntry)) return false;
  const pools = value.pools as QPoolMembershipPool[];
  const entries = value.entries as QPoolMembershipEntry[];
  return unique(pools.map((pool) => String(pool.slot))) && unique(pools.map((pool) => pool.poolVersionId))
    && entries.every((entry) => {
      if (entry.pools.length !== pools.length || !pools.every((pool) => entry.pools.some((item) => item.poolVersionId === pool.poolVersionId))) return false;
      if (!value.supported) return true;
      const expectedDue = value.baseFeeMinor as number + pools.reduce((sum, pool) => sum + (entry.pools.find((item) => item.poolVersionId === pool.poolVersionId)!.elected ? pool.feeMinor : 0), 0);
      if (!Number.isSafeInteger(expectedDue) || entry.pools.some((item) => item.amountOwedMinor !== (item.elected ? pools.find((pool) => pool.poolVersionId === item.poolVersionId)!.feeMinor : 0))) return false;
      if (entry.allocationVersion > 0 && !entry.allocationCurrent && !entry.reason) return false;
      if (entry.allocationCurrent) {
        if (!entry.receiptId || entry.obligationMinor !== expectedDue || entry.baseAllocatedMinor > (value.baseFeeMinor as number)
          || entry.pools.some((item) => item.amountAllocatedMinor > item.amountOwedMinor)) return false;
        const allocated = BigInt(entry.baseAllocatedMinor) + entry.pools.reduce((sum, item) => sum + BigInt(item.amountAllocatedMinor), BigInt(0));
        if (allocated !== BigInt(entry.receivedMinor)) return false;
      }
      return entry.pools.every((item) => item.paidEntryEligible === (entry.allocationCurrent && entry.receiptId !== null
        && entry.obligationMinor === expectedDue && item.elected && entry.baseAllocatedMinor === value.baseFeeMinor
        && item.amountAllocatedMinor === item.amountOwedMinor));
    });
}

export function isQPoolMutation(value: unknown): value is QPoolMutation {
  if (!record(value) || !isUuid(value.rosterEntryId) || !Number.isSafeInteger(value.expectedVersion) || (value.expectedVersion as number) < 0
    || typeof value.correction !== "boolean" || (value.correction && value.expectedVersion === 0)
    || !reasonText(value.reason) || !Array.isArray(value.pools) || !value.pools.length || value.pools.length > 2) return false;
  if (value.action === "membership") {
    return exact(value, ["action", "rosterEntryId", "expectedVersion", "correction", "reason", "pools"])
      && value.pools.every((pool) => record(pool) && exact(pool, ["poolVersionId", "elected", "consentReference"])
        && isUuid(pool.poolVersionId) && typeof pool.elected === "boolean"
        && typeof pool.consentReference === "string" && pool.consentReference.length <= 500
        && (!pool.elected || !!pool.consentReference.trim()))
      && unique(value.pools.map((pool: UnknownRecord) => String(pool.poolVersionId)));
  }
  if (value.action === "allocation") {
    return exact(value, ["action", "rosterEntryId", "expectedVersion", "correction", "reason", "membershipVersionId", "receiptId", "obligationVersion", "baseMinor", "pools"])
      && isUuid(value.membershipVersionId) && isUuid(value.receiptId) && positiveInt(value.obligationVersion)
      && safeMinor(value.baseMinor)
      && value.pools.every((pool) => record(pool) && exact(pool, ["poolVersionId", "amountMinor"])
        && isUuid(pool.poolVersionId) && safeMinor(pool.amountMinor))
      && unique(value.pools.map((pool: UnknownRecord) => String(pool.poolVersionId)));
  }
  return false;
}

export function qPoolMutationMatchesWorkspace(request: QPoolMutation, workspace: QPoolMembershipWorkspace, entry: QPoolMembershipEntry): boolean {
  if (request.rosterEntryId !== entry.rosterEntryId || !reasonText(request.reason)) return false;
  const expectedIds = workspace.pools.map((pool) => pool.poolVersionId).sort();
  const submittedIds = request.pools.map((pool) => pool.poolVersionId).sort();
  if (expectedIds.length !== submittedIds.length || expectedIds.some((poolId, index) => poolId !== submittedIds[index])) return false;
  if (request.action === "membership") {
    if (request.expectedVersion !== entry.membershipVersion || (workspace.started && !request.correction)
      || (request.correction && (!workspace.canCorrect || entry.membershipVersion === 0))) return false;
    if (workspace.started && (!workspace.canCorrect || entry.membershipVersion === 0)) return false;
    if (workspace.started && request.pools.some((pool) => pool.elected
      && !entry.pools.find((current) => current.poolVersionId === pool.poolVersionId)?.prePlayElected)) return false;
    return request.pools.every((pool) => !pool.elected || !!pool.consentReference.trim());
  }
  if (request.expectedVersion !== entry.allocationVersion || (workspace.started && !request.correction)
    || (request.correction && (!workspace.canCorrect || entry.allocationVersion === 0))
    || entry.receiptId === null || entry.membershipVersionId === null || entry.obligationMinor === null
    || request.receiptId !== entry.receiptId || request.membershipVersionId !== entry.membershipVersionId
    || request.obligationVersion !== entry.obligationVersion
    || (workspace.started && (!workspace.canCorrect || entry.allocationVersion === 0 || entry.membershipVersion === 0
      || !entry.pools.some((pool) => pool.prePlayElected)))) return false;
  const due = workspace.baseFeeMinor + workspace.pools.reduce((sum, pool) => sum + (entry.pools.find((item) => item.poolVersionId === pool.poolVersionId)?.elected ? pool.feeMinor : 0), 0);
  if (!Number.isSafeInteger(due) || due !== entry.obligationMinor || request.baseMinor > workspace.baseFeeMinor) return false;
  if (!request.pools.every((allocation) => {
    const fee = workspace.pools.find((pool) => pool.poolVersionId === allocation.poolVersionId)?.feeMinor ?? -1;
    const owed = entry.pools.find((pool) => pool.poolVersionId === allocation.poolVersionId)?.amountOwedMinor ?? -1;
    return allocation.amountMinor <= fee && allocation.amountMinor <= owed;
  })) return false;
  const total = BigInt(request.baseMinor) + request.pools.reduce((sum, allocation) => sum + BigInt(allocation.amountMinor), BigInt(0));
  return total === BigInt(entry.receivedMinor);
}

export function isQPoolMutationResult(value: unknown, request: QPoolMutation): value is QPoolMutationResult {
  if (!record(value) || value.rosterEntryId !== request.rosterEntryId) return false;
  if (value.status === "rejected") return exact(value, ["status", "code", "rosterEntryId"]) && typeof value.code === "string";
  return exact(value, ["status", "action", "rosterEntryId", "version", "versionId"])
    && value.status === "q_pool_saved" && value.action === request.action
      && value.version === request.expectedVersion + 1 && isUuid(value.versionId);
}

export function isQPoolReconciliation(value: unknown): value is { authorized: true; result: unknown | null } {
  if (!record(value) || !exact(value, ["authorized", "result"]) || value.authorized !== true) return false;
  const result = value.result;
  if (result === null) return true;
  return record(result) && (result.status === "rejected"
    ? exact(result, ["status", "code", "rosterEntryId"]) && typeof result.code === "string" && isUuid(result.rosterEntryId)
    : exact(result, ["status", "action", "rosterEntryId", "version", "versionId"]) && result.status === "q_pool_saved"
      && ["membership", "allocation"].includes(result.action as string) && isUuid(result.rosterEntryId)
      && positiveInt(result.version) && isUuid(result.versionId));
}
