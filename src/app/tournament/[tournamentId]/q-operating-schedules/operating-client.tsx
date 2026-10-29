"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { equalQMethodV2, graduatedQMethodV2, isQOperatingRequestV2, isQOperatingResultV2, qOperatingResultMatchesV2, type QOperatingRequestV2, type QOperatingWorkspaceV2 } from "../../../../lib/api/q-operating-schedules";
import { isUuid } from "../../../../lib/api/validation";
import { previewQOperatingScheduleV2, type QOperatingPolicyV2, type QOperatingResultV2 } from "../../../../lib/results/q-operating-schedule";
import { lookupQChart, qChartSchedules } from "../../../../lib/results/q-chart-catalog";
import { formatUsd } from "../../../../lib/money";
import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";

type Envelope = { kind: "q-operating-v2"; operationId: string; request: QOperatingRequestV2 };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const envelope = (v: unknown): v is Envelope => object(v) && Object.keys(v).sort().join() === "kind,operationId,request"
  && v.kind === "q-operating-v2" && isUuid(v.operationId) && isQOperatingRequestV2(v.request);

/** Client rendering is a preview only; server source and policy checks own all writes. */
export function operatingPoolPreview(source: QOperatingWorkspaceV2, poolVersionId: string): QOperatingResultV2 | { status: "blocked"; code: string } {
  if (!source.membership?.supported || source.blockers.length || !source.cards.length) return { status: "blocked", code: source.blockers.join(", ") || "current_finalized_sources_required" };
  const pool = source.membership.pools.find(p => p.poolVersionId === poolVersionId), policy = source.policies.find(p => p.poolVersionId === poolVersionId);
  if (!pool || !policy) return { status: "blocked", code: "disclosed_policy_required" };
  const contributions: Array<{ participantId: string; amountMinor: number }> = [];
  for (const entry of source.membership.entries) {
    if (entry.receivedMinor > 0 && !entry.allocationCurrent) return { status: "blocked", code: "unresolved_receipt_allocation" };
    const elected = entry.pools.find(p => p.poolVersionId === poolVersionId);
    if (!elected) return { status: "blocked", code: "pool_membership_unavailable" };
    if (!elected.elected) {
      if (elected.amountAllocatedMinor > 0) return { status: "blocked", code: "refund_resolution_required" };
      continue;
    }
    const prefix = `Q policy ${policy.id}: `;
    if (!elected.consentReference.startsWith(prefix) || !elected.consentReference.slice(prefix.length).trim()) return { status: "blocked", code: "policy_acknowledgment_required" };
    if (!entry.allocationCurrent || !elected.paidEntryEligible || elected.amountAllocatedMinor !== pool.feeMinor) return { status: "blocked", code: "partial_or_stale_contribution" };
    contributions.push({ participantId: entry.participantId, amountMinor: elected.amountAllocatedMinor });
  }
  const operatingPolicy: QOperatingPolicyV2 = policy.method === equalQMethodV2 ? { method: equalQMethodV2, feeMinor: pool.feeMinor }
    : { method: graduatedQMethodV2, feeMinor: pool.feeMinor, ratio: policy.ratio!, scheduleId: policy.scheduleId! };
  return previewQOperatingScheduleV2({ policy: operatingPolicy, cards: source.cards, contributions,
    cuts: source.cuts.filter(c => c.poolVersionId === poolVersionId && c.sourceDigest === source.sourceDigest).map(c => ({ participantIdsLowFirst: c.participantIdsLowFirst, recordedBy: c.recordedBy, reason: c.reason })),
    chart: policy.scheduleId ? lookupQChart(policy.scheduleId, contributions.length) : null });
}

export default function QOperatingClient({ actorId, tournamentId, source }: { actorId: string; tournamentId: string; source: QOperatingWorkspaceV2 | null }) {
  const router = useRouter(), flight = useRef(false), key = `payment-obligation:q-operating-v2:${actorId}:${tournamentId}`;
  const [ready, setReady] = useState(false), [blocked, setBlocked] = useState(false), [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Envelope | null>(null), [message, setMessage] = useState("Checking retained operating-schedule work.");
  const [poolId, setPoolId] = useState(source?.membership?.pools[0]?.poolVersionId ?? "");
  const [method, setMethod] = useState<"equal" | "graduated">("equal"), [scheduleId, setScheduleId] = useState("");
  const [reference, setReference] = useState(""), [disclosed, setDisclosed] = useState(false);
  const [cutOrder, setCutOrder] = useState(""), [cutReason, setCutReason] = useState(""), [cutObserved, setCutObserved] = useState(false);
  const url = `/api/v1/tournaments/${tournamentId}/q-operating-schedules`;
  function finish(raw: string, e: Envelope, result: unknown) {
    if (!isQOperatingResultV2(result) || !qOperatingResultMatchesV2(result, e.request)) { setMessage("Outcome remains uncertain. The exact request is retained."); return; }
    try {
      if (sessionStorage.getItem(key) !== raw) { setBlocked(true); setMessage("Retained work changed. No recovery record was cleared."); return; }
      sessionStorage.removeItem(key);
    } catch { setBlocked(true); setMessage("Outcome received, but retained work could not be cleared safely."); return; }
    setPending(null);
    setMessage(result.status === "rejected" ? `Request rejected: ${result.code.replaceAll("_", " ")}.` : result.status === "q_cut_recorded" ? "Physical cut outcome recorded for these exact sources. Reloading." : "Selected schedule frozen. Reloading saved disclosure.");
    if (result.status !== "rejected") { setDisclosed(false); setCutObserved(false); setCutOrder(""); setCutReason(""); router.refresh(); }
  }
  useEffect(() => {
    let active = true;
    async function restore() {
      let raw: string | null;
      try { raw = sessionStorage.getItem(key); } catch { setBlocked(true); setReady(true); setMessage("Recovery storage unavailable. Recording is blocked."); return; }
      if (!raw) { setReady(true); setMessage("Review and disclose the exact selected schedule before recording it."); return; }
      let e: unknown; try { e = JSON.parse(raw); } catch { e = null; }
      if (!envelope(e)) { setBlocked(true); setReady(true); setMessage("Unrecognized retained request; it was not overwritten."); return; }
      setPending(e); setBusy(true);
      try {
        const response = await fetch(`${url}/reconciliation`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: e.operationId }) });
        const result: unknown = response.ok ? await response.json() : null;
        if (!active) return;
        if (object(result) && Object.keys(result).sort().join() === "authorized,result" && result.authorized === true) {
          if (result.result !== null) finish(raw, e, result.result); else setMessage("No completed receipt. Retry only the exact retained request.");
        } else setMessage("Reconciliation unavailable. The exact request remains retained.");
      } catch { if (active) setMessage("Connection interrupted. The exact request remains retained."); }
      finally { if (active) { setBusy(false); setReady(true); } }
    }
    void restore(); return () => { active = false; };
    // Source refresh must not replay a mutation; retained identity changes only with actor/tournament.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, url]);
  async function submit(e: Envelope, retained: boolean) {
    if (flight.current || !ready || blocked) return;
    flight.current = true; setBusy(true);
    const raw = JSON.stringify(e);
    try {
      if (retained) { if (sessionStorage.getItem(key) !== raw) throw Error("Retained work changed."); }
      else { if (sessionStorage.getItem(key)) throw Error("Another retained request exists."); setAppRecoveryItem(sessionStorage, key, raw); setPending(e); }
      const response = await fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json", "x-idempotency-key": e.operationId }, body: JSON.stringify(e.request) });
      finish(raw, e, await response.json().catch(() => null));
    } catch { setMessage("Recording could not be confirmed. Recovery work remains intact; check the connection and retry the exact request."); }
    finally { flight.current = false; setBusy(false); }
  }
  const pools = source?.membership?.pools ?? [], selectedPool = pools.find(p => p.poolVersionId === poolId), selectedPolicy = source?.policies.find(p => p.poolVersionId === poolId);
  const schedules = qChartSchedules.filter(s => s.feeMinor === selectedPool?.feeMinor), selectedSchedule = schedules.find(s => s.id === scheduleId);
  const request: QOperatingRequestV2 = { action: "publish", poolVersionId: poolId, method: method === "equal" ? equalQMethodV2 : graduatedQMethodV2,
    ratio: method === "equal" ? null : selectedSchedule?.ratio ?? null, scheduleId: method === "equal" ? null : scheduleId, disclosureReference: reference, disclosed: true };
  const cutRequest: QOperatingRequestV2 = { action: "cut", poolVersionId: poolId, expectedSourceDigest: source?.sourceDigest ?? "", participantIdsLowFirst: cutOrder.split(/[\s,]+/).filter(Boolean), reason: cutReason };
  const locked = !ready || busy || blocked || !!pending;
  const name = (id: string) => source?.membership?.entries.find(e => e.participantId === id)?.displayName ?? id;
  return <>
    <p role="status">{message}</p>
    <section className="correction-item"><h2>Director-selected schedule</h2>
      <p>These selectable operating schedules were supplied by a tournament director. They are not a universal ACC formula. Q Pools remain separate from regular playoff prizes.</p>
      <p>Disclose the named pool cost, method and ratio before players elect or pay. Announce its entrant count before play. A frozen policy cannot be changed retrospectively; older policies and unpaid history remain preserved.</p>
      {!source && <p role="alert">Operating-schedule service unavailable. Recording and previews are blocked; no saved history was changed.</p>}
      {source && <fieldset disabled={locked}><label>Named Q Pool<select value={poolId} onChange={e => { setPoolId(e.target.value); setScheduleId(""); setDisclosed(false); setCutOrder(""); setCutObserved(false); }}>{pools.map(p => <option key={p.poolVersionId} value={p.poolVersionId}>{p.name} ({formatUsd(p.feeMinor)})</option>)}</select></label>
        {selectedPolicy ? <><p>Frozen method: {selectedPolicy.method === equalQMethodV2 ? "Equal — paid playoff qualifiers" : `Graduated — 1 in ${selectedPolicy.ratio} paid pool entrants`}. {selectedPolicy.scheduleId && <>Chart: {selectedPolicy.scheduleId}.</>}</p><p>Disclosure: {selectedPolicy.disclosureReference}. Published {selectedPolicy.publishedAt}.</p><p className="auth-note" style={{ overflowWrap: "anywhere" }}>Policy {selectedPolicy.id}.</p></> : <>
          {!source.canPublish && <p role="alert">Publishing is blocked by current scope, earlier collection/consent, historical policy or play state. Saved records remain intact.</p>}
          <label>Payout method<select aria-label="Payout method" value={method} onChange={e => { setMethod(e.target.value as "equal" | "graduated"); setDisclosed(false); }}><option value="equal">Equal — paid playoff qualifiers only</option><option value="graduated">Graduated — ranked paid pool entrants</option></select></label>
          {method === "equal" ? <p>Divide valid Q contributions equally among paid playoff qualifiers. Leftover pennies follow finalized qualifying order. If nobody qualifies, contributors are owed their contributions back as unpaid refund obligations. No refund is executed.</p> : <><p>Select ceil(paid entrants in this named pool ÷ ratio) recipients by qualifying-card rank, continuing to paid nonqualifiers when needed. Use the selected chart&apos;s exact dollars; unsupported counts or unbalanced cells require review.</p><label>Exact chart schedule<select aria-label="Exact chart schedule" value={scheduleId} onChange={e => { setScheduleId(e.target.value); setDisclosed(false); }}><option value="">Choose a verified chart</option>{schedules.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>{!schedules.length && <p role="alert">No verified graduated chart covers this pool fee.</p>}</>}
          <label>Disclosure reference<input maxLength={500} value={reference} onChange={e => { setReference(e.target.value); setDisclosed(false); }}/></label>
          <label><input type="checkbox" checked={disclosed} onChange={e => setDisclosed(e.target.checked)}/>I disclosed this exact named-pool schedule before any election or payment and approve freezing it.</label>
          <button type="button" disabled={!source.canPublish || !disclosed || !isQOperatingRequestV2(request)} onClick={() => void submit({ kind: "q-operating-v2", operationId: crypto.randomUUID(), request }, false)}>Publish and freeze selected schedule</button>
        </>}
      </fieldset>}
      {pending && <button type="button" disabled={!ready || busy || blocked} onClick={() => void submit(pending, true)}>Retry exact operating-schedule request</button>}
    </section>
    <section className="correction-item"><h2>Read-only Q previews</h2><p>Current, fully allocated payments and finalized qualification are required. These calculations do not record awards, mark anyone paid, execute refunds or finalize settlement. Refresh to recheck sources.</p>
      {source && pools.map(pool => { const p = operatingPoolPreview(source, pool.poolVersionId); return <article key={pool.poolVersionId}><h3>{pool.name}</h3>{p.status === "blocked" ? <p role="alert">Preview blocked: {p.code.replaceAll("_", " ")}.</p> : <><p>Valid pool contributions: {formatUsd(p.fundMinor)}.</p><h4>{p.refunds.length ? "Unpaid refund obligations — not executed" : "Proposed awards — not paid"}</h4><ul>{[...p.awards, ...p.refunds].map(a => <li key={a.participantId}>{name(a.participantId)}: {formatUsd(a.amountMinor)}</li>)}</ul></>}</article>; })}
      <p>Automatic payouts and canonical Q settlement remain disabled.</p>
    </section>
    {source && selectedPolicy?.method === graduatedQMethodV2 && <section className="correction-item"><h2>Record a physical low-card cut</h2><p>When paid Q entrants remain tied on game points, game wins and positive plus points, the director observes a physical deck cut. Low card wins. The app never substitutes net spread, a random value or an identifier order.</p>
      <p>Enter the exact tied participants in observed low-card-first order. The server verifies the tied group against this policy and source snapshot. A source change invalidates earlier cut evidence.</p>
      <ul>{source.cards.filter(c => source.membership?.entries.some(e => e.participantId === c.participantId && e.pools.some(p => p.poolVersionId === poolId && p.elected && p.paidEntryEligible))).map(c => <li key={c.participantId}>{name(c.participantId)}: {c.gamePoints} points, {c.gamesWon} wins, +{c.plusPoints}; <span style={{ overflowWrap: "anywhere" }}>{c.participantId}</span></li>)}</ul>
      <fieldset disabled={locked || !!source.blockers.length}><label>Tied participant IDs, low card first<textarea value={cutOrder} onChange={e => { setCutOrder(e.target.value); setCutObserved(false); }} maxLength={10000}/></label><label>Observed cut outcome and reason<input value={cutReason} onChange={e => { setCutReason(e.target.value); setCutObserved(false); }} maxLength={500}/></label><label><input type="checkbox" checked={cutObserved} onChange={e => setCutObserved(e.target.checked)}/>I observed this physical cut and recorded its exact low-card-first outcome.</label><button type="button" disabled={!cutObserved || !isQOperatingRequestV2(cutRequest)} onClick={() => void submit({ kind: "q-operating-v2", operationId: crypto.randomUUID(), request: cutRequest }, false)}>Record director-observed cut</button></fieldset>
    </section>}
    {source && <p className="auth-note" style={{ overflowWrap: "anywhere" }}>Source snapshot {source.sourceDigest}.</p>}
  </>;
}
