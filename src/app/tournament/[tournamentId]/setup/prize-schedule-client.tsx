"use client";
import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";
import { useEffect, useRef, useState } from "react";
import { directorPrizeScheduleVersion, type DirectorPrizeScheduleV1 } from "../../../../lib/results/prize-schedule";
import { formatUsd, parseUsdMinor } from "../../../../lib/money";
import { parsePrizePercentBasisPoints, semifinalWeightsFromPercentText } from "../../../../lib/results/prize-percentage-input";

type Props = { actorId: string; tournamentId: string; clientRowId: string; entryFeeCents: number; disabled?: boolean; onBlockingChange?: (blocking: boolean) => void };
import { isPrizeScheduleRequest, isPrizeScheduleWorkspace, isPrizeScheduleSaved, isRejectedPrizeSchedule, isPrizeScheduleReconciliation, type PrizeScheduleRequest, type PrizeScheduleWorkspace } from "../../../../lib/api/prize-schedule";
import { isUuid } from "../../../../lib/api/validation";
type Envelope = { kind: "prize-schedule"; operationId: string; request: PrizeScheduleRequest };
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const exact = (x: Record<string, unknown>, keys: string[]) => Object.keys(x).sort().join(",") === [...keys].sort().join(",");
const whole = (x: unknown, min = 0): x is number => Number.isSafeInteger(x) && (x as number) >= min;
function validEnvelope(x: unknown): x is Envelope { return record(x) && exact(x, ["kind", "operationId", "request"]) && x.kind === "prize-schedule" && isUuid(x.operationId) && isPrizeScheduleRequest(x.request); }
function outcome(x: unknown, tournamentId: string, clientRowId: string): "saved" | "rejected" | null {
  return isPrizeScheduleSaved(x, tournamentId, clientRowId) ? "saved" : isRejectedPrizeSchedule(x, clientRowId) ? "rejected" : null;
}
export default function PrizeScheduleClient({ actorId, tournamentId, clientRowId, entryFeeCents, disabled = false, onBlockingChange }: Props) {
  const endpoint = `/api/v1/tournaments/${tournamentId}/setup/prize-schedules/${clientRowId}`, key = `prize-schedule:${actorId}:${tournamentId}:${clientRowId}`;
  const retained = useRef<string | null>(null), flight = useRef(false), baseline = useRef(JSON.stringify({ weights: ["", "", ""], source: "", reason: "", reviewed: false }));
  const [workspace, setWorkspace] = useState<PrizeScheduleWorkspace | null>(null), [pending, setPending] = useState<Envelope | null>(null);
  const [busy, setBusy] = useState(true), [blocked, setBlocked] = useState(false), [message, setMessage] = useState("Loading prize schedules and recovery state.");
  const [weights, setWeights] = useState(["", "", ""]), [source, setSource] = useState(""), [reason, setReason] = useState(""), [reviewed, setReviewed] = useState(false);
  const [entries, setEntries] = useState(""), [expenses, setExpenses] = useState("");
  const [chartPercentages, setChartPercentages] = useState(["", "", "", ""]);
  useEffect(() => {
    let active = true;
    async function load() {
      let raw: string | null;
      try { raw = sessionStorage.getItem(key); retained.current = raw; } catch { if (active) { setBlocked(true); setBusy(false); setMessage("Recovery storage is unavailable. No write was started."); } return; }
      let saved: Envelope | null = null;
      if (raw) { let parsed: unknown; try { parsed = JSON.parse(raw); } catch { parsed = null; } if (!validEnvelope(parsed)) { if (active) { setBlocked(true); setBusy(false); setMessage("An unrecognized request remains saved locally. It cannot be overwritten here."); } return; } saved = parsed; }
      if (saved && active) { setPending(saved); setWeights([...saved.request.schedule.cohorts].sort((a, b) => a.bandStart - b.bandStart).map(c => String(c.weight))); setSource(saved.request.schedule.sourceReference); setReason(saved.request.reason); setReviewed(true); }
      let factsLoaded = false;
      try {
        const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" }); const data: unknown = response.ok ? await response.json() : null;
        if (!active) return;
        if (!isPrizeScheduleWorkspace(data, tournamentId, clientRowId)) { if (!saved) setBlocked(true); setMessage("Prize schedule facts are unavailable. No new write can start."); }
        else { factsLoaded = true; setWorkspace(data); if (!saved && data.versions[0]) { const latest = data.versions[0]; const loadedWeights = [...latest.schedule.cohorts].sort((a, b) => a.bandStart - b.bandStart).map(c => String(c.weight)); baseline.current = JSON.stringify({ weights: loadedWeights, source: latest.schedule.sourceReference, reason: "", reviewed: false }); setWeights(loadedWeights); setSource(latest.schedule.sourceReference); } }
      } catch { if (active) { if (!saved) setBlocked(true); setMessage("Prize schedule facts are unavailable. No new write can start."); } }
      if (saved) {
        try { const response = await fetch(`${endpoint}/reconciliation`, { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: saved.operationId }) }); const data: unknown = response.ok ? await response.json().catch(() => null) : null;
          if (!active) return;
          if (sessionStorage.getItem(key) !== raw) { setBlocked(true); setMessage("The retained request changed during recovery. The newer record remains saved."); }
          else if (isPrizeScheduleReconciliation(data, tournamentId, clientRowId) && data.result !== null) { const result = outcome(data.result, tournamentId, clientRowId); sessionStorage.removeItem(key); retained.current = null; setPending(null); if (result === "saved") setBlocked(true); setMessage(result === "saved" ? "Schedule saved. Reload to see authoritative versions." : "The exact schedule request was rejected. Review current facts."); }
          else setMessage("No completed receipt is available. The exact schedule request is retained for retry.");
        } catch { if (active) setMessage("Receipt recovery is unavailable. The exact schedule request remains saved for retry."); }
      } else if (active && factsLoaded) setMessage("Enter a director-selected schedule and review its evidence.");
      if (active) setBusy(false);
    }
    void load(); return () => { active = false; };
  }, [endpoint, key, tournamentId, clientRowId]);
  useEffect(() => { onBlockingChange?.(busy || blocked || !!pending || chartPercentages.some(value => value !== "") || (!!workspace && workspace.currentVersion > 0 && !workspace.settingsCurrent) || JSON.stringify({ weights, source, reason, reviewed }) !== baseline.current); }, [busy, blocked, pending, workspace, weights, source, reason, reviewed, chartPercentages, onBlockingChange]);
  async function save() {
    if (busy || blocked || flight.current || (!pending && (disabled || !workspace))) return;
    if (!pending && chartPercentages.some(value => value !== "")) { setMessage("Apply or discard the unapplied chart percentages before saving the schedule."); return; }
    const schedule: DirectorPrizeScheduleV1 = { kind: directorPrizeScheduleVersion, amountBasis: "total_award", expectedQualifierCount: 4, sourceReference: source, roundingRule: "floor_each_weighted_share_then_assign_remainder_to_champion", cohorts: weights.map((weight, i) => ({ bandStart: [1, 2, 3][i], bandEnd: [1, 2, 4][i], weight: Number(weight) })) };
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
  const locked = busy || blocked || !!pending || disabled || !workspace;
  const combinedChartWeights = semifinalWeightsFromPercentText(chartPercentages);
  function applyChartPercentages() {
    if (locked || flight.current || !combinedChartWeights) return;
    setWeights(combinedChartWeights.map(String)); setReviewed(false); setChartPercentages(["", "", "", ""]);
    setMessage("Combined semifinal chart shares into equal per-person weights. Review the source and save explicitly; no schedule was saved.");
  }
  const nums = weights.map(Number), count = Number(entries), expenseMinor = parseUsdMinor(expenses, { allowZero: true }), gross = count * entryFeeCents, cost = expenseMinor ?? 0, budget = gross - cost;
  const canPreview = entries !== "" && expenses !== "" && /^\d+$/.test(entries) && whole(count) && expenseMinor !== null && whole(gross) && budget > 0 && weights.every(w => /^[1-9]\d*$/.test(w)) && nums.every(n => whole(n, 1));
  let awards: number[] | null = null;
  if (canPreview) { const denominator = BigInt(nums[0]) + BigInt(nums[1]) + BigInt(2) * BigInt(nums[2]); if (denominator <= BigInt(Number.MAX_SAFE_INTEGER)) { const b = BigInt(budget); const a = nums.map(n => Number(b * BigInt(n) / denominator)); a[0] += budget - a[0] - a[1] - 2 * a[2]; if (a.every(n => n > 0)) awards = a; } }
  return <section className="policy-settings" aria-labelledby={`prize-schedule-${clientRowId}`}><h3 id={`prize-schedule-${clientRowId}`}>Main prize schedule</h3><p>Choose and post the rule before qualifying ends. A reviewed revision is allowed only before qualification is finalized and before playoff or settlement records exist; later weight changes are blocked.</p>
    <p>For one Main 12-game event with no pools and four qualifiers. Weights are per person; 3rd and 4th receive equal total awards. These are total awards, not round increments.</p><p role="status">{message}</p>
    {workspace && <><p>Current version: {workspace.currentVersion}. {workspace.activated ? "Event activated; the server determines whether revisions remain open." : "Event not yet activated."} {!workspace.settingsCurrent && "Setup settings have changed; review and save a revised schedule before activation."}</p>{workspace.versions.length > 0 && <details><summary>Saved schedule versions</summary>{workspace.versions.map(v => <div key={v.scheduleId}><p>Version {v.version} · {v.recordedAt}</p><p>Weights: {v.schedule.cohorts.map(c => c.weight).join(" / ")}; source: {v.schedule.sourceReference}; reason: {v.reason}</p></div>)}</details>}</>}
    <fieldset disabled={locked}><legend>Optional external chart percentages</legend><p>Enter a director-selected chart&apos;s 1st through 4th percentages, totaling exactly 100%. This is not an automatic chart import or an ACC-mandated split. Third and fourth shares are combined and divided equally between semifinal losers; existing cent-rounding rules remain unchanged.</p>{["1st place chart percentage", "2nd place chart percentage", "3rd place chart percentage", "4th place chart percentage"].map((label, i) => <label key={label}>{label}<input type="text" inputMode="decimal" value={chartPercentages[i]} maxLength={8} aria-invalid={chartPercentages[i] !== "" && parsePrizePercentBasisPoints(chartPercentages[i]) === null} onChange={e => setChartPercentages(chartPercentages.map((value, j) => i === j ? e.target.value : value))}/></label>)}{chartPercentages.some(value => value !== "") && !combinedChartWeights && <p role="alert">Enter four positive percentages with up to two decimal places, totaling exactly 100%.</p>}<button type="button" disabled={!combinedChartWeights} onClick={applyChartPercentages}>Combine semifinal shares into weights</button><button type="button" disabled={chartPercentages.every(value => value === "")} onClick={() => setChartPercentages(["", "", "", ""])}>Discard unapplied chart percentages</button></fieldset>
    <p>Schedule source and reason can appear in a player-visible summary. Do not include private information.</p><fieldset disabled={locked}><legend>Director selection</legend>{["1st place weight", "2nd place weight", "3rd-4th per-person weight"].map((label, i) => <label key={label}>{label}<input type="number" min="1" step="1" value={weights[i]} onChange={e => { setWeights(weights.map((w, j) => i === j ? e.target.value : w)); setReviewed(false); }} /></label>)}<label>Schedule source reference<input maxLength={500} value={source} onChange={e => { setSource(e.target.value); setReviewed(false); }} /></label><label>Reason for schedule<input maxLength={500} value={reason} onChange={e => { setReason(e.target.value); setReviewed(false); }} /></label><label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I reviewed this schedule and its source</label></fieldset>
    {chartPercentages.some(value => value !== "") && <p>Apply or discard the chart percentage draft before saving. Unapplied values block setup completion.</p>}
    <button type="button" className="primary" disabled={busy || blocked || (!pending && (disabled || !workspace || chartPercentages.some(value => value !== "")))} onClick={() => void save()}>{busy ? "Loading or saving schedule" : pending ? "Retry exact schedule" : "Save prize schedule"}</button>
    <fieldset><legend>Estimated prize budget preview</legend><p>Local assumptions only; this preview is not final or authoritative. Enter estimated entry count and total expenses in dollars.</p><label>Estimated entry count<input type="number" min="0" step="1" value={entries} onChange={e => setEntries(e.target.value)} /></label><label>Estimated total expenses (USD)<input type="text" inputMode="decimal" value={expenses} onChange={e => setExpenses(e.target.value)} aria-invalid={expenses !== "" && expenseMinor === null} /></label>{expenses !== "" && expenseMinor === null && <p role="alert">Enter a valid non-negative dollar amount with up to two decimal places.</p>}{awards && <><p>Estimated gross {formatUsd(gross)}, expenses {formatUsd(cost)}, prize budget {formatUsd(budget)}.</p><p>Estimated total awards: 1st {formatUsd(awards[0])}; 2nd {formatUsd(awards[1])}; 3rd and 4th {formatUsd(awards[2])} each. Each weighted share is rounded down; remaining cents go to the champion.</p></>}</fieldset>
  </section>;
}

