import "server-only";

import { isUuid } from "./api/validation.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export type RosterAccountActivationCancellation = {
  actorId: string;
  tournamentId: string;
  activationId: string;
  operationId: string;
};

export type RosterAccountActivationCancellationResult =
  | { status: "cancelled"; activationId: string }
  | { status: "rejected" };

function isResult(value: unknown, input: RosterAccountActivationCancellation): value is RosterAccountActivationCancellationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return (Object.keys(result).length === 2 && result.status === "cancelled" && result.activationId === input.activationId && isUuid(result.activationId))
    || (Object.keys(result).length === 1 && result.status === "rejected");
}

/** Cancels only through the private service transaction; the browser never receives the secret key. */
export async function cancelRosterAccountActivation(admin: RpcClient, input: RosterAccountActivationCancellation): Promise<RosterAccountActivationCancellationResult> {
  const { data, error } = await admin.rpc("cancel_roster_account_activation_v1", {
    p_actor_id: input.actorId,
    p_tournament_id: input.tournamentId,
    p_activation_id: input.activationId,
    p_operation_id: input.operationId,
  });
  if (error || !isResult(data, input)) throw new Error("Account activation cancellation is unavailable.");
  return data;
}
