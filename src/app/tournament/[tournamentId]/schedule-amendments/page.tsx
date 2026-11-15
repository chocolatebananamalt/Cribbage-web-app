import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { parseScheduleAmendmentWorkspace } from "../../../../lib/api/schedule-amendments";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import ScheduleAmendmentsClient from "./schedule-amendments-client";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params; if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId); if (!["director", "co_director"].includes(access.role)) notFound();
  const { data, error } = await createServerOnlyAdminClient().rpc("get_schedule_amendment_workspace_v1", { p_actor_id: access.user.id, p_tournament_id: tournamentId });
  const workspace = error ? null : parseScheduleAmendmentWorkspace(data); if (!workspace) notFound();
  return <main className="auth-shell"><section className="auth-card schedule-card"><p className="eyebrow">OPERATIONS</p><h1>Late, Missing, or Departing Player</h1><p className="card-context">{workspace.tournamentName}</p><p className="auth-note">Choose the source-backed case, edit only affected unresolved assignments, preview all conflicts, then confirm. Mixed-rotation repairs are the director’s reviewed decision—not an automatic ACC pairing.</p><ScheduleAmendmentsClient tournamentId={tournamentId} workspace={workspace}/><Link className="guide-link" href={`/tournament/${tournamentId}/participant-status`}>Previous Screen</Link><SharedDeviceSignOut/></section></main>;
}
