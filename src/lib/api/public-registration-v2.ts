import { parseRegistrationLinkCredential } from "../registration-link-token.ts";
import { isUuid } from "./validation";

const methods = ["cash", "check"];
const keys = ["credential", "displayName", "email", "accNumber", "intendedPaymentMethod", "scorecardType", "operationId"];
const own = (value: object) => Object.keys(value).length === keys.length && keys.every((key) => key in value);

export type PublicRegistrationClaim = { credential: string; displayName: string; email: string; accNumber: string; intendedPaymentMethod: "cash" | "check"; scorecardType: "digital" | "paper"; operationId: string };

export function publicRegistrationEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ACC_PUBLIC_REGISTRATION_V2 === "enabled";
}

/**
 * Directors can prepare, replace, or close a fragment-only QR link before a
 * separate public-registration release is approved. It does not make a link
 * claimable; the public claim route still requires ACC_PUBLIC_REGISTRATION_V2.
 */
export function registrationLinkManagementEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ACC_REGISTRATION_LINK_MANAGEMENT_V2 === "enabled";
}

export function isPublicRegistrationClaim(value: unknown): value is PublicRegistrationClaim {
  if (!value || typeof value !== "object" || !own(value)) return false;
  const claim = value as Record<string, unknown>;
  return typeof claim.credential === "string" && !!parseRegistrationLinkCredential(claim.credential)
    && typeof claim.displayName === "string" && claim.displayName.trim().length >= 1 && claim.displayName.length <= 160
    && typeof claim.email === "string" && claim.email.trim().length >= 3 && claim.email.length <= 320
    && typeof claim.accNumber === "string" && claim.accNumber.length <= 64
    && methods.includes(claim.intendedPaymentMethod as string)
    && (claim.scorecardType === "digital" || claim.scorecardType === "paper")
    && isUuid(claim.operationId);
}
