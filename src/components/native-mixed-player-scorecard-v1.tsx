import type {NativeMixedPlayerCardV1} from '../lib/seating/native-mixed-player-scorecard-v1';
import Link from 'next/link';
import {formatScorecardSpread,formatSignedNet} from '../lib/score';
import './player-page.css';

const rowState = {complete:'Practice Complete',pending:'Not Complete - Not Counted',mismatch:'Entries Disagree - Not Counted',unavailable:'Evidence Unavailable - Not Counted',upcoming:'Upcoming - Not Counted'} as const;

/** Private presentation only. The authenticated host must supply a freshly
 * projected own-player card; this component is never an authorization boundary. */
export function NativeMixedPlayerScorecardV1({enabled=false,card,currentGameHref}:{enabled?:boolean;card:NativeMixedPlayerCardV1|null;currentGameHref?:string}){
 if(!enabled||!card)return <p role="status">The rehearsal scorecard is unavailable. Saved entries are preserved.</p>;
 const attention=card.rows.filter(r=>r.status!=='complete'&&r.status!=='upcoming');
 const current=card.allSourcesAvailable?card.rows.find(r=>r.gameId===card.currentGameId&&['pending','mismatch'].includes(r.status)):undefined;
 return <section aria-labelledby="native-practice-card-title">
  <h1 id="native-practice-card-title">Scorecard</h1>
  <p><strong>Practice Only.</strong> Completed rehearsal evidence is shown below. These are not official results, qualification or payout records.</p>
  <h2 className="player-card-name">{card.player.displayName}</h2>
  <p className="player-card-id">Tournament ID# <strong>{card.player.fixedTournamentId}</strong></p>
  <p role="status">{card.completedGames} of 12 games complete. Totals include only completed rehearsal evidence.{!card.allSourcesAvailable?' Some current game information could not be checked.':''}</p>
  {current&&<div className="player-card-verification-note" role="status" aria-label="Current Practice Game"><p><strong>Current Practice Game {current.gameNumber}</strong><br/>Your Chair: <strong>{current.currentSeat}</strong><br/>Opponent Chair: <strong>{current.opponentCurrentSeat}</strong><br/>Opponent: {current.opponentName}<br/>Opponent Tournament ID# <strong>{current.opponentTournamentId}</strong><br/>{rowState[current.status]}</p><p>Chair numbers stay with the furniture. Your Tournament ID stays with you.</p>{currentGameHref&&<Link className="primary player-current-game" href={currentGameHref}>Open Current Practice Game</Link>}</div>}
  {attention.length>0&&<p className="player-card-verification-note" role="status" aria-label="Games Not Counted Yet">{attention.map(r=>`Game ${r.gameNumber}: ${rowState[r.status]}.`).join(" ")}</p>}
  <div className="player-scorecard-scroll" role="region" aria-label="Practice scorecard; scroll right for opponent Tournament ID" tabIndex={0}>
   <table className="player-scorecard-table">
    <caption className="sr-only">Practice scorecard for {card.player.displayName}. Pending and unavailable results are excluded from totals.</caption>
    <colgroup><col className="game-number"/><col className="game-points"/><col className="spread-plus"/><col className="spread-minus"/><col className="opponent-name"/><col className="verification-id"/></colgroup>
    <thead><tr><th rowSpan={2} scope="col">Game</th><th rowSpan={2} scope="col">Game<br/>Points</th><th colSpan={2} scope="colgroup">Spread Points</th><th rowSpan={2} scope="col">Opponent</th><th rowSpan={2} scope="col">Tournament ID#</th></tr><tr><th scope="col">+</th><th scope="col">-</th></tr></thead>
    <tbody>{card.rows.map(r=><tr key={r.gameId} title={rowState[r.status]}><th scope="row">{r.gameNumber}</th><td>{r.gamePoints??'-'}</td><td>{r.plus?`+${formatScorecardSpread(r.plus)}`:'-'}</td><td>{r.minus?`-${formatScorecardSpread(r.minus)}`:'-'}</td><td className="player-card-opponent"><span className="player-card-opponent-name">{r.opponentName}</span>{r.status!=='complete'&&<span className="player-card-row-state">{rowState[r.status]}</span>}</td><td className="player-card-opponent-id">{r.opponentTournamentId}</td></tr>)}</tbody>
    <tfoot><tr><th scope="row">Total</th><td>{card.totals.gamePoints}</td><td>+{card.totals.plus}</td><td>-{card.totals.minus}</td><td colSpan={2}/></tr><tr className="player-card-net-row"><th colSpan={2} scope="row">Net Spread</th><td colSpan={2} className="player-card-net-value">{formatSignedNet(card.totals.net)}</td><td colSpan={2}/></tr></tfoot>
   </table>
  </div>
  <p className="player-card-hint">Scroll right for opponent ID#. A dash means no completed value in that column. Incomplete, disputed, unavailable and upcoming results are not counted in totals.</p>
 </section>;
}
