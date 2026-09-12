import { isUuid } from "./validation.ts";

type RecordValue = Record<string, unknown>;
function isRecord(value: unknown): value is RecordValue { return !!value && typeof value === "object" && !Array.isArray(value); }
function exact(value: RecordValue, keys: string[]) { return Object.keys(value).length === keys.length && keys.every((key) => key in value); }
const phrase = /^[A-Z]{4}-[A-Z]{4}$/;
const activationMinimumLifetimeMs = 5 * 60 * 1000;
const activationMaximumLifetimeMs = 60 * 60 * 1000;

export type ActivationIssueRequest = { rosterEntryId: string; expiresAt: string; operationId: string };
export type ActivationRedeemRequest = { credential: string; operationId: string };
export type ActivationDecisionRequest = { requestId: string; decision: "approve" | "reject"; confirmationPhrase?: string; operationId: string };
export type ActivationCancelRequest = { activationId: string; operationId: string };
export type ActivationIssueResult = { status: "issued"; credential: string; expiresAt: string };
export type ActivationRedemptionResult = { status: "pending"; activationId: string; requestId: string; confirmationPhrase: string };
export type ActivationDecisionResult = { status: "approved"; requestId: string; rosterEntryId: string; linkId: string };
export type ActivationCancellationResult = { status: "cancelled"; activationId: string };
export type ActivationWorkspace = {
  tournamentName: string;
  rosterEntries: Array<{
    rosterEntryId: string;
    displayName: string;
    activation: null | { activationId: string; state: "issued" | "pending" | "expired"; expiresAt: string };
  }>;
  pendingRequests: Array<{
    requestId: string;
    activationId: string;
    rosterEntryId: string;
    rosterDisplayName: string;
    requestedAt: string;
    expiresAt: string;
    canApprove: boolean;
  }>;
};

const credential = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i;
function timestamp(value: unknown) { return typeof value === "string" && Number.isFinite(new Date(value).valueOf()); }

export function isActivationIssueRequest(value: unknown, now = new Date()): value is ActivationIssueRequest {
  if (!isRecord(value) || !exact(value, ["rosterEntryId", "expiresAt", "operationId"])) return false;
  const date = typeof value.expiresAt === "string" ? new Date(value.expiresAt) : null;
  const lifetimeMs = date ? date.valueOf() - now.valueOf() : Number.NaN;
  return isUuid(value.rosterEntryId) && isUuid(value.operationId) && !!date && Number.isFinite(date.valueOf())
    && date.toISOString() === value.expiresAt
    && lifetimeMs > activationMinimumLifetimeMs && lifetimeMs <= activationMaximumLifetimeMs;
}

export function isActivationRedeemRequest(value: unknown): value is ActivationRedeemRequest {
  return isRecord(value) && exact(value, ["credential", "operationId"])
    && typeof value.credential === "string" && value.credential.length >= 1 && value.credential.length <= 512
    && isUuid(value.operationId);
}

export function isActivationDecisionRequest(value: unknown): value is ActivationDecisionRequest {
  if (!isRecord(value) || !isUuid(value.requestId) || !isUuid(value.operationId)) return false;
  if (value.decision === "approve") return exact(value, ["requestId", "decision", "confirmationPhrase", "operationId"]) && typeof value.confirmationPhrase === "string" && phrase.test(value.confirmationPhrase);
  return value.decision === "reject" && exact(value, ["requestId", "decision", "operationId"]);
}

export function isActivationCancelRequest(value: unknown): value is ActivationCancelRequest {
  return isRecord(value) && exact(value, ["activationId", "operationId"]) && isUuid(value.activationId) && isUuid(value.operationId);
}

export function isActivationIssueResult(value: unknown): value is ActivationIssueResult {
  return isRecord(value) && exact(value, ["status", "credential", "expiresAt"])
    && value.status === "issued" && typeof value.credential === "string" && credential.test(value.credential)
    && timestamp(value.expiresAt);
}

export function isActivationRedemptionResult(value: unknown): value is ActivationRedemptionResult {
  return isRecord(value) && exact(value, ["status", "activationId", "requestId", "confirmationPhrase"])
    && value.status === "pending" && isUuid(value.activationId) && isUuid(value.requestId)
    && typeof value.confirmationPhrase === "string" && phrase.test(value.confirmationPhrase);
}

export function isActivationDecisionResult(value: unknown, requestId: string): value is ActivationDecisionResult {
  return isRecord(value) && exact(value, ["status", "requestId", "rosterEntryId", "linkId"])
    && value.status === "approved" && value.requestId === requestId
    && isUuid(value.rosterEntryId) && isUuid(value.linkId);
}

export function isActivationCancellationResult(value: unknown, activationId: string): value is ActivationCancellationResult {
  return isRecord(value) && exact(value, ["status", "activationId"])
    && value.status === "cancelled" && value.activationId === activationId;
}

export function isActivationWorkspace(value: unknown): value is ActivationWorkspace {
  if (!isRecord(value) || !exact(value, ["tournamentName", "rosterEntries", "pendingRequests"])
      || typeof value.tournamentName !== "string" || !value.tournamentName.trim()
      || !Array.isArray(value.rosterEntries) || !Array.isArray(value.pendingRequests)) return false;
  const rosterEntries = value.rosterEntries;
  const pendingRequests = value.pendingRequests;
  if (!rosterEntries.every((item) => {
    if (!isRecord(item) || !exact(item, ["rosterEntryId", "displayName", "activation"])
        || !isUuid(item.rosterEntryId) || typeof item.displayName !== "string" || !item.displayName.trim()) return false;
    return item.activation === null || (isRecord(item.activation)
      && exact(item.activation, ["activationId", "state", "expiresAt"])
      && isUuid(item.activation.activationId) && ["issued", "pending", "expired"].includes(item.activation.state as string)
      && timestamp(item.activation.expiresAt));
  })) return false;
  if (!pendingRequests.every((item) => isRecord(item)
      && exact(item, ["requestId", "activationId", "rosterEntryId", "rosterDisplayName", "requestedAt", "expiresAt", "canApprove"])
      && isUuid(item.requestId) && isUuid(item.activationId) && isUuid(item.rosterEntryId)
      && typeof item.rosterDisplayName === "string" && !!item.rosterDisplayName.trim()
      && timestamp(item.requestedAt) && timestamp(item.expiresAt) && typeof item.canApprove === "boolean")) return false;
  if (new Set(rosterEntries.map((item) => item.rosterEntryId)).size !== rosterEntries.length
      || new Set(pendingRequests.map((item) => item.requestId)).size !== pendingRequests.length) return false;
  return pendingRequests.every((request) => rosterEntries.some((entry) => entry.rosterEntryId === request.rosterEntryId
    && entry.activation?.activationId === request.activationId && entry.activation.state === "pending"));
}
