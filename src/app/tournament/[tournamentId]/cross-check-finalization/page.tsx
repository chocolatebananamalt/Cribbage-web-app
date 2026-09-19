import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isCrossCheckFinalizationWorkspace } from "../../../../lib/api/cross-check-finalization";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import CrossCheckFinalizationClient from "./cross-check-finalization-client";

// Rendered per request for the same reason every other interactive page is:
// under the proxy's strict-dynamic CSP a prerendered page ships scripts with no
// nonce, so the markup looks right and the button is dead
// (tests/interactive-pages-are-not-prerendered.test.mjs). The counts are also
// live evidence, and a cached list of them would be worse than no list.
export const dynamic = "force-dynamic";

export default async function CrossCheckFinalizationPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  // The RPC answers null for anyone who is not a director or co-director of
  // this tournament, so the guard failing is the authorization result, not an
  // error to report.
  const { data, error } = await createServerOnlyAdminClient().rpc("get_cross_check_finalization_workspace_v1", {
    p_actor_id: access.user.id,
    p_tournament_id: tournamentId,
  });
  if (error || !isCrossCheckFinalizationWorkspace(data, tournamentId)) notFound();

  return <main className="auth-shell">
    <section className="auth-card wide-card" aria-labelledby="cross-check-finalization-title">
      <p className="eyebrow">CROSS CHECK</p>
      <h1 id="cross-check-finalization-title">Finalize Cross-Checking</h1>
      <p className="card-context">{data.tournamentName}</p>
      <p className="auth-note">Every condition below is read from the tournament server when this page loads. Finalizing records that cross-checking was completed, with a receipt and an audit entry. It changes no score, correction, dispute or result.</p>
      <CrossCheckFinalizationClient tournamentId={tournamentId} workspace={data} />
      <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
      <SharedDeviceSignOut />
    </section>
  </main>;
}
