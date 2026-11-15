import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import {
  createRosterAccountActivationCredential,
  digestRosterAccountActivationCredential,
  type RosterAccountActivationCredential,
} from "./roster-account-activation-token.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export type RosterAccountActivationIssue = {
  actorId: string;
  tournamentId: string;
  rosterEntryId: string;
  expiresAt: Date;
  operationId: string;
};

export type RosterAccountActivationIssueResult =
  | { status: "issued"; credential: RosterAccountActivationCredential; expiresAt: string }
  | { status: "rejected"; code: "activation_unavailable" | "idempotency_conflict" }
  | { status: "credential_unavailable" };

function bytea(value: Uint8Array) { return `\\x${Buffer.from(value).toString("hex")}`; }

function isExactInstant(value: unknown, expected: Date) {
  return typeof value === "string" && Number.isFinite(new Date(value).valueOf()) && new Date(value).valueOf() === expected.valueOf();
}

function isIssued(value: unknown, activationId: string, input: RosterAccountActivationIssue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return Object.keys(result).length === 5
    && result.status === "issued" && result.activationId === activationId
    && result.rosterEntryId === input.rosterEntryId && result.tournamentId === input.tournamentId
    && isExactInstant(result.expiresAt, input.expiresAt);
}

function isPriorIssued(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return Object.keys(result).length === 5 && result.status === "issued"
    && typeof result.activationId === "string" && typeof result.rosterEntryId === "string"
    && typeof result.tournamentId === "string" && typeof result.expiresAt === "string";
}

function isRejected(value: unknown): value is { status: "rejected"; code: "activation_unavailable" | "idempotency_conflict" } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return Object.keys(result).length === 2 && result.status === "rejected"
    && (result.code === "activation_unavailable" || result.code === "idempotency_conflict");
}

/**
 * Issues a raw credential only after an exact server-only database receipt.
 * A retried operation never reconstructs a bearer credential.
 */
export async function issueRosterAccountActivation(admin: RpcClient, input: RosterAccountActivationIssue): Promise<RosterAccountActivationIssueResult> {
  const credential = createRosterAccountActivationCredential(randomUUID());
  const salt = randomBytes(32);
  const digest = digestRosterAccountActivationCredential(salt, credential.canonicalToken);
  const { data, error } = await admin.rpc("issue_roster_account_activation_v1", {
    p_actor_id: input.actorId,
    p_tournament_id: input.tournamentId,
    p_roster_entry_id: input.rosterEntryId,
    p_activation_id: credential.activationId,
    p_salt: bytea(salt),
    p_digest: bytea(digest),
    p_expires_at: input.expiresAt.toISOString(),
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("Account activation issuance is unavailable.");
  if (isIssued(data, credential.activationId, input)) return { status: "issued", credential, expiresAt: input.expiresAt.toISOString() };
  if (isRejected(data)) return data;
  if (isPriorIssued(data)) return { status: "credential_unavailable" };
  throw new Error("Account activation issuance is unavailable.");
}
