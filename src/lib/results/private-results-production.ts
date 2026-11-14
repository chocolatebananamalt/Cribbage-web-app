import "server-only";
import { requireTournamentAccess } from "../auth/require-tournament-access";
import { createPrivateResultsView } from "./private-results-view";
import { readExistingPlayerBracket } from "./player-playoff-read-production";
import { readExistingRunningPools } from "./pool-running-read-production";
import type { ExistingPlayoffMode } from "./player-playoff-read-model";

/** Unwired official-only composition of the existing independently guarded readers.
 * No new RPC, route, permission, client-side admin access or public/player read. */
export async function readPrivateResults(tournamentId: string, eventId: string, mode: ExistingPlayoffMode) {
  return createPrivateResultsView({
    access: async id => { const a = await requireTournamentAccess(id); return { actorId: a.user.id, roles: a.roles }; },
    bracket: readExistingPlayerBracket,
    pools: readExistingRunningPools,
  })({ tournamentId, eventId, mode, audience: "existing-official" });
}
