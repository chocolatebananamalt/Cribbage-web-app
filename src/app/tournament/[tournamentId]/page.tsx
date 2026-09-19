import { requireTournamentAccess } from "../../../lib/auth/require-tournament-access";
import { SharedDeviceSignOut } from "../../../components/shared-device-sign-out";
import Link from "next/link";
import { registrationLinkManagementEnabled } from "../../../lib/api/public-registration-v2";
import { accountActivationEnabled } from "../../../lib/api/account-activation-release";
import { rule12CorrectionEnabled } from "../../../lib/api/rule12-correction-release";
import { getAccessibleTournaments } from "../../../lib/tournaments/accessible-tournaments";
import { ArchiveTournamentClient } from "./archive-tournament-client";

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
  const isDirector = access.roles.some((role) => ["director", "co_director"].includes(role));
  const isCrossCheckOfficial = access.roles.some((role) => ["director", "co_director", "cross_checker"].includes(role));
  const canViewResults = access.roles.some((role) => ["viewer", "player", "cross_checker", "director", "co_director"].includes(role));
  return (
    <main className="auth-shell">
      <section className="auth-card wide-card tournament-workspace" aria-labelledby="tournament-title">
        <p className="eyebrow">AUTHORIZED TOURNAMENT</p>
        <Link className="secondary workspace-chooser-link" href="/">Back to Your Tournaments</Link>
        <h1 id="tournament-title">{tournamentName ?? "Tournament workspace"}</h1>
        <p className="lede">Your role{access.roles.length === 1 ? "" : "s"}: {access.roles.map((role) => roleLabels[role] ?? role).join(", ")}.</p>
        <section className="workspace-phase-grid" aria-label="Tournament operations">
          <section className="workspace-phase"><h2>Start here</h2><p>Personal tournament information and player tools.</p>
            <Link className="guide-link" href={`/tournament/${tournamentId}/how-to`}>How to run this tournament</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/games`}>My Games</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/teams`}>Team Scorecards</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/seating-directory`}>Seating Directory</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/rulebook`}>ACC Rulebook</Link>
            {access.roles.includes("judge") ? <Link className="guide-link" href={`/tournament/${tournamentId}/judge-calls`}>Judge Calls</Link> : null}
          </section>
          {isDirector ? <section className="workspace-phase"><h2>1. Set up</h2><p>Configure the tournament, officials, events, pools, and registration.</p>
            <Link className="guide-link" href={`/tournament/${tournamentId}/setup`}>Set Up Tournament</Link>
            {registrationLinkManagementEnabled() ? <Link className="guide-link" href={`/tournament/${tournamentId}/registration`}>Registration QR code and link</Link> : null}
          </section> : null}
          {isDirector ? <section className="workspace-phase"><h2>2. Registration and payments</h2><p>Review registrations, maintain the roster, and record payment evidence.</p>
            <Link className="guide-link" href={`/tournament/${tournamentId}/roster`}>Registration and roster</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/payments`}>Payments and expenses</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/side-pools`}>Event Side Pools</Link>
          </section> : null}
          {isDirector ? <section className="workspace-phase"><h2>3. Check-in and seating</h2><p>Open event check-in, manage desk requests, publish seating, and schedule play.</p>
            <Link className="guide-link" href={`/tournament/${tournamentId}/event-check-in`}>Event Check-In</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/seating`}>Check-in and seating publication</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/participants`}>Event participants</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/schedule`}>Game schedule</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/event-control`}>Event play control</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/tournament-day-import`}>Tournament Day CSV Import</Link>
            {accountActivationEnabled() ? <Link className="guide-link" href={`/tournament/${tournamentId}/account-activations`}>Player app access</Link> : null}
          </section> : null}
          {isCrossCheckOfficial ? <section className="workspace-phase"><h2>4. Cross-check and recovery</h2><p>Complete paper evidence, correct authorized cards, and recover failed devices.</p>
            <Link className="guide-link" href={`/tournament/${tournamentId}/recoveries`}>Failed-device score recovery</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/hybrid-games`}>Digital-versus-paper games</Link>
            <Link className="guide-link" href={`/tournament/${tournamentId}/paper-games`}>Paper-versus-paper games</Link>
            {rule12CorrectionEnabled() && isCrossCheckOfficial ? <Link className="guide-link" href={`/tournament/${tournamentId}/corrections`}>Independent scorecard corrections</Link> : null}
            {isDirector ? <Link className="guide-link" href={`/tournament/${tournamentId}/cross-check-finalization`}>Finalize Cross-Checking</Link> : null}
          </section> : null}
          {canViewResults ? <section className="workspace-phase"><h2>5. Results and reporting</h2><p>Review live standings, qualifications, event results, and director reports.</p>
            <Link className="guide-link" href={`/tournament/${tournamentId}/results`}>Tournament Results</Link>
          </section> : null}
        </section>
        {access.roles.includes("director") ? <ArchiveTournamentClient tournamentId={tournamentId} tournamentName={tournamentName ?? "this tournament"} /> : null}
        <Link className="secondary workspace-chooser-link workspace-chooser-link-bottom" href="/">Back to Your Tournaments</Link>
        <SharedDeviceSignOut />
      </section>
    </main>
  );
}
