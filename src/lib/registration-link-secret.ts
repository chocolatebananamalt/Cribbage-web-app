import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { parseRegistrationLinkCredential } from "./registration-link-token.ts";

const algorithm = "aes-256-gcm";
const nonceBytes = 12;
const tagBytes = 16;
const aadPrefix = "acc-registration-link-reveal-v1";

export type RegistrationLinkSecretEnvelope = {
  nonce: string;
  ciphertext: string;
};

// The operator types this value into a hosting dashboard once, so accept any
// ordinary encoding of 32 bytes rather than base64url alone. Requiring base64url
// silently rejected the output of `openssl rand -base64 32`, which is padded and
// uses + and /, and the only symptom was Create Link returning 503 with the
// reason swallowed by the failure boundary. The strength requirement is
// unchanged: exactly 32 bytes, or this throws.
//
// Nothing here may reach a log, an error message or a response. Every branch
// throws the same sentence and never includes the value or its length.
function decodeRevealKey(encoded: string) {
  const candidates: Buffer[] = [];
  if (/^[0-9a-fA-F]{64}$/.test(encoded)) candidates.push(Buffer.from(encoded, "hex"));
  if (/^[A-Za-z0-9_-]+={0,2}$/.test(encoded)) candidates.push(Buffer.from(encoded, "base64url"));
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) candidates.push(Buffer.from(encoded, "base64"));
  return candidates.find((candidate) => candidate.byteLength === 32);
}

function key(env: Record<string, string | undefined> = process.env) {
  const encoded = env.ACC_REGISTRATION_LINK_REVEAL_KEY?.trim();
  if (!encoded) throw new Error("Registration-link reveal encryption is not configured.");
  const value = decodeRevealKey(encoded);
  if (!value) throw new Error("Registration-link reveal encryption is not configured.");
  return value;
}

function aad(tournamentId: string, linkId: string) {
  return Buffer.from(`${aadPrefix}:${tournamentId}:${linkId}`, "utf8");
}

function decode(value: string, minimum: number, maximum: number) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Registration-link reveal envelope is unavailable.");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.byteLength < minimum || bytes.byteLength > maximum) throw new Error("Registration-link reveal envelope is unavailable.");
  return bytes;
}

export function sealRegistrationLinkCredential(
  tournamentId: string,
  canonicalToken: string,
  env: Record<string, string | undefined> = process.env,
): RegistrationLinkSecretEnvelope {
  const credential = parseRegistrationLinkCredential(canonicalToken);
  if (!credential) throw new Error("Registration-link credential is invalid.");
  const nonce = randomBytes(nonceBytes);
  const cipher = createCipheriv(algorithm, key(env), nonce);
  cipher.setAAD(aad(tournamentId, credential.linkId));
  const ciphertext = Buffer.concat([cipher.update(canonicalToken, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { nonce: nonce.toString("base64url"), ciphertext: ciphertext.toString("base64url") };
}

export function openRegistrationLinkCredential(
  tournamentId: string,
  linkId: string,
  envelope: RegistrationLinkSecretEnvelope,
  env: Record<string, string | undefined> = process.env,
) {
  const nonce = decode(envelope.nonce, nonceBytes, nonceBytes);
  const ciphertextWithTag = decode(envelope.ciphertext, tagBytes + 1, 1024);
  const ciphertext = ciphertextWithTag.subarray(0, -tagBytes);
  const tag = ciphertextWithTag.subarray(-tagBytes);
  const decipher = createDecipheriv(algorithm, key(env), nonce);
  decipher.setAAD(aad(tournamentId, linkId));
  decipher.setAuthTag(tag);
  const token = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  const credential = parseRegistrationLinkCredential(token);
  if (!credential || credential.linkId !== linkId) throw new Error("Registration-link reveal envelope is unavailable.");
  return credential.canonicalToken;
}

/**
 * Whether the reveal key is present and usable, without decoding, logging or
 * returning any part of the value. Used so the registration link screen can name
 * the missing configuration instead of showing a blank failure: Create Link
 * returned 503 with the reason swallowed by the API failure boundary, and the
 * director had no way to tell a misconfigured server from a broken feature.
 */
export function registrationLinkRevealKeyConfigured(env: Record<string, string | undefined> = process.env) {
  try {
    key(env);
    return true;
  } catch {
    return false;
  }
}
