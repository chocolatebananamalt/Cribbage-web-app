import { isUuid } from "./validation.ts";

export const registrationLinkRequestBodyLimit = 2048;

export async function readRegistrationLinkJson(request: Request): Promise<unknown | null> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const contentLength = request.headers.get("content-length");
  if (!contentType.startsWith("application/json")
    || (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > registrationLinkRequestBodyLimit))) {
    return null;
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > registrationLinkRequestBodyLimit) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}

export type RegistrationLinkIssueRequest = {
  expiresAt: string;
  maxClaims: number;
  maxClaimsPerHour: number;
  operationId: string;
};

export type RegistrationLinkRotateRequest = RegistrationLinkIssueRequest & {
  expectedLinkId: string;
  expectedVersion: number;
};

export type RegistrationLinkCloseRequest = {
  expectedLinkId: string;
  expectedVersion: number;
  operationId: string;
};

export type RegistrationLinkState =
  | { status: "none" }
  | {
    status: "open" | "closed" | "expired";
    linkId: string;
    issuedAt: string;
    expiresAt: string;
    maxClaims: number;
    maxClaimsPerHour: number;
    version: number;
  };

function own(value: object, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function isCanonicalInstant(value: unknown) {
  if (typeof value !== "string") return false;
  const instant = new Date(value);
  return Number.isFinite(instant.valueOf()) && instant.toISOString() === value;
}

function isExpectedLink(value: Record<string, unknown>) {
  return isUuid(value.expectedLinkId)
    && Number.isSafeInteger(value.expectedVersion) && (value.expectedVersion as number) > 0;
}

export function isRegistrationLinkIssueRequest(value: unknown): value is RegistrationLinkIssueRequest {
  if (!value || typeof value !== "object" || !own(value, ["expiresAt", "maxClaims", "maxClaimsPerHour", "operationId"])) return false;
  const request = value as Record<string, unknown>;
  return isCanonicalInstant(request.expiresAt)
    && Number.isSafeInteger(request.maxClaims) && (request.maxClaims as number) >= 1 && (request.maxClaims as number) <= 2000
    && Number.isSafeInteger(request.maxClaimsPerHour) && (request.maxClaimsPerHour as number) >= 1 && (request.maxClaimsPerHour as number) <= 1000
    && isUuid(request.operationId);
}

export function isRegistrationLinkRotateRequest(value: unknown): value is RegistrationLinkRotateRequest {
  if (!value || typeof value !== "object" || !own(value, ["expectedLinkId", "expectedVersion", "expiresAt", "maxClaims", "maxClaimsPerHour", "operationId"])) return false;
  const request = value as Record<string, unknown>;
  return isExpectedLink(request) && isRegistrationLinkIssueRequest({
    expiresAt: request.expiresAt,
    maxClaims: request.maxClaims,
    maxClaimsPerHour: request.maxClaimsPerHour,
    operationId: request.operationId,
  });
}

export function isRegistrationLinkCloseRequest(value: unknown): value is RegistrationLinkCloseRequest {
  if (!value || typeof value !== "object" || !own(value, ["expectedLinkId", "expectedVersion", "operationId"])) return false;
  const request = value as Record<string, unknown>;
  return isExpectedLink(request) && isUuid(request.operationId);
}

export function isRegistrationLinkState(value: unknown): value is RegistrationLinkState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  if (state.status === "none") return own(state, ["status"]);
  return own(state, ["status", "linkId", "issuedAt", "expiresAt", "maxClaims", "maxClaimsPerHour", "version"])
    && (state.status === "open" || state.status === "closed" || state.status === "expired")
    && isUuid(state.linkId)
    && typeof state.issuedAt === "string" && Number.isFinite(new Date(state.issuedAt).valueOf())
    && typeof state.expiresAt === "string" && Number.isFinite(new Date(state.expiresAt).valueOf())
    && Number.isSafeInteger(state.maxClaims) && (state.maxClaims as number) >= 1 && (state.maxClaims as number) <= 2000
    && Number.isSafeInteger(state.maxClaimsPerHour) && (state.maxClaimsPerHour as number) >= 1 && (state.maxClaimsPerHour as number) <= 1000
    && Number.isSafeInteger(state.version) && (state.version as number) > 0;
}
