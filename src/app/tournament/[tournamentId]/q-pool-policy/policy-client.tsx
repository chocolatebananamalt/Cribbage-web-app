"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isQPolicyRequest, isQPolicyResult, type QPolicyRequest } from "../../../../lib/api/q-pool-policy";
import { isUuid } from "../../../../lib/api/validation";
import { Q_POLICY_METHOD, Q_POLICY_TEXT, previewQPools, type QPreviewSources } from "../../../../lib/results/q-pool-preview";
import { formatUsd } from "../../../../lib/money";
import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";
type Envelope = { kind: "q-policy"; operationId: string; request: QPolicyRequest };
const envelope = (v: unknown): v is Envelope => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).sort().join() === "kind,operationId,request"
  && (v as Envelope).kind === "q-policy" && isUuid((v as Envelope).operationId) && isQPolicyRequest((v as Envelope).request);
export default function QPolicyClient({ actorId, tournamentId, source }: { actorId: string; tournamentId: string; source: QPreviewSources | null }) {
  const router = useRouter(), flight = useRef(false);
  const key = `payment-obligation:q-policy:${actorId}:${tournamentId}`;
  const [ready, setReady] = useState(false), [blocked, setBlocked] = useState(false), [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Envelope | null>(null), [message, setMessage] = useState("Checking policy recovery.");
  const [poolId, setPoolId] = useState(source?.membership?.pools[0]?.poolVersionId ?? "");
  const [reference, setReference] = useState(""), [disclosed, setDisclosed] = useState(false);
  const url = `/api/v1/tournaments/${tournamentId}/q-pool-policy`;
  function finish(raw: string, e: Envelope, result: unknown) {
    if (!isQPolicyResult(result) || (result.status === "q_policy_published" && result.poolVersionId !== e.request.poolVersionId)) { setMessage("Outcome remains uncertain. The exact policy request is retained."); return; }
    try {
      if (sessionStorage.getItem(key) !== raw) { setBlocked(true); setMessage("Recovery record changed; no data was cleared."); return; }
      sessionStorage.removeItem(key);
    } catch { setBlocked(true); setMessage("Outcome received, but recovery storage could not be cleared safely."); return; }
    setPending(null);
    setMessage(result.status === "q_policy_published" ? "Policy frozen. Reloading saved disclosure evidence." : `Policy rejected: ${result.code.replaceAll("_", " ")}.`);
    if (result.status === "q_policy_published") { setDisclosed(false); setReference(""); router.refresh(); }
  }
  useEffect(() => {
    let active = true;
    async function restore() {
      let raw: string | null;
      try { raw = sessionStorage.getItem(key); } catch { setBlocked(true); setReady(true); setMessage("Recovery storage unavailable. Publishing is blocked."); return; }
      if (!raw) { setReady(true); setMessage("Review the exact policy before recording disclosure."); return; }
      let e: unknown; try { e = JSON.parse(raw); } catch { e = null; }
      if (!envelope(e)) { setBlocked(true); setReady(true); setMessage("Unrecognized retained policy request; it was not overwritten."); return; }
      setPending(e); setBusy(true);
      try {
        const response = await fetch(`${url}/reconciliation`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: e.operationId }) });
        const result: unknown = response.ok ? await response.json() : null;
        if (!active) return;
        if (result && typeof result === "object" && !Array.isArray(result) && Object.keys(result).sort().join() === "authorized,result" && (result as { authorized?: unknown }).authorized === true) {
          const saved = (result as { result: unknown }).result;
          if (saved !== null) finish(raw, e, saved); else setMessage("No completed receipt. Retry only the exact retained policy request.");
        } else setMessage("Reconciliation unavailable. The exact request remains retained.");
      } catch { if (active) setMessage("Connection interrupted. The exact policy request remains retained."); }
      finally { if (active) { setBusy(false); setReady(true); } }
    }
    void restore();
    return () => { active = false; };
    // The recovery identity changes only with actor/tournament. A refreshed source must not replay a request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, url]);
  async function submit(e: Envelope, retained: boolean) {
    if (flight.current || !ready || blocked) return;
    flight.current = true; setBusy(true);
    const raw = JSON.stringify(e);
    try {
      if (retained) { if (sessionStorage.getItem(key) !== raw) throw Error("Recovery record changed."); }
      else {
        if (sessionStorage.getItem(key)) throw Error("Another retained policy request exists.");
        setAppRecoveryItem(sessionStorage, key, raw); setPending(e);
      }
      const response = await fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json", "x-idempotency-key": e.operationId }, body: JSON.stringify(e.request) });
      const result: unknown = await response.json().catch(() => null);
      finish(raw, e, result);
    } catch { setMessage("Publishing could not be confirmed. Saved recovery work remains intact; check the connection and retry the exact request."); }
    finally { flight.current = false; setBusy(false); }
  }
  const pools = source?.membership?.pools ?? [], selected = source?.policies.find((p) => p.poolVersionId === poolId);
  const request: QPolicyRequest = { poolVersionId: poolId, method: Q_POLICY_METHOD, disclosureReference: reference, disclosed: true };
  return <>
    <p role="status">{message}</p>
    <section className="correction-item"><h2>Director-selected equal-share policy</h2><p>{Q_POLICY_TEXT}</p>
      <p>Disclose the cost, payback type and payout ratio on the flyer before payment. Announce the Q entrant count before play. The acknowledgment below records the director&apos;s disclosure attestation, not proof of personal player consent.</p>
      <p>This first policy is permanent for its exact pool version. Publish all pool policies before any tournament receipt or elected membership. Historical paid pools cannot be retroactively certified; policy changes after publication are unsupported.</p>
      <p>Setup must use Equal (Pays All Equally) before activation. Graduated and top-qualifier-double types cannot be overridden by this policy; their existing records remain unchanged.</p>
      {!source && <p role="alert">Policy service unavailable. No disclosure or preview can be recorded.</p>}
      {source && <fieldset disabled={!ready || busy || blocked || !!pending}><label>Named Q Pool<select value={poolId} onChange={(e) => { setPoolId(e.target.value); setDisclosed(false); }}>{pools.map((p) => <option key={p.poolVersionId} value={p.poolVersionId}>{p.name} ({formatUsd(p.feeMinor)})</option>)}</select></label>
        {selected ? <p>Frozen policy {selected.id} · version 1 · {selected.publishedAt}. Disclosure: {selected.disclosureReference}</p> : <>
          {!source.canPublish && <p role="alert">Publishing is blocked: scope, play state, earlier collection/consent or director authority must be reviewed. Existing history is preserved.</p>}
          <label>Disclosure reference<input maxLength={500} value={reference} onChange={(e) => setReference(e.target.value)}/></label>
          <label><input type="checkbox" checked={disclosed} onChange={(e) => setDisclosed(e.target.checked)}/>I disclosed this exact named-pool policy before any payment or elected membership, and approve freezing it.</label>
          <button type="button" disabled={!source.canPublish || !disclosed || !isQPolicyRequest(request)} onClick={() => void submit({ kind: "q-policy", operationId: crypto.randomUUID(), request }, false)}>Publish and freeze disclosed policy</button>
        </>}
      </fieldset>}
      {pending && <button type="button" disabled={!ready || busy || blocked} onClick={() => void submit(pending, true)}>Retry exact policy request</button>}
    </section>
    <section className="correction-item"><h2>Read-only Q payout preview</h2><p>Separate from regular playoff prizes. This snapshot cannot pay, refund, create claims or finalize settlement. Refresh to recheck sources; changed records invalidate prior previews.</p>
      {source && previewQPools(source).map((p) => <article key={p.poolVersionId}><h3>{p.name}</h3><p>Valid fully funded contributions: {formatUsd(p.fundMinor)}.</p>
        {p.status === "blocked" ? <p role="alert">Preview blocked: {p.blockers.map((b) => b.replaceAll("_", " ")).join("; ")}. No authoritative awards calculated.</p> : <>
          <h4>{p.status === "awards_preview" ? "Proposed equal awards" : "Refund obligations — not executed"}</h4>
          <ul>{[...p.awards, ...p.refundObligations].map((a) => <li key={a.participantId}>{a.displayName}: {formatUsd(a.amountMinor)}{a.qualificationRank ? ` · qualifying order ${a.qualificationRank}` : ""}</li>)}</ul>
        </>}
        <p className="auth-note" style={{ overflowWrap: "anywhere" }}>Policy {p.policyId ?? "not published"}; source snapshot {p.sourceDigest}.</p>
      </article>)}
      <p>Automatic Q payouts, actual refunds and canonical Q settlement remain disabled.</p>
    </section>
  </>;
}
