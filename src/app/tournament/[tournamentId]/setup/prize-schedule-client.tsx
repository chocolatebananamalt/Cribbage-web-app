"use client";
import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";
import { useEffect, useRef, useState } from "react";
import { isDirectorPrizeScheduleV3 } from "../../../../lib/results/prize-schedule";
import { buildSetupPrizeScheduleV3, previewSetupPrizeScheduleV3 } from "../../../../lib/results/prize-schedule-setup";
import { formatUsd, parseUsdMinor } from "../../../../lib/money";
import { parsePrizePercentBasisPoints, semifinalWeightsFromPercentText } from "../../../../lib/results/prize-percentage-input";

type Props = { actorId: string; tournamentId: string; clientRowId: string; entryFeeCents: number; disabled?: boolean; onBlockingChange?: (blocking: boolean) => void };
import { isPrizeScheduleRequest, isPrizeScheduleWorkspace, isPrizeScheduleSaved, isRejectedPrizeSchedule, isPrizeScheduleReconciliation, type PrizeScheduleRequest, type PrizeScheduleWorkspace } from "../../../../lib/api/prize-schedule";
import { isUuid } from "../../../../lib/api/validation";
type Envelope = { kind: "prize-schedule"; operationId: string; request: PrizeScheduleRequest };
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const exact = (x: Record<string, unknown>, keys: string[]) => Object.keys(x).sort().join(",") === [...keys].sort().join(",");
function validEnvelope(x: unknown): x is Envelope { return record(x) && exact(x, ["kind", "operationId", "request"]) && x.kind === "prize-schedule" && isUuid(x.operationId) && isPrizeScheduleRequest(x.request); }
function outcome(x: unknown, tournamentId: string, clientRowId: string): "saved" | "rejected" | null {
  return isPrizeScheduleSaved(x, tournamentId, clientRowId) ? "saved" : isRejectedPrizeSchedule(x, clientRowId) ? "rejected" : null;
}
export default function PrizeScheduleClient({ actorId, tournamentId, clientRowId, entryFeeCents, disabled = false, onBlockingChange }: Props) {
  const endpoint = `/api/v1/tournaments/${tournamentId}/setup/prize-schedules/${clientRowId}`, key = `prize-schedule:${actorId}:${tournamentId}:${clientRowId}`;
  const retained = useRef<string | null>(null), flight = useRef(false), baseline = useRef(JSON.stringify({ weights: ["", "", ""], source: "", reason: "", reviewed: false }));
  const [workspace, setWorkspace] = useState<PrizeScheduleWorkspace | null>(null), [pending, setPending] = useState<Envelope | null>(null);
  const [busy, setBusy] = useState(true), [blocked, setBlocked] = useState(false), [message, setMessage] = useState("Loading prize schedules and recovery state.");
  const [qualifierCount, setQualifierCount] = useState<4 | 5>(4);
  const [weights, setWeights] = useState(["", "", ""]), [source, setSource] = useState(""), [reason, setReason] = useState(""), [reviewed, setReviewed] = useState(false);
  const [entries, setEntries] = useState(""), [expenses, setExpenses] = useState(""), [benefitExpenses, setBenefitExpenses] = useState("");
  const [chartPercentages, setChartPercentages] = useState(["", "", "", ""]);
  useEffect(() => {
    let active = true;
    async function load() {
      let raw: string | null;
      try { raw = sessionStorage.getItem(key); retained.current = raw; } catch { if (active) { setBlocked(true); setBusy(false); setMessage("Recovery storage is unavailable. No write was started."); } return; }
      let saved: Envelope | null = null;
      if (raw) { let parsed: unknown; try { parsed = JSON.parse(raw); } catch { parsed = null; } if (!validEnvelope(parsed)) { if (active) { setBlocked(true); setBusy(false); setMessage("An unrecognized request remains saved locally. It cannot be overwritten here."); } return; } saved = parsed; }
      if (saved && active) { setPending(saved); setQualifierCount(saved.request.schedule.expectedQualifierCount); setWeights([...saved.request.schedule.cohorts].sort((a, b) => a.bandStart - b.bandStart).map(c => String(c.weight))); setSource(saved.request.schedule.sourceReference); setReason(saved.request.reason); setReviewed(true); }
      let factsLoaded = false, loadedLegacy = false;
      try {
        const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" }); const data: unknown = response.ok ? await response.json() : null;
        if (!active) return;
        if (!isPrizeScheduleWorkspace(data, tournamentId, clientRowId)) { if (!saved) setBlocked(true); setMessage("Prize schedule facts are unavailable. No new write can start."); }
        else { factsLoaded = true; setWorkspace(data); if (!saved && data.versions[0]) { const latest = data.versions[0]; loadedLegacy = !isDirectorPrizeScheduleV3(latest.schedule); const loadedWeights = [...latest.schedule.cohorts].sort((a, b) => a.bandStart - b.bandStart).map(c => String(c.weight)); baseline.current = JSON.stringify({ weights: loadedWeights, source: latest.schedule.sourceReference, reason: "", reviewed: false }); setQualifierCount(latest.schedule.expectedQualifierCount); setWeights(loadedWeights); setSource(latest.schedule.sourceReference); } }
      } catch { if (active) { if (!saved) setBlocked(true); setMessage("Prize schedule facts are unavailable. No new write can start."); } }
      if (saved) {
        try { const response = await fetch(`${endpoint}/reconciliation`, { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: saved.operationId }) }); const data: unknown = response.ok ? await response.json().catch(() => null) : null;
          if (!active) return;
          if (sessionStorage.getItem(key) !== raw) { setBlocked(true); setMessage("The retained request changed during recovery. The newer record remains saved."); }
          else if (isPrizeScheduleReconciliation(data, tournamentId, clientRowId) && data.result !== null) { const result = outcome(data.result, tournamentId, clientRowId); sessionStorage.removeItem(key); retained.current = null; setPending(null); if (result === "saved") setBlocked(true); setMessage(result === "saved" ? "Schedule saved. Reload to see authoritative versions." : "The exact schedule request was rejected. Review current facts."); }
          else setMessage("No completed receipt is available. The exact schedule request is retained for retry.");
        } catch { if (active) setMessage("Receipt recovery is unavailable. The exact schedule request remains saved for retry."); }
      } else if (active && factsLoaded) setMessage(loadedLegacy ? "Historical cent-rounded schedule is read-only. Existing values and history are preserved." : "Enter a director-selected schedule and review its evidence.");
      if (active) setBusy(false);
    }
    void load(); return () => { active = false; };
  }, [endpoint, key, tournamentId, clientRowId]);
  useEffect(() => { onBlockingChange?.(busy || blocked || !!pending || chartPercentages.some(value => value !== "") || (!!workspace && workspace.currentVersion > 0 && !workspace.settingsCurrent) || JSON.stringify({ weights, source, reason, reviewed }) !== baseline.current); }, [busy, blocked, pending, workspace, weights, source, reason, reviewed, chartPercentages, onBlockingChange]);
  async function save() {
    if (busy || blocked || flight.current || (!pending && (disabled || !workspace || legacyReadOnly))) return;
    if (!pending && chartPercentages.some(value => value !== "")) { setMessage("Apply or discard the unapplied chart percentages before saving the schedule."); return; }
    const schedule = buildSetupPrizeScheduleV3(qualifierCount, weights, source);
    const request: unknown = pending?.request ?? { expectedVersion: workspace?.currentVersion, schedule, reviewed, reason };
    if (!isPrizeScheduleRequest(request) || (!pending && weights.some(w => !/^[1-9]\d*$/.test(w)))) { setMessage("Enter positive whole weights, source, reason, and review confirmation."); return; }
    flight.current = true; setBusy(true);
    try {
      if (sessionStorage.getItem(key) !== retained.current) { setBlocked(true); setMessage("Another request changed recovery storage. It has not been overwritten."); return; }
      const operation = pending ?? { kind: "prize-schedule" as const, operationId: crypto.randomUUID(), request }; const raw = retained.current ?? JSON.stringify(operation);
      if (!pending) setAppRecoveryItem(sessionStorage, key, raw); retained.current = raw; setPending(operation); setMessage("Saving the exact schedule request.");
      const response = await fetch(endpoint, { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json", "x-idempotency-key": operation.operationId }, body: JSON.stringify(operation.request) }); const result: unknown = await response.json().catch(() => null);
      if (sessionStorage.getItem(key) !== raw) { setBlocked(true); setMessage("The retained request changed while the write was pending. The newer record remains saved."); return; }
      const accepted = response.ok && outcome(result, tournamentId, clientRowId) === "saved", rejected = response.status === 409 && outcome(result, tournamentId, clientRowId) === "rejected";
      if (accepted || rejected) { sessionStorage.removeItem(key); retained.current = null; setPending(null); setMessage(accepted ? "Schedule saved. Reload to see authoritative versions." : `The exact schedule request was rejected (${(result as {code:string}).code}). Review current facts.`); if (accepted) setBlocked(true); return; }
      setMessage("The outcome is uncertain. The exact schedule request remains saved for retry.");
    } catch { setMessage(retained.current ? "The outcome is uncertain. The exact schedule request remains saved for retry." : "Recovery storage is unavailable. No write was started."); }
    finally { flight.current = false; setBusy(false); }
  }
  const legacyReadOnly = !!workspace?.versions[0] && !isDirectorPrizeScheduleV3(workspace.versions[0].schedule);
  const locked = busy || blocked || !!pending || disabled || !workspace || legacyReadOnly;
  const combinedChartWeights = semifinalWeightsFromPercentText(chartPercentages);
  function applyChartPercentages() {
    if (locked || flight.current || !combinedChartWeights) return;
    setWeights(combinedChartWeights.map(String)); setReviewed(false); setChartPercentages(["", "", "", ""]);
    setMessage("Combined semifinal chart shares into equal per-person weights. Review the source and save explicitly; no schedule was saved.");
  }
  const expenseMinor = parseUsdMinor(expenses, { allowZero: true }), benefitMinor = parseUsdMinor(benefitExpenses, { allowZero: true });
  const preview = legacyReadOnly ? null : previewSetupPrizeScheduleV3({ entryCount: entries, entryFeeMinor: entryFeeCents, expenses, benefitExpenses, expectedQualifierCount: qualifierCount, weights });
  return <section className="policy-settings" aria-labelledby={`prize-schedule-${clientRowId}`}><h3 id={`prize-schedule-${clientRowId}`}>Main prize schedule</h3><p>Choose and post the rule before qualifying ends. A reviewed revision is allowed only before qualification is finalized and before playoff or settlement records exist; later weight changes are blocked.</p>
    <p>For one Main 12-game event and four or five qualifiers, without Side Pools. Supported Q Pools use separate funding and awards; this schedule allocates only the base entry-fee prize budget. Save it before collecting payments or Q Pool elections. Weights are per person; 3rd and 4th receive equal total awards. These are total awards, not round increments.</p><p>New declarations use automatic $5 cohort rounding: round the prize budget down if player benefits still meet the minimum 85% of gross base entry fees; otherwise round it up. Every award is a positive $5 multiple, with equal awards for the same elimination band. This is the selected app rule, not an ACC-mandated prize split.</p><p role="status">{message}</p>
    {legacyReadOnly && <p className="auth-note">Historical schedule and cent-rounded awards remain unchanged. This screen does not convert them to the new rule or create a replacement financial obligation.</p>}
    {workspace && <><p>Current version: {workspace.currentVersion}. {workspace.activated ? "Event activated; the server determines whether revisions remain open." : "Event not yet activated."} {!workspace.settingsCurrent && "Setup settings have changed; review and save a revised schedule before activation."}</p>{workspace.versions.length > 0 && <details><summary>Saved schedule versions</summary>{workspace.versions.map(v => <div key={v.scheduleId}><p>Version {v.version} · {v.recordedAt}</p><p>Weights: {v.schedule.cohorts.map(c => c.weight).join(" / ")}; source: {v.schedule.sourceReference}; reason: {v.reason}</p></div>)}</details>}</>}
    <fieldset disabled={locked || qualifierCount !== 4}><legend>Optional four-qualifier chart percentages</legend><p>Enter a director-selected chart&apos;s 1st through 4th percentages, totaling exactly 100%. This is not an automatic chart import or an ACC-mandated split. Third and fourth shares are combined and divided equally between semifinal losers; the selected $5 cohort rule is then applied to the resulting weights.</p>{["1st place chart percentage", "2nd place chart percentage", "3rd place chart percentage", "4th place chart percentage"].map((label, i) => <label key={label}>{label}<input type="text" inputMode="decimal" value={chartPercentages[i]} maxLength={8} aria-invalid={chartPercentages[i] !== "" && parsePrizePercentBasisPoints(chartPercentages[i]) === null} onChange={e => setChartPercentages(chartPercentages.map((value, j) => i === j ? e.target.value : value))}/></label>)}{chartPercentages.some(value => value !== "") && !combinedChartWeights && <p role="alert">Enter four positive percentages with up to two decimal places, totaling exactly 100%.</p>}<button type="button" disabled={!combinedChartWeights} onClick={applyChartPercentages}>Combine semifinal shares into weights</button><button type="button" disabled={chartPercentages.every(value => value === "")} onClick={() => setChartPercentages(["", "", "", ""])}>Discard unapplied chart percentages</button></fieldset>
    <p>Schedule source and reason can appear in a player-visible summary. Do not include private information.</p><fieldset disabled={locked}><legend>Director selection</legend><label>Expected playoff qualifiers<select value={qualifierCount} onChange={e => { const n = Number(e.target.value) as 4 | 5; setQualifierCount(n); setWeights(n === 5 ? [...weights.slice(0, 3), weights[3] ?? ""] : weights.slice(0, 3)); setReviewed(false); setChartPercentages(["", "", "", ""]); }}><option value={4}>4 qualifiers, no byes</option><option value={5}>5 qualifiers, 3 first-round byes</option></select></label><p>The saved schedule must match the finalized qualifier count. Five qualifiers require an explicit fifth-place weight; a bye creates no additional prize.</p>{(qualifierCount === 5 ? ["1st place weight", "2nd place weight", "3rd–4th per-person weight", "5th place weight"] : ["1st place weight", "2nd place weight", "3rd–4th per-person weight"]).map((label, i) => <label key={label}>{label}<input type="number" min="1" step="1" value={weights[i]} onChange={e => { setWeights(weights.map((w, j) => i === j ? e.target.value : w)); setReviewed(false); }} /></label>)}<label>Schedule source reference<input maxLength={500} value={source} onChange={e => { setSource(e.target.value); setReviewed(false); }} /></label><label>Reason for schedule<input maxLength={500} value={reason} onChange={e => { setReason(e.target.value); setReviewed(false); }} /></label><label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I reviewed this schedule and its source</label></fieldset>
    {chartPercentages.some(value => value !== "") && <p>Apply or discard the chart percentage draft before saving. Unapplied values block setup completion.</p>}
    <button type="button" className="primary" disabled={busy || blocked || (!pending && (disabled || legacyReadOnly || !workspace || chartPercentages.some(value => value !== "")))} onClick={() => void save()}>{busy ? "Loading or saving schedule" : pending ? "Retry exact schedule" : "Save prize schedule"}</button>
    <fieldset disabled={legacyReadOnly}><legend>Estimated prize budget preview</legend><p>Local assumptions only; final amounts are recomputed from actual entries and approved classified expenses. The saved schedule is the rule, not this estimated entrant count or these dollar awards. Enter total expenses and the player-benefit portion separately. Sanctioning and eligible meals are player benefits; hall rental and cards are operating costs.</p><label>Estimated entry count<input type="number" min="0" step="1" value={entries} onChange={e => setEntries(e.target.value)} /></label><label>Estimated total expenses (USD)<input type="text" inputMode="decimal" value={expenses} onChange={e => setExpenses(e.target.value)} aria-invalid={expenses !== "" && expenseMinor === null} /></label><label>Estimated player-benefit expenses (USD)<input type="text" inputMode="decimal" value={benefitExpenses} onChange={e => setBenefitExpenses(e.target.value)} aria-invalid={benefitExpenses !== "" && (benefitMinor === null || (expenseMinor !== null && benefitMinor > expenseMinor))} /></label>{((expenses !== "" && expenseMinor === null) || (benefitExpenses !== "" && benefitMinor === null)) && <p role="alert">Enter a valid non-negative dollar amount with up to two decimal places.</p>}{benefitMinor !== null && expenseMinor !== null && benefitMinor > expenseMinor && <p role="alert">Player-benefit expenses cannot exceed total expenses.</p>}
    {preview?.status === 'blocked' && <p role="alert">Estimated prize rounding is blocked: {preview.code.replaceAll('_', ' ')}. No award or funding record was created.</p>}
    {preview?.status === 'calculated' && <><p>Estimated gross {formatUsd(preview.grossBaseIncomeMinor)}, expenses {formatUsd(preview.expenseTotalMinor)}, original prize budget {formatUsd(preview.originalBudgetMinor)}.</p><p>Rounded prize budget {formatUsd(preview.roundedBudgetMinor)}; direction {preview.direction}; signed adjustment {preview.adjustmentMinor > 0 ? '+' : ''}{formatUsd(preview.adjustmentMinor)}.</p><p>Estimated total awards: 1st {formatUsd(preview.awardsMinor[0])}; 2nd {formatUsd(preview.awardsMinor[1])}; 3rd and 4th {formatUsd(preview.awardsMinor[2])} each{qualifierCount === 5 ? `; 5th ${formatUsd(preview.awardsMinor[4])}` : ''}. All awards are positive $5 multiples.</p><p>Estimated participant return {formatUsd(preview.participantReturnMinor)}; minimum {formatUsd(preview.minimumReturnMinor)}.</p>{preview.requiredFundingMinor > 0 && <p role="alert">Additional funding required: {formatUsd(preview.requiredFundingMinor)}. This estimate does not record funding, invent a receipt or permit finalization. The actual shortfall must be evidenced in unpaid accounting.</p>}{preview.restrictedBalanceMinor > 0 && <p>Restricted remaining balance: {formatUsd(preview.restrictedBalanceMinor)}. It remains separately accounted for and is not director profit.</p>}<p>Exact weighted-share deviation: {preview.objective.numeratorMinor}/{preview.objective.denominator} cents. The server repeats this calculation before recording awards; supported rounded budgets are at most $100,000.</p></>}</fieldset>
  </section>;
}
