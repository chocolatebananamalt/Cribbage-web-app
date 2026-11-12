"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatUsd } from "../../../../../../../lib/money";
import { setAppRecoveryItem } from "../../../../../../../lib/recovery-write-coordinator";
import { isUuid } from "../../../../../../../lib/api/validation";
import {
  isSidePoolRecipientMutationV3,
  isSidePoolRecipientReconciliationV3,
  isSidePoolRecipientResultV3,
  sidePoolRecipientMethodV3,
  sidePoolRecipientResultMatchesV3,
  type SidePoolRecipientMutationV3,
  type SidePoolRecipientWorkspaceV3,
} from "../../../../../../../lib/api/side-pool-recipients-v3";

type Pending = { kind: "side-pool-recipient-v3"; actorId: string; operationId: string; mutation: SidePoolRecipientMutationV3 };
const recoveryKey = (actorId: string, tournamentId: string, eventId: string, poolId: string) =>
  `payment-obligation:side-pool-recipient-v3:${actorId}:${tournamentId}:${eventId}:${poolId}`;
const money = formatUsd;
const errorText: Record<string, string> = {
  idempotency_conflict: "The saved operation conflicts with another request. Its recovery record is preserved and further recording is blocked.",
  amount_policy_required: "This pool has no graduated amount policy to attach. Its existing fixed schedule and history remain unchanged.",
  policy_frozen: "A recipient policy is already frozen for this pool.",
  collection_or_play_started: "Recipient policy disclosure must be frozen before collection or play. No upgrade was made.",
  accounting_already_finalized: "Tournament accounting is already finalized, so a new recipient review cannot be added.",
  source_blocked: "A required source is unavailable or blocked. Refresh and resolve the listed source issue before reviewing.",
  source_changed: "The source changed before review. Refresh and inspect the current ranks and amounts.",
  stale_version: "This pool changed in another director session. Refresh before continuing.",
  already_reviewed: "These exact source amounts already have an immutable unpaid review.",
  invalid_request: "The recipient request was rejected as invalid.",
};

export default function SidePoolRecipientsV3Client({ actorId, tournamentId, eventId, poolId, workspace, canPublishPolicy }: {
  actorId: string; tournamentId: string; eventId: string; poolId: string; workspace: SidePoolRecipientWorkspaceV3; canPublishPolicy: boolean;
}) {
  const router = useRouter();
  const [disclosure, setDisclosure] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const flight = useRef(false);
  const recoveryStarted = useRef(false);

  const clear = useCallback((operationId: string, expectedRaw: string): boolean => {
    const key = recoveryKey(actorId, tournamentId, eventId, poolId);
    try {
      const raw = sessionStorage.getItem(key);
      const value: unknown = raw ? JSON.parse(raw) : null;
      if (raw !== expectedRaw || !isPending(value) || value.actorId !== actorId || value.operationId !== operationId
        || value.mutation.eventId !== eventId || value.mutation.poolId !== poolId) return false;
      sessionStorage.removeItem(key);
      return sessionStorage.getItem(key) === null;
    } catch { return false; }
  }, [actorId, eventId, poolId, tournamentId]);

  const reconcile = useCallback(async (operation: Pending) => {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/side-pools/${poolId}/recipients-v3/reconciliation`, {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ operationId: operation.operationId, mutation: operation.mutation }),
    });
    return { ok: response.ok, data: await response.json().catch(() => null) as unknown };
  }, [eventId, poolId, tournamentId]);

  useEffect(() => {
    if (recoveryStarted.current) return;
    recoveryStarted.current = true;
    async function recover() {
      const key = recoveryKey(actorId, tournamentId, eventId, poolId);
      let raw: string | null;
      try { raw = sessionStorage.getItem(key); }
      catch { setBlocked(true); setReady(true); setMessage("Recovery storage is unavailable. Recipient recording is blocked."); return; }
      if (!raw) { setReady(true); return; }
      let value: unknown;
      try { value = JSON.parse(raw); }
      catch { setBlocked(true); setReady(true); setMessage("An unknown recovery record is preserved. Recipient recording is blocked until resolved."); return; }
      if (!isPending(value) || value.actorId !== actorId || value.mutation.eventId !== eventId || value.mutation.poolId !== poolId
        || key !== recoveryKey(value.actorId, tournamentId, value.mutation.eventId, value.mutation.poolId)) {
        setBlocked(true); setReady(true); setMessage("A mismatched or unknown recovery record is preserved. Recipient recording is blocked."); return;
      }
      setPending(value);
      if (value.mutation.action === "publish_policy") {
        setMessage("A policy request may have completed. Retry the exact saved request to recover its original result.");
        setReady(true);
        return;
      }
      setBusy(true);
      try {
        const response = await reconcile(value);
        if (!response.ok || !isSidePoolRecipientReconciliationV3(response.data, value.mutation)) {
          setBlocked(true); setMessage("The saved review could not be reconciled. Its exact request is preserved and recording is blocked."); return;
        }
        if (response.data.result === null) {
          setMessage("No completed review receipt was found. Retry the exact saved request.");
          setReady(true);
          return;
        }
        if (response.data.result.status === "rejected" && response.data.result.code === "idempotency_conflict") {
          setBlocked(true); setMessage(errorText.idempotency_conflict); return;
        }
        if (!clear(value.operationId, raw)) {
          setBlocked(true); setMessage("The result was confirmed, but its exact recovery record could not be cleared safely. It is preserved and recording is blocked."); return;
        }
        setPending(null);
        setMessage(response.data.result.status === "rejected" ? errorText[response.data.result.code] ?? `Request rejected: ${response.data.result.code}.` : "Unpaid recipient review confirmed.");
        router.refresh();
      } catch {
        setBlocked(true); setMessage("The saved review could not be reconciled. Its exact request is preserved and recording is blocked.");
      } finally { setReady(true); setBusy(false); }
    }
    void recover();
  }, [actorId, clear, eventId, poolId, reconcile, router, tournamentId]);

  async function submit(mutation: SidePoolRecipientMutationV3, retry?: Pending) {
    if (flight.current || busy || !ready || blocked || (pending && !retry)) return;
    const operation = retry ?? { kind: "side-pool-recipient-v3" as const, actorId, operationId: crypto.randomUUID(), mutation };
    if (!isSidePoolRecipientMutationV3(operation.mutation) || operation.actorId !== actorId
      || operation.mutation.eventId !== eventId || operation.mutation.poolId !== poolId) { setMessage("The recipient request is invalid."); return; }
    flight.current = true; setBusy(true); setMessage("");
    try {
      const key = recoveryKey(actorId, tournamentId, eventId, poolId);
      let retainedRaw: string;
    try {
      if (retry) {
        retainedRaw = sessionStorage.getItem(key) ?? "";
        const retained: unknown = retainedRaw ? JSON.parse(retainedRaw) : null;
        if (!retainedRaw || retainedRaw !== JSON.stringify(operation) || !isPending(retained) || retained.actorId !== actorId
          || retained.operationId !== operation.operationId || retained.mutation.eventId !== eventId || retained.mutation.poolId !== poolId) throw Error("retained_record_changed");
        if (operation.mutation.action === "review") {
          const checked = await reconcile(operation);
          if (!checked.ok || !isSidePoolRecipientReconciliationV3(checked.data, operation.mutation)) throw Error("reconciliation_unavailable");
          if (checked.data.result !== null) {
            if (checked.data.result.status === "rejected" && checked.data.result.code === "idempotency_conflict") {
              setBlocked(true); setMessage(errorText.idempotency_conflict); return;
            }
            if (!clear(operation.operationId, retainedRaw)) {
              setBlocked(true); setMessage("The result was confirmed, but its exact recovery record could not be cleared safely. It is preserved and recording is blocked."); return;
            }
            setPending(null);
            setMessage(checked.data.result.status === "rejected" ? errorText[checked.data.result.code] ?? `Request rejected: ${checked.data.result.code}.` : "Unpaid recipient review confirmed.");
            router.refresh(); return;
          }
        }
      } else {
        if (sessionStorage.getItem(key) !== null) throw Error("recovery_record_conflict");
        retainedRaw = JSON.stringify(operation);
        setAppRecoveryItem(sessionStorage, key, retainedRaw);
        setPending(operation);
      }
      } catch {
        setBlocked(true); setMessage("The exact recovery record could not be verified or saved. Recording is blocked; no new request was sent.");
        return;
      }

      try {
        const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/side-pools/${poolId}/recipients-v3`, {
          method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": operation.operationId },
          credentials: "same-origin", body: JSON.stringify(operation.mutation),
        });
        const result: unknown = await response.json().catch(() => null);
        if (!isSidePoolRecipientResultV3(result) || !sidePoolRecipientResultMatchesV3(result, operation.mutation)) {
          setMessage("The request result is unresolved. Its exact retry is preserved."); return;
        }
        if (result.status === "rejected" && result.code === "idempotency_conflict") {
          setBlocked(true); setMessage(errorText.idempotency_conflict); return;
        }
        if (result.status === "rejected" && response.ok) {
          setMessage("The server response was inconsistent. Its exact recovery record is preserved."); return;
        }
        if (result.status !== "rejected" && !response.ok) {
          setMessage("The server response was inconsistent. Its exact recovery record is preserved."); return;
        }
        if (!clear(operation.operationId, retainedRaw)) {
          setBlocked(true); setMessage("The result was received, but its exact recovery record could not be cleared safely. It is preserved and recording is blocked."); return;
        }
        setPending(null);
        setMessage(result.status === "rejected" ? errorText[result.code] ?? `Request rejected: ${result.code}.` : result.status === "side_pool_recipient_policy_frozen" ? "Recipient policy frozen and disclosed; no money was moved." : "Unpaid recipient review recorded; no money was moved.");
        router.refresh();
      } catch { setMessage("The request result is unresolved. Its exact retry is preserved."); }
    } finally { setBusy(false); flight.current = false; }
  }

  const policyExists = workspace.recipientPolicy !== null;
  const currentReview = workspace.history.find((item) => item.current);
  const priorReview = workspace.history[0];
  const publishBlocked = !canPublishPolicy || workspace.policyId === null || workspace.feeMinor <= 0 || workspace.blockers.some((item) => ["source_blocked", "legacy_pool_history_preserved"].includes(item));
  const reviewBlocked = workspace.blockers.length > 0 || !policyExists || workspace.qualificationId === null;

  return <section className="policy-settings" aria-label="Side Pool unpaid recipient policy">
    <h2>Side Pool recipient policy and unpaid review</h2>
    <p className="auth-note">Rank every fully paid entrant using the approved Side Pool scorecard order. Playoff qualification does not cut the recipient list. Cash ties in the paid order block review until a separate approved tie policy exists. The amount source uses the configured fee, fully paid entrant count, configured ratio, and shared balanced $5 rounding.</p>
    <p>Side Pool fee: {money(workspace.feeMinor)} · recipient fund: {workspace.fundMinor === null ? "pending fully paid entries" : money(workspace.fundMinor)} · disclosed amount ratio: {workspace.ratio === null ? "not configured" : `1 in ${workspace.ratio}`}.</p>
    <p>These obligations are recorded as unpaid. No payment status, recipient disbursement, or combined tournament settlement is available in this flow.</p>
    {workspace.policyId === null
      ? <p className="auth-note">A new graduated amount policy is required before this recipient policy can be published. Any old fixed schedule or amount-only history remains on its original terms and cannot be retrofitted or silently upgraded.</p>
      : null}
    {!policyExists ? <fieldset disabled={!ready || busy || blocked || !!pending || publishBlocked}>
      <legend>Disclose and freeze recipient policy before collection</legend>
      <p>This policy ranks all fully paid scorecards, including nonqualifiers, by their qualifying-card performance. Freeze it before collecting any Side Pool fee or starting play. Existing fixed schedules and history remain unchanged.</p>
      {!canPublishPolicy && workspace.policyId !== null ? <p className="auth-note">An election or play has already begun, so this recipient policy can no longer be retrofitted. Previously reviewed amount-only history does not choose recipients; preserve it on its original terms.</p> : null}
      <label>Disclosure reference<input aria-label="Recipient policy disclosure reference" maxLength={500} value={disclosure} onChange={(event) => setDisclosure(event.target.value)} placeholder="Posted Side Pool rules or registration notice" /></label>
      {workspace.blockers.includes("recipient_policy_required") ? <p className="auth-note">The amount schedule is present. Publish this recipient-selection disclosure before recording any election or collection.</p> : null}
      <button className="secondary" type="button" disabled={!ready || busy || blocked || !!pending || publishBlocked || !disclosure.trim()}
        onClick={() => void submit({ eventId, poolId, action: "publish_policy", request: { amountPolicyId: workspace.policyId!, method: sidePoolRecipientMethodV3, disclosureReference: disclosure.trim(), disclosed: true } })}>Disclose and freeze recipient policy</button>
    </fieldset> : <>
      <p><strong>Frozen policy:</strong> {workspace.recipientPolicy?.method}; disclosed at {workspace.recipientPolicy?.disclosureReference}. This policy was fixed before collection/play.</p>
      {workspace.blockers.length > 0 ? <p className="auth-note" role="status">Review blocked: {workspace.blockers.map((item) => item.replaceAll("_", " ")).join(", ")}.</p> : null}
      {workspace.obligations.length > 0 ? <>
        <h3>Unpaid recipient amounts</h3>
        <ol aria-label="Unpaid Side Pool recipient amounts">{workspace.obligations.map((item) => <li key={item.participantId}>
          <strong>Pool rank {item.poolRank}: {item.displayName}</strong> — {money(item.amountMinor)} unpaid ({item.qualified ? "qualified for playoffs" : "not playoff-qualified; included by the frozen paid-card policy"})
        </li>)}</ol>
        <p>Recipient amounts total {money(workspace.obligations.reduce((sum, item) => sum + item.amountMinor, 0))}. Recipient list reflects the full paid-card ranking; it does not use playoff finish as a cut.</p>
      </> : null}
      {currentReview ? <p role="status">Current unpaid review: version {currentReview.version} · source {currentReview.sourceDigest.slice(0, 12)}…</p> : null}
      {currentReview && workspace.blockers.length === 0 ? <aside className="auth-note"><p>This pool has a current unpaid recipient review. Event-level accounting combines regular prizes with each current Side Pool review; Q Pool accounting is optional and remains separate when present.</p><p><a href={`/tournament/${tournamentId}/events/${eventId}/prize-accounting-v9`}>Open event unpaid accounting (regular + Side; Q optional)</a></p><p>All configured graduated Side Pools need a current policy and unpaid recipient review before event accounting can finalize. This page never initiates payment.</p></aside> : null}
      {!currentReview ? <fieldset disabled={!ready || busy || blocked || !!pending || reviewBlocked}>
        <legend>Review unpaid recipient amounts</legend>
        <label>Review reason<input aria-label="Recipient review reason" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reviewed against finalized scorecards and paid entries" /></label>
        <button className="secondary" type="button" disabled={!ready || busy || blocked || !!pending || reviewBlocked || !reason.trim()}
          onClick={() => void submit({ eventId, poolId, action: "review", request: { expectedVersion: workspace.history.length, sourceDigest: workspace.sourceDigest, reason: reason.trim(), reviewed: true } })}>Record unpaid recipient review</button>
      </fieldset> : null}
      {priorReview ? <details><summary>Recipient review history</summary><ol>{workspace.history.map((item) => <li key={item.id}>
        Version {item.version} · {item.current ? "current" : "stale source"} · unpaid · {item.reason} · {new Date(item.recordedAt).toISOString()}
      </li>)}</ol></details> : null}
    </>}
    {pending ? <div className="auth-note" role="status"><p>{message || "A request is awaiting recovery."}</p>
      <button className="secondary" type="button" disabled={!ready || busy || blocked} onClick={() => void submit(pending.mutation, pending)}>Retry exact saved request</button>
    </div> : null}
    <p className="live-status" role="status">{pending ? "" : message}</p>
  </section>;
}

function isPending(value: unknown): value is Pending {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === "actorId,kind,mutation,operationId"
    && (value as Pending).kind === "side-pool-recipient-v3" && isUuid((value as Pending).actorId) && isUuid((value as Pending).operationId)
    && isSidePoolRecipientMutationV3((value as Pending).mutation);
}
