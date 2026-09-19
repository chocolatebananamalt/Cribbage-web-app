"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DeviceRecoveryWorkspace, RecoveryCandidate, RecoveryReviewCase } from "../../../../lib/recovery/device-failure-workspace";
import { isUuid } from "../../../../lib/api/validation";

type Notice = { kind: "error" | "success"; text: string } | null;
type EvidenceSource = "opponent_device" | "paper_card";
type ProposalEnvelope = { kind: "proposal"; recoveryId: string; idempotencyKey: string; winnerSide: "a" | "b"; margin: number; sourceType: EvidenceSource; sourceReference: string };
type ReviewEnvelope = { kind: "review"; decision: "approve" | "reject"; idempotencyKey: string };

function readEnvelope<T>(key: string, kind: "proposal" | "review"): T | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    const validReview = kind === "review" && Object.keys(item).length === 3
      && item.kind === "review" && (item.decision === "approve" || item.decision === "reject")
      && isUuid(item.idempotencyKey);
    const validProposal = kind === "proposal" && Object.keys(item).length === 7
      && item.kind === "proposal" && isUuid(item.recoveryId) && isUuid(item.idempotencyKey)
      && (item.winnerSide === "a" || item.winnerSide === "b")
      && Number.isInteger(item.margin) && Number(item.margin) >= 1 && Number(item.margin) <= 121
      && (item.sourceType === "opponent_device" || item.sourceType === "paper_card")
      && typeof item.sourceReference === "string" && item.sourceReference.length > 0 && item.sourceReference.length <= 200;
    return validReview || validProposal ? value as T : null;
  } catch { return null; }
}
function saveEnvelope(key: string, value: ProposalEnvelope | ReviewEnvelope) {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function clearEnvelope(key: string) { try { window.sessionStorage.removeItem(key); } catch { /* Server state remains authoritative. */ } }

function sideName(side: "a" | "b", item: { sideA: { displayName: string }; sideB: { displayName: string } }) {
  return side === "a" ? item.sideA.displayName : item.sideB.displayName;
}

function Proposal({ actorId, tournamentId, item }: { actorId: string; tournamentId: string; item: RecoveryCandidate }) {
  const router = useRouter();
  const claim = item.survivingClaims[0];
  const [winnerSide, setWinnerSide] = useState<"a" | "b">(claim?.winnerSide ?? "a");
  const [margin, setMargin] = useState(String(claim?.margin ?? ""));
  const [sourceType, setSourceType] = useState<EvidenceSource>(claim?.sourceType ?? "opponent_device");
  const [sourceReference, setSourceReference] = useState(claim?.sourceReference ?? "");
  const storageKey = `device-recovery:proposal:${actorId}:${item.gameId}`;
  const [locked, setLocked] = useState<ProposalEnvelope | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const numericMargin = Number(margin);
  const valid = Number.isInteger(numericMargin) && numericMargin >= 1 && numericMargin <= 121 && sourceReference.trim().length > 0;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readEnvelope<ProposalEnvelope>(storageKey, "proposal");
      if (!saved) return;
      setWinnerSide(saved.winnerSide); setMargin(String(saved.margin)); setSourceType(saved.sourceType);
      setSourceReference(saved.sourceReference); setLocked(saved);
      setNotice({ kind: "error", text: "A prior recovery request may be unresolved. Retry sends the exact same protected request." });
    });
    return () => window.clearTimeout(timer);
  }, [storageKey]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || busy) return;
    const envelope = locked ?? { kind: "proposal" as const, recoveryId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), winnerSide, margin: numericMargin, sourceType, sourceReference: sourceReference.trim() };
    if (!locked && !saveEnvelope(storageKey, envelope)) { setNotice({ kind: "error", text: "This browser cannot safely retain the recovery request. Enable session storage before continuing." }); return; }
    setLocked(envelope); setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/device-recoveries`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ recoveryId: envelope.recoveryId, idempotencyKey: envelope.idempotencyKey,
          gameId: item.gameId, winnerSide: envelope.winnerSide, margin: envelope.margin,
          evidence: [{ sourceType: envelope.sourceType, sourceReference: envelope.sourceReference, winnerSide: envelope.winnerSide, margin: envelope.margin }] }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status < 500) { clearEnvelope(storageKey); setLocked(null); }
        setNotice({ kind: "error", text: response.status >= 500 ? "Connection problem. Retry this locked recovery request." : "The tournament server rejected this recovery. Refresh the list before trying again." });
        return;
      }
      const status = payload && typeof payload === "object" ? (payload as Record<string, unknown>).status : null;
      if (status !== "pending_review" && status !== "disputed") {
        setNotice({ kind: "error", text: "The server response was incomplete. Retry this locked recovery request." });
        return;
      }
      clearEnvelope(storageKey); setLocked(null);
      setNotice({ kind: "success", text: status === "pending_review" ? "Evidence recorded. A different eligible official must approve it." : "Conflicting evidence was preserved as disputed and cannot affect totals." });
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "Connection problem. Retry this locked recovery request." });
    } finally { setBusy(false); }
  }
  const formId = `recovery-${item.gameId}`;
  return <li className="correction-item">
    <p><strong>{item.eventName}</strong> · Game {item.roundNumber} · {item.sideA.displayName} / {item.sideB.displayName}</p>
    <p className="auth-note">Server state: {item.gameState.replaceAll("_", " ")}. No recovered result is authoritative yet.</p>
    <form onSubmit={submit}>
      <fieldset disabled={busy || !!locked}><legend>Recovered winner</legend>
        <label><input type="radio" name={`${formId}-winner`} checked={winnerSide === "a"} onChange={() => setWinnerSide("a")} /> {item.sideA.displayName}</label>
        <label><input type="radio" name={`${formId}-winner`} checked={winnerSide === "b"} onChange={() => setWinnerSide("b")} /> {item.sideB.displayName}</label>
      </fieldset>
      <label htmlFor={`${formId}-margin`}>Spread Points</label>
      <input id={`${formId}-margin`} inputMode="numeric" pattern="[0-9]*" maxLength={3} value={margin} disabled={busy || !!locked} onChange={(event) => setMargin(event.target.value.replace(/\D/g, "").slice(0, 3))} />
      <label htmlFor={`${formId}-source`}>Surviving evidence</label>
      <select id={`${formId}-source`} value={sourceType} disabled={busy || !!locked} onChange={(event) => setSourceType(event.target.value as EvidenceSource)}><option value="opponent_device">Opponent device</option><option value="paper_card">Paper card</option></select>
      <label htmlFor={`${formId}-reference`}>Evidence reference</label>
      <input id={`${formId}-reference`} value={sourceReference} maxLength={200} disabled={busy || !!locked} onChange={(event) => setSourceReference(event.target.value)} placeholder="Example: opponent receipt or paper card ID" />
      <button type="submit" className="primary full" disabled={!valid || busy}>{busy ? "Recording evidence…" : locked ? "Retry locked request" : "Record for independent review"}</button>
    </form>
    {notice ? <p className={notice.kind === "error" ? "error-text" : "success-text"} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null}
  </li>;
}

function Review({ actorId, item }: { actorId: string; item: RecoveryReviewCase }) {
  const router = useRouter();
  const storageKey = `device-recovery:review:${actorId}:${item.recoveryId}`;
  const [locked, setLocked] = useState<ReviewEnvelope | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readEnvelope<ReviewEnvelope>(storageKey, "review");
      if (!saved) return;
      setLocked(saved);
      setNotice({ kind: "error", text: "A prior review may be unresolved. Retry sends the exact same protected decision." });
    });
    return () => window.clearTimeout(timer);
  }, [storageKey]);
  async function decide(decision: "approve" | "reject") {
    if (busy || (locked && locked.decision !== decision)) return;
    const envelope = locked ?? { kind: "review" as const, decision, idempotencyKey: crypto.randomUUID() };
    if (!locked && !saveEnvelope(storageKey, envelope)) { setNotice({ kind: "error", text: "This browser cannot safely retain the review decision. Enable session storage before continuing." }); return; }
    setLocked(envelope); setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/v1/device-recoveries/${encodeURIComponent(item.recoveryId)}/reviews`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: envelope.decision, idempotencyKey: envelope.idempotencyKey }),
      });
      if (!response.ok) {
        if (response.status < 500) { clearEnvelope(storageKey); setLocked(null); }
        setNotice({ kind: "error", text: response.status >= 500 ? "Connection problem. Retry this locked decision." : "The server rejected this decision. Refresh the recovery list." });
        return;
      }
      clearEnvelope(storageKey); setLocked(null);
      setNotice({ kind: "success", text: decision === "approve" ? "Recovery approved. Scorecards and preliminary standings now include it." : "Recovery rejected. It did not change any totals." });
      router.refresh();
    } catch { setNotice({ kind: "error", text: "Connection problem. Retry this locked decision." }); }
    finally { setBusy(false); }
  }
  return <li className="correction-item">
    <p><strong>{item.eventName}</strong> · Game {item.roundNumber} · {item.sideA.displayName} / {item.sideB.displayName}</p>
    <p>Proposed: {sideName(item.winnerSide, item)} won by {item.margin}.</p>
    <ul>{item.evidence.map((evidence) => <li key={`${evidence.sourceType}:${evidence.sourceReference}`}><strong>{evidence.sourceType === "opponent_device" ? "Opponent device" : "Paper card"}</strong> · {evidence.sourceReference} · {sideName(evidence.winnerSide, item)} won by {evidence.margin}</li>)}</ul>
    {item.state === "disputed" ? <p className="error-text" role="status">The recorded evidence conflicts. Approval is blocked; reject this case and investigate the source records.</p> : null}
    <div className="correction-actions"><button type="button" className="primary" disabled={busy || item.state === "disputed" || (!!locked && locked.decision !== "approve")} onClick={() => decide("approve")}>{busy && locked?.decision === "approve" ? "Approving…" : "Approve recovery"}</button><button type="button" className="secondary" disabled={busy || (!!locked && locked.decision !== "reject")} onClick={() => decide("reject")}>{busy && locked?.decision === "reject" ? "Rejecting…" : "Reject recovery"}</button></div>
    {notice ? <p className={notice.kind === "error" ? "error-text" : "success-text"} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null}
  </li>;
}

export default function RecoveryClient({ actorId, tournamentId, actorRole, proposalCandidates, reviewCases }: Pick<DeviceRecoveryWorkspace, "actorRole" | "proposalCandidates" | "reviewCases"> & { actorId: string; tournamentId: string }) {
  return <>
    {/* Proposing a recovery is a cross-checker action. A director opening this
        page from the hub used to get the explanation of what recovery is and
        then nothing at all, which reads as a broken screen rather than as a
        role they do not hold. Say which role does it. */}
    {actorRole === "cross_checker" ? null : <p className="auth-note">Only an assigned cross-checker can start a recovery. Your role can review one after a cross-checker proposes it. Assign a cross-checker on the Cross-Checkers screen if nobody holds that role yet.</p>}
    {actorRole === "cross_checker" ? <><h2>Games eligible for evidence recovery</h2>{proposalCandidates.length ? <ul className="correction-list">{proposalCandidates.map((item) => <Proposal key={item.gameId} actorId={actorId} tournamentId={tournamentId} item={item} />)}</ul> : <p className="auth-note">No unresolved non-self games are available for recovery.</p>}</> : null}
    <h2>Independent recovery reviews</h2>
    {reviewCases.length ? <ul className="correction-list">{reviewCases.map((item) => <Review key={item.recoveryId} actorId={actorId} item={item} />)}</ul> : <p className="auth-note">No recovery reviews are waiting for you.</p>}
  </>;
}
