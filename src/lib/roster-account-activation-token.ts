import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const activationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const secretPattern = /^[A-Za-z0-9_-]{43}$/;

export type RosterAccountActivationCredential = {
  activationId: string;
  canonicalToken: string;
  secret: string;
};

/**
 * Creates a 256-bit, fragment-only activation credential. The caller may show
 * it once, but must never persist, log, or put it in a request URL.
 */
export function createRosterAccountActivationCredential(activationId: string): RosterAccountActivationCredential {
  const normalizedId = activationId.toLowerCase();
  if (!activationIdPattern.test(normalizedId)) throw new Error("Invalid activation ID.");
  const secret = randomBytes(32).toString("base64url");
  return { activationId: normalizedId, secret, canonicalToken: `${normalizedId}.${secret}` };
}

/** Accept only the exact ID.secret fragment grammar; URLs and whitespace fail. */
export function parseRosterAccountActivationCredential(value: string): RosterAccountActivationCredential | null {
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const activationId = parts[0].toLowerCase();
  const secret = parts[1];
  if (!activationIdPattern.test(activationId) || !secretPattern.test(secret)) return null;
  return { activationId, secret, canonicalToken: `${activationId}.${secret}` };
}

/** Derive the only fixed-length representation that the database may retain. */
export function digestRosterAccountActivationCredential(salt: Uint8Array, canonicalToken: string): Uint8Array {
  if (salt.byteLength !== 32) throw new Error("Activation salt must be 256 bits.");
  const credential = parseRosterAccountActivationCredential(canonicalToken);
  if (!credential || credential.canonicalToken !== canonicalToken) throw new Error("Invalid activation credential.");
  return createHash("sha256").update(salt).update(canonicalToken, "utf8").digest();
}

export function matchesRosterAccountActivationDigest(expected: Uint8Array, actual: Uint8Array): boolean {
  return expected.byteLength === 32 && actual.byteLength === 32 && timingSafeEqual(expected, actual);
}
