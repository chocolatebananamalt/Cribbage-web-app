import type { NamedPreview } from "../../../../../../lib/api/multi-event-award-preview";
import type {ReactNode} from 'react';
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n / 100);
export function PreviewView({ view, blocked, tournamentId, eventId, children }: { view: NamedPreview | null; blocked: boolean; tournamentId: string; eventId: string; children?:ReactNode }) {
  return <main className="auth-shell"><section className="auth-card corrections-card">
    <p className="eyebrow">TEST ONLY · SIMULATED ACCOUNTING</p><h1>{view ? `${view.eventName} — award preview` : "Award preview unavailable"}</h1>
    <p>This is a calculated preview of fictional records. It is not final accounting; no money was received or paid.</p>
    <p><a href={`/tournament/${tournamentId}`}>Tournament</a> · <a href={`/tournament/${tournamentId}/results?event=${eventId}`}>Event results</a></p>
    {!view ? <p role="status">{blocked ? "Complete and verify this event’s financial and result sources before viewing awards." : "The preview or its participant names could not be verified. Try again when the test sources are available."}</p> : <>
      <h2>Event totals</h2><ul><li>Base entry: {money(view.baseIncomeMinor)}</li><li>Q pools: {money(view.qIncomeMinor)}</li><li>Side pools: {money(view.sideIncomeMinor)}</li><li>Expenses: {money(view.expenseMinor)} (including {money(view.benefitMinor)} in player benefits)</li><li>Additional funding required: {money(view.requiredFundingMinor)}</li><li>Restricted remainder: {money(view.restrictedResidualMinor)}</li></ul>
      <h2>Regular awards</h2><ul>{view.regularAwards.map(r => <li key={r.participantId}>{r.name}: {money(r.amountMinor)} · place {r.bandStart}{r.bandEnd !== r.bandStart ? `–${r.bandEnd}` : ""}</li>)}</ul>
      {view.pools.map((pool, i) => <section key={`${pool.kind}-${i}`}><h2>{pool.name} · {pool.kind === "q" ? "Q pool" : "Side pool"}</h2><p>Pool total: {money(pool.fundMinor)}</p>{pool.awards.length ? <ul>{pool.awards.map(a => <li key={a.participantId}>{a.name}: {money(a.amountMinor)}{a.kind === "refund" ? " refund" : ""}</li>)}</ul> : <p>No paid entries.</p>}</section>)}
    </>}
  {children}</section></main>;
}
