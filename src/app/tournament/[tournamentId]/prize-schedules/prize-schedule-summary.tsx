import Link from "next/link";
import type { PrizeScheduleWorkspace, PrizeAwardSummary } from "../../../../lib/api/prize-schedule";
import { formatUsd } from "../../../../lib/money";
export default function PrizeScheduleSummary({tournamentId,schedules,resolved}:{tournamentId:string;schedules:PrizeScheduleWorkspace[]|null;resolved:PrizeAwardSummary[]|null}) {
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="prize-summary-title">
    <h1 id="prize-summary-title">Director-selected prize schedules</h1>
    <Link href={`/tournament/${tournamentId}`}>Back to tournament</Link>
    <p>This printable page records the director’s selected total-award rule, not a universal ACC formula. Print with your browser’s Print command. No money is transferred here.</p>
    {resolved === null ? <p role="alert">Reviewed award amounts are unavailable. An empty award list has not been inferred.</p> : null}
    {schedules === null ? <p role="alert">Prize schedules are unavailable. No saved rule is inferred.</p> : schedules.length === 0 ? <p>No structured schedule has been published. Historical free-text notes remain unstructured; ask the director for the posted prize information.</p> : schedules.map((workspace, index) => <section key={workspace.clientRowId} className="correction-item">
      <h2>Event schedule {index + 1}</h2><p>{workspace.activated ? "Published with activated event" : "Private setup draft"}. {workspace.settingsCurrent ? "Saved event settings match." : "Event settings changed: a reviewed revision is required before use."}</p>
      {resolved?.find(r => r.eventId === workspace.eventId) ? <section><h3>Reviewed total awards</h3><p>{resolved.find(r => r.eventId === workspace.eventId)?.status === "unpaid" ? "These are reviewed unpaid obligations. No bank payment or refund has been executed." : "These amounts are from the recorded payback review, not proof of a bank payment."}</p><ul>{resolved.find(r => r.eventId === workspace.eventId)?.awards.map((a, i) => <li key={i}>{a.displayName}, band {a.bandStart === a.bandEnd ? a.bandStart : `${a.bandStart}-${a.bandEnd}`}: {formatUsd(a.amountMinor)}</li>)}</ul></section> : resolved !== null ? <p>There are no current reviewed award amounts to publish yet.</p> : null}
      {workspace.versions.map((v, i) => <section key={v.scheduleId}><h3>Version {v.version}{i === 0 ? " — current rule" : " — history"}</h3>
        <p>Source: {v.schedule.sourceReference}</p><p>Review reason: {v.reason}</p><p>Recorded: {v.recordedAt}</p>
        <p>{v.schedule.expectedQualifierCount === 5 ? "Exactly five qualifiers, with three first-round playoff byes." : "Exactly four qualifiers, no byes."} Available cash is actual entry income minus all current recorded expenses, with the independent payback review still required.</p>
        <ul>{v.schedule.cohorts.map(c => <li key={c.bandStart}>Finishing band {c.bandStart === c.bandEnd ? c.bandStart : `${c.bandStart}–${c.bandEnd}`}: weight {c.weight} per person.</li>)}</ul>
        <p>Weights cannot be revised after qualification is finalized. These are total awards, not additional payments each round. {v.schedule.kind === "regular-prize-cohort-5usd-v3" ? "The regular budget rounds down to $5 if required return is met, otherwise up. Every award is a $5 multiple and shared-band awards stay equal. Any additional funding must be recorded before unpaid finalization; a downward balance remains separately accounted for." : "Historical rule: each weighted share is rounded down to whole cents; all remaining cents go to the champion. Shared-band players receive equal awards."}</p>
        <p>Amounts are not promised from estimated entries. A different qualifier count or unsupported pool/bracket requires separately supported review; no automatic replacement formula is used.</p>
      </section>)}
    </section>)}
  </section></main>;
}
