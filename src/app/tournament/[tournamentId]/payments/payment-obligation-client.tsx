"use client";
import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isPaymentObligationRequest, isRejectedPaymentObligation, isSavedPaymentObligation, type PaymentObligationEntry, type PaymentObligationRequest } from "../../../../lib/api/payment-obligation";

const money = (minor: number | null) => minor === null ? "Not set" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);
function cents(value: string) { const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim()); if (!match) return null; const result = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0"); return Number.isSafeInteger(result) && result <= 2147483647 ? result : null; }
function storageKey(actorId: string, tournamentId: string, rosterEntryId: string) { return `payment-obligation:${actorId}:${tournamentId}:${rosterEntryId}`; }
function readPending(key: string, rosterEntryId: string): PaymentObligationRequest | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null"); return isPaymentObligationRequest(value) && value.rosterEntryId === rosterEntryId ? value : null; } catch { return null; } }
function storePending(key: string, request: PaymentObligationRequest) { try { setAppRecoveryItem(sessionStorage, key, JSON.stringify(request)); return true; } catch { return false; } }
function clearPending(key: string) { try { sessionStorage.removeItem(key); } catch { /* accepted server receipt remains authoritative */ } }
function rejectionMessage(code: string) { return code === "invalid_request" ? "The amount owed request was invalid. Review the amount and reason, then try again." : code === "tournament_unavailable" ? "This tournament is unavailable for payment changes." : code === "not_director" ? "Only a tournament Director or Co-director can save amount owed." : code === "idempotency_conflict" ? "That request key was already used with different data. Refresh before trying again." : code === "roster_entry_unavailable" ? "This roster entry is no longer available." : "Another amount owed update was saved first. Refresh this row before trying again."; }

function Row({ actorId, entry, tournamentId }: { actorId: string; entry: PaymentObligationEntry; tournamentId: string }) {
  const key = storageKey(actorId, tournamentId, entry.rosterEntryId);
  const [value, setValue] = useState(entry.amountOwedMinor === null ? "" : (entry.amountOwedMinor / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState<PaymentObligationRequest | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const router = useRouter();
  useEffect(() => { const timer = window.setTimeout(() => { const recovered = readPending(key, entry.rosterEntryId); if (recovered) { setPending(recovered); setValue((recovered.amountOwedMinor / 100).toFixed(2)); setReason(recovered.reason); setMessage("A previous amount owed request could not be confirmed. Retry the exact request."); } setHydrated(true); }, 0); return () => window.clearTimeout(timer); }, [entry.rosterEntryId, key]);
  async function save() {
    if (!hydrated || busy || inFlight.current) return;
    const request = pending ?? (() => { const amountOwedMinor = cents(value); return amountOwedMinor === null ? null : { rosterEntryId: entry.rosterEntryId, expectedVersion: entry.obligationVersion, amountOwedMinor, reason, idempotencyKey: crypto.randomUUID() }; })();
    if (!request) { setMessage("Enter a valid amount owed."); return; }
    if (!isPaymentObligationRequest(request)) { setMessage("Enter a valid amount owed and reason."); return; }
    if (!pending && !storePending(key, request)) { setMessage("This browser cannot safely retain the request for recovery."); return; }
    inFlight.current = true; setBusy(true); setPending(request); setMessage("Saving the amount owed.");
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/payment-obligations`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(request) });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isSavedPaymentObligation(result, request)) { clearPending(key); setPending(null); setMessage("Amount owed saved."); router.refresh(); return; }
      if (response.status === 409 && isRejectedPaymentObligation(result, request)) { clearPending(key); setPending(null); setMessage(rejectionMessage(result.code)); return; }
      setMessage("The amount owed request could not be confirmed. Retry the exact request when the connection is available.");
    } catch { setMessage("The amount owed request could not be confirmed. Retry the exact request when the connection is available."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <li className="correction-item"><h3>{entry.displayName}</h3><p><strong>Status:</strong> {entry.paymentStatus.replace("_", " ")} · Owed {money(entry.amountOwedMinor)} · Received {money(entry.amountReceivedMinor)} · Remaining {money(entry.amountRemainingMinor)}</p><label>Amount owed<input inputMode="decimal" disabled={busy || !!pending || !hydrated} value={value} onChange={event => setValue(event.target.value)} placeholder="0.00" /></label><label>Optional reason for change<textarea disabled={busy || !!pending || !hydrated} value={reason} maxLength={500} onChange={event => setReason(event.target.value)} /></label><button type="button" className="secondary" disabled={busy || !hydrated} onClick={() => void save()}>{busy ? "Saving." : pending ? "Retry Exact Amount Owed Request" : "Save amount owed"}</button>{message ? <p className={pending ? "auth-note" : "error-text"} role={pending ? "status" : "alert"}>{message}</p> : null}</li>;
}

export default function PaymentObligationClient({ actorId, tournamentId, entries }: { actorId: string; tournamentId: string; entries: PaymentObligationEntry[] }) { return <section id="player-payment-status" className="policy-settings"><h2>Player payment status and amount owed</h2><p>Before event attendance, save an explicit amount owed for each enrolled player, including 0 when no fee is due. Configured event fees do not create this separate payment prerequisite. Review the intended fees and pools; nothing is charged automatically.</p><p>The received amount is the current cumulative cash/check receipt. To correct or increase it, void the current receipt below and record the new total received-to-date.</p><ul className="correction-list">{entries.map(entry => <Row key={entry.rosterEntryId} actorId={actorId} entry={entry} tournamentId={tournamentId} />)}</ul></section>; }
