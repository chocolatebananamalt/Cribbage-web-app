"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { MANUAL_SETTLEMENT_ATTESTATIONS, isManualSettlementFinalizationOutcome, isManualSettlementFinalizationRequest, isRejectedManualSettlementFinalization, type ManualSettlementFinalizationRequest, type ManualSettlementFinalizationWorkspace } from "../../../../../../lib/api/settlement-finalization";
import { formatUsdInput, parseUsdMinor } from "../../../../../../lib/money";

type Envelope = ManualSettlementFinalizationRequest & { kind: "manual-settlement-finalization" };
const storageKey = (actorId: string, eventId: string) => `settlement-finalization:${actorId}:${eventId}`;
const requestFromEnvelope = ({ kind: _kind, ...request }: Envelope) => { void _kind; return request; };
const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;

function readEnvelope(key: string) {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)
      || (value as Record<string, unknown>).kind !== "manual-settlement-finalization") return null;
    const envelope = value as Envelope;
    return isManualSettlementFinalizationRequest(requestFromEnvelope(envelope)) ? envelope : null;
  } catch { return null; }
}

export default function SettlementFinalizationClient({ actorId, tournamentId, eventId, workspace }: {
  actorId: string; tournamentId: string; eventId: string; workspace: ManualSettlementFinalizationWorkspace;
}) {
  const router = useRouter();
  const draft = workspace.draft;
  const totalAwards = draft ? draft.placementPayoutTotalMinor + draft.qPoolPayoutTotalMinor + draft.otherAwardTotalMinor : 0;
  const initialRetained = draft ? draft.paymentReceiptTotalMinor - draft.expenseTotalMinor - totalAwards : 0;
  const [eventIncome, setEventIncome] = useState(() => formatUsdInput(draft?.paymentReceiptTotalMinor ?? 0));
  const [eventExpense, setEventExpense] = useState(() => formatUsdInput(draft?.expenseTotalMinor ?? 0));
  const [retained, setRetained] = useState(() => initialRetained >= 0 ? formatUsdInput(initialRetained) : "");
  const [source, setSource] = useState("");
  const [checks, setChecks] = useState(() => Object.fromEntries(Object.keys(MANUAL_SETTLEMENT_ATTESTATIONS).map((key) => [key, false])) as Record<keyof typeof MANUAL_SETTLEMENT_ATTESTATIONS, boolean>);
  const [locked, setLocked] = useState<Envelope | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const key = storageKey(actorId, eventId);

  const reconcile = useCallback(async (envelope: Envelope) => {
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/settlement-finalization/reconciliation`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store",
        body: JSON.stringify({ idempotencyKey: envelope.idempotencyKey }),
      });
      const value: unknown = response.ok ? await response.json().catch(() => null) : null;
      return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1 && "result" in value
        ? (value as { result: unknown }).result : undefined;
    } catch { return undefined; }
  }, [eventId, tournamentId]);

  useEffect(() => {
    void (async () => {
      const saved = readEnvelope(key);
      if (!saved) { setBusy(false); return; }
      setEventIncome(formatUsdInput(saved.eventIncomeMinor));
      setEventExpense(formatUsdInput(saved.eventExpenseMinor));
      setRetained(formatUsdInput(saved.retainedBalanceMinor));
      setSource(saved.officialSourceReference);
      setChecks(Object.fromEntries(Object.keys(MANUAL_SETTLEMENT_ATTESTATIONS).map((name) => [name, true])) as Record<keyof typeof MANUAL_SETTLEMENT_ATTESTATIONS, boolean>);
      const result = await reconcile(saved);
      if (result === null) {
        sessionStorage.removeItem(key); setMessage("The prior finalization did not reach the server. Review every attestation before trying again."); setBusy(false); return;
      }
      if (isManualSettlementFinalizationOutcome(result, tournamentId, eventId)
        || isRejectedManualSettlementFinalization(result, eventId)) {
        sessionStorage.removeItem(key); setBusy(false); router.refresh(); return;
      }
      setLocked(saved); setMessage("The prior finalization is unresolved. Only its exact protected request may be retried."); setBusy(false);
    })();
  }, [eventId, key, reconcile, router, tournamentId]);

  async function finalize() {
    if (!draft) { setMessage("Save a complete settlement working copy first."); return; }
    if (draft.mrpClaimCount !== draft.qualifierCount) { setMessage("Every qualifier needs an explicitly reviewed MRP claim, including zero when the official source says zero."); return; }
    const eventIncomeMinor = parseUsdMinor(eventIncome, { allowZero: true, maxMinor: Number.MAX_SAFE_INTEGER });
    const eventExpenseMinor = parseUsdMinor(eventExpense, { allowZero: true, maxMinor: Number.MAX_SAFE_INTEGER });
    const retainedBalanceMinor = parseUsdMinor(retained, { allowZero: true, maxMinor: Number.MAX_SAFE_INTEGER });
    if (eventIncomeMinor === null || eventExpenseMinor === null || retainedBalanceMinor === null) {
      setMessage("Enter each reviewed event amount in dollars and cents."); return;
    }
    if (eventIncomeMinor !== eventExpenseMinor + totalAwards + retainedBalanceMinor) {
      setMessage("The event ledger does not balance: income must equal expenses, payouts, awards, and retained balance."); return;
    }
    if (!Object.values(checks).every(Boolean)) { setMessage("Complete every review attestation before finalizing."); return; }
    const candidate: Envelope = {
      kind: "manual-settlement-finalization", settlementDraftId: draft.settlementDraftId,
      settlementDraftVersion: draft.settlementDraftVersion, qualificationResultVersionId: draft.qualificationResultVersionId,
      playoffResultVersionId: draft.playoffResultVersionId, expectedFinalizationVersion: workspace.currentVersion,
      eventIncomeMinor, eventExpenseMinor, placementPayoutTotalMinor: draft.placementPayoutTotalMinor,
      qPoolPayoutTotalMinor: draft.qPoolPayoutTotalMinor, otherAwardTotalMinor: draft.otherAwardTotalMinor,
      retainedBalanceMinor, expectedPaymentReceiptCount: draft.paymentReceiptCount,
      expectedPaymentReceiptTotalMinor: draft.paymentReceiptTotalMinor, expectedExpenseCount: draft.expenseCount,
      expectedExpenseTotalMinor: draft.expenseTotalMinor, officialSourceReference: source.trim(),
      attestations: MANUAL_SETTLEMENT_ATTESTATIONS, idempotencyKey: locked?.idempotencyKey ?? crypto.randomUUID(),
    };
    if (locked && JSON.stringify(requestFromEnvelope(locked)) !== JSON.stringify(requestFromEnvelope(candidate))) {
      setMessage("The unresolved request is locked. Restore its exact reviewed inputs before retrying."); return;
    }
    const envelope = locked ?? candidate;
    const request = requestFromEnvelope(envelope);
    if (!isManualSettlementFinalizationRequest(request)) { setMessage("Enter a short official source reference without line breaks or control characters."); return; }
    try {
      sessionStorage.setItem(key, JSON.stringify(envelope)); setLocked(envelope); setBusy(true); setMessage(null);
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/settlement-finalization`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store",
        body: JSON.stringify(request),
      });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isManualSettlementFinalizationOutcome(result, tournamentId, eventId)) {
        sessionStorage.removeItem(key); setLocked(null); router.refresh(); return;
      }
      if (response.status === 409 && isRejectedManualSettlementFinalization(result, eventId)) {
        sessionStorage.removeItem(key); setLocked(null); setMessage(`Finalization blocked: ${String((result as { code: string }).code).replaceAll("_", " ")}.`); router.refresh(); return;
      }
      setMessage("This finalization is unresolved and remains locked until the server can confirm it.");
    } catch { setMessage("This finalization is unresolved and remains locked until the server can confirm it."); }
    finally { setBusy(false); }
  }

  return <section className="policy-settings" aria-labelledby="manual-finalization-title">
    <h2 id="manual-finalization-title">Manual financial reconciliation</h2>
    <p className="registration-note"><strong>Director-reviewed record only.</strong> This does not calculate ACC payouts or MRPs, send money, publish results, or submit anything to the ACC.</p>
    {!draft ? <p className="error-text">Save the settlement working copy before finalization.</p> : <form onSubmit={(event) => { event.preventDefault(); void finalize(); }}>
      <fieldset disabled={busy || !!locked}>
        <legend>Exact saved amounts</legend>
        <p>Placement payouts: <strong>{money(draft.placementPayoutTotalMinor)}</strong></p>
        <p>Q-pool payouts: <strong>{money(draft.qPoolPayoutTotalMinor)}</strong></p>
        <p>Other awards: <strong>{money(draft.otherAwardTotalMinor)}</strong></p>
        <p>{draft.mrpClaimCount} of {draft.qualifierCount} qualifier MRP claims explicitly entered.</p>
        <label>Reviewed event income (USD)<input inputMode="decimal" value={eventIncome} onChange={(event) => setEventIncome(event.target.value)} /></label>
        <label>Reviewed event expenses (USD)<input inputMode="decimal" value={eventExpense} onChange={(event) => setEventExpense(event.target.value)} /></label>
        <label>Reviewed retained balance (USD)<input inputMode="decimal" value={retained} onChange={(event) => setRetained(event.target.value)} /></label>
        <label>Official source reference<input maxLength={500} value={source} onChange={(event) => setSource(event.target.value)} placeholder="Dated worksheet, report, or director record" /></label>
      </fieldset>
      <fieldset disabled={busy || !!locked}><legend>Required director attestations</legend>
        {Object.keys(MANUAL_SETTLEMENT_ATTESTATIONS).map((name) => <label key={name}><input type="checkbox" checked={checks[name as keyof typeof checks]} onChange={(event) => setChecks((current) => ({ ...current, [name]: event.target.checked }))} /> {name === "officialSourceReviewed" ? "I reviewed the identified official source inputs." : name === "expenseLedgerReviewed" ? "I reviewed the complete expense ledger for this event allocation." : name === "payoutClaimsReviewed" ? "I reviewed every placement payout amount." : name === "qPoolClaimsReviewed" ? "I reviewed every Q-pool amount, including no-award cases." : name === "mrpClaimsReviewed" ? "I reviewed every qualifier MRP claim, including explicit zeroes." : "I understand this does not submit anything to the ACC."}</label>)}
      </fieldset>
      <button className="primary" type="submit" disabled={busy || draft.mrpClaimCount !== draft.qualifierCount}>{busy ? "Checking…" : locked ? "Retry Exact Finalization" : `Finalize Reviewed Version ${workspace.currentVersion + 1}`}</button>
    </form>}
    {message ? <p className="error-text" role="alert">{message}</p> : null}
    {workspace.finalization ? <section className="correction-item"><h3>Latest manual reconciliation</h3><p>Version {workspace.finalization.version} by {workspace.finalization.finalizedBy}</p><p>Event income {money(workspace.finalization.eventIncomeMinor)} · Expenses {money(workspace.finalization.eventExpenseMinor)} · Retained {money(workspace.finalization.retainedBalanceMinor)}</p><p>Source: {workspace.finalization.officialSourceReference}</p><p className="success-text">Internally reconciled. Not submitted to ACC.</p></section> : null}
  </section>;
}
