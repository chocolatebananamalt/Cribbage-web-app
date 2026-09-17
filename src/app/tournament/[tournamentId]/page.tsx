import { requireTournamentAccess } from "../../../lib/auth/require-tournament-access";
import { SharedDeviceSignOut } from "../../../components/shared-device-sign-out";
import Link from "next/link";
import { registrationLinkManagementEnabled } from "../../../lib/api/public-registration-v2";
import { accountActivationEnabled } from "../../../lib/api/account-activation-release";
import { rule12CorrectionEnabled } from "../../../lib/api/rule12-correction-release";
import { getAccessibleTournaments } from "../../../lib/tournaments/accessible-tournaments";

const roleLabels: Record<string, string> = {
  director: "Director",
  co_director: "Co-director",
  cross_checker: "Cross-checker",
  judge: "Judge",
  player: "Player",
  viewer: "Viewer",
};

export default async function ProtectedTournamentPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  const access = await requireTournamentAccess(tournamentId);
  const chooser = await getAccessibleTournaments(access.user.id);
  const tournamentName = chooser.status === "available"
    ? chooser.tournaments.find((tournament) => tournament.tournamentId === tournamentId)?.tournamentName
    : undefined;
  const isDirector = ["director", "co_director"].includes(access.role);
  const canViewResults = ["viewer", "player", "cross_checker", "director", "co_director"].includes(access.role);
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="tournament-title">
        <p className="eyebrow">AUTHORIZED TOURNAMENT</p>
        <Link className="secondary workspace-chooser-link" href="/">Back to Your Tournaments</Link>
        <h1 id="tournament-title">{tournamentName ?? "Tournament workspace"}</h1>
        <p className="lede">Your role: {roleLabels[access.role] ?? access.role}.</p>
        <Link className="guide-link" href={`/tournament/${tournamentId}/how-to`}>Start Here / How To</Link>
        <Link className="guide-link" href={`/tournament/${tournamentId}/games`}>My Games</Link>
        <Link className="guide-link" href={`/tournament/${tournamentId}/teams`}>Team Scorecards</Link>
        <Link className="guide-link" href={`/tournament/${tournamentId}/seating-directory`}>Seating Directory</Link>
        <Link className="guide-link" href={`/tournament/${tournamentId}/rulebook`}>ACC Rulebook</Link>
        {isDirector ? <Link className="guide-link" href={`/tournament/${tournamentId}/setup`}>Set Up Tournament</Link> : null}
        {(["director", "co_director", "cross_checker"] as string[]).includes(access.role) ? <Link className="guide-link" href={`/tournament/${tournamentId}/recoveries`}>Failed-device score recovery</Link> : null}
        {(["director", "co_director", "cross_checker"] as string[]).includes(access.role) ? <><Link className="guide-link" href={"/tournament/"+tournamentId+"/hybrid-games"}>Complete digital-versus-paper games</Link><Link className="guide-link" href={"/tournament/"+tournamentId+"/paper-games"}>Complete paper-versus-paper games</Link></> : null}
        {rule12CorrectionEnabled() && (["director", "co_director", "cross_checker"] as string[]).includes(access.role) ? <Link className="guide-link" href={`/tournament/${tournamentId}/corrections`}>Independent scorecard corrections</Link> : null}
        {isDirector ? <Link className="guide-link" href={`/tournament/${tournamentId}/roster`}>Registration roster review</Link> : null}
        {isDirector && registrationLinkManagementEnabled() ? <Link className="guide-link" href={`/tournament/${tournamentId}/registration`}>Registration link and QR code</Link> : null}
        {isDirector && accountActivationEnabled() ? <Link className="guide-link" href={`/tournament/${tournamentId}/account-activations`}>Player account activation</Link> : null}
        {access.role === "director" ? <Link className="guide-link" href={`/tournament/${tournamentId}/officials`}>Officials</Link> : null}
        {isDirector ? <Link className="guide-link" href={`/tournament/${tournamentId}/cross-checkers`}>Cross-checker assignments</Link> : null}
        {isDirector ? <Link className="guide-link" href={`/tournament/${tournamentId}/seating`}>Check-in and seating</Link> : null}
        {isDirector ? <Link className="guide-link" href={`/tournament/${tournamentId}/event-check-in`}>Day-of-play Event QR Check-In</Link> : null}
        {isDirector ? <Link className="guide-link" href={`/tournament/${tournamentId}/participants`}>Event participants</Link> : null}
        {isDirector ? <Link className="guide-link" href={`/tournament/${tournamentId}/schedule`}>Game schedule</Link> : null}
        {isDirector ? <Link className="guide-link" href={`/tournament/${tournamentId}/payments`}>Manual payment evidence</Link> : null}
        {isDirector ? <Link className="guide-link" href={`/tournament/${tournamentId}/side-pools`}>Event Side Pools</Link> : null}
        {canViewResults ? <Link className="guide-link" href={`/tournament/${tournamentId}/results`}>Tournament Results</Link> : null}
        <Link className="secondary workspace-chooser-link workspace-chooser-link-bottom" href="/">Back to Your Tournaments</Link>
        <SharedDeviceSignOut />
      </section>
    </main>
  );
}
