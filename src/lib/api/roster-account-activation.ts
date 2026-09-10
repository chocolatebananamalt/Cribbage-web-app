import { isUuid } from "./validation.ts";

type RecordValue = Record<string, unknown>;
function isRecord(value: unknown): value is RecordValue { return !!value && typeof value === "object" && !Array.isArray(value); }
function exact(value: RecordValue, keys: string[]) { return Object.keys(value).length === keys.length && keys.every((key) => key in value); }
const phrase = /^[A-Z]{4}-[A-Z]{4}$/;

export type ActivationIssueRequest = { rosterEntryId: string; expiresAt: string; operationId: string };
export type ActivationDecisionRequest = { requestId: string; decision: "approve" | "reject"; confirmationPhrase?: string; operationId: string };
export type ActivationCancelRequest = { activationId: string; operationId: string };

export function isActivationIssueRequest(value: unknown): value is ActivationIssueRequest {
  if (!isRecord(value) || !exact(value, ["rosterEntryId", "expiresAt", "operationId"])) return false;
  const date = typeof value.expiresAt === "string" ? new Date(value.expiresAt) : null;
  return isUuid(value.rosterEntryId) && isUuid(value.operationId) && !!date && Number.isFinite(date.valueOf()) && date.toISOString() === value.expiresAt;
}

export function isActivationDecisionRequest(value: unknown): value is ActivationDecisionRequest {
  if (!isRecord(value) || !isUuid(value.requestId) || !isUuid(value.operationId)) return false;
  if (value.decision === "approve") return exact(value, ["requestId", "decision", "confirmationPhrase", "operationId"]) && typeof value.confirmationPhrase === "string" && phrase.test(value.confirmationPhrase);
  return value.decision === "reject" && exact(value, ["requestId", "decision", "operationId"]);
}

export function isActivationCancelRequest(value: unknown): value is ActivationCancelRequest {
  return isRecord(value) && exact(value, ["activationId", "operationId"]) && isUuid(value.activationId) && isUuid(value.operationId);
}
