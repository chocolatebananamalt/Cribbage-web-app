import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { createRegistrationLinkCredential, digestRegistrationLinkCredential, type RegistrationLinkCredential } from "./registration-link-token.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export type RegistrationLinkIssue = {
  actorId: string;
  tournamentId: string;
  expiresAt: Date;
  maxClaims: number;
  maxClaimsPerHour: number;
  operationId: string;
};

export type IssuedRegistrationLink = {
  status: "issued";
  credential: RegistrationLinkCredential;
  expiresAt: string;
};

export type RejectedRegistrationLinkIssue = {
  status: "rejected";
  code: "active_link_exists" | "idempotency_conflict";
};

export type AmbiguousRegistrationLinkIssue = {
  status: "credential_unavailable";
};

export type RegistrationLinkIssueResult = IssuedRegistrationLink | RejectedRegistrationLinkIssue | AmbiguousRegistrationLinkIssue;

export type RegistrationLinkRotation = RegistrationLinkIssue & {
  expectedLinkId: string;
  expectedVersion: number;
};

export type RotatedRegistrationLink = {
  status: "rotated";
  credential: RegistrationLinkCredential;
  expiresAt: string;
  version: number;
};

export type RejectedRegistrationLinkRotation = {
  status: "rejected";
  code: "link_unavailable" | "idempotency_conflict";
};

export type RegistrationLinkRotationResult = RotatedRegistrationLink | RejectedRegistrationLinkRotation | AmbiguousRegistrationLinkIssue;

function bytea(value: Uint8Array) {
  return `\\x${Buffer.from(value).toString("hex")}`;
}

function isExactInstant(value: unknown, expected: Date): boolean {
  return typeof value === "string" && Number.isFinite(new Date(value).valueOf()) && new Date(value).valueOf() === expected.valueOf();
}

function isIssuedResponse(value: unknown, linkId: string, expiresAt: Date): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 4
    && record.status === "issued"
    && record.state === "open"
    && record.linkId === linkId
    && isExactInstant(record.expiresAt, expiresAt);
}

function isPriorIssuedResponse(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 4
    && record.status === "issued"
    && record.state === "open"
    && typeof record.linkId === "string"
    && typeof record.expiresAt === "string";
}

function isRejectedResponse(value: unknown): value is { status: "rejected"; code: "active_link_exists" | "idempotency_conflict" } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 2
    && record.status === "rejected"
    && (record.code === "active_link_exists" || record.code === "idempotency_conflict");
}

function isRotatedResponse(value: unknown, linkId: string, expiresAt: Date, expectedVersion: number): value is { status: "rotated"; linkId: string; state: "open"; expiresAt: string; version: number } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 5
    && record.status === "rotated"
    && record.state === "open"
    && record.linkId === linkId
    && isExactInstant(record.expiresAt, expiresAt)
    && record.version === expectedVersion + 1;
}

function isPriorRotatedResponse(value: unknown): value is { status: "rotated"; linkId: string; state: "open"; expiresAt: string; version: number } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 5
    && record.status === "rotated"
    && record.state === "open"
    && typeof record.linkId === "string"
    && typeof record.expiresAt === "string"
    && Number.isSafeInteger(record.version) && (record.version as number) > 0;
}

function isRejectedRotationResponse(value: unknown): value is RejectedRegistrationLinkRotation {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 2
    && record.status === "rejected"
    && (record.code === "link_unavailable" || record.code === "idempotency_conflict");
}

/**
 * Creates the only director-displayable credential after the server has
 * received an exact private receipt. Raw credentials never enter a database
 * RPC; the database receives only fixed-length PostgreSQL bytea values.
 */
export async function issueRegistrationLink(
  admin: RpcClient,
  input: RegistrationLinkIssue,
): Promise<RegistrationLinkIssueResult> {
  const credential = createRegistrationLinkCredential(randomUUID());
  const salt = randomBytes(32);
  const digest = digestRegistrationLinkCredential(salt, credential.canonicalToken);
  const expiresAt = input.expiresAt.toISOString();
  const { data, error } = await admin.rpc("issue_registration_link_v2", {
    p_actor_id: input.actorId,
    p_tournament_id: input.tournamentId,
    p_link_id: credential.linkId,
    p_salt: bytea(salt),
    p_digest: bytea(digest),
    p_expires_at: expiresAt,
    p_max_claims: input.maxClaims,
    p_max_claims_per_hour: input.maxClaimsPerHour,
    p_operation_id: input.operationId,
  });
  if (error) {
    throw new Error("Registration link issuance is unavailable.");
  }
  if (isIssuedResponse(data, credential.linkId, input.expiresAt)) return { status: "issued", credential, expiresAt };
  if (isRejectedResponse(data)) return data;
  // A prior accepted operation can be replayed by PostgreSQL. Its original
  // bearer credential cannot be reconstructed safely, so never return or
  // regenerate one from a later request.
  if (isPriorIssuedResponse(data)) return { status: "credential_unavailable" };
  throw new Error("Registration link issuance is unavailable.");
}

/**
 * Replaces only the exact head/version a director read. The raw replacement
 * credential is returned once, after an exact new receipt; a retry never
 * reconstructs a prior credential.
 */
export async function rotateRegistrationLink(
  admin: RpcClient,
  input: RegistrationLinkRotation,
): Promise<RegistrationLinkRotationResult> {
  const credential = createRegistrationLinkCredential(randomUUID());
  const salt = randomBytes(32);
  const digest = digestRegistrationLinkCredential(salt, credential.canonicalToken);
  const expiresAt = input.expiresAt.toISOString();
  const { data, error } = await admin.rpc("rotate_registration_link_v2", {
    p_actor_id: input.actorId,
    p_tournament_id: input.tournamentId,
    p_expected_link_id: input.expectedLinkId,
    p_expected_version: input.expectedVersion,
    p_link_id: credential.linkId,
    p_salt: bytea(salt),
    p_digest: bytea(digest),
    p_expires_at: expiresAt,
    p_max_claims: input.maxClaims,
    p_max_claims_per_hour: input.maxClaimsPerHour,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("Registration link rotation is unavailable.");
  if (isRotatedResponse(data, credential.linkId, input.expiresAt, input.expectedVersion)) {
    return { status: "rotated", credential, expiresAt, version: data.version };
  }
  if (isRejectedRotationResponse(data)) return data;
  if (isPriorRotatedResponse(data) && data.linkId !== credential.linkId) return { status: "credential_unavailable" };
  throw new Error("Registration link rotation is unavailable.");
}
