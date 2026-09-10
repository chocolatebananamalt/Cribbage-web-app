import { isUuid } from "./validation";

export type RegistrationLinkIssueRequest = {
  expiresAt: string;
  maxClaims: number;
  maxClaimsPerHour: number;
  operationId: string;
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
