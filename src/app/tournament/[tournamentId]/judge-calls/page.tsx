import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { getLiveJudgeCalls } from "../../../../lib/api/live-judge-calls";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import JudgeCallClient from "./judge-call-client";

export const dynamic = "force-dynamic";

export default async function JudgeCallsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!access.roles.includes("judge")) notFound();
  const workspace = await getLiveJudgeCalls(createServerOnlyAdminClient(), access.user.id, tournamentId);
  if (!workspace) notFound();

  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="judge-calls-title">
    <p className="eyebrow">LIVE TOURNAMENT SUPPORT</p>
    <h1 id="judge-calls-title">Judge Calls</h1>
    <p className="registration-note">Accept a player’s call only if you are not playing in that game. The first two Judges are assigned. Make the ruling in person; players adjust the peg board and submit the normal final score. No ruling or score is recorded here.</p>
    <JudgeCallClient tournamentId={tournamentId} initialWorkspace={workspace} />
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;
}
