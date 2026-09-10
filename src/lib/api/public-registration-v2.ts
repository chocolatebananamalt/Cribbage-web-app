import { parseRegistrationLinkCredential } from "../registration-link-token.ts";
import { isUuid } from "./validation";

const methods = ["cash", "check", "other", "unspecified"];
const keys = ["credential", "displayName", "email", "accNumber", "intendedPaymentMethod", "operationId"];
const own = (value: object) => Object.keys(value).length === keys.length && keys.every((key) => key in value);

export type PublicRegistrationClaim = { credential: string; displayName: string; email: string; accNumber: string; intendedPaymentMethod: "cash" | "check" | "other" | "unspecified"; operationId: string };

export function publicRegistrationEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ACC_PUBLIC_REGISTRATION_V2 === "enabled";
}

export function isPublicRegistrationClaim(value: unknown): value is PublicRegistrationClaim {
  if (!value || typeof value !== "object" || !own(value)) return false;
  const claim = value as Record<string, unknown>;
  return typeof claim.credential === "string" && !!parseRegistrationLinkCredential(claim.credential)
    && typeof claim.displayName === "string" && claim.displayName.trim().length >= 1 && claim.displayName.length <= 160
    && typeof claim.email === "string" && claim.email.trim().length >= 3 && claim.email.length <= 320
    && typeof claim.accNumber === "string" && claim.accNumber.length <= 64
    && methods.includes(claim.intendedPaymentMethod as string) && isUuid(claim.operationId);
}
