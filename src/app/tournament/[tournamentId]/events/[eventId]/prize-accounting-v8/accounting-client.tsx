"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUsd, parseUsdMinor } from "../../../../../../lib/money";
import { isUuid } from "../../../../../../lib/api/validation";
import { setAppRecoveryItem } from "../../../../../../lib/recovery-write-coordinator";
import { Q_ACCOUNTING_EXPENSE_CATEGORIES, isPrizeAccountingRequestV8, isPrizeAccountingResultV8, isPrizeAccountingWorkspaceV8, prizeAccountingResultMatchesV8, type PrizeAccountingActionV8, type PrizeAccountingClassificationV8, type PrizeAccountingDraftRequestV8, type PrizeAccountingFinalRequestV8, type PrizeAccountingFundingRequestV8, type PrizeAccountingVoidFundingRequestV8, type PrizeAccountingRequestV8, type PrizeAccountingWorkspaceV8 } from "../../../../../../lib/api/prize-accounting-v8";

type Envelope = { kind: "prize-accounting-v8"; operationId: string; action: PrizeAccountingActionV8; request: PrizeAccountingRequestV8 };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const validEnvelope = (v: unknown): v is Envelope => object(v) && Object.keys(v).sort().join() === "action,kind,operationId,request" && v.kind === "prize-accounting-v8" && isUuid(v.operationId) && ["draft", "funding", "void_funding", "final"].includes(v.action as string) && isPrizeAccountingRequestV8(v.request, v.action as PrizeAccountingActionV8);
const label = (s: string) => s.replaceAll("_", " ");
export default function PrizeAccountingClient({ actorId, tournamentId, eventId, initialWorkspace }: { actorId: string; tournamentId: string; eventId: string; initialWorkspace: PrizeAccountingWorkspaceV8 | null }) {
  const key = `payment-obligation:prize-accounting-v8:${actorId}:${eventId}`, url = `/api/v1/tournaments/${tournamentId}/events/${eventId}/prize-accounting-v8`;
  const [workspace, setWorkspace] = useState(initialWorkspace), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [needsRefresh, setNeedsRefresh] = useState(false);
  const [pending, setPending] = useState<Envelope | null>(null), [message, setMessage] = useState("Checking retained accounting work."), [reason, setReason] = useState(""), [reviewed, setReviewed] = useState(false), [finalReviewed, setFinalReviewed] = useState(false);
  const [categories, setCategories] = useState<Record<string, string>>({}), [evidence, setEvidence] = useState<Record<string, string>>({});
  const [fundingAmount, setFundingAmount] = useState(""), [fundingAt, setFundingAt] = useState(""), [fundingEvidence, setFundingEvidence] = useState(""), [fundingReviewed, setFundingReviewed] = useState(false), [voidsId, setVoidsId] = useState(""), [voidReviewed, setVoidReviewed] = useState(false);
  const flight = useRef(false), retained = useRef<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(url, { cache: "no-store" });
    const data: unknown = await response.json();
    if (!response.ok || !isPrizeAccountingWorkspaceV8(data, tournamentId, eventId)) throw Error("accounting_unavailable");
    setWorkspace(data); setNeedsRefresh(false); setReviewed(false); setFinalReviewed(false); setFundingReviewed(false); setVoidReviewed(false);
  }, [url, tournamentId, eventId]);
  const finish = useCallback(async (raw: string, operation: Envelope, value: unknown) => {
    if (!isPrizeAccountingResultV8(value, eventId) || !prizeAccountingResultMatchesV8(value, operation.action, operation.request)) { setMessage("Outcome remains uncertain. The exact accounting request is retained."); return; }
    if (value.status === "rejected" && value.code === "idempotency_conflict") { setBlocked(true); setMessage("Operation identity conflict. Retained work is preserved; further recording is blocked."); return; }
    try { if (sessionStorage.getItem(key) !== raw) throw Error("retained_work_changed"); sessionStorage.removeItem(key); }
    catch { setBlocked(true); setMessage("Outcome received, but retained accounting work could not be cleared safely."); return; }
    retained.current = null; setPending(null); setNeedsRefresh(true); setReviewed(false); setFinalReviewed(false);
    setMessage(value.status === "rejected" ? `Accounting request rejected: ${label(value.code)}. Refresh sources before another review.` : value.status === "prize_accounting_draft_saved_v8" ? "Unpaid accounting draft recorded. No money moved." : value.status === "prize_rounding_funding_recorded_v8" ? value.eventType === "received" ? "Existing contribution evidence recorded. No transfer was executed by the app." : "Funding record correction recorded. No refund was executed." : "Unpaid accounting finalized. Nobody was marked paid and no money moved.");
    if (value.status !== "rejected") { try { await load(); } catch { setNeedsRefresh(true); setMessage("Accounting receipt confirmed. Refresh sources before another review; current workspace could not be loaded."); } }
  }, [eventId, key, load]);
  const reconcile = useCallback(async (operation: Envelope, raw: string, isActive: () => boolean = () => true) => {
    const response = await fetch(`${url}/reconciliation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId: operation.operationId, action: operation.action, request: operation.request }) });
    const data: unknown = await response.json();
    if (!isActive()) return true;
    if (!response.ok || !object(data) || Object.keys(data).sort().join() !== "authorized,result" || data.authorized !== true) throw Error("reconciliation_unavailable");
    if (data.result === null) { setMessage("No completed accounting receipt. Retry only the exact retained request."); return false; }
    await finish(raw, operation, data.result); return true;
  }, [url, finish]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const raw = sessionStorage.getItem(key);
        if (!active) return;
        if (!raw) { setReady(true); setMessage("Review current unpaid accounting sources."); return; }
        let operation: unknown; try { operation = JSON.parse(raw); } catch { operation = null; }
        if (!validEnvelope(operation)) { setBlocked(true); setReady(true); setMessage("Unrecognized retained accounting work. It was preserved and recording is blocked."); return; }
        retained.current = raw; setPending(operation); setReady(true); flight.current = true; setBusy(true);
        try { await reconcile(operation, raw, () => active); } catch { if (active) setMessage("Accounting reconciliation unavailable. The exact request remains retained."); }
        finally { if (active) { flight.current = false; setBusy(false); } }
      } catch { if (active) { setBlocked(true); setReady(true); setMessage("Recovery storage unavailable. Accounting recording is blocked."); } }
    })();
    return () => { active = false; };
  }, [key, reconcile]);
  async function send(action: PrizeAccountingActionV8, request: PrizeAccountingRequestV8, retry = false) {
    if (flight.current || blocked || !ready) return;
    flight.current = true; setBusy(true);
    try {
      const operation: Envelope = retry && pending ? pending : { kind: "prize-accounting-v8", action, request, operationId: crypto.randomUUID() };
      if (!validEnvelope(operation) || (pending && !retry)) throw Error("pending_work");
      let raw = retained.current;
      if (retry) {
        if (!pending || !raw || sessionStorage.getItem(key) !== raw || JSON.stringify(operation) !== raw) { setBlocked(true); setMessage("Retained accounting work changed. Recording is blocked."); return; }
        if (await reconcile(operation, raw)) return;
      } else {
        if (sessionStorage.getItem(key) !== null) { setBlocked(true); setMessage("Other retained accounting work exists. It was not overwritten."); return; }
        raw = JSON.stringify(operation); setAppRecoveryItem(sessionStorage, key, raw); retained.current = raw; setPending(operation);
      }
      const response = await fetch(`${url}/${operation.action === "final" ? "finalize" : operation.action === "void_funding" ? "void-funding" : operation.action}`, { method: "POST", headers: { "Content-Type": "application/json", "x-idempotency-key": operation.operationId }, body: JSON.stringify(operation.request) });
      const result: unknown = await response.json();
      await finish(raw!, operation, result);
    } catch {
      if (retained.current) setMessage("Recording could not be confirmed. The exact accounting request remains retained; no automatic retry will occur.");
      else setMessage("Recording did not start because recovery preparation failed. No request was sent.");
    }
    finally { flight.current = false; setBusy(false); }
  }
  const locked = !ready || busy || blocked || pending !== null || needsRefresh || !workspace || workspace.blockers.length > 0 || workspace.finalization !== null;
  const expenses = workspace?.facts?.expenseEvidence ?? [];
  const classifications = expenses.map(e => ({ expenseEventId: e.expenseEventId, category: categories[e.expenseEventId], evidenceReference: evidence[e.expenseEventId]?.trim() ?? "" })) as PrizeAccountingClassificationV8[];
  const draftRequest = (): PrizeAccountingDraftRequestV8 => ({ expectedVersion: workspace!.currentDraftVersion, sourceDigest: workspace!.sourceDigest, reason: reason.trim(), expenseClassifications: classifications, reviewed: true });
  const fundingMinor = parseUsdMinor(fundingAmount), receivedAtValid = !!fundingAt && Number.isFinite(Date.parse(fundingAt));
  const fundingRequest = (): PrizeAccountingFundingRequestV8 => ({ expectedVersion: workspace!.funding.version, sourceDigest: workspace!.sourceDigest, draftId: workspace!.draft!.id, amountMinor: fundingMinor!, receivedAt: new Date(fundingAt).toISOString(), evidenceReference: fundingEvidence.trim(), reason: reason.trim(), reviewed: true });
  const voidRequest = (): PrizeAccountingVoidFundingRequestV8 => ({ expectedVersion: workspace!.funding.version, sourceDigest: workspace!.sourceDigest, draftId: workspace!.draft!.id, voidsId, reason: reason.trim(), reviewed: true });
  const finalRequest = (): PrizeAccountingFinalRequestV8 => ({ expectedVersion: workspace!.currentFinalVersion, draftId: workspace!.draft!.id, draftVersion: workspace!.draft!.version, expectedFundingVersion: workspace!.funding.version, reason: reason.trim(), reviewed: true });
  const canDraft = !locked && reviewed && isPrizeAccountingRequestV8(draftRequest(), "draft");
  const currentDraft = !!workspace?.draft?.current;
  const canFund = !locked && currentDraft && fundingReviewed && fundingMinor !== null && fundingMinor <= workspace!.funding.shortfallMinor && receivedAtValid && isPrizeAccountingRequestV8(fundingRequest(), "funding");
  const voided = new Set(workspace?.funding.records.filter(r => r.eventType === "voided").map(r => r.voidsId) ?? []);
  const activeReceipts = workspace?.funding.records.filter(r => r.eventType === "received" && !voided.has(r.id)) ?? [];
  const canVoid = !locked && currentDraft && voidReviewed && activeReceipts.some(r => r.id === voidsId) && isPrizeAccountingRequestV8(voidRequest(), "void_funding");
  const canFinal = !locked && currentDraft && finalReviewed && workspace!.funding.shortfallMinor === 0 && workspace!.funding.unallocatedMinor === 0 && isPrizeAccountingRequestV8(finalRequest(), "final");
  const rounding = workspace?.draft?.rounding;
  const changedReason = (value: string) => { setReason(value); setReviewed(false); setFundingReviewed(false); setVoidReviewed(false); setFinalReviewed(false); };
  return <section className="correction-item" aria-labelledby="prize-accounting-review"><h2 id="prize-accounting-review">Unpaid accounting with $5 awards</h2>
    <p>Regular prizes use the saved standing rounding policy. Finalizing records unpaid obligations only; it does not pay a prize or execute a transfer or refund. Q Pool obligations remain separate.</p>
    <p role="status">{message}</p>
    <button type="button" disabled={!ready || busy || pending !== null} onClick={async () => { setBusy(true); try { await load(); setMessage("Current accounting sources refreshed."); } catch { setNeedsRefresh(true); setMessage("Accounting sources unavailable. Recording remains blocked."); } finally { setBusy(false); } }}>Refresh accounting sources</button>
    {pending && <p><button type="button" disabled={busy || blocked} onClick={() => void send(pending.action, pending.request, true)}>Retry exact accounting request</button></p>}
    {!workspace ? <p role="alert">Accounting service unavailable. Existing records are unchanged.</p> : <>
      {!!workspace.blockers.length && <p role="alert">Recording blocked: {workspace.blockers.map(label).join(", ")}.</p>}
      {workspace.facts && <><h3>Separated source funds</h3><dl><dt>Base entry receipts</dt><dd>{formatUsd(workspace.facts.baseIncomeMinor)}</dd><dt>Q Pool funding</dt><dd>{formatUsd(workspace.facts.qIncomeMinor)}</dd><dt>Total entry and Q receipts</dt><dd>{formatUsd(workspace.facts.receiptTotalMinor)}</dd><dt>Total approved expenses (including player benefits)</dt><dd>{formatUsd(workspace.facts.expenseTotalMinor)}</dd><dt>Raw cash prize budget: base receipts minus expenses</dt><dd>{formatUsd(workspace.facts.regularAwardMinor)}</dd><dt>Required return from base entry fees</dt><dd>{formatUsd(workspace.facts.minimumReturnMinor)}</dd></dl><p>Q awards and rounding-cover contributions do not increase the base-entry denominator. The 85% return is checked separately from cash conservation. Player-benefit expenses are part of total expenses, not an additional cash pot.</p><p>Raw cash calculation: {formatUsd(workspace.facts.baseIncomeMinor)} base receipts - {formatUsd(workspace.facts.expenseTotalMinor)} total expenses = {formatUsd(workspace.facts.regularAwardMinor)} before prize rounding.</p></>}
      {workspace.regularRule && <><h3>Saved standing $5 policy</h3><p>{workspace.regularRule.rule.sourceReference}. Schedule version {workspace.regularRule.scheduleVersion}. Awards are total awards, not cumulative additions. Same-round losers share equal awards.</p></>}
      <fieldset disabled={locked} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",minWidth:0}}><legend>Review expense evidence and record the unpaid draft</legend>{expenses.map(e => <div key={e.expenseEventId}><p>{e.description}: {formatUsd(e.amountMinor)}</p><label>Category for {e.description}<select value={categories[e.expenseEventId] ?? ""} onChange={ev => { setCategories(c => ({ ...c, [e.expenseEventId]: ev.target.value })); setReviewed(false); }}><option value="">Select a supported category</option>{Q_ACCOUNTING_EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{label(c)}</option>)}</select></label><label>Evidence for {e.description}<input maxLength={500} value={evidence[e.expenseEventId] ?? ""} onChange={ev => { setEvidence(v => ({ ...v, [e.expenseEventId]: ev.target.value })); setReviewed(false); }}/></label></div>)}<label>Accounting review reason<input maxLength={500} value={reason} onChange={e => changedReason(e.target.value)}/></label><label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/>I reviewed the saved policy, expense classifications and separate Q obligations. All awards remain unpaid.</label><button type="button" disabled={!canDraft} onClick={() => void send("draft", draftRequest())}>Record unpaid accounting draft</button></fieldset>
      {workspace.draft && rounding && <article><h3>Accounting draft {workspace.draft.version} — unpaid</h3><p>{workspace.draft.current ? "Draft matches current sources." : "Draft is stale. Refresh and record a new reviewed draft before using it."}</p><dl><dt>Raw cash prize budget: base receipts minus expenses</dt><dd>{formatUsd(rounding.originalBudgetMinor)}</dd><dt>Rounded regular-prize budget</dt><dd>{formatUsd(rounding.roundedBudgetMinor)}</dd><dt>Rounding direction</dt><dd>{label(rounding.direction)}</dd><dt>Signed budget adjustment</dt><dd>{rounding.adjustmentMinor > 0 ? "+" : ""}{formatUsd(rounding.adjustmentMinor)}</dd><dt>Required rounding cover</dt><dd>{formatUsd(rounding.requiredFundingMinor)}</dd><dt>Recorded rounding cover received</dt><dd>{formatUsd(workspace.funding.receivedMinor)}</dd><dt>Rounding-cover shortfall</dt><dd>{formatUsd(workspace.funding.shortfallMinor)}</dd><dt>Unallocated recorded cover</dt><dd>{formatUsd(workspace.funding.unallocatedMinor)}</dd><dt>Residual held separately (excluded from participant return)</dt><dd>{formatUsd(rounding.restrictedBalanceMinor)}</dd><dt>Eligible player-benefit expenses (included in total expenses)</dt><dd>{formatUsd(rounding.benefitExpenseMinor)}</dd><dt>Participant return: regular awards plus eligible benefits</dt><dd>{formatUsd(rounding.participantReturnMinor)}</dd><dt>Required 85% minimum</dt><dd>{formatUsd(rounding.minimumReturnMinor)}</dd></dl>
        <p>The restricted event rounding hold is not an expense, player benefit or director profit. No automatic transfer or refund is made.</p>
        <h4>Regular awards — unpaid</h4><ul>{workspace.draft.awards.map(a => <li key={a.participantId}>{a.displayName}: {formatUsd(a.totalAwardMinor)} — finishing band {a.bandStart === a.bandEnd ? a.bandStart : `${a.bandStart}-${a.bandEnd}`} — unpaid</li>)}</ul>
      </article>}
      {workspace.qReview && <><h3>Separate reviewed Q obligations — unpaid</h3>{workspace.qReview.obligations.map(p => <article key={p.poolVersionId}><h4>{p.name}: {formatUsd(p.fundMinor)} {p.kind === "refund" ? "refund obligations" : "award obligations"}</h4><ul>{p.rows.map(r => <li key={r.participantId}>{r.displayName}: {formatUsd(r.amountMinor)} — unpaid</li>)}</ul></article>)}</>}
      {workspace.draft && <><fieldset disabled={locked || !currentDraft} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",minWidth:0}}><legend>Record evidence of cover already received</legend><p>Only record an actual manual contribution with its evidence. This form does not collect money or automatically create a payment receipt. Maximum remaining cover: {formatUsd(workspace.funding.shortfallMinor)}.</p><label>Contribution received (USD $)<input inputMode="decimal" value={fundingAmount} onChange={e => { setFundingAmount(e.target.value); setFundingReviewed(false); }}/></label><label>Received at (your device&apos;s local time)<input type="datetime-local" value={fundingAt} onChange={e => { setFundingAt(e.target.value); setFundingReviewed(false); }}/></label><label>Contribution evidence reference<input maxLength={500} value={fundingEvidence} onChange={e => { setFundingEvidence(e.target.value); setFundingReviewed(false); }}/></label><label><input type="checkbox" checked={fundingReviewed} onChange={e => setFundingReviewed(e.target.checked)}/>I confirm this contribution was already received and the reference supports that record. This does not execute a transfer.</label><button type="button" disabled={!canFund} onClick={() => void send("funding", fundingRequest())}>Record received-cover evidence</button></fieldset>
        <fieldset disabled={locked || !currentDraft} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",minWidth:0}}><legend>Correct an erroneous funding record</legend><p>A void is an audit correction only. It does not return or transfer actual money. Funding from earlier source versions remains visible until corrected with a reason.</p><label>Recorded contribution to correct<select value={voidsId} onChange={e => { setVoidsId(e.target.value); setVoidReviewed(false); }}><option value="">Select a current received record</option>{activeReceipts.map(r => <option key={r.id} value={r.id}>{formatUsd(r.amountMinor)} — {r.evidenceReference}</option>)}</select></label><label><input type="checkbox" checked={voidReviewed} onChange={e => setVoidReviewed(e.target.checked)}/>I reviewed this erroneous record and supplied the reason above. No actual refund is executed.</label><button type="button" disabled={!canVoid} onClick={() => void send("void_funding", voidRequest())}>Record funding correction</button></fieldset>
        <h3>Funding audit history</h3>{workspace.funding.records.length === 0 ? <p>No rounding-cover contribution has been recorded.</p> : <ul>{workspace.funding.records.map(r => <li key={r.id}>{label(r.eventType)} {formatUsd(r.amountMinor)} — version {r.version}; {r.evidenceReference || "void correction"}; {r.reason}. {r.sourceDigest === workspace.sourceDigest ? "Current source reference." : "Earlier source reference retained."}</li>)}</ul>}
        {!!workspace.funding.shortfallMinor && <p role="alert">Finalization blocked: rounding cover remains unfunded.</p>}{!!workspace.funding.unallocatedMinor && <p role="alert">Finalization blocked: recorded cover exceeds the current requirement. Preserve the record and review the discrepancy; no automatic refund occurs.</p>}
        <label><input type="checkbox" checked={finalReviewed} disabled={locked || !currentDraft} onChange={e => setFinalReviewed(e.target.checked)}/>Finalize unpaid accounting using this current draft and funding version {workspace.funding.version}. No person is marked paid.</label><button type="button" disabled={!canFinal} onClick={() => void send("final", finalRequest())}>Finalize unpaid accounting</button></>}
      {workspace.finalization && <p><strong>Accounting finalized — unpaid.</strong> {workspace.finalization.current ? "The recorded sources and funding version remain current." : "Sources changed. The immutable final is preserved and must not be silently recalculated."} Restricted event rounding hold: {formatUsd(workspace.finalization.restrictedBalanceMinor)}. No payment, transfer or refund was executed.</p>}
    </>}
  </section>;
}
