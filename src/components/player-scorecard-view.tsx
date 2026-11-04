import Link from "next/link";
import { PlayerPageFrame } from "./player-page-frame";
import { SharedDeviceSignOut } from "./shared-device-sign-out";
import type { PlayerScorecard } from "../lib/games/player-scorecard";
import type { AssignedGameSummary } from "../lib/games/my-games-decision";
import { currentScorecardAssignment, scorecardPlayerName, scorecardPresentationRows } from "../lib/games/scorecard-presentation";
import { getScorecardVerificationStatus } from "../lib/games/scorecard-status";
import { formatScorecardSpread, formatSignedNet } from "../lib/score";

/** Presentation only. The route retains authentication and all actor-scoped reads. */
export function PlayerScorecardView({ scorecard, assignments = [], hasCorrectionNotice = false }: {
  scorecard: PlayerScorecard & { player: PlayerScorecard["player"] & { accNumber?: string } };
  assignments?: readonly AssignedGameSummary[];
  hasCorrectionNotice?: boolean;
}) {
  const { tournamentId, eventId: event } = scorecard;
  const verificationStatus = getScorecardVerificationStatus(scorecard.pendingGames.map((game) => game.state));
  const rows = scorecardPresentationRows(scorecard, assignments);
  const currentGame = currentScorecardAssignment(scorecard, assignments);

  return <PlayerPageFrame tournamentId={tournamentId} tournamentName={scorecard.tournamentName} eventId={event} eventName={scorecard.eventName} activeTab="card" player={scorecard.player}>
    <h1 className="player-card-name" id="scorecard-title">{scorecardPlayerName(scorecard.player)}</h1>
    <p className="player-card-id"><strong>Tournament ID# {scorecard.player.verificationId}</strong></p>
    <p className="player-card-state" role="status">{scorecard.lines.length} {scorecard.lines.length === 1 ? "game" : "games"} verified{verificationStatus.tone !== "current" ? ` · ${verificationStatus.message}` : ""}</p>
    {hasCorrectionNotice ? <p className="verification-pending" role="status">A Rule 12 scorecard correction changed your qualifying status or position. Please speak with the tournament director for the card evidence.</p> : null}
    <div className="player-scorecard-scroll" role="region" aria-label="Scorecard table; scroll right for opponent name and Tournament ID" tabIndex={0}>
      <table className="player-scorecard-table">
        <caption className="sr-only">{scorecard.player.displayName} · {scorecard.eventName}. Only verified scorecard values count in totals.</caption>
        <colgroup><col className="game-number" /><col className="game-points" /><col className="spread-plus" /><col className="spread-minus" /><col className="opponent-name" /><col className="verification-id" /></colgroup>
        <thead><tr><th rowSpan={2} scope="col">Game</th><th rowSpan={2} scope="col">Game<br />points</th><th colSpan={2} scope="colgroup">Spread points</th><th rowSpan={2} scope="col">Opponent</th><th rowSpan={2} scope="col">Opponent<br />ID#</th></tr><tr><th scope="col">+</th><th scope="col">−</th></tr></thead>
        <tbody>
          {rows.map((line) => <tr key={line.key} title={line.resultStatus} data-verified={line.gamePoints !== null}>
            <th scope="row">{line.roundNumber}<span className="sr-only"> · {line.resultStatus}</span></th>
            <td>{line.gamePoints ?? "—"}</td>
            <td>{line.plusPoints ? `+${formatScorecardSpread(line.plusPoints)}` : "—"}</td>
            <td>{line.minusPoints ? `−${formatScorecardSpread(line.minusPoints)}` : "—"}</td>
            <td className="player-card-opponent" title={line.opponentName ?? undefined}>{line.opponentName ?? "—"}</td>
            <td className="player-card-opponent-id">{line.opponentVerificationId ?? "—"}</td>
          </tr>)}
          {rows.length === 0 ? <tr><td colSpan={6}>No scheduled scorecard games available.</td></tr> : null}
        </tbody>
        <tfoot><tr><th scope="row">Total</th><td>{scorecard.totals.gamePoints}</td><td>+{scorecard.totals.plusPoints}</td><td>−{scorecard.totals.minusPoints}</td><td colSpan={2}></td></tr>
          <tr className="player-card-net-row"><th colSpan={2} scope="row" aria-label="Net Spread Points">Net Spread</th><td colSpan={2} className="player-card-net-value">{formatSignedNet(scorecard.totals.netSpreadPoints)}</td><td colSpan={2}></td></tr>
        </tfoot>
      </table>
    </div>
    <p className="player-card-hint">Scroll right for opponent ID# → · — = no verified value</p>
    {verificationStatus.totalMessage ? <p className="verification-pending">{verificationStatus.totalMessage}. Unverified results are excluded from totals.</p> : null}
    {currentGame ? <Link className="primary player-current-game" href={`/tournament/${tournamentId}/game/${currentGame.gameId}`}>Open Current Game</Link> : null}
    <Link className="guide-link" href={`/tournament/${tournamentId}/results?event=${event}`}>View Preliminary Standings</Link>
    <details className="player-help"><summary>Help and account options</summary><SharedDeviceSignOut /></details>
  </PlayerPageFrame>;
}
