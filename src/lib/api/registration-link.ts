import { isUuid } from "./validation";

export type RegistrationLinkIssueRequest = {
  expiresAt: string;
  maxClaims: number;
  maxClaimsPerHour: number;
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

export function isRegistrationLinkIssueRequest(value: unknown): value is RegistrationLinkIssueRequest {
  if (!value || typeof value !== "object" || !own(value, ["expiresAt", "maxClaims", "maxClaimsPerHour", "operationId"])) return false;
  const request = value as Record<string, unknown>;
  const date = typeof request.expiresAt === "string" ? new Date(request.expiresAt) : null;
  return !!date && Number.isFinite(date.valueOf())
    && Number.isSafeInteger(request.maxClaims) && (request.maxClaims as number) >= 1 && (request.maxClaims as number) <= 2000
    && Number.isSafeInteger(request.maxClaimsPerHour) && (request.maxClaimsPerHour as number) >= 1 && (request.maxClaimsPerHour as number) <= 1000
    && isUuid(request.operationId);
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
