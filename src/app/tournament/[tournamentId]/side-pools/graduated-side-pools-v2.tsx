"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isSideGraduatedMutationV2,
  isSideGraduatedResultV2,
  sideGraduatedResultMatchesV2,
  type SideGraduatedMutationV2,
  type SideGraduatedPoolV2,
  type SideGraduatedWorkspaceV2,
} from "../../../../lib/api/side-pool-graduated-v2";
import { graduatedPoolAmountsVersionV2 } from "../../../../lib/results/graduated-pool-amounts-v2";
import { formatUsd } from "../../../../lib/money";
import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";
import { isUuid } from "../../../../lib/api/validation";

type Pending = { kind: "side-pool-graduated-v2"; actorId: string; operationId: string; mutation: SideGraduatedMutationV2 };
const keyFor = (actorId: string, tournamentId: string, poolId: string) => `payment-obligation:side-pool-graduated-v2:${actorId}:${tournamentId}:${poolId}`;
const money = formatUsd;
const errors: Record<string, string> = {
  idempotency_conflict: "The saved operation conflicts with a different request. Its recovery record is preserved; contact the director support path before continuing.",
  unsupported_scope: "This policy is currently available only for an active Standard Singles Side Pool.",
  unsupported_payout_domain: "This fee, entrant count, or ratio is outside the supported graduated policy range.",
  policy_frozen: "A policy is already frozen for this Side Pool.",
  entries_locked: "Pool entries are locked because play has started.",
  legacy_pool_history_preserved: "This Side Pool already has fixed-schedule history, which remains on its original policy.",
  source_blocked: "The amount source is blocked. Resolve the listed funding or policy issue, then refresh.",
  entries_not_locked: "The amount schedule can be reviewed after event entries are locked.",
  source_changed: "The source changed before review. Refresh and inspect the new amounts.",
  stale_version: "This Side Pool changed in another director session. Refresh before continuing.",
  already_reviewed: "These exact amounts were already reviewed. The existing unpaid review is preserved.",
  disclosed_policy_required: "Post and disclose the graduated policy before recording Side Pool collection.",
  participant_unavailable: "That participant is no longer active in this event.",
  election_identity_conflict: "This election identity is already attached to a different entry.",
  received_exceeds_due: "Received amount cannot exceed the Side Pool fee.",
  refund_resolution_required: "Record the refund resolution before removing this paid entry.",
};

export function GraduatedSidePoolsV2({ actorId, tournamentId, workspace }: { actorId: string; tournamentId: string; workspace: SideGraduatedWorkspaceV2 | null }) {
  return <section className="policy-settings" aria-label="Graduated Side Pool policy">
    <h2>New graduated Side Pool policy</h2>
    <p className="auth-note">New policies use observed ACC weighted amounts with the app’s disclosed, balanced $5 rounding. This is an app policy, not an ACC endorsement. It preserves the pot and publishes rank amounts only; it does not choose recipients or move money. Existing fixed schedules and history stay on their original policy.</p>
    {!workspace ? <p className="auth-note">Graduated policy records are unavailable in this environment. Existing Side Pool records remain accessible below.</p> : workspace.pools.map((pool) => <GraduatedPool key={pool.poolId} actorId={actorId} tournamentId={tournamentId} pool={pool} participants={pool.participants} />)}
  </section>;
}
export default GraduatedSidePoolsV2;

export function hasGraduatedPolicy(workspace: SideGraduatedWorkspaceV2 | null, poolId: string) {
  return !!workspace?.pools.find((pool) => pool.poolId === poolId)?.policy;
}

export function GraduatedPool({ actorId, tournamentId, pool, participants = pool.participants, syntheticMode = false }: { actorId: string; tournamentId: string; pool: SideGraduatedPoolV2; participants?: Array<{ participantId: string; displayName: string }>; syntheticMode?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const flight = useRef(false);
  const [ratio, setRatio] = useState("6");
  const [disclosure, setDisclosure] = useState("");
  const [participantId, setParticipantId] = useState(participants[0]?.participantId ?? "");
  const [received, setReceived] = useState(String((pool.feeMinor / 100).toFixed(2)));
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "check">("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [reason, setReason] = useState("");
  const participantNames = useMemo(() => new Map(participants.map((item) => [item.participantId, item.displayName])), [participants]);
  const entry = pool.entries.find((item) => item.participantId === participantId);
  const currentReview = pool.history.find((item) => item.current);
  const storedReview = pool.history[0];
  const clear = useCallback((operationId: string, expectedRaw: string): boolean => {
    const key = keyFor(actorId, tournamentId, pool.poolId);
    try {
      const raw = sessionStorage.getItem(key), value: unknown = raw ? JSON.parse(raw) : null;
      if (raw !== expectedRaw || !isPending(value) || value.actorId !== actorId || value.operationId !== operationId || value.mutation.poolId !== pool.poolId) return false;
      sessionStorage.removeItem(key);
      return sessionStorage.getItem(key) === null;
    } catch { return false; }
  }, [actorId, pool.poolId, tournamentId]);

  useEffect(() => {
    let cancelled = false;
    async function recover() {
      let raw: string | null;
      const key = keyFor(actorId, tournamentId, pool.poolId);
      try { raw = sessionStorage.getItem(key); } catch { setBlocked(true); setReady(true); setMessage("Recovery storage is unavailable. Side Pool recording is blocked."); return; }
      if (!raw) { setReady(true); return; }
      let candidate: unknown;
      try { candidate = JSON.parse(raw); } catch { setBlocked(true); setReady(true); setMessage("An unrecognized recovery record is preserved. Recording is blocked until it is resolved."); return; }
      if (!isPending(candidate) || candidate.actorId !== actorId || candidate.mutation.poolId !== pool.poolId || candidate.mutation.eventId !== pool.eventId || key !== keyFor(candidate.actorId, tournamentId, candidate.mutation.poolId)) { setBlocked(true); setReady(true); setMessage("A mismatched or unknown recovery record is preserved. Recording is blocked."); return; }
      setPending(candidate);
      setBusy(true);
      try {
        const response = await fetch(`/api/v1/tournaments/${tournamentId}/side-pool-graduated-v2/reconciliation`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ operationId: candidate.operationId, mutation: candidate.mutation }) });
        const data = await response.json().catch(() => null) as { authorized?: boolean; result?: unknown } | null;
        if (cancelled) return;
        if (!response.ok || !data || data.authorized !== true || !(data.result === null || (isSideGraduatedResultV2(data.result) && sideGraduatedResultMatchesV2(data.result, candidate.mutation)))) {
          setBlocked(true); setMessage("The saved Side Pool request could not be reconciled. Its exact retry is preserved; recording is blocked."); return;
        }
        if (data.result === null) setMessage("No completed receipt was found. Retry the exact saved request.");
        else if (data.result.status === "rejected" && data.result.code === "idempotency_conflict") { setBlocked(true); setMessage(errors.idempotency_conflict); }
        else if (!clear(candidate.operationId, raw)) { setBlocked(true); setMessage("The result was confirmed, but its exact recovery record could not be cleared safely. It is preserved and recording is blocked."); }
        else { setPending(null); setMessage(data.result.status === "rejected" ? errors[data.result.code] ?? `Request rejected: ${data.result.code}.` : "Saved Side Pool request confirmed."); router.refresh(); }
      } catch { if (!cancelled) { setBlocked(true); setMessage("The saved Side Pool request could not be reconciled. Its exact retry is preserved; recording is blocked."); } }
      finally { if (!cancelled) { setReady(true); setBusy(false); } }
    }
    void recover();
    return () => { cancelled = true; };
  }, [actorId, clear, pool.eventId, pool.poolId, router, tournamentId]);
  async function submit(mutation: SideGraduatedMutationV2, retry?: Pending) {
    if (flight.current || busy || !ready || blocked || (pending && !retry)) return;
    const operation = retry ?? { kind: "side-pool-graduated-v2" as const, actorId, operationId: crypto.randomUUID(), mutation };
    if (!isSideGraduatedMutationV2(operation.mutation)) { setMessage("The Side Pool request is invalid."); return; }
    flight.current = true; setBusy(true); setMessage(""); if (retry) setPending(operation);
    try {
      if (retry) {
        const key = keyFor(actorId, tournamentId, pool.poolId), raw = sessionStorage.getItem(key), retained: unknown = raw ? JSON.parse(raw) : null;
        if (!raw || raw !== JSON.stringify(operation) || !isPending(retained) || retained.actorId !== actorId || retained.mutation.poolId !== pool.poolId) throw Error("retained_work_changed");
        const check = await fetch(`/api/v1/tournaments/${tournamentId}/side-pool-graduated-v2/reconciliation`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ operationId: operation.operationId, mutation: operation.mutation }) });
        const receipt = await check.json().catch(() => null) as { authorized?: boolean; result?: unknown } | null;
        if (!check.ok || !receipt || receipt.authorized !== true || !(receipt.result === null || (isSideGraduatedResultV2(receipt.result) && sideGraduatedResultMatchesV2(receipt.result, operation.mutation)))) throw Error("reconciliation_unavailable");
        if (receipt.result !== null) {
          if (receipt.result.status === "rejected" && receipt.result.code === "idempotency_conflict") { setBlocked(true); setMessage(errors.idempotency_conflict); return; }
          if (!clear(operation.operationId, raw)) { setBlocked(true); setMessage("The result was confirmed, but its exact recovery record could not be cleared safely. It is preserved and recording is blocked."); return; }
          setPending(null); setMessage(receipt.result.status === "rejected" ? errors[receipt.result.code] ?? `Request rejected: ${receipt.result.code}.` : "Saved Side Pool request confirmed."); router.refresh(); return;
        }
      } else {
        const key = keyFor(actorId, tournamentId, pool.poolId), raw = JSON.stringify(operation);
        if (sessionStorage.getItem(key) !== null) throw Error("recovery_record_conflict");
        setAppRecoveryItem(sessionStorage, key, raw); setPending(operation);
      }
    } catch {
      setBlocked(true); setMessage("The exact recovery record could not be verified or saved. Recording is blocked; no new Side Pool request was sent."); setBusy(false); flight.current = false; return;
    }
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/side-pool-graduated-v2`, { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": operation.operationId }, credentials: "same-origin", body: JSON.stringify(operation.mutation) });
      const result: unknown = await response.json().catch(() => null);
      if (isSideGraduatedResultV2(result) && sideGraduatedResultMatchesV2(result, operation.mutation) && result.status === "rejected" && result.code === "idempotency_conflict") {
        setBlocked(true); setMessage(errors.idempotency_conflict);
      } else if (!response.ok || !isSideGraduatedResultV2(result) || !sideGraduatedResultMatchesV2(result, operation.mutation)) {
        if (isSideGraduatedResultV2(result) && sideGraduatedResultMatchesV2(result, operation.mutation) && result.status === "rejected") {
          if (!clear(operation.operationId, JSON.stringify(operation))) { setBlocked(true); setMessage("The rejection was received, but its exact recovery record could not be cleared safely. It is preserved and recording is blocked."); }
          else { setPending(null); setMessage(errors[result.code] ?? `Request rejected: ${result.code}.`); router.refresh(); }
        }
        else setMessage("The Side Pool request is unresolved. Its exact retry is preserved.");
      } else if (result.status === "rejected") {
        if (!clear(operation.operationId, JSON.stringify(operation))) { setBlocked(true); setMessage("The rejection was received, but its exact recovery record could not be cleared safely. It is preserved and recording is blocked."); }
        else { setPending(null); setMessage(errors[result.code] ?? `Request rejected: ${result.code}.`); router.refresh(); }
      } else if (!clear(operation.operationId, JSON.stringify(operation))) { setBlocked(true); setMessage("The result was confirmed, but its exact recovery record could not be cleared safely. It is preserved and recording is blocked."); }
      else { setPending(null); setMessage("Side Pool record saved and audited; no money was moved."); router.refresh(); }
    } catch { setMessage("The Side Pool request is unresolved. Its exact retry is preserved."); }
    finally { setBusy(false); flight.current = false; }
  }
  function saveElection() {
    const receivedMinor = /^\d{1,8}(?:\.\d{1,2})?$/.test(received) ? Math.round(Number(received) * 100) : NaN;
    if (!participantId || !Number.isSafeInteger(receivedMinor) || receivedMinor < 0 || receivedMinor > pool.feeMinor) { setMessage("Enter a valid received amount up to the pool fee."); return; }
    const policyId = pool.policy?.id;
    if (!policyId) return;
    void submit({ eventId: pool.eventId, poolId: pool.poolId, action: "election", request: { policyId, participantId, electionId: entry?.electionId ?? crypto.randomUUID(), expectedVersion: entry?.version ?? 0, elected: true, receivedMinor, paymentMethod, paymentReference: syntheticMode ? `TEST ONLY SYNTHETIC:${paymentReference.trim()}`.slice(0, 100) : paymentReference, reason: reason.trim() || (entry ? "Director corrected disclosed Side Pool collection" : "Director recorded disclosed Side Pool collection") } });
  }
  function publishPolicy() {
    if (!disclosure.trim()) { setMessage("Enter where the policy disclosure was presented before collection."); return; }
    void submit({ eventId: pool.eventId, poolId: pool.poolId, action: "policy", request: { method: graduatedPoolAmountsVersionV2, ratio: Number(ratio), definitionVersionId: pool.definitionId, disclosureReference: disclosure.trim(), disclosed: true } });
  }
  function reviewAmounts() {
    if (!pool.calculation) return;
    void submit({ eventId: pool.eventId, poolId: pool.poolId, action: "review", request: { expectedVersion: pool.history.length, sourceDigest: pool.sourceDigest, reason: reason.trim() || "Director reviewed the current unpaid rank amount schedule", reviewed: true } });
  }

  const graduated = !!pool.policy;
  return <section className="registration-note" aria-label={`${pool.name} graduated policy`}>
    <h3>{pool.name} · {money(pool.feeMinor)}</h3>
    {graduated ? <Link className="guide-link" href={`/tournament/${tournamentId}/side-pools/recipients/${pool.eventId}/${pool.poolId}`}>Review unpaid recipients</Link> : null}
    {pending?.mutation.poolId === pool.poolId ? <div className="auth-note" role="status"><p>{message || "A Side Pool request is awaiting recovery."}</p><button className="secondary" type="button" disabled={!ready || busy || blocked} onClick={() => void submit(pending.mutation, pending)}>Retry exact Side Pool request</button></div> : null}
    {!graduated ? <fieldset disabled={!ready || busy || blocked || !!pending || !pool.canPublish}>
      <legend>Disclose and post the new graduated policy before collection</legend>
      <p>Observed ACC weighted amounts use this app’s exact balanced $5 rounding, so all rank amounts add to the collected pot. This is not an ACC-endorsed rule. Directors select and disclose the policy before collecting entry fees. Later review records unpaid rank amounts only.</p>
      <label>Pay approximately 1 in <input aria-label="Paid-entry ratio" inputMode="numeric" min="2" max="100" value={ratio} onChange={(event) => setRatio(event.target.value)} /></label>
      <label>Disclosure reference (where players saw this policy)<input aria-label="Disclosure reference" maxLength={500} value={disclosure} onChange={(event) => setDisclosure(event.target.value)} placeholder="Posted event rules / registration notice" /></label>
      {!pool.canPublish ? <p className="auth-note">This Side Pool cannot adopt the new policy. Existing fixed-schedule policy and history are preserved.</p> : null}
      <button className="secondary" type="button" disabled={busy || !!pending || !pool.canPublish || !/^\d+$/.test(ratio) || Number(ratio) < 2 || Number(ratio) > 100 || !disclosure.trim()} onClick={publishPolicy}>Disclose and freeze graduated policy</button>
    </fieldset> : <>
      <p><strong>Disclosed policy:</strong> {pool.policy?.method}; 1 in {pool.policy?.ratio}; disclosure: {pool.policy?.disclosureReference}. Published {new Date(pool.policy!.publishedAt).toISOString()}.</p>
      <fieldset disabled={!ready || busy || blocked || !!pending || !participantId || pool.started}>
        <legend>{syntheticMode ? "Record simulated fully paid Side Pool entry" : "Record fully paid Side Pool entry"}</legend>{syntheticMode && <p>No actual cash receipt or personal player consent is claimed.</p>}
        <p>Policy disclosure is already on file. Only fully paid entries count toward the entrant count and amount schedule; recorded collection remains an audited ledger entry.</p>
        <label>Participant<select value={participantId} onChange={(event) => setParticipantId(event.target.value)}><option value="">Select participant</option>{participants.map((item) => <option key={item.participantId} value={item.participantId}>{item.displayName}</option>)}</select></label>
        <label>{syntheticMode ? "Simulated amount received (USD)" : "Amount received (USD)"}<input inputMode="decimal" value={received} onChange={(event) => setReceived(event.target.value)} /></label>
        <label>Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "cash" | "check")}><option value="cash">Cash</option><option value="check">Check</option></select></label>
        <label>Check number or reference (optional)<input maxLength={syntheticMode ? 79 : 100} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></label>
        <label>Audit reason (optional)<input maxLength={400} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <button className="secondary" type="button" disabled={busy || !!pending || !participantId || pool.started} onClick={saveElection}>{entry ? "Correct audited entry" : "Record collection"}</button>
      </fieldset>
      <ul aria-label="Audited Side Pool entries">{pool.entries.filter((item) => item.elected).map((item) => <li key={item.electionId}>{participantNames.get(item.participantId) ?? "Participant"} · due {money(item.dueMinor)} · received {money(item.receivedMinor)} · {item.receivedMinor === item.dueMinor ? "fully paid" : "not fully paid"}</li>)}</ul>
      {pool.blockers.length ? <p className="auth-note" role="status">Amount schedule unavailable: {pool.blockers.map((item) => item.replaceAll("_", " ")).join(", ")}.</p> : null}
      {pool.calculation ? <>
        <p><strong>{pool.paidCount} fully paid entrant{pool.paidCount === 1 ? "" : "s"}; pot {money(pool.calculation.fundMinor)}; ratio 1 in {pool.calculation.ratio}.</strong></p>
        <ol aria-label="Unpaid rank amount schedule">{pool.calculation.awardsMinor.map((amount, index) => <li key={index}>Rank {index + 1}: {money(amount)}</li>)}</ol>
        <p>Rank amounts sum to {money(pool.calculation.awardsMinor.reduce((sum, amount) => sum + amount, 0))}. This review assigns no recipients and moves no money.</p>
        {pool.started ? <><label>Review reason<input maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="secondary" type="button" disabled={!ready || busy || blocked || !!pending || !!currentReview} onClick={reviewAmounts}>{currentReview ? "Current amounts reviewed" : "Review unpaid rank amounts"}</button></> : <p className="auth-note">Review becomes available after entries are locked.</p>}
      </> : null}
      {storedReview ? <details><summary>Amount review history</summary><ol>{pool.history.map((item) => <li key={item.id}>Version {item.version} · {item.current ? "current" : "stale"} · {item.status} · {item.reason} · {new Date(item.recordedAt).toISOString()} · {item.calculation.awardsMinor.map(money).join(", ")}</li>)}</ol></details> : null}
    </>}
    <p className="live-status" role="status">{pending?.mutation.poolId === pool.poolId ? "" : message}</p>
  </section>;
}

function isPending(value: unknown): value is Pending {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === "actorId,kind,mutation,operationId"
    && (value as Pending).kind === "side-pool-graduated-v2" && isUuid((value as Pending).actorId) && isUuid((value as Pending).operationId)
    && isSideGraduatedMutationV2((value as Pending).mutation);
}
