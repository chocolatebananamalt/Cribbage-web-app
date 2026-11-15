import "server-only";

import {
  isCrossCheckerAssignmentRejection,
  isCrossCheckerAssignmentResult,
  isCrossCheckerAssignmentWorkspace,
  type CrossCheckerAssignmentResult,
  type CrossCheckerAssignmentWorkspace,
} from "./api/cross-checker-assignment.ts";

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export async function getCrossCheckerAssignmentWorkspace(
  admin: RpcClient,
  actorId: string,
  tournamentId: string,
): Promise<CrossCheckerAssignmentWorkspace | null> {
  const { data, error } = await admin.rpc("get_cross_checker_assignment_workspace_v1", {
    p_actor_id: actorId,
    p_tournament_id: tournamentId,
  });
  if (error) throw new Error("Cross-checker assignment workspace is unavailable.");
  if (data === null) return null;
  if (!isCrossCheckerAssignmentWorkspace(data)) throw new Error("Cross-checker assignment workspace is unavailable.");
  return data;
}

export async function assignCrossChecker(
  admin: RpcClient,
  input: { actorId: string; tournamentId: string; rosterEntryId: string; operationId: string },
): Promise<CrossCheckerAssignmentResult | { status: "rejected"; code: string }> {
  const { data, error } = await admin.rpc("assign_cross_checker_v1", {
    p_actor_id: input.actorId,
    p_tournament_id: input.tournamentId,
    p_roster_entry_id: input.rosterEntryId,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("Cross-checker assignment is unavailable.");
  if (isCrossCheckerAssignmentResult(data, input.tournamentId, input.rosterEntryId)) return data;
  if (isCrossCheckerAssignmentRejection(data)) return data;
  throw new Error("Cross-checker assignment is unavailable.");
}

