"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isReviewedNativeWorkspace, type ReviewedNativeWorkspace } from "../lib/api/reviewed-native-seating-handlers";
import { sameDrawRequest } from "../lib/api/roster-random-draw";
import { prepareReviewedDrawPublication, isDrawPhysicalReview } from "../lib/seating/reviewed-draw-publication";
import { reviewedDrawRecoveryKey, readReviewedDrawRecovery, clearExactReviewedDrawRecovery, type RetainedDrawPublication } from "../lib/seating/reviewed-draw-recovery";
import { readReviewedDrawPublicationResult, readReviewedDrawPublicationOperation } from "../lib/seating/reviewed-draw-publication-result";
import { assertRecoveryStorageOwner } from "../lib/auth/recovery-owner";
import { setAppRecoveryItem } from "../lib/recovery-write-coordinator";
import styles from "./reviewed-draw-publisher.module.css";
type Pending = { value: RetainedDrawPublication; serialized: string };

export default function ReviewedDrawPublisherClient({ actorId, tournamentId }: { actorId: string; tournamentId: string }) {
  // A committed account/tournament transition gets fresh state AND fresh flight
  // refs. Late old-scope work cannot render its roster or release a new flight.
  return <ScopedReviewedDrawPublisherClient key={`${actorId}:${tournamentId}`} actorId={actorId} tournamentId={tournamentId}/>;
}
function ScopedReviewedDrawPublisherClient({ actorId, tournamentId }: { actorId: string; tournamentId: string }) {
  const base = `/api/v1/tournaments/${tournamentId}/reviewed-seating`, key = reviewedDrawRecoveryKey(actorId, tournamentId), scope = `${actorId}:${tournamentId}`, publishedKey = `reviewed-publication-link:${actorId}:${tournamentId}`;
  const current = useRef(scope), generation = useRef(0), flight = useRef(false);
  const [workspace, setWorkspace] = useState<ReviewedNativeWorkspace | null>(null), [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [confirmed, setConfirmed] = useState(false), [ready, setReady] = useState(false);
  const [review, setReview] = useState([false, false, false]), [reason, setReason] = useState(""), [message, setMessage] = useState("Loading the saved draw and starting-seat status.");
  useLayoutEffect(() => { current.current = scope; generation.current++; return () => { current.current = ""; generation.current++; }; }, [scope]);
  const active = useCallback(() => current.current === scope, [scope]);
  const refresh = useCallback(async () => {
    const seq = ++generation.current;
    if (active()) setReady(false);
    const response = await fetch(base, { cache: "no-store", credentials: "same-origin" }), body: unknown = await response.json().catch(() => null);
    if (!active() || seq !== generation.current) return false;
    if (!response.ok || !isReviewedNativeWorkspace(body, actorId, tournamentId)) throw Error("workspace_unavailable");
    setWorkspace(body); setReady(true); setReview([false, false, false]); setReason(""); return true;
  }, [active, actorId, tournamentId, base]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!active()) return;
      setWorkspace(null); setPending(null); setConfirmed(false); setBlocked(false); setReady(false); setReview([false, false, false]); setReason("");
      try {
        assertRecoveryStorageOwner(actorId);
        const saved = readReviewedDrawRecovery(sessionStorage, actorId, tournamentId);
        if (saved.kind === "blocked") { setBlocked(true); setMessage("Unrecognized saved work is preserved. Keep this account and page intact for review."); return; }
        if (saved.kind === "pending") setPending(saved);
        void refresh().then(ok => { if (ok && active()) setMessage(saved.kind === "pending" ? "An exact publication request is saved. Check its result before continuing." : "Saved draw loaded. No starting IDs were published by opening this page."); }).catch(() => { if (active()) { setReady(false); setMessage("Current status could not be verified. Saved work is preserved."); } });
      } catch { setBlocked(true); setMessage("Account recovery ownership could not be established. Saved work is preserved."); }
    }, 0);
    return () => clearTimeout(timer);
  }, [active, actorId, tournamentId, refresh, publishedKey]);

  function retainedIsExact(p: Pending) { assertRecoveryStorageOwner(actorId); return active() && sessionStorage.getItem(key) === p.serialized; }
  async function finish(p: Pending, value: unknown, readback: boolean): Promise<void> {
    if (!active()) return;
    const bound = { actorId, tournamentId, request: p.value.request };
    const outcome = readback ? readReviewedDrawPublicationOperation(value, bound) : readReviewedDrawPublicationResult(value, bound);
    if (outcome.kind === "accepted" && !readback) {
      const response = await fetch(`${base}/operations/${p.value.request.idempotencyKey}`, { cache: "no-store", credentials: "same-origin" });
      const stored: unknown = await response.json().catch(() => null);
      if (!active()) return;
      const recovered = readReviewedDrawPublicationOperation(stored, bound);
      if (!response.ok || recovered.kind !== "accepted" || !sameDrawRequest(recovered.receipt, outcome.receipt)) { setMessage("Publication may have completed, but its saved result could not be confirmed. Keep the exact request."); return; }
      return finish(p, stored, true);
    }
    if (outcome.kind === "retry-exact") { setMessage("Seating is busy. Keep this same request; check its saved result or retry it exactly."); return; }
    if (outcome.kind === "unknown" || outcome.kind === "rejected" && ["operation_conflict", "native_binding_unavailable"].includes(outcome.code)) { setMessage("The exact outcome needs review. Saved work is preserved; no new draw or request was created."); return; }
    if (outcome.kind !== "accepted" && outcome.kind !== "rejected") return;
    if (!retainedIsExact(p) || !clearExactReviewedDrawRecovery(sessionStorage, actorId, tournamentId, p.serialized)) { setBlocked(true); setMessage("Saved work changed. It has been preserved; do not send the older request."); return; }
    setPending(null);
    if (outcome.kind === "accepted") { try { setAppRecoveryItem(sessionStorage, publishedKey, p.value.request.idempotencyKey); } catch { /* the URL remains available for this session */ } setSavedOperationId(p.value.request.idempotencyKey); setConfirmed(true); setReady(false); setMessage("Starting IDs are published. Game scheduling and Start Play are separate steps."); }
    else { setReady(false); setMessage(`Publication was not applied (${outcome.code.replaceAll("_", " ")}). Reload status and review the saved draw again.`); }
  }
  async function send(p: Pending, retry = false) {
    if (!active() || flight.current || blocked) return;
    flight.current = true; generation.current++; setBusy(true); setReady(false);
    try {
      if (!retainedIsExact(p)) { setBlocked(true); setMessage("Saved work changed. It has been preserved; no request was sent."); return; }
      const response = await fetch(base, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(p.value.request) });
      const value: unknown = await response.json().catch(() => null);
      if (active()) await finish(p, value, false);
    } catch { if (active()) setMessage(retry ? "The exact retry could not be confirmed. Keep the same saved request." : "Publication could not be confirmed. Keep the saved request and check its result."); }
    finally { flight.current = false; if (active()) setBusy(false); }
  }
  async function publish() {
    if (!active() || !ready || !workspace || pending || confirmed || blocked || flight.current || !review.every(Boolean)) return;
    try {
      assertRecoveryStorageOwner(actorId);
      if (sessionStorage.getItem(key) !== null) { setBlocked(true); setMessage("Saved work already exists. It has been preserved."); return; }
      const prepared = prepareReviewedDrawPublication({ actorId, tournamentId, workspace: workspace.draw, nativeWorkspace: workspace.native,
        review: { physicalLayoutConfirmed: true, stationaryDecisionsConfirmed: true, constraintsConfirmed: true, reason }, operationId: crypto.randomUUID() });
      if (prepared.status !== "prepared-not-authorized") { setMessage("This saved draw is not ready for publication. Reload status and review it."); return; }
      const value: RetainedDrawPublication = { protocol: "reviewed-native-seating-v1", actorId, tournamentId, request: prepared.request }, serialized = JSON.stringify(value);
      setAppRecoveryItem(sessionStorage, key, serialized);
      const p = { value, serialized }; setPending(p); await send(p);
    } catch { if (active()) { setBlocked(true); setMessage("The request could not be safely retained. No new request was sent; existing work is preserved."); } }
  }
  async function check() {
    if (!pending || !active() || flight.current) return;
    const p = pending; flight.current = true; generation.current++; setBusy(true);
    try {
      if (!retainedIsExact(p)) { setBlocked(true); setMessage("Saved work changed. It is preserved for review."); return; }
      const response = await fetch(`${base}/operations/${p.value.request.idempotencyKey}`, { cache: "no-store", credentials: "same-origin" });
      const value: unknown = await response.json().catch(() => null);
      if (active()) { if (response.ok) await finish(p, value, true); else setMessage("No exact saved result could be verified. Keep this same request."); }
    } catch { if (active()) setMessage("The saved result could not be checked. Keep this same request."); }
    finally { flight.current = false; if (active()) setBusy(false); }
  }
  const [savedOperationId, setSavedOperationId] = useState<string | null>(null);
  const draw = workspace?.draw.latestDraw, candidate = pending?.value.request.reviewedCandidate ?? (draw?.receipt.status === "accepted" ? draw.receipt.candidate : null);
  const name = (id: string) => (!pending || pending.value.request.planId === draw?.plan.planId ? draw?.plan.sourceSnapshot.roster.find(r => r.rosterEntryId === id)?.displayName : null) ?? "Saved tournament entry";
  const locked = busy || !!pending || blocked || confirmed || !!workspace?.native.publication;
  const planReady = ready && workspace && prepareReviewedDrawPublication({ actorId, tournamentId, workspace: workspace.draw, nativeWorkspace: workspace.native,
    review: { physicalLayoutConfirmed: true, stationaryDecisionsConfirmed: true, constraintsConfirmed: true, reason: "Read-only readiness check" }, operationId: "00000000-0000-4000-8000-000000000001" }).status === "prepared-not-authorized";
  return <section className={styles.panel} aria-label="Review saved draw for starting IDs">
    <h2>Review starting IDs</h2><p>Local test workflow. Publish the saved draw exactly as reviewed. This page does not draw again.</p>
    <p role="status" aria-live="polite" data-testid="reviewed-publication-status">{message}</p>
    {!pending && !confirmed && <button disabled={busy} onClick={() => void refresh().then(ok => { if (ok) setMessage("Current saved draw and seating status reloaded. Review it before publishing."); }).catch(() => { if (active()) { setReady(false); setMessage("Current status is unavailable. No publication was sent."); } })}>Reload current status</button>}
    {workspace?.native.publication && <p>Starting IDs already exist. They are read-only here.</p>}
    {candidate && <div className={styles.table}><table><caption>{confirmed ? "Published starting IDs" : pending ? "Starting IDs in the retained request" : "Saved draw — proposed starting IDs"}</caption><thead><tr><th>Player</th><th>Tournament ID</th></tr></thead><tbody>{candidate.assignments.map(a => <tr key={a.participantId}><td>{name(a.participantId)}</td><td>{a.tournamentId}</td></tr>)}</tbody></table></div>}
    <fieldset disabled={locked || !planReady}><legend>Review this exact saved draw</legend>
      {["I checked the physical tables, opposite seats and walking paths.", "I checked the approved stationary player and requests.", "I checked the recorded restrictions for this draw."].map((label, i) => <label key={label}><input type="checkbox" checked={review[i]} onChange={e => setReview(v => v.map((x, n) => n === i ? e.target.checked : x))}/>{label}</label>)}
      <label>Review Reason<textarea maxLength={500} value={reason} onChange={e => setReason(e.target.value)}/></label>
    </fieldset>
    {!pending && !confirmed && <button disabled={locked || !planReady || !review.every(Boolean) || !isDrawPhysicalReview({ physicalLayoutConfirmed: true, stationaryDecisionsConfirmed: true, constraintsConfirmed: true, reason })} onClick={() => void publish()}>Publish these starting IDs</button>}
    {(confirmed || workspace?.native.publication) && savedOperationId && <p><Link href={`/tournament/${tournamentId}/participants`}>Enroll event participants</Link><br/><Link href={`/tournament/${tournamentId}/seating/random-draw/schedule?operationId=${savedOperationId}`}>Preview the generated schedule</Link></p>}
    {pending && <div className={styles.actions}><p>The exact request is saved. Review fields are locked.</p><button disabled={busy} onClick={() => void check()}>Check saved result</button><button disabled={busy || blocked} onClick={() => void send(pending, true)}>Retry exact publication</button></div>}
  </section>;
}

