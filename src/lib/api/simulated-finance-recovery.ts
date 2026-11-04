import { isMultiEventSimulationAction } from "./multi-event-simulation-action.ts";
import { isUuid } from "./validation.ts";

export type SimulationRecovery = { actorId: string; tournamentId: string; request: Record<string, unknown> };
/** Keep the complete exact operation scoped to the verified actor and tournament. */
export function isSimulationRecovery(value: unknown, actorId: string, tournamentId: string): value is SimulationRecovery {
  if (!value || typeof value !== "object" || Array.isArray(value) || !isUuid(actorId) || !isUuid(tournamentId)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).sort().join(",") === "actorId,request,tournamentId" && v.actorId === actorId
    && v.tournamentId === tournamentId && isMultiEventSimulationAction(v.request);
}
