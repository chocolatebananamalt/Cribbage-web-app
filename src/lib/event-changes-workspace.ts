import "server-only";

import { createServerOnlyAdminClient } from "./supabase/private-admin";

export type EventChangesWorkspaceAccess = { tournamentName: string; canManage: boolean };

function isWorkspaceAccess(value: unknown): value is EventChangesWorkspaceAccess {
  return !!value && typeof value === "object"
    && typeof (value as Record<string, unknown>).tournamentName === "string"
    && typeof (value as Record<string, unknown>).canManage === "boolean";
}

export async function getEventChangesWorkspaceAccess(actorId: string, tournamentId: string) {
  const { data, error } = await createServerOnlyAdminClient().rpc("get_event_change_workspace_v1", {
    p_actor_id: actorId,
    p_tournament_id: tournamentId,
  });
  return error || !isWorkspaceAccess(data) ? null : data;
}
