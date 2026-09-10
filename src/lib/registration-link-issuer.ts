import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { createRegistrationLinkCredential, digestRegistrationLinkCredential, type RegistrationLinkCredential } from "./registration-link-token.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
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
  credential: RegistrationLinkCredential;
  expiresAt: string;
};

function bytea(value: Uint8Array) {
  return `\\x${Buffer.from(value).toString("hex")}`;
}

function isIssuedResponse(value: unknown, linkId: string, expiresAt: string): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 4
    && record.status === "issued"
    && record.state === "open"
    && record.linkId === linkId
    && record.expiresAt === expiresAt;
}

/**
 * Creates the only director-displayable credential after the server has
 * received an exact private receipt. Raw credentials never enter a database
 * RPC; the database receives only fixed-length PostgreSQL bytea values.
 */
export async function issueRegistrationLink(
  admin: RpcClient,
  input: RegistrationLinkIssue,
): Promise<IssuedRegistrationLink> {
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
  if (error || !isIssuedResponse(data, credential.linkId, expiresAt)) {
    throw new Error("Registration link issuance is unavailable.");
  }
  return { credential, expiresAt };
}
