import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import { isUuid } from "../../../../lib/api/validation";
import { isQReviewV2Workspace, type QReviewV2Workspace } from "../../../../lib/api/q-obligation-review-v2";
import QObligationReviewV2Client from "./review-client";

export const dynamic = "force-dynamic";

export default async function QReviewV2Page({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (access.role !== "director") notFound();
  let workspace: QReviewV2Workspace | null = null;
  try {
    const { data, error } = await createServerOnlyAdminClient().rpc("get_q_obligation_review_workspace_v2", {
      p_actor_id: access.user.id, p_tournament_id: tournamentId,
    });
    if (!error && isQReviewV2Workspace(data, tournamentId)) workspace = data;
  } catch { /* Unavailable or older database support fails closed. */ }
  return <main className="auth-shell"><section className="auth-card corrections-card">
    <p className="eyebrow">Q OBLIGATION REVIEW</p>
    <h1>Reviewed equal and graduated Q obligations — unpaid</h1>
    <p><a href={`/tournament/${tournamentId}/q-operating-schedules`}>Disclosed operating schedules</a> — <a href={`/tournament/${tournamentId}/q-obligation-reviews`}>Historical v1 reviews</a> — <a href={`/tournament/${tournamentId}`}>Back to tournament</a></p>
    {workspace?.eventId && <p><a href={`/tournament/${tournamentId}/events/${workspace.eventId}/q-accounting-v6`}>Review canonical unpaid tournament accounting</a></p>}
    <QObligationReviewV2Client actorId={access.user.id} tournamentId={tournamentId} initial={workspace}/>
    <SharedDeviceSignOut/>
  </section></main>;
}
