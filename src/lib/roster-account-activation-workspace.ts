import "server-only";

import { isActivationWorkspace, type ActivationWorkspace } from "./api/roster-account-activation.ts";

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export async function getRosterAccountActivationWorkspace(
  admin: RpcClient,
  actorId: string,
  tournamentId: string,
): Promise<ActivationWorkspace | null> {
  const { data, error } = await admin.rpc("get_roster_account_activation_workspace_v1", {
    p_actor_id: actorId,
    p_tournament_id: tournamentId,
  });
  if (error) throw new Error("Account activation workspace is unavailable.");
  if (data === null) return null;
  if (!isActivationWorkspace(data)) throw new Error("Account activation workspace is unavailable.");
  return data;
}
