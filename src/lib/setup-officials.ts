import "server-only";
import { isSetupOfficialsWorkspace, type SetupOfficialRole, type SetupOfficialsWorkspace } from "./api/setup-officials";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export async function getSetupOfficialsWorkspace(admin: RpcClient, actorId: string, tournamentId: string, role: SetupOfficialRole): Promise<SetupOfficialsWorkspace | null> {
  const { data, error } = await admin.rpc("get_tournament_setup_officials_v1", { p_actor_id: actorId, p_tournament_id: tournamentId, p_role: role });
  if (error) throw new Error("Tournament official assignments are unavailable.");
  return data === null ? null : isSetupOfficialsWorkspace(data) ? data : (() => { throw new Error("Tournament official assignments are unavailable."); })();
}

export async function nominateSetupOfficial(admin: RpcClient, input: { actorId: string; tournamentId: string; role: SetupOfficialRole; firstName: string; lastName: string; email: string; accNumber: string; secret: string; operationId: string }) {
  const { data, error } = await admin.rpc("nominate_tournament_setup_official_v1", { p_actor_id: input.actorId, p_tournament_id: input.tournamentId, p_role: input.role, p_first_name: input.firstName, p_last_name: input.lastName, p_email: input.email, p_acc_number: input.accNumber, p_secret: input.secret, p_operation_id: input.operationId });
  if (error || !data || typeof data !== "object") throw new Error("Tournament official assignment was not accepted.");
  return data as Record<string, unknown>;
}

export async function manageSetupOfficial(admin: RpcClient, input: { actorId: string; tournamentId: string; nominationId: string; action: "remove" | "restore"; operationId: string }) {
  const { data, error } = await admin.rpc("manage_tournament_setup_official_v1", { p_actor_id: input.actorId, p_tournament_id: input.tournamentId, p_nomination_id: input.nominationId, p_action: input.action, p_operation_id: input.operationId });
  if (error || !data || typeof data !== "object") throw new Error("Tournament official assignment was not changed.");
  return data as Record<string, unknown>;
}

export async function markSetupOfficialInvitationDelivery(admin: RpcClient, input: { actorId: string; tournamentId: string; nominationId: string; operationId: string; delivered: boolean }) {
  const { data, error } = await admin.rpc("record_tournament_setup_official_invitation_delivery_v1", { p_actor_id: input.actorId, p_tournament_id: input.tournamentId, p_nomination_id: input.nominationId, p_operation_id: input.operationId, p_delivered: input.delivered });
  if (error || !data || typeof data !== "object") throw new Error("Official invitation delivery could not be recorded.");
  return data as Record<string, unknown>;
}
