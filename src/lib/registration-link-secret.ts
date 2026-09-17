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

function key(env: Record<string, string | undefined> = process.env) {
  const encoded = env.ACC_REGISTRATION_LINK_REVEAL_KEY?.trim();
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("Registration-link reveal encryption is not configured.");
  const value = Buffer.from(encoded, "base64url");
  if (value.byteLength !== 32) throw new Error("Registration-link reveal encryption is not configured.");
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
