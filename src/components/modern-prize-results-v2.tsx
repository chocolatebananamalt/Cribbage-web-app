import type {ModernPrizeResultsV2 as ModernPrizeResultsViewV2} from '../lib/results/modern-prize-results-v2';
const money=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v/100);
export function ModernPrizeResultsV2({view}:{view:ModernPrizeResultsViewV2|null}){return <section className="correction-item" aria-labelledby="modern-prize-results-title" style={{overflowWrap:'anywhere'}}>
 <h2 id="modern-prize-results-title">Regular Prize Awards</h2>
 {view?<><p><strong>Recorded Unpaid Awards.</strong> These reviewed awards match the current event source at this Results snapshot. Nobody is marked paid, and this is not bank-settlement evidence.</p>
 <p>{view.eventKind==='main'?'Main':'Consolation'} regular prize fund and awards: {money(view.totalMinor)}. Payout increment: {money(view.roundingUnitMinor)}. Q-Pool and Side Pool funds remain separate.</p>
 {view.directorAdjusted&&<p>Graduated awards include reviewed Director adjustments to the suggestions. Every member of each finishing group receives the same amount.</p>}
 <ol>{view.groups.map(g=><li key={g.firstPlace}><strong>{g.firstPlace===g.lastPlace?`Place ${g.firstPlace}`:`Places ${g.firstPlace}-${g.lastPlace}`}</strong>: {g.included?`${money(g.perPersonMinor)} each; ${money(g.groupTotalMinor)} for this finishing group.`:'No Prize Award - Excluded by Saved Paid-Place Selection.'}<ul>{g.members.map(p=><li key={p.tournamentPlayerId}>{p.name} - Tournament ID {p.tournamentPlayerId}</li>)}</ul></li>)}</ol>
 <p>Recorded {view.recordedAt}. Refresh for a new source check. These awards do not establish MRP eligibility or ACC submission.</p></>:<p role="status">Current reviewed regular-prize awards are unavailable. A historical receipt or missing information is not a current award or a zero payout.</p>}
 </section>;}
