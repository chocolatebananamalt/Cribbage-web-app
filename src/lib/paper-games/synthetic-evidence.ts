import "server-only";
import { createServerOnlyAdminClient } from "../supabase/private-admin";
import { isSyntheticPaperDeployment, isSyntheticPaperWorkspace } from "../api/synthetic-paper-evidence";

/** No failure can silently opt a registered synthetic fixture into paper mode. */
export async function getSyntheticPaperEvidence(actorId: string, tournamentId: string) {
  if (!isSyntheticPaperDeployment(process.env)) return null;
  const { data, error } = await createServerOnlyAdminClient().rpc("get_synthetic_paper_evidence_v1", {
    p_actor_id: actorId, p_tournament_id: tournamentId,
  });
  if (error) throw new Error("Synthetic test evidence could not be checked. Pending work is preserved.");
  if (data === null) return null;
  if (!isSyntheticPaperWorkspace(data, tournamentId)) throw new Error("Synthetic test evidence is unavailable.");
  return data;
}
