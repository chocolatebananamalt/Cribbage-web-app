import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getPreliminaryEventStandings } from "../../../../lib/results/preliminary-standings";
import { formatSignedNet } from "../../../../lib/score";

export default async function PreliminaryResultsPage({ params, searchParams }: {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { tournamentId } = await params;
  const { event } = await searchParams;
  if (!isUuid(tournamentId) || !event || !isUuid(event)) notFound();
  await requireTournamentAccess(tournamentId);
  const standings = await getPreliminaryEventStandings(tournamentId, event);

  return <main className="auth-shell"><section className="auth-card standings-card" aria-labelledby="standings-title">
    <p className="eyebrow">TOURNAMENT RESULTS</p>
    <h1 id="standings-title">Preliminary Standings</h1>
    <p className="card-context">{standings.tournamentName} · {standings.eventName}</p>
    <p className="registration-note">Only verified or corrected games are included. Ties remain visible. Qualification, MRPs, Q-pools, payouts, and final results are not decided on this screen.</p>
    <div className="table-scroll"><table className="standings-table">
      <caption className="sr-only">Preliminary standings from verified scorecards</caption>
      <thead><tr><th scope="col">Numeric rank</th><th scope="col">Player</th><th scope="col">Status</th><th scope="col">Games</th><th scope="col">Game Points</th><th scope="col">Won</th><th scope="col">Plus</th><th scope="col">Minus</th><th scope="col">Net</th></tr></thead>
      <tbody>{standings.rows.map((row) => <tr key={row.participantId}>
        <td>{row.numericRank}{row.tied ? " (tie)" : ""}</td><th scope="row">{row.displayName}</th><td>{row.participantStatus.replace("_", " ")}</td><td>{row.verifiedGames}</td><td>{row.gamePoints}</td><td>{row.gamesWon}</td><td>+{row.plusPoints}</td><td>−{row.minusPoints}</td><td>{formatSignedNet(row.netSpreadPoints)}</td>
      </tr>)}{standings.rows.length === 0 ? <tr><td colSpan={9}>No event participants are available yet.</td></tr> : null}</tbody>
    </table></div>
    <Link className="guide-link" href={`/tournament/${tournamentId}/scorecard?event=${event}`}>Back to Scorecard</Link>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;
}
