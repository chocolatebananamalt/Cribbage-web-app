import { headers } from "next/headers";
import Link from "next/link";
import { SharedDeviceSignOut } from "../components/shared-device-sign-out";
import { getCurrentSubject } from "../lib/auth/current-subject";
import { allowsReviewPrototype } from "../lib/review-prototype-boundary";
import { getAccessibleTournaments } from "../lib/tournaments/accessible-tournaments";
import { TournamentDashboard } from "./tournament-dashboard";

const roleLabels: Record<string, string> = {
  director: "Director",
  co_director: "Co-director",
  cross_checker: "Cross-checker",
  judge: "Judge",
  player: "Player",
  viewer: "Viewer",
};

const statusLabels: Record<string, string> = {
  draft: "Setup in progress",
  open: "Open",
  pending_finalization: "Final review",
  finalized: "Finalized",
};

export default async function HomePage() {
  const requestHeaders = await headers();
  if (!allowsReviewPrototype({
    host: requestHeaders.get("host"),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  })) {
    const subject = await getCurrentSubject();
    if (subject) {
      const access = await getAccessibleTournaments(subject);
      return (
        <main className="auth-shell">
          <section className="auth-card tournament-chooser" aria-labelledby="welcome-title">
            <p className="eyebrow">ACC TOURNAMENT DESK</p>
            <h1 id="welcome-title">You’re signed in</h1>
            <p className="lede">Your secure email sign-in is complete.</p>
            {access.status === "available" && access.tournaments.length > 0 ? (
              <>
                <h2>Your tournaments</h2>
                <p className="auth-note">Choose a tournament to open its workspace.</p>
                <ul className="tournament-choice-list">
                  {access.tournaments.map((tournament) => (
                    <li key={tournament.tournamentId}>
                      <Link href={`/tournament/${tournament.tournamentId}`}>
                        <strong>{tournament.tournamentName}</strong>
                        <span>{tournament.tournamentDate || "Date not set"}</span>
                        <small>{roleLabels[tournament.effectiveRole]} · {statusLabels[tournament.tournamentStatus]}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : access.status === "available" ? (
              <div className="tournament-choice-empty">
                <h2>No tournament access yet</h2>
                <p>A director can add you to a tournament. When access is granted, it will appear here.</p>
              </div>
            ) : (
              <div className="tournament-choice-empty" role="status">
                <h2>Tournaments are temporarily unavailable</h2>
                <p>Please try this page again. Your account remains signed in.</p>
              </div>
            )}
            <Link className="secondary demo-choice" href="/demo">Explore the demonstration</Link>
            <SharedDeviceSignOut />
          </section>
        </main>
      );
    }
    return (
      <main className="auth-shell">
        <section className="auth-card" aria-labelledby="welcome-title">
          <p className="eyebrow">ACC TOURNAMENT DESK</p>
          <h1 id="welcome-title">Tournament access</h1>
          <p className="lede">Sign in to open the tournament workspace assigned to you.</p>
          <Link className="primary-action" href="/sign-in">Sign in by email</Link>
          <p className="auth-note">Tournament registration uses the QR code or registration link provided by the tournament director.</p>
        </section>
      </main>
    );
  }
  return <TournamentDashboard />;
}
