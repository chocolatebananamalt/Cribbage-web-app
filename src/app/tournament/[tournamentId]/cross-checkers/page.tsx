import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getCrossCheckerAssignmentWorkspace } from "../../../../lib/cross-checker-assignment";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import CrossCheckerAssignmentClient from "./cross-checker-assignment-client";

export const dynamic = "force-dynamic";

export default async function CrossCheckerAssignmentPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const workspace = await getCrossCheckerAssignmentWorkspace(createServerOnlyAdminClient(), access.user.id, tournamentId);
  if (!workspace) notFound();
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="cross-checker-title">
    <p className="eyebrow">TOURNAMENT OFFICIALS</p>
    <h1 id="cross-checker-title">Cross-checker Assignments</h1>
    <p className="card-context">{workspace.tournamentName}</p>
    <p className="auth-note">Assign only a person who will independently check other players&apos; cards. For the October pilot, assignments are permanent from this screen so completed verification evidence cannot be invalidated accidentally.</p>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <CrossCheckerAssignmentClient tournamentId={tournamentId} workspace={workspace} />
    <SharedDeviceSignOut />
  </section></main>;
}

