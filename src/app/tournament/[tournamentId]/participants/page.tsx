import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getEventRosterEnrollmentWorkspace } from "../../../../lib/events/roster-enrollment-workspace";
import ParticipantsClient from "./participants-client";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const workspace = await getEventRosterEnrollmentWorkspace(access.user.id, tournamentId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="participants-title">
    <p className="eyebrow">OPERATIONS</p>
    <h1 id="participants-title">Event Participants</h1>
    <p className="auth-note">Enroll checked-in players in each Standard Singles event. A player without app access remains a paper participant; the event and scorecard record still exist for cross-checking.</p>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <ParticipantsClient actorId={access.user.id} tournamentId={tournamentId} workspace={workspace} />
    <SharedDeviceSignOut />
  </section></main>;
}
