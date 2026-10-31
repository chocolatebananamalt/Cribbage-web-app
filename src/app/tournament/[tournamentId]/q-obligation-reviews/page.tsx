import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import { isUuid } from "../../../../lib/api/validation";
import { isQReviewWorkspace, type QReviewWorkspace } from "../../../../lib/api/q-obligation-review";
import QObligationReviewClient from "./review-client";
export const dynamic = "force-dynamic";
export default async function QReviewPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (access.role !== "director") notFound();
  let workspace: QReviewWorkspace | null = null;
  try { const { data, error } = await createServerOnlyAdminClient().rpc("get_q_obligation_review_workspace_v1", { p_actor_id: access.user.id, p_tournament_id: tournamentId }); if (!error && isQReviewWorkspace(data, tournamentId)) workspace = data; } catch { /* Fail closed. */ }
  return <main className="auth-shell"><section className="auth-card corrections-card"><p className="eyebrow">Q OBLIGATION REVIEW</p><h1>Reviewed Q obligations - unpaid</h1><p><a href={`/tournament/${tournamentId}/q-pool-policy`}>Policy and payout preview</a> - <a href={`/tournament/${tournamentId}`}>Back to tournament</a></p><QObligationReviewClient actorId={access.user.id} tournamentId={tournamentId} initial={workspace}/><SharedDeviceSignOut/></section></main>;
}
