import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { getCurrentSubject } from "../../../../lib/auth/current-subject";
import { getDirectorAccessWorkspace } from "../../../../lib/director-administration";
import { NewTournamentClient } from "./new-tournament-client";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage() {
  const actorId = await getCurrentSubject();
  if (!actorId) notFound();
  const access = await getDirectorAccessWorkspace(actorId);
  if (!access?.canCreateTournament) notFound();
  return <main className="auth-shell"><section className="auth-card director-form" aria-labelledby="new-tournament-title">
    <p className="eyebrow">TOURNAMENT DIRECTOR</p>
    <h1 id="new-tournament-title">Create Tournament</h1>
    <Link className="guide-link" href="/">Back to Your Tournaments</Link>
    <p className="lede">Create a private draft, then complete its events, officials, fees, and capacity in Set Up Tournament.</p>
    <NewTournamentClient />
    <Link className="guide-link" href="/">Back to Your Tournaments</Link>
    <SharedDeviceSignOut />
  </section></main>;
}
