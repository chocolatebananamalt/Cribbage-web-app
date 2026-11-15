import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const linkIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const secretPattern = /^[A-Za-z0-9_-]{43}$/;

export type RegistrationLinkCredential = {
  linkId: string;
  canonicalToken: string;
  secret: string;
};

/**
 * Generates the 256-bit secret for a one-time director issue response. The
 * caller must display it only as a URL fragment and clear it immediately.
 */
export function createRegistrationLinkCredential(linkId: string): RegistrationLinkCredential {
  const normalizedLinkId = linkId.toLowerCase();
  if (!linkIdPattern.test(normalizedLinkId)) throw new Error("Invalid registration link ID.");
  const secret = randomBytes(32).toString("base64url");
  return {
    linkId: normalizedLinkId,
    secret,
    canonicalToken: `${normalizedLinkId}.${secret}`,
  };
}

/**
 * Parses only the exact fragment format. It intentionally accepts neither a
 * URL, query string, path component, whitespace, nor a legacy token shape.
 */
export function parseRegistrationLinkCredential(value: string): RegistrationLinkCredential | null {
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [rawLinkId, secret] = parts;
  const linkId = rawLinkId.toLowerCase();
  if (!linkIdPattern.test(linkId) || !secretPattern.test(secret)) return null;
  return { linkId, secret, canonicalToken: `${linkId}.${secret}` };
}

/**
 * Derives the fixed-length database value without forwarding the raw fragment
 * credential outside the application server.
 */
export function digestRegistrationLinkCredential(salt: Uint8Array, canonicalToken: string): Uint8Array {
  if (salt.byteLength !== 32) throw new Error("Registration-link salt must be 256 bits.");
  const credential = parseRegistrationLinkCredential(canonicalToken);
  if (!credential || credential.canonicalToken !== canonicalToken) {
    throw new Error("Invalid registration-link credential.");
  }
  return createHash("sha256").update(salt).update(canonicalToken, "utf8").digest();
}

/**
 * Both values are SHA-256 digests, so unequal lengths are never valid. The
 * equal-length path uses Node's constant-time comparison primitive.
 */
export function matchesRegistrationLinkDigest(expected: Uint8Array, actual: Uint8Array): boolean {
  return expected.byteLength === 32
    && actual.byteLength === 32
    && timingSafeEqual(expected, actual);
}
