"use client";

import { useEffect, useRef, useState } from "react";
import {
  isQReviewV2Request, isQReviewV2Result, isQReviewV2Workspace, qReviewV2ResultMatches,
  type QReviewV2Request, type QReviewV2Workspace,
} from "../../../../lib/api/q-obligation-review-v2";
import { isUuid } from "../../../../lib/api/validation";
import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";
import { formatUsd } from "../../../../lib/money";

type Envelope = { kind: "q-obligation-review-v2"; operationId: string; request: QReviewV2Request };
type Pools = NonNullable<QReviewV2Workspace["preview"]>;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isEnvelope = (v: unknown): v is Envelope => object(v) && Object.keys(v).sort().join() === "kind,operationId,request"
  && v.kind === "q-obligation-review-v2" && isUuid(v.operationId) && isQReviewV2Request(v.request);
const reconciliation = (v: unknown): v is { authorized: true; result: unknown } => object(v)
  && Object.keys(v).sort().join() === "authorized,result" && v.authorized === true;

function Rows({ pools }: { pools: Pools }) {
  return <>{pools.map(p => <article key={p.poolVersionId}>
    <h3>{p.name}</h3>
    <p>{p.kind === "award" ? "Award obligations" : "Refund obligations"} — unpaid. Fund: {formatUsd(p.fundMinor)}.</p>
    {p.rows.length === 0 ? <p>No amounts owed in this pool.</p> : <ul>{p.rows.map(r => <li key={r.participantId}>
      {r.displayName}: {formatUsd(r.amountMinor)}
      {p.kind === "refund" ? " — contributor refund obligation" : ` — Q award order ${r.qRank}`}
      {r.qualificationRank !== null ? `; playoff qualifier, qualifying order ${r.qualificationRank}` : "; not a playoff qualifier"}
    </li>)}</ul>}
    <p className="auth-note" style={{ overflowWrap: "anywhere" }}>Policy {p.policyId}; pool {p.poolVersionId}.</p>
  </article>)}</>;
}

export default function QObligationReviewV2Client({ actorId, tournamentId, initial }: {
  actorId: string; tournamentId: string; initial: QReviewV2Workspace | null;
}) {
  const [workspace, setWorkspace] = useState(initial), [pending, setPending] = useState<Envelope | null>(null);
  const [ready, setReady] = useState(false), [blocked, setBlocked] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking Q review recovery.");
  const [reason, setReason] = useState(""), [reviewed, setReviewed] = useState(false);
  const flight = useRef(false);
  // An existing financial recovery namespace keeps older account-switch pages fail-closed.
  const key = `payment-obligation:q-review-v2:${actorId}:${tournamentId}`;
  const url = `/api/v1/tournaments/${tournamentId}/q-obligation-reviews-v2`;

  async function refresh() {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    const data: unknown = response.ok ? await response.json() : null;
    if (!isQReviewV2Workspace(data, tournamentId)) { setWorkspace(null); throw Error("workspace unavailable"); }
    setWorkspace(data); setReviewed(false); setReason("");
  }

  async function finish(raw: string, e: Envelope, result: unknown) {
    if (!isQReviewV2Result(result) || !qReviewV2ResultMatches(result, e.request)
      || (result.status === "q_obligations_recorded_v2" && result.version !== e.request.expectedVersion + 1)
      || (result.status === "q_obligations_recorded_v2" && workspace?.eventId && result.eventId !== workspace.eventId)) {
      setMessage("Outcome remains uncertain. The exact request is retained."); return;
    }
    if (result.status === "rejected" && result.code === "idempotency_conflict") {
      setBlocked(true); setMessage("Operation identity conflict. Retained work was preserved for review."); return;
    }
    try {
      if (sessionStorage.getItem(key) !== raw) throw Error("recovery changed");
      sessionStorage.removeItem(key);
    } catch {
      setBlocked(true); setMessage("Outcome received, but retained work could not be cleared safely."); return;
    }
    setPending(null);
    setMessage(result.status === "q_obligations_recorded_v2"
      ? "Q obligations recorded as unpaid. No money moved."
      : `Review rejected: ${result.code.replaceAll("_", " ")}. Refresh sources and review again.`);
    try { await refresh(); } catch { setMessage("Outcome confirmed, but current sources could not load. Reload before further review."); }
  }

  async function check(e: Envelope): Promise<unknown> {
    const response = await fetch(`${url}/reconciliation`, {
      method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operationId: e.operationId, request: e.request }),
    });
    const data: unknown = response.ok ? await response.json() : null;
    if (!reconciliation(data)) throw Error("reconciliation unavailable");
    return data.result;
  }

  useEffect(() => {
    let active = true;
    async function restore() {
      let raw: string | null;
      try { raw = sessionStorage.getItem(key); }
      catch { setBlocked(true); setReady(true); setMessage("Recovery storage unavailable. Recording is blocked."); return; }
      if (!raw) { setReady(true); setMessage("Review every named pool before recording unpaid obligations."); return; }
      let e: unknown; try { e = JSON.parse(raw); } catch { e = null; }
      if (!isEnvelope(e)) { setBlocked(true); setReady(true); setMessage("Unrecognized retained review; it was not overwritten."); return; }
      setPending(e); setBusy(true);
      try {
        const result = await check(e);
        if (!active) return;
        if (result === null) setMessage("No completed operation receipt. Retry only the retained exact request.");
        else await finish(raw, e, result);
      } catch { if (active) setMessage("Reconciliation unavailable. Exact request retained; no automatic retry."); }
      finally { if (active) { setReady(true); setBusy(false); } }
    }
    void restore();
    return () => { active = false; };
    // Recovery is tied to actor/tournament identity, not fresh preview props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, url]);

  async function submit(e: Envelope, retained: boolean) {
    if (flight.current || !ready || blocked) return;
    flight.current = true; setBusy(true);
    const raw = JSON.stringify(e);
    try {
      if (retained) {
        if (sessionStorage.getItem(key) !== raw) throw Error("recovery changed");
        const result = await check(e);
        if (result !== null) { await finish(raw, e, result); return; }
      } else {
        if (sessionStorage.getItem(key)) throw Error("pending review exists");
        setAppRecoveryItem(sessionStorage, key, raw); setPending(e);
      }
      const response = await fetch(url, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json", "x-idempotency-key": e.operationId }, body: JSON.stringify(e.request),
      });
      await finish(raw, e, await response.json().catch(() => null));
    } catch { setMessage("Recording could not be confirmed. Keep recovery work intact; check status before retrying the exact request."); }
    finally { flight.current = false; setBusy(false); }
  }

  const request: QReviewV2Request = { expectedVersion: workspace?.currentVersion ?? 0, sourceDigest: workspace?.sourceDigest ?? "", reason, reviewed: true };
  const canSave = !!workspace?.preview && workspace.blockers.length === 0 && !workspace.current && workspace.currentVersion < 256;
  return <>
    <p role="status">{message}</p>
    <p>These records say who is owed an award or refund from each disclosed Q Pool. All amounts remain unpaid. Recording does not transfer money, issue a refund, create a payment receipt or mark anyone paid. Regular playoff prizes are separate.</p>
    {!workspace ? <p role="alert">Review service unavailable or not authorized. Recording is blocked.</p> : <>
      <section className="correction-item"><h2>Current source review</h2>
        <p>{workspace.current ? "Latest review is current and unpaid." : workspace.currentVersion ? "Latest review is stale or blocked. No historical version is substituted." : "No Q obligation review recorded."}</p>
        <p className="auth-note" style={{ overflowWrap: "anywhere" }}>Source snapshot {workspace.sourceDigest}.</p>
        {workspace.blockers.length > 0 && <p role="alert">Recording blocked: {workspace.blockers.map(b => b.replaceAll("_", " ")).join("; ")}.</p>}
        {workspace.preview && <Rows pools={workspace.preview}/>}
        <fieldset disabled={!ready || busy || blocked || !!pending || !canSave}>
          <label>{workspace.currentVersion ? "Reason for superseding the prior review" : "Review reason"}<input maxLength={500} value={reason} onChange={e => setReason(e.target.value)}/></label>
          <label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/>I reviewed every named pool and approve recording these obligations as unpaid.</label>
          <button type="button" disabled={!reviewed || !isQReviewV2Request(request)} onClick={() => void submit({ kind: "q-obligation-review-v2", operationId: crypto.randomUUID(), request }, false)}>Record reviewed Q obligations</button>
        </fieldset>
        {pending && <button type="button" disabled={!ready || busy || blocked} onClick={() => void submit(pending, true)}>Retry exact review request</button>}
        <button type="button" className="secondary" disabled={busy || blocked || !!pending} onClick={() => {
          setBusy(true); void refresh().then(() => setMessage("Sources refreshed. Review every pool again."))
            .catch(() => setMessage("Sources unavailable; recording blocked.")).finally(() => setBusy(false));
        }}>Refresh review sources</button>
      </section>
      <section className="correction-item"><h2>Immutable unpaid review history</h2>
        <p>Only the latest current revision is active. Superseded reviews are history, never additional amounts owed. A source change makes a saved review stale.</p>
        {workspace.history.length === 0 ? <p>No recorded history.</p> : workspace.history.map((r, i) => <article key={r.id}>
          <h3>Review {r.version} — unpaid — {i === 0 ? workspace.current ? "current" : "stale" : "superseded"}</h3>
          <p>{r.reason}</p><p className="auth-note" style={{ overflowWrap: "anywhere" }}>{r.recordedAt} — Actor {r.actorId} — Review {r.id} — Source {r.sourceDigest}</p>
          <Rows pools={r.obligations}/>
        </article>)}
      </section>
    </>}
    <p>Actual Q payments and refunds remain disabled. This review does not by itself finalize tournament accounting. Browser Print produces this director-only summary.</p>
  </>;
}
