import "server-only";

import { notFound, redirect } from "next/navigation";
import { createServerOnlyAdminClient } from "../supabase/private-admin.ts";
import { isSyntheticPaperDeployment } from "./synthetic-paper-evidence.ts";
import { simulationFinanceDispatch } from "./simulation-finance-dispatch.ts";

/** Call only after the page's existing tournament and role authorization.
 * Only verified non-enrollment may continue into historical finance loaders. */
export async function requireLegacyFinanceMode(actorId: string, tournamentId: string): Promise<void> {
  if (!isSyntheticPaperDeployment(process.env)) return;
  let dispatch: ReturnType<typeof simulationFinanceDispatch> = "blocked";
  try {
    const { data, error } = await createServerOnlyAdminClient().rpc("get_multi_event_finance_workspace_v1", {
      actor: actorId, tid: tournamentId,
    });
    dispatch = simulationFinanceDispatch(data, !!error);
  } catch {
    // Unknown mode must never expose an empty or misleading legacy ledger.
  }
  // Next navigation throws control-flow signals; keep them outside the RPC catch.
  if (dispatch === "blocked") notFound();
  if (dispatch === "simulation") redirect(`/tournament/${tournamentId}/payments`);
}
