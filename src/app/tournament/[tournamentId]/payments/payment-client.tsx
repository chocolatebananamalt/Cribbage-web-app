"use client";
import { compareAndReplaceAppRecoveryItem, setAppRecoveryItem, trackAppRecoveryWrite } from "../../../../lib/recovery-write-coordinator";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentRosterEntry } from "../../../../lib/api/payment";
import { isPaymentRecordRequest, isPaymentVoidRequest, isRecordedPayment, isRecoveredPayment, isRejectedPayment, isVoidedPayment, type PaymentRecordRequest, type PaymentRecoveryRequest, type PaymentVoidRequest } from "../../../../lib/api/payment";
import {
  createPaymentRecoveryEnvelopeV2,
  exactPaymentRecoveryRequestMatches,
  parsePaymentRecoveryRaw,
  paymentRecoveryStorageKey,
  readPaymentRecovery,
  type ParsedPaymentRecovery,
} from "../../../../lib/payments/payment-recovery-v2";

type RecordFields = Omit<PaymentRecordRequest, "rosterEntryId" | "expectedPaymentVersion" | "idempotencyKey">;
type VoidFields = Omit<PaymentVoidRequest, "rosterEntryId" | "expectedPaymentVersion" | "paymentEventId" | "idempotencyKey">;

async function digest(value: unknown) { const bytes = new TextEncoder().encode(JSON.stringify(value)); const hash = await crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
const now = () => new Date().toISOString();
const terminalRejectedPaymentCodes = new Set([
  "stale_payment_history",
  "active_payment_receipt_exists",
  "current_payment_receipt_required",
  "roster_entry_unavailable",
]);
function dollarsToMinor(value: string) { const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim()); if (!match || match[1].length > 8) return null; const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0"); return Number.isSafeInteger(cents) && cents > 0 && cents <= 2147483647 ? cents : null; }

function PaymentRow({ entry, disabled, unavailableReason, acceptedMethods, onRecord, onVoid, syntheticMode }: { entry: PaymentRosterEntry; disabled: boolean; unavailableReason: string | null; acceptedMethods: readonly ("cash" | "check")[]; onRecord: (entry: PaymentRosterEntry, fields: RecordFields) => void; onVoid: (entry: PaymentRosterEntry, fields: VoidFields) => void; syntheticMode: boolean }) {
  const [amount, setAmount] = useState(""); const [method, setMethod] = useState<"cash" | "check">(acceptedMethods[0] ?? "cash"); const [receivedAt, setReceivedAt] = useState(now); const [note, setNote] = useState(""); const [voidReason, setVoidReason] = useState("");
  const receipt = entry.currentReceiptEventId;
  function submitRecord() { const amountMinor = dollarsToMinor(amount); const activeMethod = acceptedMethods.includes(method) ? method : acceptedMethods[0]; if (amountMinor === null || !activeMethod) return; onRecord(entry, { amountMinor, paymentMethod: activeMethod, paymentReceivedAt: receivedAt, note: syntheticMode ? `TEST ONLY SYNTHETIC:${note.trim() ? ` ${note.trim()}` : ""}` : note }); }
  return <li className="correction-item"><h2>{entry.displayName}</h2><p><strong>Player planned:</strong> {entry.plannedPaymentMethod === "cash" ? "Cash" : entry.plannedPaymentMethod === "check" ? "Check" : "Not specified"}</p><p><strong>Evidence status:</strong> {entry.paymentState === "unrecorded" ? "No receipt recorded" : entry.paymentState === "received" ? "Current receipt recorded" : "Most recent receipt voided"} · history version {entry.paymentVersion}</p>{entry.history.length ? <ol>{entry.history.map((item) => <li key={item.paymentEventId}><strong>{item.eventType === "received" ? "Receipt recorded" : "Receipt voided"}</strong> · ${" "}{(item.amountMinor / 100).toFixed(2)} USD · {item.paymentMethod === "cash" ? "Cash" : item.paymentMethod === "check" ? "Check" : "Historical manual payment"}</li>)}</ol> : null}{disabled && unavailableReason ? <p className="auth-note">{unavailableReason}</p> : null}{entry.paymentState !== "received" ? <fieldset disabled={disabled}><legend>{syntheticMode ? "Record simulated fixture receipt" : "Record cash or check received"}</legend>{syntheticMode && <p className="auth-note">No cash or check was actually received.</p>}<label>Amount in USD<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label>Payment Method<select value={method} onChange={(event) => setMethod(event.target.value as "cash" | "check")}>{acceptedMethods.includes("cash") ? <option value="cash">Cash</option> : null}{acceptedMethods.includes("check") ? <option value="check">Check</option> : null}</select></label><label>Received at (UTC)<input value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} aria-describedby={`${entry.rosterEntryId}-received-help`} /></label><p id={`${entry.rosterEntryId}-received-help`}>Keep the supplied UTC date/time format. Do not enter card, bank-account, or full check details.</p><label>{syntheticMode ? "Optional note after synthetic label" : "Optional receipt note"}<textarea value={note} maxLength={syntheticMode ? 478 : 500} onChange={(event) => setNote(event.target.value)} /></label><button className="primary" type="button" onClick={submitRecord}>{syntheticMode ? "Record simulated receipt evidence" : "Record receipt evidence"}</button></fieldset> : <fieldset disabled={disabled}><legend>Void current receipt</legend><label>Reason for Void<textarea value={voidReason} maxLength={500} onChange={(event) => setVoidReason(event.target.value)} /></label><button className="secondary" type="button" onClick={() => receipt && onVoid(entry, { voidReason })}>Void current receipt</button></fieldset>}</li>;
}

type PaymentClientProps = {
  actorId: string;
  tournamentId: string;
  rosterEntries: PaymentRosterEntry[];
  acceptedMethods: readonly ("cash" | "check")[];
  syntheticMode?: boolean;
};

export default function PaymentClient(props: PaymentClientProps) {
  return <PaymentClientScope key={`${props.actorId}:${props.tournamentId}`} {...props} />;
}

function PaymentClientScope({ actorId, tournamentId, rosterEntries, acceptedMethods, syntheticMode = false }: PaymentClientProps) {
  const router = useRouter();
  const storageKey = paymentRecoveryStorageKey(actorId, tournamentId);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState<ParsedPaymentRecovery | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const activation = useRef<object | null>(null);
  const isActive = useCallback((token: object | null): token is object => token !== null && activation.current === token, []);

  useLayoutEffect(() => {
    const token = {};
    activation.current = token;
    return () => { if (activation.current === token) activation.current = null; };
  }, []);

  const reconcile = useCallback(async (recovery: PaymentRecoveryRequest) => {
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/payments/reconciliation`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-expected-actor-id": actorId },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(recovery),
      });
      const payload: unknown = response.ok ? await response.json().catch(() => null) : null;
      if (!payload || typeof payload !== "object" || !("result" in (payload as Record<string, unknown>))) return { status: "unresolved" } as const;
      const result = (payload as Record<string, unknown>).result;
      if (result === null) return { status: "none" } as const;
      if (isRecoveredPayment(result, recovery)) return { status: "accepted" } as const;
      if (isRejectedPayment(result, recovery.rosterEntryId, recovery.operationType)) {
        const code = (result as Record<string, unknown>).code;
        return code === "idempotency_conflict"
          ? { status: "conflict" } as const
          : { status: "rejected", code: typeof code === "string" ? code : "" } as const;
      }
      return { status: "unresolved" } as const;
    } catch { return { status: "unresolved" } as const; }
  }, [actorId, tournamentId]);

  useEffect(() => {
    let live = true;
    const token = activation.current;
    const current = () => live && isActive(token);
    void (async () => {
      const saved = readPaymentRecovery(window.sessionStorage, storageKey, actorId, tournamentId);
      if (!current()) return;
      if (!saved) { setReady(true); return; }
      if (saved.status === "unknown") {
        setLocked(saved);
        setMessage("An unrecognized payment recovery record remains saved. It was not changed or removed.");
        setReady(true); return;
      }
      const state = await reconcile(saved.recovery);
      if (!current()) return;
      setLocked(saved);
      setMessage(state.status === "accepted"
        ? "A server receipt exists for this operation identity, but it does not prove the retained full payload. Retry the exact saved request before cleanup."
        : state.status === "rejected"
          ? "A rejected server receipt exists for this operation identity. Retry the exact saved request before cleanup."
          : state.status === "none"
        ? saved.status === "current"
          ? "No server receipt exists yet. The exact payment request remains saved and can be retried."
          : "No server receipt exists yet. This legacy record has no full payload; re-enter its original details exactly before retrying."
        : state.status === "conflict"
          ? "The server reported an idempotency conflict. The payment recovery bytes remain saved for review."
          : "A prior payment action is unresolved. Its recovery bytes remain saved.");
      setReady(true);
    })();
    return () => { live = false; };
  }, [actorId, isActive, reconcile, storageKey, tournamentId]);

  async function postPending(pending: ParsedPaymentRecovery, token: object) {
    if (pending.status !== "current" || !isActive(token)) return;
    const { operationType, request: body } = pending.envelope;
    const path = operationType === "record_manual_roster_payment" ? "record" : "void";
    setBusy(true); setLocked(pending); setMessage(null);
    const outcome = await trackAppRecoveryWrite(async () => {
      if (!isActive(token)) return "superseded" as const;
      if (window.sessionStorage.getItem(storageKey) !== pending.raw) return "changed" as const;
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/payments/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-expected-actor-id": actorId },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!isActive(token)) return "superseded" as const;
      const directAccepted = response.ok && (operationType === "record_manual_roster_payment"
        ? isRecordedPayment(result, body as PaymentRecordRequest)
        : isVoidedPayment(result, body as PaymentVoidRequest));
      const directRejected = response.status === 409 && isRejectedPayment(result, pending.recovery.rosterEntryId, operationType);
      if (!directAccepted && !directRejected) return "unresolved" as const;
      if (directRejected && (result as Record<string, unknown>).code === "idempotency_conflict") return "conflict" as const;
      if (directRejected) {
        const directCode = (result as Record<string, unknown>).code;
        if (typeof directCode !== "string" || !terminalRejectedPaymentCodes.has(directCode)) return "rejected" as const;
        const confirmed = await reconcile(pending.recovery);
        if (!isActive(token)) return "superseded" as const;
        if (confirmed.status !== "rejected" || confirmed.code !== directCode) {
          return confirmed.status === "conflict" ? "conflict" as const : "unresolved" as const;
        }
        try {
          if (window.sessionStorage.getItem(storageKey) !== pending.raw) return "changed" as const;
          window.sessionStorage.removeItem(storageKey);
          return window.sessionStorage.getItem(storageKey) === null ? "terminal_rejected" as const : "unresolved" as const;
        } catch { return "unresolved" as const; }
      }
      try {
        if (window.sessionStorage.getItem(storageKey) !== pending.raw) return "changed" as const;
        window.sessionStorage.removeItem(storageKey);
        return window.sessionStorage.getItem(storageKey) === null ? (directAccepted ? "accepted" as const : "rejected" as const) : "unresolved" as const;
      } catch { return "unresolved" as const; }
    });
    if (!isActive(token)) return;
    if (outcome === "accepted") { setLocked(null); router.refresh(); return; }
    if (outcome === "terminal_rejected") {
      setLocked(null);
      setMessage("The server confirmed the same terminal rejection for this exact payment request. Its recovery record was cleared; refresh before another attempt.");
      router.refresh(); return;
    }
    if (outcome === "rejected") {
      setMessage("The server rejected the exact payment request. Its recovery bytes remain saved for review."); return;
    }
    if (outcome === "changed") {
      setLocked(readPaymentRecovery(window.sessionStorage, storageKey, actorId, tournamentId) ?? pending);
      setMessage("The retained payment request changed while the write was pending. The newer bytes remain saved."); return;
    }
    if (outcome === "conflict") {
      setMessage("The server reported an idempotency conflict. The exact payment recovery bytes remain saved for review."); return;
    }
    setMessage("The payment action is unresolved. Its exact recovery record remains saved.");
  }

  async function retryCurrent() {
    const token = activation.current;
    if (!ready || busy || inFlight.current || !isActive(token) || locked?.status !== "current") return;
    inFlight.current = true;
    try { await postPending(locked, token); }
    catch { if (isActive(token)) setMessage("The payment action is unresolved. Its exact recovery record remains saved until safely reconciled."); }
    finally { if (isActive(token)) { inFlight.current = false; setBusy(false); } }
  }

  async function submit(
    operationType: PaymentRecoveryRequest["operationType"],
    entry: PaymentRosterEntry,
    fields: RecordFields | VoidFields,
  ) {
    const token = activation.current;
    if (!ready || busy || inFlight.current || !isActive(token)) return;
    inFlight.current = true;
    try {
      const paymentEventId = operationType === "void_manual_roster_payment" ? entry.currentReceiptEventId : null;
      if (operationType === "void_manual_roster_payment" && !paymentEventId) return;
      const provisionalKey = locked?.status === "current" || locked?.status === "legacy"
        ? locked.recovery.idempotencyKey : crypto.randomUUID();
      const body: PaymentRecordRequest | PaymentVoidRequest = operationType === "record_manual_roster_payment"
        ? { ...(fields as RecordFields), rosterEntryId: entry.rosterEntryId, expectedPaymentVersion: entry.paymentVersion, idempotencyKey: provisionalKey }
        : { ...(fields as VoidFields), rosterEntryId: entry.rosterEntryId, expectedPaymentVersion: entry.paymentVersion, paymentEventId: paymentEventId!, idempotencyKey: provisionalKey };
      if (operationType === "record_manual_roster_payment" ? !isPaymentRecordRequest(body) : !isPaymentVoidRequest(body)) {
        setMessage("Enter a valid amount, UTC date/time, and required reason before recording payment evidence."); return;
      }
      const operationDigest = await digest({ kind: operationType, rosterEntryId: entry.rosterEntryId,
        expectedPaymentVersion: entry.paymentVersion, paymentEventId, fields });
      if (!isActive(token)) return;
      let pending = locked;
      if (pending?.status === "unknown") {
        setMessage("An unrecognized payment recovery record remains saved. It cannot be overwritten here."); return;
      }
      if (pending?.status === "legacy") {
        if (pending.recovery.operationType !== operationType || pending.recovery.rosterEntryId !== entry.rosterEntryId
          || pending.recovery.expectedPaymentVersion !== entry.paymentVersion || pending.recovery.paymentEventId !== paymentEventId
          || pending.envelope.digest !== operationDigest || pending.recovery.idempotencyKey !== body.idempotencyKey) {
          setMessage("This action is locked. Re-enter the original details exactly or refresh after it resolves."); return;
        }
        const envelope = createPaymentRecoveryEnvelopeV2(actorId, tournamentId, operationType, body);
        if (!envelope) return;
        const upgradedRaw = JSON.stringify(envelope);
        try {
          const priorRaw = pending.raw;
          const upgraded = await trackAppRecoveryWrite(async () => {
            if (!isActive(token) || window.sessionStorage.getItem(storageKey) !== priorRaw) return false;
            return compareAndReplaceAppRecoveryItem(window.sessionStorage, storageKey, priorRaw, upgradedRaw);
          });
          if (!upgraded) {
            setLocked(readPaymentRecovery(window.sessionStorage, storageKey, actorId, tournamentId) ?? pending);
            setMessage("The retained payment request changed while preparing its retry. The existing bytes remain saved."); return;
          }
          pending = parsePaymentRecoveryRaw(upgradedRaw, actorId, tournamentId);
        } catch { setMessage("This browser cannot safely retain the exact payment request for recovery."); return; }
      } else if (pending?.status === "current") {
        if (!exactPaymentRecoveryRequestMatches(pending, operationType, body)) {
          setMessage("This action is locked. Retry the exact saved request without changing its fields."); return;
        }
      } else {
        const envelope = createPaymentRecoveryEnvelopeV2(actorId, tournamentId, operationType, body);
        const raw = envelope && JSON.stringify(envelope);
        if (!envelope || !raw) return;
        try {
          if (!isActive(token)) return;
          const observed = window.sessionStorage.getItem(storageKey);
          if (observed !== null) {
            setLocked(parsePaymentRecoveryRaw(observed, actorId, tournamentId));
            setMessage("Another payment recovery record was saved before this request. Its bytes remain unchanged."); return;
          }
          setAppRecoveryItem(window.sessionStorage, storageKey, raw);
          if (window.sessionStorage.getItem(storageKey) !== raw) throw new Error("recovery_write_unconfirmed");
          pending = parsePaymentRecoveryRaw(raw, actorId, tournamentId);
        } catch { setMessage("This browser cannot safely retain a payment request for recovery. Enable session storage before continuing."); return; }
      }
      if (!pending || pending.status !== "current" || !isActive(token)) return;
      await postPending(pending, token);
    } catch {
      if (isActive(token)) setMessage("The payment action is unresolved. Its exact recovery record remains saved until safely reconciled.");
    } finally {
      if (isActive(token)) { inFlight.current = false; setBusy(false); }
    }
  }

  const lockedName = locked && locked.status !== "unknown"
    ? rosterEntries.find((row) => row.rosterEntryId === locked.recovery.rosterEntryId)?.displayName ?? "Another player"
    : null;
  const lockedRosterId = locked && locked.status !== "unknown" ? locked.recovery.rosterEntryId : null;
  return <section className="policy-settings" aria-label="Manual payment history">
    <p>{syntheticMode ? "Fixture receipts are simulated evidence only; no cash or check is claimed as actually received." : "Record only cash or check that the director has actually received."} This evidence remains separate from check-in, seating, enrollment, scoring, and final reconciliation.</p>
    {locked?.status === "current" ? <button className="primary" type="button" disabled={!ready || busy} onClick={() => void retryCurrent()}>Retry exact saved payment request</button> : null}
    {rosterEntries.length ? <ul className="correction-list">{rosterEntries.map((entry) => <PaymentRow
      key={entry.rosterEntryId} entry={entry} acceptedMethods={acceptedMethods} syntheticMode={syntheticMode}
      disabled={!ready || busy || locked?.status === "unknown" || (lockedRosterId !== null && lockedRosterId !== entry.rosterEntryId)}
      unavailableReason={lockedRosterId !== null && lockedRosterId !== entry.rosterEntryId ? `${lockedName} has a payment action waiting to resolve. Finish or refresh that one, then this row can be used again.` : null}
      onRecord={(row, fields) => void submit("record_manual_roster_payment", row, fields)}
      onVoid={(row, fields) => void submit("void_manual_roster_payment", row, fields)}
    />)}</ul> : <p>No private roster entries are available yet.</p>}
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </section>;
}
