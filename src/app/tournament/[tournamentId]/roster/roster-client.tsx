"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PromotionCandidate, RosterEntry } from "../../../../lib/roster/workspace";
import { isAcceptedRosterPromotion, isRejectedRosterPromotion, isUuid } from "../../../../lib/api/roster";

type Envelope = { kind: "roster-promotion"; approvalDecisionId: string; idempotencyKey: string };
const valid = (value: unknown): value is Envelope => !!value && typeof value === "object" && (value as Envelope).kind === "roster-promotion" && isUuid((value as Envelope).approvalDecisionId) && isUuid((value as Envelope).idempotencyKey);
function read(key: string) { try { const raw = window.sessionStorage.getItem(key); const parsed: unknown = raw ? JSON.parse(raw) : null; return valid(parsed) ? parsed : null; } catch { return null; } }
function write(key: string, value: Envelope) { try { window.sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function clear(key: string) { try { window.sessionStorage.removeItem(key); } catch { /* Server receipt remains authoritative. */ } }

export default function RosterClient({ actorId, tournamentId, rosterEntries, promotionCandidates }: { actorId: string; tournamentId: string; rosterEntries: RosterEntry[]; promotionCandidates: PromotionCandidate[] }) {
  const router = useRouter(); const key = `registration-operation:roster:${actorId}:${tournamentId}`;
  const [locked, setLocked] = useState<Envelope | null>(null); const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const reconcile = useCallback(async (envelope: Envelope) => {
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/roster-promotions/reconciliation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope) });
      const payload: unknown = response.ok ? await response.json().catch(() => null) : null;
      const result = payload && typeof payload === "object" ? (payload as Record<string, unknown>).result : null;
      return response.ok && isAcceptedRosterPromotion(result, envelope.approvalDecisionId) ? "accepted" : response.ok && isRejectedRosterPromotion(result, envelope.approvalDecisionId) ? "rejected" : "unresolved";
    } catch { return "unresolved"; }
  }, [tournamentId]);
  useEffect(() => { void (async () => { const saved = read(key); if (!saved) { setReady(true); return; } const state = await reconcile(saved); if (state === "accepted") { clear(key); router.refresh(); return; } if (state === "rejected") { clear(key); setMessage("The server did not create that roster entry. The current list is shown."); setReady(true); return; } setLocked(saved); setMessage("A prior roster request needs a safe retry. Its target is locked until resolved."); setReady(true); })(); }, [key, router, reconcile]);
  async function promote(envelope: Envelope) {
    if (busy) return; setBusy(true); setLocked(envelope); setMessage(null);
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/roster-promotions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope) });
      const payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedRosterPromotion(payload, envelope.approvalDecisionId)) { clear(key); setLocked(null); router.refresh(); return; }
      if (response.status === 409 && isRejectedRosterPromotion(payload, envelope.approvalDecisionId)) { clear(key); setLocked(null); setMessage("The tournament server did not accept that roster action."); return; }
      setMessage("The roster request is unresolved. Retry uses the same protected request.");
    } catch { setMessage("The roster request is unresolved. Retry uses the same protected request."); } finally { setBusy(false); }
  }
  function start(decisionId: string) { if (!ready || locked || busy) return; const envelope = { kind: "roster-promotion" as const, approvalDecisionId: decisionId, idempotencyKey: crypto.randomUUID() }; if (!write(key, envelope)) { setMessage("This browser cannot safely retain a roster request for recovery. Enable session storage before continuing."); return; } setLocked(envelope); void promote(envelope); }
  return <section className="policy-settings"><h2>Approved registration candidates</h2><p>Payment preference is unverified and is not payment. Promoting a candidate creates only a private roster identity snapshot.</p>{promotionCandidates.length ? <ul>{promotionCandidates.map((candidate) => <li key={candidate.approvalDecisionId}><strong>{candidate.displayName}</strong> · {candidate.email}{candidate.accNumber ? ` · ${candidate.accNumber}` : ""} · planned {candidate.intendedPaymentMethod}<button className="primary" type="button" disabled={!ready || !!locked || busy} onClick={() => start(candidate.approvalDecisionId)}>{locked?.approvalDecisionId === candidate.approvalDecisionId ? "Retry roster entry" : "Create roster identity"}</button></li>)}</ul> : <p>No reviewed registrations are waiting for roster creation.</p>}<h2>Roster identities</h2>{rosterEntries.length ? <ul>{rosterEntries.map((entry) => <li key={entry.rosterEntryId}><strong>{entry.displayName}</strong> · {entry.email}{entry.accNumber ? ` · ${entry.accNumber}` : ""}</li>)}</ul> : <p>No roster identities have been created.</p>}{locked && <button className="primary" type="button" disabled={busy} onClick={() => void promote(locked)}>Retry roster request</button>}{message && <p className="error-text" role="alert">{message}</p>}</section>;
}
