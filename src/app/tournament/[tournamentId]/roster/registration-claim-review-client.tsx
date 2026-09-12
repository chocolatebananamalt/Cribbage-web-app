"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAcceptedRegistrationClaimReview, isRegistrationClaimReviewRequest, isRejectedRegistrationClaimReview, type RegistrationClaimReviewRequest } from "../../../../lib/api/registration-claim-review";
import { formatUtcDateTime } from "../../../../lib/date-time";
import type { RegistrationClaimReviewItem } from "../../../../lib/registration-claim-review-workspace";

type Draft = { reason: string; confirmedDistinct: boolean };
function read(key: string) { try { const raw = window.sessionStorage.getItem(key); return raw ? JSON.parse(raw) as unknown : null; } catch { return null; } }
function write(key: string, value: RegistrationClaimReviewRequest) { try { window.sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function clear(key: string) { try { window.sessionStorage.removeItem(key); } catch { /* The immutable server receipt remains authoritative. */ } }

export default function RegistrationClaimReviewClient({ actorId, tournamentId, claims }: { actorId: string; tournamentId: string; claims: RegistrationClaimReviewItem[] }) {
  const router = useRouter();
  const pending = useMemo(() => claims.filter((claim) => claim.decision === null), [claims]);
  const storageKey = `registration-review-operation:${actorId}:${tournamentId}`;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [locked, setLocked] = useState<RegistrationClaimReviewRequest | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const recovered = read(storageKey);
      if (isRegistrationClaimReviewRequest(recovered) && pending.some((claim) => claim.claimId === recovered.claimId)) {
        setLocked(recovered);
        setMessage("An earlier review may not have finished. Retry sends the exact same protected decision.");
      } else clear(storageKey);
      setReady(true);
    });
    return () => window.clearTimeout(timer);
  }, [storageKey, pending]);

  function draftFor(claimId: string): Draft { return drafts[claimId] ?? { reason: "", confirmedDistinct: false }; }
  function updateDraft(claimId: string, update: Partial<Draft>) { setDrafts((current) => ({ ...current, [claimId]: { ...(current[claimId] ?? { reason: "", confirmedDistinct: false }), ...update } })); }

  async function send(envelope: RegistrationClaimReviewRequest) {
    setBusy(true); setMessage("Saving registration review…");
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/registration-claim-reviews`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope) });
      const payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedRegistrationClaimReview(payload, envelope.claimId, envelope.decision)) {
        clear(storageKey); setLocked(null); setMessage(envelope.decision === "approved_for_roster" ? "Registration approved. Create the roster identity below when ready." : "Registration rejected."); router.refresh(); return;
      }
      if (response.status === 409 && isRejectedRegistrationClaimReview(payload, envelope.claimId)) {
        clear(storageKey); setLocked(null); setMessage("The server did not accept that review. Refresh before deciding again."); return;
      }
      setMessage("The review result is uncertain. Retry the same protected decision.");
    } catch { setMessage("The review result is uncertain. Retry the same protected decision."); }
    finally { setBusy(false); }
  }

  function decide(claim: RegistrationClaimReviewItem, decision: "approved_for_roster" | "rejected") {
    if (!ready || busy || locked) return;
    const draft = draftFor(claim.claimId);
    const envelope: RegistrationClaimReviewRequest = { claimId: claim.claimId, decision, duplicateResolution: decision === "approved_for_roster" && claim.collisionClaimIds.length ? "confirmed_distinct_person" : null, duplicateOfClaimId: null, reason: draft.reason.trim(), idempotencyKey: crypto.randomUUID() };
    if (!write(storageKey, envelope)) { setMessage("This browser cannot safely retain the review for retry. Enable session storage before continuing."); return; }
    setLocked(envelope); void send(envelope);
  }

  return <section className="registration-claim-review" aria-labelledby="claim-review-title">
    <h2 id="claim-review-title">Registration requests</h2>
    <p>Approve a request before it can become a roster identity. Approval does not record payment, check the player in, enroll an event, or assign a seat.</p>
    {pending.length ? <ul className="correction-list">{pending.map((claim) => { const draft = draftFor(claim.claimId); const claimLocked = locked?.claimId === claim.claimId; const collision = claim.collisionClaimIds.length > 0; return <li className="correction-item" key={claim.claimId}>
      <p><strong>{claim.displayName}</strong> · {claim.email}{claim.accNumber ? ` · ACC # ${claim.accNumber}` : ""}</p>
      <p className="auth-note">Planned payment: {claim.intendedPaymentMethod} · Submitted <time dateTime={claim.submittedAt}>{formatUtcDateTime(claim.submittedAt)}</time></p>
      {collision ? <label className="publication-confirmation"><input type="checkbox" checked={draft.confirmedDistinct} disabled={busy || !!locked} onChange={(event) => updateDraft(claim.claimId, { confirmedDistinct: event.target.checked })} /> I reviewed the matching registration and confirmed this is a different person.</label> : null}
      <label>Reason (optional)<input maxLength={500} value={draft.reason} disabled={busy || !!locked} onChange={(event) => updateDraft(claim.claimId, { reason: event.target.value })} /></label>
      <div className="correction-actions"><button className="primary" type="button" disabled={!ready || busy || !!locked || (collision && !draft.confirmedDistinct)} onClick={() => decide(claim, "approved_for_roster")}>{claimLocked && locked?.decision === "approved_for_roster" ? "Retry approval" : "Approve for roster"}</button><button className="secondary" type="button" disabled={!ready || busy || !!locked} onClick={() => decide(claim, "rejected")}>{claimLocked && locked?.decision === "rejected" ? "Retry rejection" : "Reject request"}</button></div>
    </li>; })}</ul> : <p>No registration requests are waiting for review.</p>}
    {locked ? <button className="primary" type="button" disabled={busy} onClick={() => void send(locked)}>Retry the same protected decision</button> : null}
    {message ? <p className="auth-note" role="status">{message}</p> : null}
  </section>;
}
