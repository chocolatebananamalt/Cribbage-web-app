import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getEventScheduleWorkspace } from "../../../../lib/events/schedule-workspace";
import ScheduleClient from "./schedule-client";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const workspace = await getEventScheduleWorkspace(access.user.id, tournamentId);
  return <main className="auth-shell"><section className="auth-card schedule-card" aria-labelledby="schedule-title">
    <p className="eyebrow">OPERATIONS</p>
    <h1 id="schedule-title">Game Schedule</h1>
    <p className="auth-note">Import the director-reviewed pairings. The app validates every player, game, and Table/Seat before it creates any scoreable games.</p>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <ScheduleClient actorId={access.user.id} tournamentId={tournamentId} workspace={workspace} />
    <SharedDeviceSignOut />
  </section></main>;
}
