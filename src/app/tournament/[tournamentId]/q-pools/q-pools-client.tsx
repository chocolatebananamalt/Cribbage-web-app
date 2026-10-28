"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatUsd, formatUsdInput, parseUsdMinor } from "../../../../lib/money";
import { isUuid } from "../../../../lib/api/validation";
import {
  isQPoolMutation,
  isQPoolMutationResult,
  isQPoolReconciliation,
  qPoolMutationMatchesWorkspace,
  type QPoolMembershipEntry,
  type QPoolMembershipWorkspace,
  type QPoolMutation,
} from "../../../../lib/api/q-pool-membership";
import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";

type Envelope = { kind: "q-pool-operation"; operationId: string; request: QPoolMutation };
// Nest under an already shipped financial-recovery prefix so older pages also block account switching.
// The ordinary obligation writer uses UUID actor/tournament/roster keys, never this q-pool namespace.
const keyFor = (actorId: string, tournamentId: string) => `payment-obligation:q-pool:${actorId}:${tournamentId}`;
const exactEnvelope = (value: unknown): value is Envelope => !!value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(",") === "kind,operationId,request"
  && (value as Envelope).kind === "q-pool-operation" && isUuid((value as Envelope).operationId)
  && isQPoolMutation((value as Envelope).request);
const inputMinor = (text: string) => parseUsdMinor(text, { allowZero: true });
const controlMessage = (result: unknown, request: QPoolMutation) => isQPoolMutationResult(result, request)
  ? result.status === "q_pool_saved" ? "Q Pool record saved. Refreshing the authoritative membership and allocation state." : `Q Pool request rejected: ${result.code.replaceAll("_", " ")}. Review the current records.`
  : "The exact Q Pool request is unresolved. Its recovery record is retained.";

export default function QPoolMembershipClient({ actorId, tournamentId, canManage, workspace }: {
  actorId: string;
  tournamentId: string;
  canManage: boolean;
  workspace: QPoolMembershipWorkspace | null;
}) {
  const router = useRouter();
  const key = keyFor(actorId, tournamentId);
  const retained = useRef<string | null>(null);
  const flight = useRef(false);
  const [pending, setPending] = useState<Envelope | null>(null);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking Q Pool request recovery.");

  const finish = useCallback((raw: string, envelope: Envelope, result: unknown) => {
    let current: string | null;
    try { current = sessionStorage.getItem(key); } catch { setBlocked(true); setMessage("Recovery storage is unavailable. The saved request was not cleared."); return; }
    if (current !== raw) { setBlocked(true); setMessage("The Q Pool recovery record changed. Its current contents remain saved."); return; }
    const valid = isQPoolMutationResult(result, envelope.request);
    if (!valid) { setMessage("The exact Q Pool request remains saved because its outcome could not be verified."); return; }
    try { sessionStorage.removeItem(key); } catch { setBlocked(true); setMessage("The Q Pool result was received, but its recovery record could not be cleared safely."); return; }
    retained.current = null;
    setPending(null);
    setMessage(controlMessage(result, envelope.request));
    if (result.status === "q_pool_saved") router.refresh();
  }, [key, router]);

  useEffect(() => {
    let active = true;
    async function recover() {
      let raw: string | null;
      try { raw = sessionStorage.getItem(key); retained.current = raw; }
      catch { if (active) { setBlocked(true); setReady(true); setMessage("Recovery storage is unavailable. No Q Pool write can start."); } return; }
      if (!raw) { if (active) { setReady(true); setMessage(workspace ? "Review Q Pool eligibility, membership and recorded receipts." : "Q Pool workspace is unavailable."); } return; }
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      if (!exactEnvelope(parsed)) { if (active) { setBlocked(true); setReady(true); setMessage("An unrecognized Q Pool request remains saved locally and cannot be overwritten."); } return; }
      if (active) { setPending(parsed); setBusy(true); setMessage("Checking the exact saved Q Pool request with the server."); }
      try {
        const response = await fetch(`/api/v1/tournaments/${tournamentId}/q-pools/reconciliation`, {
          method: "POST", cache: "no-store", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: parsed.operationId }),
        });
        const result: unknown = response.ok ? await response.json().catch(() => null) : null;
        if (!active) return;
        if (!isQPoolReconciliation(result)) { setMessage("Server reconciliation is unavailable. The exact request remains saved for retry."); return; }
        if (result.result !== null) finish(raw, parsed, result.result);
        else setMessage("No completed Q Pool receipt is available. The exact request remains saved for retry.");
      } catch { if (active) setMessage("Server reconciliation is unavailable. The exact request remains saved for retry."); }
      finally { if (active) { setBusy(false); setReady(true); } }
    }
    void recover();
    return () => { active = false; };
  }, [finish, key, tournamentId, workspace]);

  async function submit(request: QPoolMutation) {
    if (busy || blocked || !ready || flight.current || !isQPoolMutation(request) || (!pending && (!workspace || !workspace.supported))) return;
    if (!pending) {
      const entry = workspace?.entries.find((item) => item.rosterEntryId === request.rosterEntryId);
      if (!workspace || !entry || !qPoolMutationMatchesWorkspace(request, workspace, entry)) {
        setMessage("This Q Pool request does not match the current event, membership, receipt or obligation facts.");
        return;
      }
    }
    flight.current = true;
    setBusy(true);
    try {
      let current: string | null;
      try { current = sessionStorage.getItem(key); } catch { setBlocked(true); setMessage("Recovery storage is unavailable. No write was started."); return; }
      if (current !== retained.current) { setBlocked(true); setMessage("A newer recovery record exists. It was not overwritten."); return; }
      const operation = pending ?? { kind: "q-pool-operation" as const, operationId: crypto.randomUUID(), request };
      if (pending && JSON.stringify(pending.request) !== JSON.stringify(request)) { setMessage("Only the exact saved Q Pool request can be retried."); return; }
      const raw = retained.current ?? JSON.stringify(operation);
      if (!pending) setAppRecoveryItem(sessionStorage, key, raw);
      retained.current = raw;
      setPending(operation);
      setMessage("Saving the exact Q Pool request.");
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/q-pools`, {
        method: "POST", cache: "no-store", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-idempotency-key": operation.operationId },
        body: JSON.stringify(operation.request),
      });
      const result: unknown = await response.json().catch(() => null);
      finish(raw, operation, result);
    } catch {
      setMessage(retained.current ? "The Q Pool outcome is uncertain. The exact request remains saved for retry." : "Recovery storage is unavailable. No write was started.");
    } finally { flight.current = false; setBusy(false); }
  }

  async function retryExact() {
    if (!pending || busy || blocked) return;
    await submit(pending.request);
  }

  const canManageWorkspace = canManage && !!workspace?.supported && !busy && !blocked && !pending;
  return <section className="policy-settings">
    <p className="live-status" role="status">{message}</p>
    {pending && <div className="correction-item"><p>An exact Q Pool operation is retained for recovery. Do not create a replacement operation while its result is unknown.</p><button className="secondary" type="button" disabled={busy || blocked} onClick={() => void retryExact()}>Retry exact Q Pool request</button></div>}
    {!workspace ? <p role="alert">Q Pool workspace is unavailable. This does not mean the event is unsupported.</p> : <>
      <section className="correction-item"><h2>{workspace.eventName}</h2><p>Base entry fee: {formatUsd(workspace.baseFeeMinor)}</p>
        {!workspace.supported ? <p role="alert">Q Pool membership is unavailable for this event{workspace.blockedReason ? `: ${workspace.blockedReason}` : "."}</p> : <>
          {workspace.started && <p className="auth-note">Play has started. Only reasoned director corrections to existing pre-play records are allowed. A late first opt-in or first allocation is blocked.</p>}
          {!workspace.pools.length && <p>No Q Pools are configured for this event.</p>}
          <p>Q Pool elections are separate for each pool. A saved payment receipt is required before allocation. No payment is created here. Paid entry eligibility is not payout eligibility.</p>
          <p>Before collecting Q Pool entries, disclose the payout method to participants. This screen records membership and allocates recorded receipts; it does not calculate or promise payouts.</p>
          {workspace.entries.map((entry) => <QPoolEntry key={`${entry.rosterEntryId}:${entry.membershipVersion}:${entry.allocationVersion}:${entry.receiptVersion}:${entry.obligationVersion}`} workspace={workspace} entry={entry} editable={canManageWorkspace && (!workspace.started || workspace.canCorrect)} busy={busy} onSubmit={submit}/>) }
        </>}
      </section>
    </>}
  </section>;
}

function QPoolEntry({ workspace, entry, editable, busy, onSubmit }: {
  workspace: QPoolMembershipWorkspace;
  entry: QPoolMembershipEntry;
  editable: boolean;
  busy: boolean;
  onSubmit: (request: QPoolMutation) => Promise<void>;
}) {
  const [membership, setMembership] = useState(() => entry.pools.map((pool) => ({ ...pool })));
  const [membershipReason, setMembershipReason] = useState("");
  const [membershipCorrection, setMembershipCorrection] = useState(false);
  const [baseAllocation, setBaseAllocation] = useState(entry.allocationCurrent ? formatUsdInput(entry.baseAllocatedMinor) : "");
  const [allocations, setAllocations] = useState(() => entry.pools.map((pool) => ({
    poolVersionId: pool.poolVersionId,
    amount: entry.allocationCurrent ? formatUsdInput(pool.amountAllocatedMinor) : "",
  })));
  const [allocationReason, setAllocationReason] = useState("");
  const [allocationCorrection, setAllocationCorrection] = useState(false);
  const prePlayElected = entry.pools.some((pool) => pool.prePlayElected);
  const canSaveMembership = editable && workspace.pools.length > 0 && membershipReason.trim().length > 0
    && membership.every((pool) => !pool.elected || pool.consentReference.trim().length > 0)
    && (!workspace.started || membership.every((pool) => !pool.elected || entry.pools.find((current) => current.poolVersionId === pool.poolVersionId)?.prePlayElected))
    && (!membershipCorrection || (entry.membershipVersion > 0 && workspace.canCorrect))
    && (!workspace.started || (entry.membershipVersion > 0 && prePlayElected && workspace.canCorrect));
  const parsedBase = baseAllocation.trim() === "" ? null : inputMinor(baseAllocation);
  const parsedPools = allocations.map((allocation) => ({ poolVersionId: allocation.poolVersionId, amountMinor: allocation.amount.trim() === "" ? null : inputMinor(allocation.amount) }));
  const obligationExpected = workspace.baseFeeMinor + workspace.pools.reduce((sum, pool) => sum + (entry.pools.find((item) => item.poolVersionId === pool.poolVersionId)?.elected ? pool.feeMinor : 0), 0);
  const allocationTotal = parsedBase !== null && parsedPools.every((pool) => pool.amountMinor !== null)
    ? BigInt(parsedBase) + parsedPools.reduce((sum, pool) => sum + BigInt(pool.amountMinor!), BigInt(0)) : null;
  const canSaveAllocation = editable && workspace.pools.length > 0 && entry.receiptId !== null && entry.obligationMinor !== null && entry.membershipVersionId !== null
    && Number.isSafeInteger(obligationExpected) && obligationExpected === entry.obligationMinor
    && parsedBase !== null && parsedBase <= workspace.baseFeeMinor
    && parsedPools.every((pool) => pool.amountMinor !== null && pool.amountMinor <= (entry.pools.find((item) => item.poolVersionId === pool.poolVersionId)?.amountOwedMinor ?? -1))
    && allocationTotal === BigInt(entry.receivedMinor) && allocationReason.trim().length > 0
    && (!allocationCorrection || (entry.allocationVersion > 0 && workspace.canCorrect))
    && (!workspace.started || (entry.allocationVersion > 0 && entry.membershipVersion > 0 && prePlayElected && workspace.canCorrect));

  function submitMembership() {
    const request: QPoolMutation = {
      action: "membership", rosterEntryId: entry.rosterEntryId, expectedVersion: entry.membershipVersion,
      correction: workspace.started || membershipCorrection, reason: membershipReason,
      pools: membership.map(({ poolVersionId, elected, consentReference }) => ({ poolVersionId, elected, consentReference })),
    };
    void onSubmit(request);
  }
  function submitAllocation() {
    if (parsedBase === null || parsedPools.some((pool) => pool.amountMinor === null) || !entry.receiptId || !entry.membershipVersionId) return;
    const request: QPoolMutation = {
      action: "allocation", rosterEntryId: entry.rosterEntryId, expectedVersion: entry.allocationVersion,
      correction: workspace.started || allocationCorrection, reason: allocationReason, membershipVersionId: entry.membershipVersionId,
      receiptId: entry.receiptId, obligationVersion: entry.obligationVersion, baseMinor: parsedBase,
      pools: parsedPools.map((pool) => ({ poolVersionId: pool.poolVersionId, amountMinor: pool.amountMinor! })),
    };
    void onSubmit(request);
  }

  return <article className="correction-item"><h3>{entry.displayName}</h3>
    {workspace.pools.length === 0 ? <p>No Q Pool membership options are configured.</p> : <fieldset disabled={!editable || busy}>
      <legend>Q Pool membership election · version {entry.membershipVersion}</legend>
      {workspace.pools.map((pool) => {
        const value = membership.find((item) => item.poolVersionId === pool.poolVersionId)!;
        return <section className="registration-note" key={pool.poolVersionId}>
          <label><input type="checkbox" checked={value.elected} disabled={workspace.started && !entry.pools.find((item) => item.poolVersionId === pool.poolVersionId)?.prePlayElected} onChange={(event) => setMembership((current) => current.map((item) => item.poolVersionId === pool.poolVersionId ? { ...item, elected: event.target.checked } : item))}/>
            Elect into Q Pool {pool.slot}: {pool.name} ({formatUsd(pool.feeMinor)})</label>
          {value.elected && <label>Consent reference for {pool.name}<input maxLength={500} value={value.consentReference} onChange={(event) => setMembership((current) => current.map((item) => item.poolVersionId === pool.poolVersionId ? { ...item, consentReference: event.target.value } : item))}/></label>}
          <p>Amount owed: {formatUsd(value.amountOwedMinor)}. Paid entry eligible: {value.paidEntryEligible ? "Yes" : "No"}. This is not payout eligibility.</p>
        </section>;
      })}
      {workspace.started && !prePlayElected && <p role="alert">A pre-play elected Q Pool record is required before play; first late opt-in is blocked.</p>}
      {!workspace.started && workspace.canCorrect && entry.membershipVersion > 0 && <label><input type="checkbox" checked={membershipCorrection} onChange={(event) => setMembershipCorrection(event.target.checked)}/>Record this membership revision as a director correction</label>}
      <label>Reason for membership record (required)<input maxLength={500} value={membershipReason} onChange={(event) => setMembershipReason(event.target.value)}/></label>
      <button className="secondary" type="button" disabled={!canSaveMembership} onClick={submitMembership}>{workspace.started ? "Save Director Membership Correction" : "Save Membership"}</button>
    </fieldset>}
    <fieldset disabled={!editable || busy}><legend>Payment allocation · version {entry.allocationVersion}</legend>
      <p>Recorded receipt: {entry.receiptId ? `${formatUsd(entry.receivedMinor)} (receipt ${entry.receiptVersion})` : "No receipt recorded"}. This screen cannot record or change a payment.</p>
      <p>Current obligation: {entry.obligationMinor === null ? "Unavailable" : formatUsd(entry.obligationMinor)}{entry.obligationMinor !== null && entry.obligationMinor !== obligationExpected ? " (does not match current base fee and elections)" : ""}.</p>
      <label>Base entry allocation (USD)<input inputMode="decimal" value={baseAllocation} onChange={(event) => setBaseAllocation(event.target.value)} placeholder="0.00"/></label>
      {workspace.pools.map((pool) => <label key={pool.poolVersionId}>{pool.name} allocation (USD; owed {formatUsd(entry.pools.find((item) => item.poolVersionId === pool.poolVersionId)?.amountOwedMinor ?? 0)})<input inputMode="decimal" value={allocations.find((item) => item.poolVersionId === pool.poolVersionId)?.amount ?? ""} onChange={(event) => setAllocations((current) => current.map((item) => item.poolVersionId === pool.poolVersionId ? { ...item, amount: event.target.value } : item))}/></label>)}
      <p>Paid entry eligibility is evaluated separately for the base entry and each elected pool. It does not determine payout eligibility.</p>
      {workspace.started && !(entry.allocationVersion > 0 && entry.membershipVersion > 0 && prePlayElected) && <p role="alert">A post-play allocation correction requires a prior pre-play allocation and pre-play Q Pool consent.</p>}
      {(!entry.receiptId || !entry.obligationMinor || entry.obligationMinor !== obligationExpected) && <p role="alert">Allocation is blocked until a current receipt and obligation match the explicit entry and elected-pool fees.</p>}
      {!entry.allocationCurrent && entry.allocationVersion > 0 && <p className="auth-note">The saved allocation no longer matches current facts. Enter and review a new full allocation snapshot; prior versions remain historical.</p>}
      {!workspace.started && workspace.canCorrect && entry.allocationVersion > 0 && <label><input type="checkbox" checked={allocationCorrection} onChange={(event) => setAllocationCorrection(event.target.checked)}/>Record this allocation revision as a director correction</label>}
      <label>Reason for allocation record (required)<input maxLength={500} value={allocationReason} onChange={(event) => setAllocationReason(event.target.value)}/></label>
      <button className="secondary" type="button" disabled={!canSaveAllocation} onClick={submitAllocation}>{workspace.started ? "Save Director Allocation Correction" : "Save Receipt Allocation"}</button>
      {parsedBase !== null && parsedPools.some((pool) => pool.amountMinor === null) && <p role="alert">Enter a valid dollar allocation with up to two decimal places for every row.</p>}
      {allocationTotal !== null && allocationTotal !== BigInt(entry.receivedMinor) && <p role="alert">Base and Q Pool allocations must equal the recorded receipt exactly ({formatUsd(entry.receivedMinor)}).</p>}
    </fieldset>
  </article>;
}
