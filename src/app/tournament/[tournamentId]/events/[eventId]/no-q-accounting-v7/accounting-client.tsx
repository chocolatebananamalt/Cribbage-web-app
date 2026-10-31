"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUsd } from "../../../../../../lib/money";
import { isUuid } from "../../../../../../lib/api/validation";
import { setAppRecoveryItem } from "../../../../../../lib/recovery-write-coordinator";
import { Q_ACCOUNTING_EXPENSE_CATEGORIES, isNoQAccountingRequest, isNoQAccountingResult, isNoQAccountingWorkspace, noQAccountingResultMatches, type NoQAccountingAction, type NoQAccountingClassification, type NoQAccountingDraftRequest, type NoQAccountingFinalRequest, type NoQAccountingRequest, type NoQAccountingWorkspace } from "../../../../../../lib/api/no-q-accounting-v7";

type Envelope = { kind: "no-q-accounting-v7"; operationId: string; action: NoQAccountingAction; request: NoQAccountingRequest };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const validEnvelope = (v: unknown): v is Envelope => object(v) && Object.keys(v).sort().join() === "action,kind,operationId,request" && v.kind === "no-q-accounting-v7" && isUuid(v.operationId) && (v.action === "draft" || v.action === "final") && isNoQAccountingRequest(v.request, v.action);
const label = (s: string) => s.replaceAll("_", " ");
export default function NoQAccountingClient({ actorId, tournamentId, eventId, initialWorkspace }: { actorId: string; tournamentId: string; eventId: string; initialWorkspace: NoQAccountingWorkspace | null }) {
  const key = `payment-obligation:no-q-accounting-v7:${actorId}:${eventId}`, url = `/api/v1/tournaments/${tournamentId}/events/${eventId}/no-q-accounting-v7`;
  const [workspace, setWorkspace] = useState(initialWorkspace), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [needsRefresh, setNeedsRefresh] = useState(false);
  const [pending, setPending] = useState<Envelope | null>(null), [message, setMessage] = useState("Checking retained accounting work."), [reason, setReason] = useState(""), [reviewed, setReviewed] = useState(false), [finalReviewed, setFinalReviewed] = useState(false);
  const [categories, setCategories] = useState<Record<string, string>>({}), [evidence, setEvidence] = useState<Record<string, string>>({});
  const flight = useRef(false), retained = useRef<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(url, { cache: "no-store" });
    const data: unknown = await response.json();
    if (!response.ok || !isNoQAccountingWorkspace(data, tournamentId, eventId)) throw Error("accounting_unavailable");
    setWorkspace(data); setNeedsRefresh(false); setReviewed(false); setFinalReviewed(false);
  }, [url, tournamentId, eventId]);
  const finish = useCallback(async (raw: string, operation: Envelope, value: unknown) => {
    if (!isNoQAccountingResult(value, eventId) || !noQAccountingResultMatches(value, operation.action, operation.request)) { setMessage("Outcome remains uncertain. The exact accounting request is retained."); return; }
    if (value.status === "rejected" && value.code === "idempotency_conflict") { setBlocked(true); setMessage("Operation identity conflict. Retained work is preserved; further recording is blocked."); return; }
    try { if (sessionStorage.getItem(key) !== raw) throw Error("retained_work_changed"); sessionStorage.removeItem(key); }
    catch { setBlocked(true); setMessage("Outcome received, but retained accounting work could not be cleared safely."); return; }
    retained.current = null; setPending(null); setNeedsRefresh(true); setReviewed(false); setFinalReviewed(false);
    setMessage(value.status === "rejected" ? `Accounting request rejected: ${label(value.code)}. Refresh sources before another review.` : value.status === "no_q_accounting_draft_saved_v7" ? "Unpaid accounting draft recorded. No money moved." : "Unpaid accounting finalized. Nobody was marked paid and no money moved.");
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
  async function send(action: NoQAccountingAction, request: NoQAccountingRequest, retry = false) {
    if (flight.current || blocked || !ready) return;
    flight.current = true; setBusy(true);
    try {
      const operation: Envelope = retry && pending ? pending : { kind: "no-q-accounting-v7", action, request, operationId: crypto.randomUUID() };
      if (!validEnvelope(operation) || (pending && !retry)) throw Error("pending_work");
      let raw = retained.current;
      if (retry) {
        if (!pending || !raw || sessionStorage.getItem(key) !== raw || JSON.stringify(operation) !== raw) { setBlocked(true); setMessage("Retained accounting work changed. Recording is blocked."); return; }
        if (await reconcile(operation, raw)) return;
      } else {
        if (sessionStorage.getItem(key) !== null) { setBlocked(true); setMessage("Other retained accounting work exists. It was not overwritten."); return; }
        raw = JSON.stringify(operation); setAppRecoveryItem(sessionStorage, key, raw); retained.current = raw; setPending(operation);
      }
      const response = await fetch(`${url}/${operation.action === "draft" ? "draft" : "finalize"}`, { method: "POST", headers: { "Content-Type": "application/json", "x-idempotency-key": operation.operationId }, body: JSON.stringify(operation.request) });
      const result: unknown = await response.json();
      await finish(raw!, operation, result);
    } catch { setMessage("Recording could not be confirmed. The exact accounting request remains retained; no automatic retry will occur."); }
    finally { flight.current = false; setBusy(false); }
  }
  const locked = !ready || busy || blocked || pending !== null || needsRefresh || !workspace || workspace.blockers.length > 0 || workspace.finalization !== null;
  const expenses = workspace?.facts?.expenseEvidence ?? [];
  const classifications = expenses.map(e => ({ expenseEventId: e.expenseEventId, category: categories[e.expenseEventId], evidenceReference: evidence[e.expenseEventId]?.trim() ?? "" })) as NoQAccountingClassification[];
  const canDraft = !locked && reviewed && reason.trim().length > 0 && classifications.every(c => Q_ACCOUNTING_EXPENSE_CATEGORIES.includes(c.category) && c.evidenceReference.length > 0) && workspace?.regularSchedule;
  const draftRequest = (): NoQAccountingDraftRequest => ({ expectedVersion: workspace!.currentDraftVersion, sourceDigest: workspace!.sourceDigest, scheduleVersionId: workspace!.regularSchedule!.scheduleVersionId, reason: reason.trim(), expenseClassifications: classifications, reviewed: true });
  const finalRequest = (): NoQAccountingFinalRequest => ({ draftId: workspace!.draft!.id, draftVersion: workspace!.draft!.version, expectedVersion: workspace!.currentFinalVersion, reason: reason.trim(), reviewed: true });
  return <section className="correction-item" aria-labelledby="no-q-accounting-review"><h2 id="no-q-accounting-review">Unpaid accounting review</h2>
    <p>This workflow supports regular prizes and approved expenses without Q Pools. Finalizing records unpaid obligations only; nobody is marked paid and no payment is executed.</p>
    <p role="status">{message}</p>
    <button type="button" disabled={!ready || busy || pending !== null} onClick={async () => { setBusy(true); try { await load(); setMessage("Current accounting sources refreshed."); } catch { setNeedsRefresh(true); setMessage("Accounting sources unavailable. Recording remains blocked."); } finally { setBusy(false); } }}>Refresh accounting sources</button>
    {pending && <p><button type="button" disabled={busy || blocked} onClick={() => void send(pending.action, pending.request, true)}>Retry exact accounting request</button></p>}
    {!workspace ? <p role="alert">Accounting service unavailable. Existing records are unchanged.</p> : <>
      {!!workspace.blockers.length && <p role="alert">Recording blocked: {workspace.blockers.map(label).join(", ")}.</p>}
      {workspace.facts && <><h3>Separated funding</h3><dl><dt>Base entry receipts</dt><dd>{formatUsd(workspace.facts.baseIncomeMinor)}</dd><dt>Total recorded receipts</dt><dd>{formatUsd(workspace.facts.receiptTotalMinor)}</dd><dt>Approved expense evidence</dt><dd>{formatUsd(workspace.facts.expenseTotalMinor)}</dd><dt>Regular prize obligations</dt><dd>{formatUsd(workspace.facts.regularAwardMinor)}</dd><dt>Required return from base entry fees</dt><dd>{formatUsd(workspace.facts.minimumReturnMinor)}</dd></dl><p>The 85% return is checked independently from cash conservation.</p></>}
      {workspace.regularSchedule && <><h3>Saved regular-prize schedule</h3><p>{workspace.regularSchedule.rule.sourceReference}. Schedule version {workspace.regularSchedule.scheduleVersion}. Total awards, not cumulative additions.</p><ul>{workspace.regularSchedule.awards.map(a => <li key={a.participantId}>{a.displayName}: {formatUsd(a.totalAwardMinor)} — finishing band {a.bandStart === a.bandEnd ? a.bandStart : `${a.bandStart}–${a.bandEnd}`}</li>)}</ul></>}
      <fieldset disabled={locked} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",minWidth:0}}><legend>Review the expense evidence</legend>{expenses.map(e => <div key={e.expenseEventId}><p>{e.description}: {formatUsd(e.amountMinor)}</p><label>Category for {e.description}<select value={categories[e.expenseEventId] ?? ""} onChange={ev => { setCategories(c => ({ ...c, [e.expenseEventId]: ev.target.value })); setReviewed(false); }}><option value="">Select a supported category</option>{Q_ACCOUNTING_EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{label(c)}</option>)}</select></label><label>Evidence for {e.description}<input maxLength={500} value={evidence[e.expenseEventId] ?? ""} onChange={ev => { setEvidence(v => ({ ...v, [e.expenseEventId]: ev.target.value })); setReviewed(false); }}/></label></div>)}<label>Accounting review reason<input maxLength={500} value={reason} onChange={e => { setReason(e.target.value); setReviewed(false); setFinalReviewed(false); }}/></label><label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/>I reviewed the saved schedule, regular-prize obligations and expense classifications. All amounts remain unpaid.</label><button type="button" disabled={!canDraft} onClick={() => void send("draft", draftRequest())}>Record unpaid accounting draft</button></fieldset>
      {workspace.draft && <article><h3>Accounting draft {workspace.draft.version} — unpaid</h3><p>{workspace.draft.current ? "Draft matches current sources." : "Draft is stale. A new source review is required."}</p><dl><dt>Player-benefit costs</dt><dd>{formatUsd(workspace.draft.facts.benefitExpenseMinor)}</dd><dt>Operating costs</dt><dd>{formatUsd(workspace.draft.facts.operatingExpenseMinor)}</dd><dt>Base participant return</dt><dd>{formatUsd(workspace.draft.facts.participantReturnMinor)}</dd></dl><label><input type="checkbox" checked={finalReviewed} disabled={locked || !workspace.draft.current} onChange={e => setFinalReviewed(e.target.checked)}/>Finalize accounting only. No person is marked paid and no payment or refund is executed.</label><button type="button" disabled={locked || !workspace.draft.current || !finalReviewed || !reason.trim()} onClick={() => void send("final", finalRequest())}>Finalize unpaid accounting</button></article>}
      {workspace.finalization && <p><strong>Accounting finalized — unpaid.</strong> {workspace.finalization.current ? "The recorded sources remain current." : "Sources changed after finalization. The immutable history is preserved; reopening requires a separately supported review."} No money moved.</p>}
    </>}
  </section>;
}
