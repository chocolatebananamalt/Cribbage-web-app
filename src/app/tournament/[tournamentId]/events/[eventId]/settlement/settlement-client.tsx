"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { isRejectedSettlementDraft, isSettlementDraftOutcome, isSettlementDraftRequest, type SettlementAward, type SettlementDraftRequest, type SettlementPlacement, type SettlementWorkspace } from "../../../../../../lib/api/settlement-draft";
import { formatUsdInput, parseUsdMinor } from "../../../../../../lib/money";

type Envelope = SettlementDraftRequest & { kind: "settlement-draft" };

function key(actorId: string, eventId: string) { return `settlement-draft:${actorId}:${eventId}`; }

function readEnvelope(storageKey: string): Envelope | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value) || (value as Record<string, unknown>).kind !== "settlement-draft") return null;
    const request = Object.fromEntries(Object.entries(value).filter(([entryKey]) => entryKey !== "kind"));
    return isSettlementDraftRequest(request) ? value as Envelope : null;
  } catch { return null; }
}

function dollars(minor: number) { return `$${(minor / 100).toFixed(2)}`; }
function placementRows(workspace: SettlementWorkspace) {
  return (workspace.draft?.placements ?? workspace.qualifierChoices.slice(0, 2).map((_, index) => ({ participantId: "", placement: index + 1, prizeAmountMinor: 0 })))
    .map((entry) => ({ ...entry, prize: formatUsdInput(entry.prizeAmountMinor) }));
}
function awardRows(workspace: SettlementWorkspace) {
  return (workspace.draft?.awards ?? []).map((entry) => ({ ...entry, amount: formatUsdInput(entry.amountMinor) }));
}

export default function SettlementClient({ actorId, tournamentId, eventId, workspace }: {
  actorId: string;
  tournamentId: string;
  eventId: string;
  workspace: SettlementWorkspace;
}) {
  const router = useRouter();
  const [placements, setPlacements] = useState(() => placementRows(workspace));
  const [awards, setAwards] = useState<(SettlementAward & { amount: string })[]>(() => awardRows(workspace));
  const [busy, setBusy] = useState(true);
  const [locked, setLocked] = useState<Envelope | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const storageKey = key(actorId, eventId);

  const reconcile = useCallback(async (envelope: Envelope) => {
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/settlement-draft/reconciliation`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store",
        body: JSON.stringify({ idempotencyKey: envelope.idempotencyKey }),
      });
      const data: unknown = response.ok ? await response.json().catch(() => null) : null;
      return data && typeof data === "object" && !Array.isArray(data) && "result" in data ? (data as { result: unknown }).result : undefined;
    } catch { return undefined; }
  }, [eventId, tournamentId]);

  useEffect(() => {
    void (async () => {
      const saved = readEnvelope(storageKey);
      if (!saved) { setBusy(false); return; }
      const result = await reconcile(saved);
      if (result === null) {
        sessionStorage.removeItem(storageKey); setMessage("The prior save did not reach the server. Review the entries before saving again."); setBusy(false); return;
      }
      if (isSettlementDraftOutcome(result, tournamentId, eventId)) {
        sessionStorage.removeItem(storageKey); setBusy(false); router.refresh(); return;
      }
      if (isRejectedSettlementDraft(result, eventId)) {
        sessionStorage.removeItem(storageKey); setLocked(null); setPlacements(placementRows(workspace)); setAwards(awardRows(workspace));
        setMessage("The prior save was rejected. The latest server version has been reloaded."); setBusy(false); router.refresh(); return;
      }
      setLocked(saved); setMessage("The prior save is unresolved and remains locked for safe recovery."); setBusy(false);
    })();
  }, [eventId, reconcile, router, storageKey, tournamentId, workspace]);

  async function save() {
    const parsedPlacements: SettlementPlacement[] = [];
    for (const entry of placements) {
      const prizeAmountMinor = parseUsdMinor(entry.prize, { allowZero: true, maxMinor: 2147483647 });
      if (prizeAmountMinor === null) { setMessage("Enter each placement prize as dollars and cents, or 0.00."); return; }
      parsedPlacements.push({ participantId: entry.participantId, placement: entry.placement, prizeAmountMinor });
    }
    const parsedAwards: SettlementAward[] = [];
    for (const entry of awards) {
      const amountMinor = parseUsdMinor(entry.amount, { maxMinor: 2147483647 });
      if (amountMinor === null || entry.note.length > 500) { setMessage("Each award needs a positive dollar amount; notes may contain up to 500 characters."); return; }
      parsedAwards.push({ participantId: entry.participantId, awardType: entry.awardType, qPoolSlot: entry.qPoolSlot, amountMinor, note: entry.note });
    }
    if (new Set(parsedPlacements.map((entry) => entry.participantId)).size !== parsedPlacements.length) {
      setMessage("Each qualifier can appear only once in the playoff placement list."); return;
    }
    const candidate: Envelope = {
      kind: "settlement-draft", qualificationResultVersionId: workspace.qualificationResultVersionId,
      expectedVersion: workspace.currentVersion, placements: parsedPlacements, awards: parsedAwards,
      idempotencyKey: locked?.idempotencyKey ?? crypto.randomUUID(),
    };
    if (locked && JSON.stringify({ ...locked, kind: undefined, idempotencyKey: undefined }) !== JSON.stringify({ ...candidate, kind: undefined, idempotencyKey: undefined })) {
      setMessage("The unresolved save is locked. Restore its original entries before retrying."); return;
    }
    if (!isSettlementDraftRequest(candidate)) { setMessage("Choose a different qualifier for every paid placement before saving."); return; }
    const request = locked ?? candidate;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(request)); setLocked(request); setBusy(true); setMessage(null);
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/settlement-draft`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ ...request, kind: undefined }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isSettlementDraftOutcome(result, tournamentId, eventId)) {
        sessionStorage.removeItem(storageKey); setLocked(null); router.refresh(); return;
      }
      if (response.status === 409) {
        sessionStorage.removeItem(storageKey); setLocked(null); setMessage("The server rejected this draft. Refresh and review the latest saved version."); return;
      }
      setMessage("This save is unresolved and remains locked until the server can confirm it.");
    } catch { setMessage("This save is unresolved and remains locked until the server can confirm it."); }
    finally { setBusy(false); }
  }

  return <section className="policy-settings" aria-labelledby="settlement-editor-title">
    <h2 id="settlement-editor-title">Playoff placements and award claims</h2>
    <p className="registration-note"><strong>Draft only.</strong> These claims are not reconciled, approved, published, or an official ACC submission.</p>
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy}>
        <legend>Playoff placement claims</legend>
        {placements.map((entry, index) => <div className="correction-actions" key={entry.placement}>
          <label>Place {entry.placement}
            <select value={entry.participantId} onChange={(event) => setPlacements((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, participantId: event.target.value } : item))}>
              <option value="">Choose a qualifier</option>
              {workspace.qualifierChoices.map((choice) => <option key={choice.participantId} value={choice.participantId}>{choice.displayName}</option>)}
            </select>
          </label>
          <label>Prize (USD)
            <input inputMode="decimal" value={entry.prize} onChange={(event) => setPlacements((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, prize: event.target.value } : item))} />
          </label>
          {placements.length > 2 && index === placements.length - 1 ? <button className="secondary" type="button" onClick={() => setPlacements((current) => current.slice(0, -1))}>Remove Place</button> : null}
        </div>)}
        <button className="secondary" type="button" disabled={placements.length >= workspace.qualifierChoices.length} onClick={() => setPlacements((current) => [...current, { participantId: "", placement: current.length + 1, prizeAmountMinor: 0, prize: "0.00" }])}>Add Paid Placement</button>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Q-pool and other award claims</legend>
        {awards.map((entry, index) => <div className="correction-item" key={`${entry.participantId}-${entry.awardType}-${entry.qPoolSlot ?? "other"}-${index}`}>
          <label>Qualifier<select value={entry.participantId} onChange={(event) => setAwards((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, participantId: event.target.value } : item))}>{workspace.qualifierChoices.map((choice) => <option key={choice.participantId} value={choice.participantId}>{choice.displayName}</option>)}</select></label>
          <label>Award type<select value={entry.awardType === "q_pool" ? String(entry.qPoolSlot) : "other"} onChange={(event) => setAwards((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, awardType: event.target.value === "other" ? "other" : "q_pool", qPoolSlot: event.target.value === "other" ? null : Number(event.target.value) as 1 | 2 } : item))}><option value="other">Other</option>{workspace.configuredQPools.map((pool) => <option key={pool.qPoolId} value={pool.slot}>Q-pool {pool.slot}</option>)}</select></label>
          <label>Amount (USD)<input inputMode="decimal" value={entry.amount} onChange={(event) => setAwards((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} /></label>
          <label>Optional note<input maxLength={500} value={entry.note} onChange={(event) => setAwards((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))} /></label>
          <button className="secondary" type="button" onClick={() => setAwards((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove award</button>
        </div>)}
        <button className="secondary" type="button" onClick={() => setAwards((current) => [...current, { participantId: workspace.qualifierChoices[0].participantId, awardType: "other", qPoolSlot: null, amountMinor: 0, amount: "", note: "" }])}>Add Award</button>
      </fieldset>
      <button className="primary" type="submit" disabled={busy}>{busy ? "Checking…" : `Save Draft Version ${workspace.currentVersion + 1}`}</button>
    </form>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
    {workspace.draft ? <section className="correction-item"><h3>Latest saved draft</h3><p>Version {workspace.draft.version} by {workspace.draft.createdBy}</p><p>{workspace.draft.serverTotals.activePaymentReceiptCount} active receipts · {dollars(workspace.draft.serverTotals.activePaymentReceiptTotalMinor)} received</p><p>{workspace.draft.serverTotals.activeExpenseCount} active expenses · {dollars(workspace.draft.serverTotals.activeExpenseTotalMinor)} recorded</p><p>Unallocated tournament cash position: <strong>{dollars(workspace.draft.serverTotals.netCashPositionMinor)}</strong></p><a className="guide-link" href={`/api/v1/tournaments/${tournamentId}/events/${eventId}/settlement-draft/working-copy`}>Download Private Working Copy (.CSV)</a><p className="auth-note">The working copy is for director review only. MRPs, Q-pool payout rules, event allocation, final reconciliation, publication, and official ACC export remain unavailable until approved rules and workflows are implemented.</p></section> : null}
  </section>;
}
