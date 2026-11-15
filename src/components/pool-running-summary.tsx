import { isRunningPoolWorkspace, type RunningPoolRow, type RunningPoolWorkspace } from "../lib/results/pool-running-summary";
import styles from "./pool-running-summary.module.css";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const observedTime = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC", timeZoneName: "short" });
/** Use Intl grouping/currency with the original integer cents, including large
 * safe values whose cents would be lost by floating-point division by 100.
 */
function money(minor: number | null) {
  if (minor === null) return "Not available";
  const cents = BigInt(minor), decimal = String(cents % BigInt(100)).padStart(2, "0");
  return usd.formatToParts(cents / BigInt(100)).map(part => part.type === "fraction" ? decimal : part.value).join("");
}
const count = (value: number | null) => value === null ? "Not available" : whole.format(value);
const kindName = (kind: "q" | "side") => kind === "q" ? "Q Pool" : "Side Pool";

function PoolRow({ row }: { row: RunningPoolRow }) {
  return <section className={styles.pool} aria-label={`${kindName(row.kind)}: ${row.name}`} data-testid="pool-summary-row" data-pool-kind={row.kind}>
    <p className={styles.kind}>{kindName(row.kind)}</p><h4>{row.name}</h4>
    <p>Entry fee: <strong>{money(row.feeMinor)}</strong></p>
    <p className={row.status === "available" ? styles.available : styles.incomplete}>{row.status === "available" ? "Recorded summary available" : row.status === "partial" ? "Incomplete recorded summary — review needed" : "Pool summary not available"}</p>
    <dl className={styles.facts}>
      <div><dt>Recorded entries</dt><dd>{count(row.enteredCount)}</dd></div>
      <div><dt>Fully paid recorded entries</dt><dd>{count(row.fullyPaidCount)}</dd></div>
      <div><dt>Paid-entry eligible count</dt><dd>{count(row.eligiblePaidEntryCount)}</dd></div>
      <div><dt>Recorded pool amount</dt><dd>{money(row.recordedPoolTotalMinor)}</dd></div>
      <div><dt>Eligible contribution amount</dt><dd>{money(row.eligiblePoolTotalMinor)}</dd></div>
      <div className={styles.estimate}><dt>Projected if all entered pay (estimate)</dt><dd>{money(row.projectedIfAllEnteredPayMinor)}</dd></div>
    </dl>
    <p className={styles.explanation}>Paid-entry eligibility is not playoff qualification. The projected amount is an estimate, not an award schedule.</p>
    {row.recordedPoolTotalMinor === null && row.knownRecordedSubtotalMinor !== null && <p className={styles.incomplete} data-testid="pool-known-subtotal"><strong>Known recorded subtotal — incomplete:</strong> {money(row.knownRecordedSubtotalMinor)}. The full recorded pool amount is not available.</p>}
    <dl className={styles.secondary}>
      <div><dt>Partially paid recorded entries</dt><dd>{count(row.partiallyPaidCount)}</dd></div>
      <div><dt>Entries with unknown payment status</dt><dd>{count(row.unknownPaymentCount)}</dd></div>
      <div><dt>Held or excluded recorded amount</dt><dd>{money(row.heldRecordedMinor)}</dd></div>
    </dl>
    {row.heldOrExcludedReviewRequired && <p className={styles.warning} role="status" data-testid="pool-review-warning"><strong>Held or excluded contributions need review.</strong> They must not be assumed available for awards.</p>}
    {row.issues.length > 0 && <p className={styles.warning} role="status">Some information for this pool needs review. Unknown values remain marked “Not available.”</p>}
  </section>;
}

/** Aggregate-only display. No source-model details, network or record actions. */
export default function PoolRunningSummary({ workspace }: { workspace: RunningPoolWorkspace | null }) {
  if (!isRunningPoolWorkspace(workspace)) return <section className={styles.summary} data-testid="pool-running-summary"><h2>Running pool summary</h2><p className={styles.warning} role="status">Pool summary not available. This view does not establish whether pools are configured.</p></section>;
  const observation = workspace.sourceObservation === "observed-source-drift"
    ? "The source records changed while this snapshot was prepared. Review current records; the figures may be incomplete."
    : workspace.sourceObservation === "matching-double-read-not-atomic"
      ? "Two checks found matching source records. Changes after those checks may not be reflected here."
      : "This snapshot was assembled from supplied records. Changes occurring while it was prepared may not be reflected here.";
  return <section className={styles.summary} data-testid="pool-running-summary">
    <h2>Running pool summary</h2>
    <p className={styles.notice}>Read-only snapshot of recorded totals and estimates. These figures are not awards, payment confirmation or a bank balance. Displaying this summary does not move money.</p>
    <p data-testid="pool-observed-at"><strong>Observed at:</strong> <time dateTime={workspace.observedAt}>{observedTime.format(new Date(workspace.observedAt))}</time></p>
    <p className={workspace.sourceObservation === "observed-source-drift" ? styles.warning : styles.explanation} role={workspace.sourceObservation === "observed-source-drift" ? "status" : undefined}>{observation}</p>
    {workspace.issues.length > 0 && <p className={styles.warning} role="status">Some pool information needs review. Incomplete figures must not be treated as final totals.</p>}
    {(["q", "side"] as const).map(kind => {
      const state = kind === "q" ? workspace.qState : workspace.sideState, rows = workspace.pools.filter(p => p.kind === kind), plural = kind === "q" ? "Q Pools" : "Side Pools";
      return <section className={styles.group} aria-label={plural} key={kind}>
        <h3>{plural}</h3>
        <p data-testid={`pool-source-${kind}`} className={state === "unavailable" ? styles.warning : styles.explanation}>{state === "unavailable"
          ? `${kindName(kind)} source information is not available. This does not mean that no pool exists.`
          : state === "no-recorded-pool" ? `No ${kindName(kind)} is recorded in this snapshot.`
            : rows.length ? `${plural} recorded in this snapshot:` : `${kindName(kind)} details are not available in this snapshot.`}</p>
        {rows.map(row => <PoolRow key={row.poolId} row={row}/>)}
      </section>;
    })}
  </section>;
}
