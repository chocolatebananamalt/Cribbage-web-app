/** A named technical rehearsal, never an independent-human identity check. */
export const SIMULATED_LINK_TOURNAMENT = "3c58ef91-010c-4769-af20-5cfa2ffe98a9";
export const SIMULATED_LINK_REPLACEMENT = "fd0589d0-31e7-4921-b793-1beec2431337";
export function isSimulatedLinkTournament(tournamentId: string): boolean {
  return tournamentId === SIMULATED_LINK_TOURNAMENT || tournamentId === SIMULATED_LINK_REPLACEMENT;
}
export const SIMULATED_LINK_PROJECT = "nnhcnvksxgxnpvdqjgpg";
export const SIMULATED_LINK_PROFILES = ["de0f27a1-60d0-4449-af83-fdf360a9bc08", "986c7f24-1d42-4115-8532-053fc4bef59a"] as const;
export const SIMULATED_LINK_NOTICE = "One operator simulating two accounts; no independent identity witness. Technical rehearsal only, not independent-human validation.";

export function simulatedLinkScope(tournamentId: string, actorId: string, url: string | undefined): boolean {
  return isSimulatedLinkTournament(tournamentId)
    && SIMULATED_LINK_PROFILES.some((id) => id === actorId)
    && url === `https://${SIMULATED_LINK_PROJECT}.supabase.co`;
}
