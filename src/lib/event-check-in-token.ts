import "server-only";

import { createHash, randomBytes } from "node:crypto";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const secretPattern = /^[A-Za-z0-9_-]{43}$/;

export type EventCheckInCredential = { credentialId: string; secret: string; canonicalToken: string };

export function createEventCheckInCredential(credentialId: string): EventCheckInCredential {
  const normalizedId = credentialId.toLowerCase();
  if (!idPattern.test(normalizedId)) throw new Error("Invalid event check-in credential ID.");
  const secret = randomBytes(32).toString("base64url");
  return { credentialId: normalizedId, secret, canonicalToken: `${normalizedId}.${secret}` };
}

export function parseEventCheckInCredential(value: string): EventCheckInCredential | null {
  const [rawId, secret, extra] = value.split(".");
  const credentialId = rawId?.toLowerCase();
  if (extra !== undefined || !credentialId || !idPattern.test(credentialId) || !secret || !secretPattern.test(secret)) return null;
  return { credentialId, secret, canonicalToken: `${credentialId}.${secret}` };
}

export function digestEventCheckInCredential(salt: Uint8Array, canonicalToken: string): Uint8Array {
  if (salt.byteLength !== 32 || !parseEventCheckInCredential(canonicalToken)) throw new Error("Invalid event check-in credential.");
  return createHash("sha256").update(salt).update(canonicalToken, "utf8").digest();
}
