"use client";
import { setAppRecoveryItem } from "../../../../../../lib/recovery-write-coordinator";

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  isRejectedSettlementV5, isSettlementV5DraftSaved, isSettlementV5FinalizationRequest,
  isSettlementV5Finalized, isSettlementV5Reconciliation, isSettlementV5Request,
  type SettlementV5FinalizationRequest, type SettlementV5Request, type SettlementV5Workspace,
} from "../../../../../../lib/api/settlement-v5";
import { isPrizeScheduleResolution, type PrizeScheduleResolution } from "../../../../../../lib/api/prize-schedule";
import { isUuid } from "../../../../../../lib/api/validation";
import { formatUsd } from "../../../../../../lib/money";
import { UsdAmountInput } from "../../../../../../components/usd-amount-input";

type Request = SettlementV5Request | SettlementV5FinalizationRequest;
type Kind = "settlement-v5" | "settlement-v5-finalization";
type Envelope = { kind: Kind; operationId: string; request: Request };
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
function validEnvelope(value: unknown, kind: Kind): value is Envelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).sort().join(",") === "kind,operationId,request" && item.kind === kind && isUuid(item.operationId)
    && (kind === "settlement-v5" ? isSettlementV5Request(item.request) : isSettlementV5FinalizationRequest(item.request));
}

/** Null receipt is an observation, never proof that an earlier POST cannot commit. */
function useRetainedOperation(kind: Kind, key: string, tournamentId: string, eventId: string, sharedFlightRef: MutableRefObject<boolean>) {
  const router = useRouter();
  const [pending, setPending] = useState<Envelope | null>(null);
  const [busy, setBusy] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const retainedRaw = useRef<string | null>(null);
  const expectedSuccess = (result: unknown) => kind === "settlement-v5"
    ? isSettlementV5DraftSaved(result, tournamentId, eventId) : isSettlementV5Finalized(result, tournamentId, eventId);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const raw = sessionStorage.getItem(key);
      retainedRaw.current = raw;
      if (!raw) { setBusy(false); return; }
      let saved: unknown;
      try { saved = JSON.parse(raw); } catch { saved = null; }
      if (!validEnvelope(saved, kind)) {
        setBlocked(true); setBusy(false); setMessage("An unrecognized request remains saved locally. It has not been overwritten or discarded."); return;
      }
      setPending(saved);
      void (async () => {
        try {
          const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/settlement-v5/reconciliation`, {
            method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: saved.operationId }),
          });
          const body: unknown = response.ok ? await response.json().catch(() => null) : null;
          if (!active) return;
          if (sessionStorage.getItem(key) !== raw) { setBlocked(true); setMessage("The retained request changed during the receipt check. The newer request remains saved."); return; }
          if (isSettlementV5Reconciliation(body, tournamentId, eventId)) {
            const result = body.result;
            const accepted = kind === "settlement-v5" ? isSettlementV5DraftSaved(result, tournamentId, eventId) : isSettlementV5Finalized(result, tournamentId, eventId);
            if (accepted || isRejectedSettlementV5(result, eventId)) {
              sessionStorage.removeItem(key); retainedRaw.current = null; setPending(null);
              setMessage(accepted ? "The saved operation was confirmed. Reloading its authoritative result." : "The saved operation was rejected. Reloading the current record."); router.refresh(); return;
            }
          }
          setMessage("No completed receipt is available yet. The exact request is retained and can be retried safely.");
        } catch { if (active) setMessage("Receipt status is uncertain. The exact request remains saved for retry."); }
        finally { if (active) setBusy(false); }
      })();
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [eventId, key, kind, router, tournamentId]);

  async function send(candidate: Request) {
    if (busy || blocked || sharedFlightRef.current) return;
    if (!(kind === "settlement-v5" ? isSettlementV5Request(candidate) : isSettlementV5FinalizationRequest(candidate))) {
      setMessage("Review the required fields before saving."); return;
    }
    if (pending && !same(candidate, pending.request)) { setMessage("The retained request is locked. Retry its exact recorded values first."); return; }
    const envelope: Envelope = pending ?? { kind, operationId: crypto.randomUUID(), request: candidate };
    const existing = sessionStorage.getItem(key);
    if (existing !== null && existing !== retainedRaw.current) { setBlocked(true); setMessage("A newer request is retained. It has not been overwritten."); return; }
    const raw = JSON.stringify(envelope);
    sharedFlightRef.current = true; setBusy(true); setPending(envelope);
    try {
      setAppRecoveryItem(sessionStorage, key, raw); retainedRaw.current = raw;
      const endpoint = kind === "settlement-v5" ? "settlement-v5" : "settlement-v5/finalization";
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/${endpoint}`, {
        method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json", "x-idempotency-key": envelope.operationId }, body: JSON.stringify(envelope.request),
      });
      const result: unknown = await response.json().catch(() => null);
      if (sessionStorage.getItem(key) !== raw) { setBlocked(true); setMessage("The retained request changed while saving. The newer request remains saved."); return; }
      if ((response.ok && expectedSuccess(result)) || (response.status === 409 && isRejectedSettlementV5(result, eventId))) {
        sessionStorage.removeItem(key); retainedRaw.current = null; setPending(null);
        setMessage(response.ok ? "The operation was recorded. Reloading authoritative evidence." : `The operation was rejected (${(result as { code: string }).code}). Review the current evidence.`);
        router.refresh(); return;
      }
      setMessage("The outcome is uncertain. Retry the exact retained request; a new operation has not been created.");
    } catch { setMessage("The outcome is uncertain. The exact request remains saved for retry."); }
    finally { sharedFlightRef.current = false; setBusy(false); }
  }
  return { pending, busy, blocked, message, send };
}

const attestationLabels = {
  expenseLedgerReviewed: "I reviewed the recorded expense evidence and ledger totals.",
  mrpClaimsReviewed: "I reviewed the canonical MRP rows and their source versions.",
  noAutomaticAccSubmission: "I understand this does not submit results to the ACC.",
  officialSourceReviewed: "I reviewed the official source and the recorded playoff evidence.",
  payoutClaimsReviewed: "I reviewed the explicit prize claims; no automatic payout policy was assumed.",
  noQPoolClaimsRecorded: "No Q Pool claims are recorded in this settlement.",
};
type AttestationKey = keyof typeof attestationLabels;
const unchecked = Object.fromEntries(Object.keys(attestationLabels).map(key => [key, false])) as Record<AttestationKey, boolean>;
function initialRequest(workspace: SettlementV5Workspace, scheduleVersionId?: string): SettlementV5Request {
  if (workspace.draft) return { ...workspace.draft.request, expectedVersion: workspace.currentDraftVersion };
  const source = workspace.sources[0];
  return { ...(scheduleVersionId ? { scheduleVersionId } : {}), source: source ? { kind: source.kind, resultId: source.resultId, qualificationResultVersionId: source.qualificationResultVersionId } : { kind: "playoff_outcome_v3", resultId: "", qualificationResultVersionId: "" }, expectedVersion: workspace.currentDraftVersion, prizeClaims: [], eventIncomeMinor: 0, eventExpenseMinor: 0, retainedBalanceMinor: 0, sanctioningExpenseEventId: null, officialSourceReference: "" };
}

export default function SettlementV5Client({ actorId, tournamentId, eventId, workspace, paybackReady = false, scheduleVersionId, children }: { actorId: string; tournamentId: string; eventId: string; workspace: SettlementV5Workspace | null; paybackReady?: boolean; scheduleVersionId?: string; children?: ReactNode }) {
  const sharedFlightRef = useRef(false);
  const draft = useRetainedOperation("settlement-v5", `settlement-v5:${actorId}:${tournamentId}:${eventId}`, tournamentId, eventId, sharedFlightRef);
  const final = useRetainedOperation("settlement-v5-finalization", `settlement-v5-finalization:${actorId}:${tournamentId}:${eventId}`, tournamentId, eventId, sharedFlightRef);
  const [request, setRequest] = useState<SettlementV5Request | null>(() => workspace ? initialRequest(workspace, scheduleVersionId) : null);
  const [attestations, setAttestations] = useState(unchecked);
  const [resolution, setResolution] = useState<PrizeScheduleResolution | null>(null);
  const [resolutionMessage, setResolutionMessage] = useState("");
  const [resolutionBusy, setResolutionBusy] = useState(false);
  const resolutionFlight = useRef(false);
  const [resolutionSource, setResolutionSource] = useState<string | null>(null);
  const effectiveRequest = draft.pending?.request && isSettlementV5Request(draft.pending.request) ? draft.pending.request : request;
  if (!workspace || !effectiveRequest) return <p role="alert">Settlement evidence is unavailable. No new save has been attempted.</p>;
  const disabled = draft.busy || final.busy || draft.blocked || final.blocked;
  const editingLocked = disabled || !!draft.pending || !!final.pending;
  const current = workspace.draft;
  const mrp = current?.canonicalMrp;
  const patch = (changes: Partial<SettlementV5Request>) => setRequest({ ...effectiveRequest, ...changes });
  async function readCalculatedAwards() {
    if (!effectiveRequest || editingLocked || resolutionFlight.current) return;
    resolutionFlight.current = true; setResolutionBusy(true); setResolution(null);
    const sourceKey = JSON.stringify(effectiveRequest.source);
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/prize-schedule-resolution`, { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: effectiveRequest.source }) });
      const body: unknown = response.ok ? await response.json().catch(() => null) : null;
      if (!isPrizeScheduleResolution(body)) { setResolutionMessage("Calculated awards are unavailable. No draft was changed."); return; }
      setResolutionSource(sourceKey); setResolution(body);
      setResolutionMessage(body.status === "available" ? "Read the server-derived total awards before using them. This has not saved a draft or paid anyone." : body.status === "blocked" ? `Cannot calculate: ${body.code.replaceAll("_", " ")}. Review setup and current evidence.` : "This event has no structured schedule. Historical manual claims remain separate.");
    } catch { setResolutionMessage("Calculated awards are unavailable. No draft was changed."); }
    finally { resolutionFlight.current = false; setResolutionBusy(false); }
  }
  function useCalculatedAwards() {
    if (editingLocked || !effectiveRequest || resolution?.status !== "available" || resolutionSource !== JSON.stringify(effectiveRequest.source) || resolution.scheduleVersionId !== scheduleVersionId) return;
    patch({ scheduleVersionId: resolution.scheduleVersionId, eventIncomeMinor: resolution.grossEntryIncomeMinor, eventExpenseMinor: resolution.expenseTotalMinor, retainedBalanceMinor: 0,
      prizeClaims: resolution.awards.map(a => ({ participantId: a.participantId, amountMinor: a.totalAwardMinor, prizeOrder: null, note: "Director-selected structured schedule total award; reviewed source required." })) });
    setResolutionMessage("Calculated total awards copied into the editable draft. Review expense binding and evidence before saving; nothing has been submitted.");
  }
  const allAttested = Object.values(attestations).every(Boolean);
  const finalCandidate: SettlementV5FinalizationRequest | null = current && allAttested ? { draftId: current.draftId, draftVersion: current.version, expectedVersion: workspace.currentFinalVersion, attestations: Object.fromEntries(Object.keys(attestationLabels).map(key => [key, true])) as SettlementV5FinalizationRequest["attestations"] } : null;
  const alreadyFinal = current && workspace.finalization?.draftId === current.draftId;
  const canStartFinal = !!finalCandidate && !draft.pending && mrp?.status === "available" && workspace.blockers.length === 0 && !alreadyFinal && paybackReady;
  const updateClaim = (index: number, field: string, value: string | number | null) => patch({ prizeClaims: effectiveRequest.prizeClaims.map((claim, position) => position === index ? { ...claim, [field]: value } : claim) });
  return <section className="policy-settings settlement-v5-workspace" aria-labelledby="settlement-review-title">
    <h2 id="settlement-review-title">Versioned settlement review</h2>
    <p>This records explicit financial claims and server-derived MRP evidence. A structured schedule can calculate proposed total awards from current evidence; it does not pay prizes, record a payment, or submit to the ACC. Q Pool claims are not supported in this workflow.</p>
    {workspace.blockers.length ? <div role="alert"><p>Known preflight blockers:</p><ul>{workspace.blockers.map(code => <li key={code}>{code.replaceAll("_", " ")}</li>)}</ul></div> : null}
    <p>Sanctioning assessment: {workspace.sanctioningAssessmentMinor === null ? "source evidence unavailable" : formatUsd(workspace.sanctioningAssessmentMinor)}. An assessment is not evidence of payment. Binding an existing expense creates no new expense or payment.</p>
    {scheduleVersionId ? <section className="correction-item" aria-label="Saved schedule calculation"><h3>Saved director-selected schedule</h3><p>New claims must match the explicitly saved schedule version. The server rechecks entries, expenses, qualifiers and equal-band awards; a mismatch is rejected.</p>
      <button type="button" disabled={editingLocked || resolutionBusy} onClick={() => void readCalculatedAwards()}>{resolutionBusy ? "Reading calculated awards…" : "Read calculated awards"}</button><p role="status">{resolutionMessage}</p>
      {resolution?.status === "available" ? <><p>Available prizes: {formatUsd(resolution.prizeBudgetMinor)}. Remainder assigned to champion: {formatUsd(resolution.roundingRemainderMinor)}.</p><ul>{resolution.awards.map(a => <li key={a.participantId}>Band {a.bandStart === a.bandEnd ? a.bandStart : `${a.bandStart}–${a.bandEnd}`}: {formatUsd(a.totalAwardMinor)} total award.</li>)}</ul><button type="button" disabled={editingLocked || resolutionBusy || resolution.scheduleVersionId !== scheduleVersionId || resolutionSource !== JSON.stringify(effectiveRequest.source)} onClick={useCalculatedAwards}>Use these total awards in draft</button></> : null}
    </section> : null}
    <section className="correction-item"><h3>Authoritative ledger</h3>
      <p>Current receipts: {workspace.ledgerSnapshot.paymentCount}; total {formatUsd(workspace.ledgerSnapshot.paymentTotalMinor)}. Current recorded expenses: {workspace.ledgerSnapshot.expenseCount}; total {formatUsd(workspace.ledgerSnapshot.expenseTotalMinor)}.</p>
      {current ? <p>Saved draft snapshot: receipts {current.ledgerSnapshot.paymentCount}, {formatUsd(current.ledgerSnapshot.paymentTotalMinor)}; expenses {current.ledgerSnapshot.expenseCount}, {formatUsd(current.ledgerSnapshot.expenseTotalMinor)}.</p> : null}
      <LinkToLedger tournamentId={tournamentId} />
      <ul>{workspace.expenseEvidence.map(evidence => <li key={evidence.expenseEventId}>{evidence.description}: {formatUsd(evidence.amountMinor)} — {evidence.expenseEventId}</li>)}</ul>
    </section>
    <fieldset disabled={editingLocked}><legend>Draft financial claims</legend>
      <label>Playoff evidence<select value={effectiveRequest.source.resultId} onChange={event => { const selected = workspace.sources.find(source => source.resultId === event.target.value); if (selected) patch({ source: { kind: selected.kind, resultId: selected.resultId, qualificationResultVersionId: selected.qualificationResultVersionId } }); }}><option value="">Choose recorded evidence</option>{workspace.sources.map(source => <option key={source.resultId} value={source.resultId}>{source.label}</option>)}</select></label>
      {(["eventIncomeMinor", "eventExpenseMinor", "retainedBalanceMinor"] as const).map(field => {
        const label = `${field === "eventIncomeMinor" ? "Event income allocation" : field === "eventExpenseMinor" ? "Event expense allocation" : "Retained balance"} (USD $)`;
        return <label key={field}>{label}<UsdAmountInput label={label} value={effectiveRequest[field]} onChange={minor => patch({ [field]: minor })} /></label>;
      })}
      <label>Existing sanctioning expense evidence<select value={effectiveRequest.sanctioningExpenseEventId ?? ""} onChange={event => patch({ sanctioningExpenseEventId: event.target.value || null })}><option value="">No expense bound</option>{workspace.expenseEvidence.map(evidence => <option key={evidence.expenseEventId} value={evidence.expenseEventId}>{evidence.description} — {formatUsd(evidence.amountMinor)}</option>)}</select></label>
      <label>Reviewed source reference<input maxLength={500} value={effectiveRequest.officialSourceReference} onChange={event => patch({ officialSourceReference: event.target.value })} /></label>
      <p>Prize order is optional financial claim data, separate from the ACC elimination cohort. No third/fourth order is inferred.</p>
      {effectiveRequest.prizeClaims.map((claim, index) => <div className="correction-item" key={index}>
        <label>Qualifier participant ID<input value={claim.participantId} onChange={event => updateClaim(index, "participantId", event.target.value)} /></label>
        <label>Claim amount (USD $)<UsdAmountInput label="Claim amount (USD $)" value={claim.amountMinor} onChange={minor => updateClaim(index, "amountMinor", minor)} /></label>
        <label>Optional prize order<input type="number" min="1" max="256" value={claim.prizeOrder ?? ""} onChange={event => updateClaim(index, "prizeOrder", event.target.value ? Number(event.target.value) : null)} /></label>
        <label>Reviewed claim note<input maxLength={500} value={claim.note} onChange={event => updateClaim(index, "note", event.target.value)} /></label>
        <button type="button" onClick={() => patch({ prizeClaims: effectiveRequest.prizeClaims.filter((_, position) => position !== index) })}>Remove claim</button>
      </div>)}
      <button type="button" disabled={effectiveRequest.prizeClaims.length >= 256} onClick={() => patch({ prizeClaims: [...effectiveRequest.prizeClaims, { participantId: "", amountMinor: 0, prizeOrder: null, note: "" }] })}>Add reviewed prize claim</button>
    </fieldset>
    <p role="status">{draft.message}</p>
    <button className="primary" type="button" disabled={disabled || !!final.pending || workspace.sources.length === 0} onClick={() => void draft.send(effectiveRequest)}>{draft.busy ? "Checking or saving draft…" : draft.pending ? "Retry exact draft request" : "Save reviewed draft"}</button>
    {mrp?.status === "available" ? <section className="correction-item"><h3>Canonical MRP evidence</h3><p>MRP source: {mrp.sourceVersion}. Bracket derivation: {mrp.bracketSourceVersion}.</p>
      <div className="settlement-evidence-scroll" role="region" aria-label="Canonical MRP evidence table" tabIndex={0}><table><caption>Saved draft participant MRP and elimination evidence</caption><thead><tr><th>Participant</th><th>Played wins</th><th>Byes</th><th>Eliminated in round</th><th>Cohort</th><th>Qualifying MRP</th><th>Playoff MRP</th><th>Total MRP</th></tr></thead><tbody>{mrp.rows.map(row => <tr key={row.participantId}><td>{row.displayName}</td><td>{row.playedMatchWins}</td><td>{row.byeWins}</td><td>{row.eliminatedInRound ?? "Champion"}</td><td>{row.bandStart === row.bandEnd ? row.bandStart : `${row.bandStart}–${row.bandEnd}`}</td><td>{row.qualifyingMrp}</td><td>{row.playoffMrp}</td><td>{row.totalMrp}</td></tr>)}</tbody></table></div>
    </section> : <p role="status">{mrp?.status === "blocked" ? `MRP evidence requires correction: ${mrp.code}. Draft claims may be saved, but finalization must wait.` : "Save a draft to obtain canonical evidence before final review."}</p>}
    {children}
    {current && !paybackReady ? <p role="alert">Payback review is unavailable, incomplete, or no longer matches this draft. New finalization must wait. Any retained finalization request remains available for exact receipt recovery.</p> : null}
    {current ? <fieldset disabled={disabled || !!draft.pending}><legend>Director evidence review and manual finalization</legend>
      <p>Review saved draft {current.version} and its evidence above. The server also rechecks disputes, current cross-check completion and ledger conservation when recording this review. This records manual reconciliation, not a bank payment or ACC submission.</p>
      {(Object.keys(attestationLabels) as AttestationKey[]).map(key => <label key={key}><input type="checkbox" checked={attestations[key]} disabled={!!final.pending} onChange={event => setAttestations({ ...attestations, [key]: event.target.checked })} />{attestationLabels[key]}</label>)}
      <p role="status">{final.message}</p>
      {final.pending ? <p>The retained finalization targets its original draft and will be retried unchanged. The server will reconcile or reject it against current evidence.</p> : null}
      <button type="button" className="primary" disabled={disabled || !!draft.pending || (!final.pending && !canStartFinal)} onClick={() => { const candidate = final.pending?.request ?? finalCandidate; if (candidate) void final.send(candidate); }}>{final.busy ? "Checking or recording review…" : final.pending ? "Retry exact finalization request" : alreadyFinal ? "This draft already has a recorded review" : "Record reviewed manual finalization"}</button>
    </fieldset> : null}
  </section>;
}

function LinkToLedger({ tournamentId }: { tournamentId: string }) {
  return <p><a href={`/tournament/${tournamentId}/roster`}>Review the roster receipt ledger</a>. Review the tournament expense ledger before attesting the selected source.</p>;
}
