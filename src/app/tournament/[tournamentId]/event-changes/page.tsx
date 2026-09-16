import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isUuid } from "../../../../lib/api/validation";
import { getCurrentSubject } from "../../../../lib/auth/current-subject";
import { getEventChangesWorkspaceAccess } from "../../../../lib/event-changes-workspace";
import EventChangesClient from "./event-changes-client";

export const dynamic = "force-dynamic";

export default async function EventChangesPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const actorId = await getCurrentSubject();
  if (!actorId || !await getEventChangesWorkspaceAccess(actorId, tournamentId)) notFound();
  return <main className="auth-shell"><section className="auth-card corrections-card setup-card" aria-labelledby="event-changes-title">
    <p className="eyebrow">OPERATIONS</p><h1 id="event-changes-title">Event Changes</h1>
    <Link className="guide-link" href={`/tournament/${tournamentId}/setup`}>Previous Screen</Link>
    <EventChangesClient tournamentId={tournamentId} /><SharedDeviceSignOut />
  </section></main>;
}
