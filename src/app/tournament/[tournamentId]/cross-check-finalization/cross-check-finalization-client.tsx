"use client";

import Link from "next/link";
import {crossCheckReviewRoutesV30,type CrossCheckReviewAccessV30} from "../../../../lib/operations/cross-check-review-routes-v30";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  finalizeCrossCheckingMessage,
  isFinalizeCrossCheckingResult,
  type CrossCheckCondition,
  type CrossCheckFinalizationWorkspace,
} from "../../../../lib/api/cross-check-finalization";

function ConditionList({ heading, note, conditions, tournamentId, reviewAccess }: { heading: string; note: string; conditions: CrossCheckCondition[]; tournamentId:string; reviewAccess:CrossCheckReviewAccessV30 }) {
  if (conditions.length === 0) return null;
  return <section className="correction-item">
    <h2>{heading}</h2>
    <p className="auth-note">{note}</p>
    <ul>
      {conditions.map((condition) => {const review=crossCheckReviewRoutesV30(tournamentId,condition,reviewAccess);return <li key={condition.code}>
        {condition.sentence}<span className="status-pill">{condition.count}</span>
        {review&&<div><p>{review.note}</p>{review.links.map(link=><Link prefetch={false} className="guide-link" key={link.href} href={link.href}>{link.label}</Link>)}</div>}
      </li>;})}
    </ul>
  </section>;
}

export default function CrossCheckFinalizationClient({
  tournamentId, workspace, reviewAccess={canAssignCrossCheckers:false,correctionsEnabled:false,eventDeskEnabled:false,manualCardsEnabled:false},
}: { tournamentId: string; workspace: CrossCheckFinalizationWorkspace; reviewAccess?:CrossCheckReviewAccessV30 }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Finalizing is one way, so it confirms first, the same as Close Event.
  const [confirming, setConfirming] = useState(false);
  // Held across retries so a request that may already have been applied is
  // retried as the same operation rather than recorded twice. The server writes
  // no receipt for a refusal, so retrying this id after clearing a condition
  // reaches the recount rather than a cached refusal.
  const operationId = useRef<string | null>(null);

  const outstanding = workspace.conditions.filter((condition) => condition.outstanding);
  const met = workspace.conditions.filter((condition) => !condition.outstanding);

  async function finalize() {
    setBusy(true); setMessage("");
    try {
      operationId.current ??= crypto.randomUUID();
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/cross-check-finalization`, {
        method: "POST", headers: { "content-type": "application/json" },
        credentials: "same-origin", cache: "no-store",
        body: JSON.stringify({ idempotencyKey: operationId.current }),
      });
      const body = await response.json().catch(() => null) as unknown;
      if (!isFinalizeCrossCheckingResult(body)) { setMessage("Cross-checking could not be finalized. Reload and try again."); return; }
      if (body.status === "rejected") { setMessage(finalizeCrossCheckingMessage(body.code)); router.refresh(); return; }
      operationId.current = null;
      router.refresh();
    } catch { setMessage("Cross-checking could not be finalized. Reload and try again."); }
    finally { setBusy(false); }
  }

  if (workspace.finalization) {
    return <section className="correction-item" aria-labelledby="cross-check-finalized-title">
      <button type="button" className="secondary" disabled={busy} onClick={()=>router.refresh()}>Refresh current status</button>
      <h2 id="cross-check-finalized-title">Cross-checking is finalized</h2>
      <p>Recorded by {workspace.finalization.finalizedBy} at {workspace.finalization.finalizedAt}.</p>
      <p className="auth-note">The condition list below is the live one. It is shown so a condition that has since reopened is visible, and it does not undo the recorded completion.</p>
      <ConditionList heading="Outstanding now" note="These are outstanding as of this page load." conditions={outstanding} tournamentId={tournamentId} reviewAccess={reviewAccess} />
      <ConditionList heading="Met now" note="These are met as of this page load." conditions={met} tournamentId={tournamentId} reviewAccess={reviewAccess} />
    </section>;
  }

  return <>
    <p>Review links open existing workflows; they do not clear a condition or authorize an action. Return here and refresh after saving the required review.</p>
    <button type="button" className="secondary" disabled={busy} onClick={()=>{setConfirming(false);router.refresh();}}>Refresh current status</button>
    <ConditionList
      heading="Still outstanding"
      note="Each line is counted on the tournament server. Clear these on their own screens, then return here."
      conditions={outstanding} tournamentId={tournamentId} reviewAccess={reviewAccess} />
    <ConditionList
      heading="Already met"
      note="Nothing is left to do for these."
      conditions={met} tournamentId={tournamentId} reviewAccess={reviewAccess} />
    <section className="correction-item" aria-labelledby="cross-check-finalize-action-title">
      <h2 id="cross-check-finalize-action-title">Finalize cross-checking</h2>
      {workspace.canFinalize
        ? <p>Nothing is outstanding. Finalizing records that cross-checking was completed for {workspace.tournamentName}.</p>
        : <p>This is disabled because {outstanding.length === 1 ? "one condition is" : `${outstanding.length} conditions are`} still outstanding: {outstanding.map((condition) => condition.sentence).join(" ")}</p>}
      <button
        className="secondary"
        type="button"
        disabled={busy || !workspace.canFinalize}
        onClick={() => setConfirming(true)}>
        {busy ? "Finalizing…" : "Finalize cross-checking"}
      </button>
      {confirming ? <section className="registration-link-secret" aria-label="Confirm finalizing cross-checking">
        <h2>Finalize cross-checking for {workspace.tournamentName}?</h2>
        <p>This records that cross-checking was completed, and there is no way to undo it from this screen. Every scorecard, correction and dispute stays exactly where it is either way.</p>
        <div className="registration-link-actions">
          <button className="primary" type="button" disabled={busy} onClick={() => { setConfirming(false); void finalize(); }}>Yes, finalize cross-checking</button>
          <button className="secondary" type="button" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      </section> : null}
      {message ? <p className="error-text" role="alert">{message}</p> : null}
    </section>
  </>;
}
