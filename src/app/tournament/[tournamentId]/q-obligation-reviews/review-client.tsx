"use client";
import { useEffect, useRef, useState } from "react";
import { isQReviewRequest, isQReviewResult, isQReviewWorkspace, type QReviewRequest, type QReviewWorkspace, type QObligation } from "../../../../lib/api/q-obligation-review";
import { isUuid } from "../../../../lib/api/validation";
import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";
import { formatUsd } from "../../../../lib/money";
type Envelope = { kind: "q-obligation-review"; operationId: string; request: QReviewRequest };
function isEnvelope(v: unknown): v is Envelope { return !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).sort().join() === "kind,operationId,request" && (v as Envelope).kind === "q-obligation-review" && isUuid((v as Envelope).operationId) && isQReviewRequest((v as Envelope).request); }
function Rows({ pools }: { pools: QObligation[] }) {
  return <>{pools.map(p => <article key={p.poolVersionId}><h3>{p.name}</h3><p>{p.kind === "award" ? "Award obligations" : "Refund obligations"} - unpaid. Fund: {formatUsd(p.fundMinor)}.</p><ul>{p.rows.map(r => <li key={r.participantId}>{r.displayName}: {formatUsd(r.amountMinor)}{r.qualificationRank ? ` - qualifying order ${r.qualificationRank}` : ""}</li>)}</ul><p className="auth-note" style={{ overflowWrap: "anywhere" }}>Policy {p.policyId}; pool {p.poolVersionId}.</p></article>)}</>;
}
export default function QObligationReviewClient({ actorId, tournamentId, initial }: { actorId: string; tournamentId: string; initial: QReviewWorkspace | null }) {
  const [workspace, setWorkspace] = useState(initial), [pending, setPending] = useState<Envelope | null>(null);
  const [ready, setReady] = useState(false), [blocked, setBlocked] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("Checking review recovery.");
  const [reason, setReason] = useState(""), [reviewed, setReviewed] = useState(false);
  const flight = useRef(false), key = `payment-obligation:q-review:${actorId}:${tournamentId}`, url = `/api/v1/tournaments/${tournamentId}/q-obligation-reviews`;
  async function refresh() {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    const data: unknown = response.ok ? await response.json() : null;
    if (!isQReviewWorkspace(data, tournamentId)) { setWorkspace(null); throw Error("workspace unavailable"); }
    setWorkspace(data); setReviewed(false); setReason("");
  }
  async function finish(raw: string, e: Envelope, result: unknown) {
    if (!isQReviewResult(result) || (result.status === "q_obligations_recorded" && (result.sourceDigest !== e.request.sourceDigest || result.version !== e.request.expectedVersion + 1 || (workspace?.eventId && result.eventId !== workspace.eventId)))) { setMessage("Outcome remains uncertain. The exact request is retained."); return; }
    if (sessionStorage.getItem(key) !== raw) { setBlocked(true); setMessage("Recovery record changed. Nothing was cleared."); return; }
    sessionStorage.removeItem(key); setPending(null);
    setMessage(result.status === "q_obligations_recorded" ? "Q obligations recorded as unpaid. No money moved." : `Review rejected: ${result.code.replaceAll("_", " ")}. Refresh sources and review again.`);
    try { await refresh(); } catch { setMessage("Outcome confirmed, but current sources could not load. Reload before further review."); }
  }
  useEffect(() => {
    let active = true;
    async function restore() {
      let raw: string | null;
      try { raw = sessionStorage.getItem(key); } catch { setBlocked(true); setReady(true); setMessage("Recovery storage unavailable. Recording is blocked."); return; }
      if (!raw) { setReady(true); setMessage("Review all named pools before recording unpaid obligations."); return; }
      let e: unknown; try { e = JSON.parse(raw); } catch { e = null; }
      if (!isEnvelope(e)) { setBlocked(true); setReady(true); setMessage("Unrecognized retained review; it was not overwritten."); return; }
      setPending(e); setBusy(true);
      try {
        const response = await fetch(`${url}/reconciliation`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: e.operationId }) });
        const data: unknown = response.ok ? await response.json() : null;
        if (!active) return;
        if (data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).sort().join() === "authorized,result" && (data as { authorized?: unknown }).authorized === true) {
          const saved = (data as { result: unknown }).result;
          if (saved === null) setMessage("No completed operation receipt. Retry only the retained exact request."); else await finish(raw, e, saved);
        } else setMessage("Reconciliation unavailable. Exact request retained.");
      } catch { if (active) setMessage("Connection interrupted. Exact request retained; no automatic retry."); }
      finally { if (active) { setReady(true); setBusy(false); } }
    }
    void restore(); return () => { active = false; };
    // A changed source must never replay a retained operation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, url]);
  async function submit(e: Envelope, retained: boolean) {
    if (flight.current || !ready || blocked) return;
    flight.current = true; setBusy(true);
    const raw = JSON.stringify(e);
    try {
      if (retained) {
        if (sessionStorage.getItem(key) !== raw) throw Error("Recovery changed");
        const check = await fetch(`${url}/reconciliation`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: e.operationId }) });
        const data: unknown = check.ok ? await check.json() : null;
        if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).sort().join() !== "authorized,result" || (data as { authorized?: unknown }).authorized !== true) throw Error("Reconciliation unavailable");
        if ((data as { result: unknown }).result !== null) { await finish(raw, e, (data as { result: unknown }).result); return; }
      }
      else { if (sessionStorage.getItem(key)) throw Error("Pending review exists"); setAppRecoveryItem(sessionStorage, key, raw); setPending(e); }
      const response = await fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json", "x-idempotency-key": e.operationId }, body: JSON.stringify(e.request) });
      await finish(raw, e, await response.json().catch(() => null));
    } catch { setMessage("Recording could not be confirmed. Keep recovery work intact; check status after reload before retrying the exact request."); }
    finally { flight.current = false; setBusy(false); }
  }
  const request: QReviewRequest = { expectedVersion: workspace?.currentVersion ?? 0, sourceDigest: workspace?.sourceDigest ?? "", reason, reviewed: true };
  const canSave = workspace && workspace.preview && workspace.blockers.length === 0 && !workspace.current && workspace.currentVersion < 256;
  return <>
    <p role="status">{message}</p>
    <p>These records say who is owed a Q award or refund. They are always unpaid; recording never transfers money, creates a payment receipt, marks an obligation paid or finalizes tournament settlement. Regular playoff prizes remain separate.</p>
    {!workspace ? <p role="alert">Review service unavailable or not authorized. Recording is blocked.</p> : <>
      <section className="correction-item"><h2>Current source review</h2><p>{workspace.current ? "Latest review is current and unpaid." : workspace.currentVersion ? "Latest review is stale or blocked. No historical version is substituted." : "No Q obligation review recorded."}</p>
        <p className="auth-note" style={{ overflowWrap: "anywhere" }}>Source snapshot {workspace.sourceDigest}.</p>
        {workspace.blockers.length > 0 && <p role="alert">Recording blocked: {workspace.blockers.map(b => b.replaceAll("_", " ")).join("; ")}.</p>}
        {workspace.preview && <Rows pools={workspace.preview}/>}
        <fieldset disabled={!ready || busy || blocked || !!pending || !canSave}>
          <label>{workspace.currentVersion ? "Reason for superseding the prior review" : "Review reason"}<input maxLength={500} value={reason} onChange={e => setReason(e.target.value)}/></label>
          <label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/>I reviewed every named pool and approve recording these obligations as unpaid.</label>
          <button type="button" disabled={!reviewed || !isQReviewRequest(request)} onClick={() => void submit({ kind: "q-obligation-review", operationId: crypto.randomUUID(), request }, false)}>Record reviewed Q obligations</button>
        </fieldset>
        {pending && <button type="button" disabled={!ready || busy || blocked} onClick={() => void submit(pending, true)}>Retry exact review request</button>}
        <button type="button" className="secondary" disabled={busy || !!pending} onClick={() => { setBusy(true); void refresh().then(() => setMessage("Sources refreshed. Review every pool again.")).catch(() => setMessage("Sources unavailable; recording blocked.")).finally(() => setBusy(false)); }}>Refresh review sources</button>
      </section>
      <section className="correction-item"><h2>Immutable unpaid review history</h2><p>Only the latest current revision is an active obligation record. Superseded rows are history, never additional amounts owed. A later source change makes a saved review stale.</p>
        {workspace.history.length === 0 ? <p>No recorded history.</p> : workspace.history.map((r, i) => <article key={r.id}><h3>Review {r.version} - unpaid - {i === 0 ? workspace.current ? "current" : "stale" : "superseded"}</h3><p>{r.reason}</p><p className="auth-note" style={{ overflowWrap: "anywhere" }}>{r.recordedAt} - Actor {r.actorId} - Review {r.id} - Source {r.sourceDigest}</p><Rows pools={r.obligations}/></article>)}
      </section>
    </>}
    <p>Automatic Q payouts, actual refunds and canonical Q settlement remain disabled. Use your browser Print command for this summary; drafts and history remain director-only.</p>
  </>;
}
