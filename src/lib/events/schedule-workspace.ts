import "server-only";

import { notFound } from "next/navigation";
import { isEventScheduleWorkspace, type EventScheduleWorkspace } from "../api/event-schedule";
import { createServerOnlyAdminClient } from "../supabase/private-admin";

export async function getEventScheduleWorkspace(actorId: string, tournamentId: string): Promise<EventScheduleWorkspace> {
  const { data, error } = await createServerOnlyAdminClient().rpc("get_event_schedule_workspace_v1", {
    p_actor_id: actorId,
    p_tournament_id: tournamentId,
  });
  if (error || !isEventScheduleWorkspace(data)) notFound();
  return data;
}
