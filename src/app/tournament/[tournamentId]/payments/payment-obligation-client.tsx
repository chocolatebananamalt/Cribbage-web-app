"use client";
import { setAppRecoveryItem, trackAppRecoveryWrite } from "../../../../lib/recovery-write-coordinator";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isPaymentObligationRequest, isRejectedPaymentObligation, isSavedPaymentObligation, type PaymentObligationEntry } from "../../../../lib/api/payment-obligation";
import {
  createPaymentObligationRecoveryEnvelopeV2,
  parsePaymentObligationRecoveryRaw,
  paymentObligationRecoveryStorageKey,
  readPaymentObligationRecovery,
  type ParsedPaymentObligationRecovery,
} from "../../../../lib/payments/payment-obligation-recovery-v2";

const money = (minor: number | null) => minor === null ? "Not set" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);
function cents(value: string) { const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim()); if (!match) return null; const result = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0"); return Number.isSafeInteger(result) && result <= 2147483647 ? result : null; }
function rejectionMessage(code: string) { return code === "invalid_request" ? "The amount owed request was invalid. Its exact recovery bytes remain saved for review." : code === "tournament_unavailable" ? "This tournament is unavailable for payment changes. The exact recovery bytes remain saved." : code === "not_director" ? "Only a tournament Director or Co-director can save amount owed. The exact recovery bytes remain saved." : code === "idempotency_conflict" ? "That request key was already used with different data. The exact recovery bytes remain saved for review." : code === "roster_entry_unavailable" ? "This roster entry is no longer available. The exact recovery bytes remain saved for review." : "The server rejected the amount owed request. Its exact recovery bytes remain saved for review."; }

type RowProps = { actorId: string; entry: PaymentObligationEntry; tournamentId: string };
function Row({ actorId, entry, tournamentId }: RowProps) {
  const key = paymentObligationRecoveryStorageKey(actorId, tournamentId, entry.rosterEntryId);
  const [value, setValue] = useState(entry.amountOwedMinor === null ? "" : (entry.amountOwedMinor / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState<ParsedPaymentObligationRecovery | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const activation = useRef<object | null>(null);
  const router = useRouter();

  useLayoutEffect(() => {
    const token = {};
    activation.current = token;
    const timer = window.setTimeout(() => {
      if (activation.current !== token) return;
      try {
        const recovered = readPaymentObligationRecovery(window.sessionStorage, key, actorId, tournamentId, entry.rosterEntryId);
        if (recovered) {
          setPending(recovered);
          if (recovered.status === "unknown") {
            setMessage("An unrecognized amount owed recovery record remains saved. It was not changed or removed.");
          } else {
            setValue((recovered.request.amountOwedMinor / 100).toFixed(2));
            setReason(recovered.request.reason);
            setMessage("A previous amount owed request could not be confirmed. Retry the exact saved request.");
          }
        }
      } catch {
        setStorageUnavailable(true);
        setMessage("This browser cannot inspect saved amount owed recovery data. Storage must be available before continuing.");
      }
      setHydrated(true);
    }, 0);
    return () => { window.clearTimeout(timer); if (activation.current === token) activation.current = null; };
  }, [actorId, entry.rosterEntryId, key, tournamentId]);

  async function save() {
    const token = activation.current;
    if (!hydrated || storageUnavailable || busy || inFlight.current || token === null) return;
    if (pending?.status === "unknown") {
      setMessage("An unrecognized amount owed recovery record remains saved. It cannot be overwritten here.");
      return;
    }
    const request = pending?.request ?? (() => {
      const amountOwedMinor = cents(value);
      return amountOwedMinor === null ? null : { rosterEntryId: entry.rosterEntryId, expectedVersion: entry.obligationVersion, amountOwedMinor, reason, idempotencyKey: crypto.randomUUID() };
    })();
    if (!request) { setMessage("Enter a valid amount owed."); return; }
    if (!isPaymentObligationRequest(request)) { setMessage("Enter a valid amount owed and reason."); return; }
    let activePending = pending;
    if (!activePending) {
      const envelope = createPaymentObligationRecoveryEnvelopeV2(actorId, tournamentId, entry.rosterEntryId, request);
      const raw = envelope && JSON.stringify(envelope);
      if (!envelope || !raw) return;
      try {
        if (activation.current !== token) return;
        const observed = window.sessionStorage.getItem(key);
        if (observed !== null) {
          setPending(parsePaymentObligationRecoveryRaw(observed, actorId, tournamentId, entry.rosterEntryId));
          setMessage("Another amount owed recovery record was saved before this request. Its bytes remain unchanged.");
          return;
        }
        setAppRecoveryItem(window.sessionStorage, key, raw);
        if (window.sessionStorage.getItem(key) !== raw) throw new Error("recovery_write_unconfirmed");
        const parsed = parsePaymentObligationRecoveryRaw(raw, actorId, tournamentId, entry.rosterEntryId);
        setPending(parsed);
        if (parsed.status === "unknown") { setMessage("The saved amount owed request could not be read back safely."); return; }
        activePending = parsed;
      } catch { setMessage("This browser cannot safely retain the exact request for recovery."); return; }
    }
    if (!activePending || activation.current !== token) return;
    inFlight.current = true; setBusy(true); setMessage("Saving the amount owed.");
    try {
      const outcome = await trackAppRecoveryWrite(async () => {
        if (activation.current !== token) return "superseded" as const;
        if (window.sessionStorage.getItem(key) !== activePending.raw) return "changed" as const;
        const response = await fetch(`/api/v1/tournaments/${tournamentId}/payment-obligations`, { method: "POST", headers: { "content-type": "application/json", "x-expected-actor-id": actorId }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(activePending.request) });
        const result: unknown = await response.json().catch(() => null);
        if (activation.current !== token) return "superseded" as const;
        const accepted = response.ok && isSavedPaymentObligation(result, activePending.request);
        if (!accepted) return response.status === 409 && isRejectedPaymentObligation(result, activePending.request) ? { status: "rejected", code: result.code } as const : "unresolved" as const;
        if (window.sessionStorage.getItem(key) !== activePending.raw) return "changed" as const;
        window.sessionStorage.removeItem(key);
        if (window.sessionStorage.getItem(key) !== null) return "unresolved" as const;
        return "accepted" as const;
      });
      if (activation.current !== token) return;
      if (outcome === "accepted") { setPending(null); setMessage("The exact amount owed request was confirmed. Refreshing the current amount."); router.refresh(); return; }
      if (outcome === "changed") {
        setPending(readPaymentObligationRecovery(window.sessionStorage, key, actorId, tournamentId, entry.rosterEntryId));
        setMessage("The retained amount owed request changed while the write was pending. The newer bytes remain saved."); return;
      }
      if (typeof outcome === "object") { setMessage(rejectionMessage(outcome.code)); return; }
      setMessage("The amount owed request could not be confirmed. Its exact recovery record remains saved for retry.");
    } catch { if (activation.current === token) setMessage("The amount owed request could not be confirmed. Its exact recovery record remains saved for retry."); }
    finally { if (activation.current === token) { inFlight.current = false; setBusy(false); } }
  }

  return <li className="correction-item"><h3>{entry.displayName}</h3><p><strong>Status:</strong> {entry.paymentStatus.replace("_", " ")} · Owed {money(entry.amountOwedMinor)} · Received {money(entry.amountReceivedMinor)} · Remaining {money(entry.amountRemainingMinor)}</p><label>Amount Owed<input inputMode="decimal" disabled={storageUnavailable || busy || !!pending || !hydrated} value={value} onChange={event => setValue(event.target.value)} placeholder="0.00" /></label><label>Optional Reason for Change<textarea disabled={storageUnavailable || busy || !!pending || !hydrated} value={reason} maxLength={500} onChange={event => setReason(event.target.value)} /></label><button type="button" className="secondary" disabled={storageUnavailable || busy || !hydrated || pending?.status === "unknown"} onClick={() => void save()}>{busy ? "Saving." : pending ? "Retry Exact Amount Owed Request" : "Save amount owed"}</button>{message ? <p className={pending ? "auth-note" : "error-text"} role={pending ? "status" : "alert"}>{message}</p> : null}</li>;
}

export default function PaymentObligationClient({ actorId, tournamentId, entries }: { actorId: string; tournamentId: string; entries: PaymentObligationEntry[] }) {
  return <section id="player-payment-status" className="policy-settings"><h2>Player payment status and amount owed</h2><p>Before event attendance, save an explicit amount owed for each enrolled player, including 0 when no fee is due. Configured event fees do not create this separate payment prerequisite. Review the intended fees and pools; nothing is charged automatically.</p><p>The received amount is the current cumulative cash/check receipt. To correct or increase it, void the current receipt below and record the new total received-to-date.</p><ul className="correction-list">{entries.map(entry => <Row key={`${actorId}:${tournamentId}:${entry.rosterEntryId}`} actorId={actorId} entry={entry} tournamentId={tournamentId} />)}</ul></section>;
}
