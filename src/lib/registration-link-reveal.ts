import "server-only";

import { openRegistrationLinkCredential } from "./registration-link-secret.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export type RegistrationLinkRevealInput = {
  actorId: string;
  tournamentId: string;
  expectedLinkId: string;
  expectedVersion: number;
  operationId: string;
};

export type RegistrationLinkRevealResult =
  | { status: "revealable"; credential: string }
  | { status: "legacy_unrecoverable" }
  | { status: "rejected" };

export type RegistrationLinkRevealAvailability = "recoverable" | "legacy_unrecoverable" | "rejected";

function revealable(value: unknown): value is { status: "revealable"; linkId: string; version: number; nonce: string; ciphertext: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 5 && item.status === "revealable"
    && typeof item.linkId === "string" && Number.isSafeInteger(item.version)
    && typeof item.nonce === "string" && typeof item.ciphertext === "string";
}

function legacy(value: unknown): value is { status: "legacy_unrecoverable"; linkId: string; version: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 3 && item.status === "legacy_unrecoverable"
    && typeof item.linkId === "string" && Number.isSafeInteger(item.version);
}

export async function revealRegistrationLink(
  admin: RpcClient,
  input: RegistrationLinkRevealInput,
  env: Record<string, string | undefined> = process.env,
): Promise<RegistrationLinkRevealResult> {
  const { data, error } = await admin.rpc("reveal_registration_link_v1", {
    p_actor_id: input.actorId,
    p_tournament_id: input.tournamentId,
    p_expected_link_id: input.expectedLinkId,
    p_expected_version: input.expectedVersion,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("Registration-link reveal is unavailable.");
  if (legacy(data) && data.linkId === input.expectedLinkId && data.version === input.expectedVersion) return { status: "legacy_unrecoverable" };
  if (revealable(data) && data.linkId === input.expectedLinkId && data.version === input.expectedVersion) {
    return { status: "revealable", credential: openRegistrationLinkCredential(input.tournamentId, data.linkId, data, env) };
  }
  return { status: "rejected" };
}

export async function getRegistrationLinkRevealAvailability(
  admin: RpcClient,
  input: Omit<RegistrationLinkRevealInput, "operationId">,
): Promise<RegistrationLinkRevealAvailability> {
  const { data, error } = await admin.rpc("get_registration_link_reveal_availability_v1", {
    p_actor_id: input.actorId,
    p_tournament_id: input.tournamentId,
    p_expected_link_id: input.expectedLinkId,
    p_expected_version: input.expectedVersion,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return "rejected";
  const result = data as Record<string, unknown>;
  if (Object.keys(result).length !== 1 || typeof result.status !== "string") return "rejected";
  return result.status === "recoverable" || result.status === "legacy_unrecoverable" ? result.status : "rejected";
}
