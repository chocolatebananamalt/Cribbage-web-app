"use client";
import { setAppRecoveryItem } from "../../../../../../lib/recovery-write-coordinator";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { accBenefitExpenseCategories, accOperatingExpenseCategories, type AccExpenseCategory } from "../../../../../../lib/results/acc-payback";
import { isPaybackReviewRequest, isPaybackReviewSaved, isPaybackReviewReconciliation, isRejectedPaybackReview, type PaybackReviewRequest, type PaybackReviewWorkspace } from "../../../../../../lib/api/payback-review";
import { isUuid } from "../../../../../../lib/api/validation";
type Envelope = { kind: "payback-review"; operationId: string; request: PaybackReviewRequest };
type Draft = { draftId: string; version: number } | null;
const money = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v / 100);
function envelopeValid(v: unknown): v is Envelope {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const item = v as Record<string, unknown>;
  return Object.keys(item).sort().join(",") === "kind,operationId,request" && item.kind === "payback-review" && isUuid(item.operationId) && isPaybackReviewRequest(item.request);
}
function initial(w: PaybackReviewWorkspace, d: Draft, savedScheduleReference?: string): PaybackReviewRequest | null {
  if (!d) return null;
  if (w.review?.draftId === d.draftId && w.review.draftVersion === d.version) return { ...w.review.request, expectedVersion: w.currentReviewVersion };
  return { draftId: d.draftId, draftVersion: d.version, expectedVersion: w.currentReviewVersion, scheduleKind: "director_selected", amountBasis: "total_award", scheduleReference: savedScheduleReference ?? "", sourceReference: "", eligibilityEvidence: [], expenseClassifications: [] };
}
export default function PaybackReviewClient({ actorId, tournamentId, eventId, workspace, draft, savedScheduleReference }: { actorId: string; tournamentId: string; eventId: string; workspace: PaybackReviewWorkspace; draft: Draft; savedScheduleReference?: string }) {
  const router = useRouter(), flight = useRef(false), retained = useRef<string | null>(null);
  const key = `payback-review:${actorId}:${tournamentId}:${eventId}`;
  const endpoint = `/api/v1/tournaments/${tournamentId}/events/${eventId}/payback-review`;
  const [request, setRequest] = useState(() => initial(workspace, draft, savedScheduleReference));
  const [pending, setPending] = useState<Envelope | null>(null);
  const [busy, setBusy] = useState(true), [blocked, setBlocked] = useState(false), [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState("Checking retained payback review requests.");
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      let raw: string | null;
      try { raw = sessionStorage.getItem(key); } catch { setBlocked(true); setBusy(false); setMessage("Recovery storage is unavailable. No write was started."); return; }
      retained.current = raw;
      if (!raw) { setBusy(false); setMessage("Review server facts and enter explicit evidence."); return; }
      let value: unknown; try { value = JSON.parse(raw); } catch { value = null; }
      if (!envelopeValid(value)) { setBlocked(true); setBusy(false); setMessage("An unrecognized request remains saved locally. It cannot be overwritten or discarded here."); return; }
      const saved = value; setPending(saved); setRequest(saved.request);
      void (async () => {
        try {
          const response = await fetch(`${endpoint}/reconciliation`, { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: saved.operationId }) });
          const body: unknown = response.ok ? await response.json().catch(() => null) : null;
          if (!active) return;
          if (sessionStorage.getItem(key) !== raw) { setBlocked(true); setMessage("The retained request changed during recovery. The newer record remains saved."); return; }
          if (isPaybackReviewReconciliation(body, tournamentId, eventId) && body.result !== null) {
            sessionStorage.removeItem(key); retained.current = null; setPending(null);
            const accepted = isPaybackReviewSaved(body.result, tournamentId, eventId);
            setCompleted(accepted); setMessage(accepted ? "Payback review saved. Reloading authoritative facts." : "The exact review was rejected. Review current facts."); router.refresh(); return;
          }
          setMessage("No completed receipt is available. The exact review request is retained for retry.");
        } catch { if (active) setMessage("Receipt recovery is unavailable. The exact review request remains saved for retry."); }
        finally { if (active) setBusy(false); }
      })();
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [endpoint, eventId, key, router, tournamentId]);
  async function save() {
    if (busy || blocked || completed || flight.current) return;
    if (!pending && (!workspace.required || workspace.scope.status !== "supported" || !request || !draft)) return;
    const body = pending?.request ?? request;
    if (!isPaybackReviewRequest(body) || (!pending && (body.eligibilityEvidence.length !== workspace.scope.qualifiers.length || body.expenseClassifications.length !== workspace.scope.expenses.length))) { setMessage("Enter schedule, source, eligibility and expense evidence before saving."); return; }
    flight.current = true; setBusy(true);
    try {
      if (sessionStorage.getItem(key) !== retained.current) { setBlocked(true); setMessage("Another request changed recovery storage. It has not been overwritten."); return; }
      const operation: Envelope = pending ?? { kind: "payback-review", operationId: crypto.randomUUID(), request: body };
      const raw = retained.current ?? JSON.stringify(operation);
      if (!pending) setAppRecoveryItem(sessionStorage, key, raw);
      retained.current = raw; setPending(operation); setMessage("Saving the exact payback review request.");
      const response = await fetch(endpoint, { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json", "x-idempotency-key": operation.operationId }, body: JSON.stringify(operation.request) });
      const result: unknown = await response.json().catch(() => null);
      if (sessionStorage.getItem(key) !== raw) { setBlocked(true); setMessage("The retained request changed while the write was pending. The newer record remains saved."); return; }
      const accepted = response.ok && isPaybackReviewSaved(result, tournamentId, eventId);
      const rejected = response.status === 409 && isRejectedPaybackReview(result, eventId);
      if (accepted || rejected) {
        sessionStorage.removeItem(key); retained.current = null; setPending(null); setCompleted(accepted);
        setMessage(accepted ? "Payback review saved. Reloading authoritative facts." : `The exact review was rejected (${(result as { code: string }).code}). Review current facts.`); router.refresh(); return;
      }
      setMessage("The outcome is uncertain. Retry the exact retained review request.");
    } catch { setMessage(retained.current ? "The outcome is uncertain. The exact review request remains saved for retry." : "Recovery storage is unavailable. No write was started."); }
    finally { flight.current = false; setBusy(false); }
  }
  const effective = pending?.request ?? request, locked = busy || blocked || completed || !!pending;
  const patch = (value: Partial<PaybackReviewRequest>) => { if (effective && !locked) setRequest({ ...effective, ...value }); };
  return <section className="policy-settings payback-review-workspace" aria-labelledby="payback-review-title">
    <h2 id="payback-review-title">Payback review</h2>
    <p>Cash conservation and the minimum 85% gross-entry return are separate checks. No fixed ACC prize formula is assumed. Each prize claim is the player’s total award, not an extra payment per round.</p>
    <p role="status">{message}</p>
    {workspace.review && !workspace.review.current ? <p role="alert">The saved review no longer matches the current evidence. Record a new review before finalizing.</p> : null}
    {workspace.review ? <section className="correction-item"><h3>Recorded payback review {workspace.review.version}</h3>
      <p>Gross entry fees {money(workspace.review.totals.grossEntryIncomeMinor)}; player-benefit costs {money(workspace.review.totals.benefitExpenseMinor)}; operating costs {money(workspace.review.totals.operatingExpenseMinor)}; cash awards {money(workspace.review.totals.awardTotalMinor)}.</p>
      <p>Participant return {money(workspace.review.totals.participantReturnMinor)}; required minimum {money(workspace.review.totals.minimumParticipantReturnMinor)}. This is evidence review, not ACC certification or payment.</p></section> : null}
    {!workspace.required && !pending ? <p>Payback review is not required for this historical domain. Its records have not been reclassified or certified compliant.</p> : <>
      {workspace.scope.status === "blocked" ? <p role="alert">Payback scope is blocked ({workspace.scope.code ?? "source unavailable"}). No new review can be started.</p> : null}
      {!draft && !pending ? <p>Save a settlement draft before reviewing its payback evidence.</p> : null}
      <p>Server-derived gross entry income: {workspace.scope.grossEntryIncomeMinor === null ? "unavailable" : money(workspace.scope.grossEntryIncomeMinor)}.</p>
      {effective ? <fieldset disabled={locked}><legend>Director-selected prize schedule and evidence</legend>
        <p>No arbitrary split, percentage, payout or award amount is prefilled. Equal finishing bands require equal total awards in this supported workflow.</p>
        <label>Schedule reference<input maxLength={500} readOnly={!!savedScheduleReference} value={effective.scheduleReference} onChange={e => patch({ scheduleReference: e.target.value })} /></label>
        {savedScheduleReference ? <><p className="field-help">This reference must exactly match the saved schedule bound to this draft. It is filled from that record; the official source below is reviewed separately.</p>{effective.scheduleReference !== savedScheduleReference ? <><p role="alert">This review uses a different schedule reference. Retained requests remain unchanged until their outcome is reconciled.</p><button type="button" disabled={locked} onClick={() => patch({ scheduleReference: savedScheduleReference })}>Use the saved schedule reference</button></> : null}</> : null}
        <label>Official source reference<input maxLength={500} value={effective.sourceReference} onChange={e => patch({ sourceReference: e.target.value })} /></label>
        <fieldset><legend>Eligibility evidence</legend>{workspace.scope.qualifiers.map(q => {
          const item = effective.eligibilityEvidence.find(v => v.participantId === q.participantId);
          return <fieldset className="correction-item" key={q.participantId}><legend>{q.displayName}</legend>
            <label><input type="checkbox" checked={!!item} onChange={e => patch({ eligibilityEvidence: e.target.checked ? [...effective.eligibilityEvidence, { participantId: q.participantId, basis: "full_entry_cash_eligible", evidenceReference: "" }] : effective.eligibilityEvidence.filter(v => v.participantId !== q.participantId) })} />{q.displayName}: full-entry cash eligible</label>
            <p>Confirm ordinary full-entry cash eligibility. Sanction-only and age-related exceptions are unsupported here; account data is not eligibility evidence.</p>
            <label>{q.displayName}: eligibility evidence<input maxLength={500} disabled={!item} value={item?.evidenceReference ?? ""} onChange={e => patch({ eligibilityEvidence: effective.eligibilityEvidence.map(v => v.participantId === q.participantId ? { ...v, evidenceReference: e.target.value } : v) })} /></label>
          </fieldset>;
        })}</fieldset>
        <fieldset><legend>Expense classifications</legend>{workspace.scope.expenses.map(expense => {
          const item = effective.expenseClassifications.find(v => v.expenseEventId === expense.expenseEventId);
          return <fieldset className="correction-item" key={expense.expenseEventId}><legend>{expense.description} — {money(expense.amountMinor)}</legend>
            <label>{expense.description}: expense category<select value={item?.category ?? ""} onChange={e => {
              const category = e.target.value as AccExpenseCategory;
              patch({ expenseClassifications: !category ? effective.expenseClassifications.filter(v => v.expenseEventId !== expense.expenseEventId) : item ? effective.expenseClassifications.map(v => v.expenseEventId === expense.expenseEventId ? { ...v, category } : v) : [...effective.expenseClassifications, { expenseEventId: expense.expenseEventId, category, evidenceReference: "" }] });
            }}><option value="">Choose category — unclassified blocks review</option>
              <optgroup label="Eligible player benefits">{accBenefitExpenseCategories.map(c => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}</optgroup>
              <optgroup label="Operating costs — excluded from player return">{accOperatingExpenseCategories.map(c => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}</optgroup>
            </select></label>
            <label>{expense.description}: expense evidence<input maxLength={500} disabled={!item} value={item?.evidenceReference ?? ""} onChange={e => patch({ expenseClassifications: effective.expenseClassifications.map(v => v.expenseEventId === expense.expenseEventId ? { ...v, evidenceReference: e.target.value } : v) })} /></label>
          </fieldset>;
        })}</fieldset>
      </fieldset> : null}
      <button type="button" className="primary" disabled={busy || blocked || completed || (!pending && (!draft || workspace.scope.status !== "supported"))} onClick={() => void save()}>{busy ? "Checking or saving payback review." : pending ? "Retry exact review" : completed ? "Payback review saved" : "Save payback review"}</button>
    </>}
  </section>;
}
