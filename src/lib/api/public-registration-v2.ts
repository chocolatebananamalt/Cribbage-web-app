import { parseRegistrationLinkCredential } from "../registration-link-token.ts";
import { isUuid } from "./validation.ts";
import { isOptionalAccNumber } from "../acc-number.ts";

const methods = ["cash", "check"];
const keys = ["credential", "firstName", "lastName", "email", "accNumber", "intendedPaymentMethod", "scorecardType", "operationId"];
const own = (value: object) => Object.keys(value).length === keys.length && keys.every((key) => key in value);

export type PublicRegistrationClaim = { credential: string; firstName: string; lastName: string; email: string; accNumber: string; intendedPaymentMethod: "cash" | "check"; scorecardType: "digital" | "paper"; operationId: string };

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
    && typeof claim.firstName === "string" && claim.firstName.trim().length >= 1 && claim.firstName.length <= 80
    && typeof claim.lastName === "string" && claim.lastName.trim().length >= 1 && claim.lastName.length <= 80
    && claim.firstName.trim().length + claim.lastName.trim().length + 1 <= 160
    && typeof claim.email === "string" && claim.email.trim().length >= 3 && claim.email.length <= 320
    && typeof claim.accNumber === "string" && claim.accNumber.length <= 64 && isOptionalAccNumber(claim.accNumber)
    && methods.includes(claim.intendedPaymentMethod as string)
    && (claim.scorecardType === "digital" || claim.scorecardType === "paper")
    && isUuid(claim.operationId);
}
