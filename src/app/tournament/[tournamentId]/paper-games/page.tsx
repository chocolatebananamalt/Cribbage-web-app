import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getPaperGameWorkspace } from "../../../../lib/paper-games/workspace";
import PaperGameClient from "./paper-game-client";

export default async function PaperGamePage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director", "cross_checker"].includes(access.role)) notFound();
  const workspace = await getPaperGameWorkspace(access.user.id, tournamentId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="paper-games-title">
    <p className="eyebrow">CROSS CHECK</p>
    <h1 id="paper-games-title">Complete paper-versus-paper games</h1>
    <p className="card-context">{workspace.tournamentName}</p>
    <p className="registration-note">An authorized official records both original paper cards, then independently re-enters the same evidence to confirm it. A mismatch stays out of scorecards and standings. Two officials may split these steps, and one official may do both.</p>
    <PaperGameClient actorId={access.user.id} tournamentId={tournamentId} actorRole={workspace.actorRole} actorIdentityConfirmed={workspace.actorIdentityConfirmed} unboundOfficials={workspace.unboundOfficials} rosterChoices={workspace.rosterChoices} candidates={workspace.candidates} reviewCases={workspace.reviewCases} />
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;
}
