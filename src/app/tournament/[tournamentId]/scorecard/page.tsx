import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getPlayerScorecard } from "../../../../lib/games/player-scorecard";
import { getScorecardVerificationStatus } from "../../../../lib/games/scorecard-status";
import { formatScorecardSpread, formatSignedNet } from "../../../../lib/score";

const ScorecardColumns = () => <colgroup><col className="game-number" /><col className="game-points" /><col className="spread-plus" /><col className="spread-minus" /><col className="opponent-name" /><col className="verification-id" /></colgroup>;

export default async function PlayerScorecardPage({ params, searchParams }: { params: Promise<{ tournamentId: string }>; searchParams: Promise<{ event?: string }> }) {
  const { tournamentId } = await params;
  const { event } = await searchParams;
  if (!isUuid(tournamentId) || !event || !isUuid(event)) notFound();
  await requireTournamentAccess(tournamentId);
  const scorecard = await getPlayerScorecard(tournamentId, event);
  const verificationStatus = getScorecardVerificationStatus(scorecard.pendingGames.map((game) => game.state));

  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="scorecard-title">
    <p className="eyebrow">SCORECARD</p>
    <div className="card-state"><h1 id="scorecard-title">{scorecard.player.displayName}</h1><p className="seat">ID #<strong>{scorecard.player.verificationId}</strong></p><strong className={verificationStatus.tone === "current" ? "verification-current" : "verification-pending"}>{verificationStatus.message}</strong></div>
    <p className="card-context">{scorecard.tournamentName} · {scorecard.eventName}</p>
    <div className="scorecard-frame">
      <table className="scorecard-header"><caption className="sr-only">{scorecard.player.displayName} scorecard</caption><ScorecardColumns /><thead><tr><th colSpan={2} scope="colgroup">Game</th><th colSpan={2} scope="colgroup">Spread Points</th><th rowSpan={2} scope="col">Opponent<span>Name</span></th><th rowSpan={2} scope="col">Verification<span>ID #</span></th></tr><tr><th scope="col">#</th><th scope="col">Points</th><th scope="col">(+)</th><th scope="col">(−)</th></tr></thead></table>
      <div className="table-scroll"><table className="scorecard-body"><ScorecardColumns /><tbody>
        {scorecard.lines.map((line) => <tr key={`${line.roundNumber}-${line.matchInstance}`}><th scope="row">{line.roundNumber}</th><td>{line.gamePoints}</td><td>{line.plusPoints ? formatScorecardSpread(line.plusPoints) : "—"}</td><td>{line.minusPoints ? formatScorecardSpread(line.minusPoints) : "—"}</td><td>{line.opponentName}</td><td>{line.opponentVerificationId}</td></tr>)}
        {scorecard.lines.length === 0 ? <tr><td colSpan={6}>No verified scorecard entries yet.</td></tr> : null}
      </tbody></table></div>
      <table className="scorecard-footer"><ScorecardColumns /><tbody><tr><th scope="row">Total</th><td>{scorecard.totals.gamePoints}</td><td>+{scorecard.totals.plusPoints}</td><td>−{scorecard.totals.minusPoints}</td><td colSpan={2}>{verificationStatus.totalMessage ?? ""}</td></tr><tr className="summary-row"><td colSpan={2}><strong>{scorecard.totals.gamesWon} Games Won</strong></td><td colSpan={4}><strong>{formatSignedNet(scorecard.totals.netSpreadPoints)} Net Spread Points</strong></td></tr></tbody></table>
    </div>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><SharedDeviceSignOut />
  </section></main>;
}
