import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../../../components/shared-device-sign-out";
import { getPlayoffOutcomeWorkspace } from "../../../../../../lib/api/playoff-outcome";
import { isUuid } from "../../../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import PlayoffOutcomeClient from "./playoff-outcome-client";

export const dynamic = "force-dynamic";

export default async function PlayoffOutcomesPage({ params }: { params: Promise<{ tournamentId: string; eventId: string }> }) {
  const { tournamentId, eventId } = await params;
  if (!isUuid(tournamentId) || !isUuid(eventId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const workspace = await getPlayoffOutcomeWorkspace(createServerOnlyAdminClient(), access.user.id, tournamentId, eventId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="playoff-outcome-page-title">
    <p className="eyebrow">PRIVATE RESULTS</p>
    <h1 id="playoff-outcome-page-title">Playoff outcomes</h1>
    <Link className="guide-link" href={`/tournament/${tournamentId}/events/${eventId}/settlement-v5`}>Settlement review</Link>
    <PlayoffOutcomeClient key={`${workspace?.currentVersion ?? "unavailable"}-${workspace?.result?.resultId ?? "none"}`} actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} workspace={workspace} />
    <SharedDeviceSignOut />
  </section></main>;
}
