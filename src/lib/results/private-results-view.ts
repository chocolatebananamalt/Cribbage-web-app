import "server-only";
import { isUuid } from "../api/validation.ts";
import { projectPlayerPlayoff } from "./player-playoff-display.ts";
import type { ExistingBracketProjection, ExistingPlayoffMode } from "./player-playoff-read-model.ts";
import { isRunningPoolWorkspace, type RunningPoolWorkspace } from "./pool-running-summary.ts";

type Access = { actorId: string; roles: string[] };
type Scope = { tournamentId: string; eventId: string; mode: ExistingPlayoffMode; audience: "existing-official" | "player" | "public" };
type Bracket = Extract<ExistingBracketProjection, { status: "available" }>;
type VisibleBracket = { status: "available"; display: Bracket["display"]; origin: Bracket["origin"]; notice: string; sourceObservation: "matching-double-read-not-atomic"; independentPlayEstablished: false };
type Unavailable = { status: "unavailable"; code: "source_unavailable" };
export type PrivateResultsView = { status: "blocked"; code: "invalid_scope" | "audience_not_authorized" | "existing_read_permission_required" } | {
  status: "available"; kind: "private-results-view-v1"; tournamentId: string; eventId: string;
  bracket: VisibleBracket | Unavailable; pools: { status: "available"; workspace: RunningPoolWorkspace } | Unavailable;
  sourceObservation: "independent-section-reads-not-atomic"; publicAccessGranted: false; playerAccessGranted: false;
};
export type PrivateResultsDependencies = {
  access: (tournamentId: string) => Promise<Access | null>;
  bracket: (tournamentId: string, eventId: string, mode: ExistingPlayoffMode) => Promise<ExistingBracketProjection>;
  pools: (tournamentId: string, eventId: string) => Promise<RunningPoolWorkspace | null>;
};
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
const permitted = (a: Access | null): a is Access => !!a && uuid(a.actorId) && Array.isArray(a.roles) && a.roles.some(r => r === "director" || r === "co_director");
const unavailable = (): Unavailable => ({ status: "unavailable", code: "source_unavailable" });

/** Private composition only. Player/public audiences are deliberately denied before any read.
 * Do not mount this function on a player route or treat aggregate fields as an access grant. */
export function createPrivateResultsView(deps: PrivateResultsDependencies) {
  return async (scope: Scope): Promise<PrivateResultsView> => {
    if (!scope || ![scope.tournamentId, scope.eventId].every(uuid) || !["main-v3", "main-v4", "consolation-v1"].includes(scope.mode)) return { status: "blocked", code: "invalid_scope" };
    if (scope.audience !== "existing-official") return { status: "blocked", code: "audience_not_authorized" };
    try {
      const access = await deps.access(scope.tournamentId);
      if (!permitted(access)) return { status: "blocked", code: "existing_read_permission_required" };
      const [b, p] = await Promise.allSettled([
        deps.bracket(scope.tournamentId, scope.eventId, scope.mode), deps.pools(scope.tournamentId, scope.eventId),
      ]);
      const current = await deps.access(scope.tournamentId);
      if (!permitted(current) || current.actorId !== access.actorId) return { status: "blocked", code: "existing_read_permission_required" };
      let bracket: VisibleBracket | Unavailable = unavailable();
      if (b.status === "fulfilled" && b.value?.status === "available") {
        const source = b.value;
        const input = structuredClone(source.input);
        // Re-project only the exact, validated display input. Never forward raw private models,
        // evidence notes or a dependency-supplied display object.
        const display = projectPlayerPlayoff(input);
        const origins = ["synthetic-event", "synthetic-indicated", "director-attested-origin-unverified", "director-reviewed-origin-unverified"];
        if (input?.tournamentId === scope.tournamentId && input?.eventId === scope.eventId && display.status === "available"
          && source.sourceObservation === "matching-double-read-not-atomic" && source.publicAccessGranted === false && source.independentPlayEstablished === false && origins.includes(source.origin)) {
          bracket = { status: "available", display, origin: source.origin, sourceObservation: "matching-double-read-not-atomic", independentPlayEstablished: false,
            notice: source.origin.startsWith("synthetic") ? "Simulated or synthetic-indicated bracket; independent human play is not established." : "Director-reviewed bracket; independent human play is not established." };
        }
      }
      const pool = p.status === "fulfilled" ? p.value : null;
      const pools = isRunningPoolWorkspace(pool) && pool.tournamentId === scope.tournamentId && pool.eventId === scope.eventId
        && pool.sourceObservation === "matching-double-read-not-atomic"
        ? { status: "available" as const, workspace: structuredClone(pool) } : unavailable();
      return { status: "available", kind: "private-results-view-v1", tournamentId: scope.tournamentId, eventId: scope.eventId,
        bracket, pools, sourceObservation: "independent-section-reads-not-atomic", publicAccessGranted: false, playerAccessGranted: false };
    } catch { return { status: "blocked", code: "existing_read_permission_required" }; }
  };
}
