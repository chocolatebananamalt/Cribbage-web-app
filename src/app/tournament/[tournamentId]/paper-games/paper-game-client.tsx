"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PrivatePaperCardPhoto } from "../../../../components/private-paper-card-photo";
import {
  isAcceptedPaperGameCompletion,
  isAcceptedPaperGameReview,
  isAcceptedPaperOfficialIdentity,
  isBindPaperOfficialIdentityRequest,
  isCompletePaperGameRequest,
  isRejectedPaperGameCompletion,
  isRejectedPaperOfficialIdentity,
  isReviewPaperGameRequest,
  type CompletePaperGameRequest,
  type BindPaperOfficialIdentityRequest,
  type ReviewPaperGameRequest,
} from "../../../../lib/api/paper-game-completion";
import type { PaperGameCandidate, PaperGameReviewCase } from "../../../../lib/paper-games/workspace";

function storageKey(actorId: string, gameId: string) {
  return `paper-game-completion:${actorId}:${gameId}`;
}

function readLocked(key: string): CompletePaperGameRequest | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
    return isCompletePaperGameRequest(value) ? value : null;
  } catch { return null; }
}

function saveLocked(key: string, value: CompletePaperGameRequest) {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

function clearLocked(key: string) {
  try { window.sessionStorage.removeItem(key); } catch { /* Server remains authoritative. */ }
}

async function reconcileOperation(tournamentId: string, operationType: "complete_paper_vs_paper_game_v1" | "review_paper_vs_paper_game_v1" | "bind_paper_official_identity_v1", targetId: string, idempotencyKey: string) {
  const response = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/paper-game-operations/reconciliation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operationType, targetId, idempotencyKey }),
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok || !value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== 1 || !("result" in value)) return undefined;
  return (value as { result: unknown }).result;
}

function SavedOperationReconciler({ actorId, tournamentId }: { actorId: string; tournamentId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      let resolved = 0;
      const entries: Array<{ key: string; operationType: "complete_paper_vs_paper_game_v1" | "review_paper_vs_paper_game_v1" | "bind_paper_official_identity_v1"; targetId: string; idempotencyKey: string; accepted: (value: unknown) => boolean }> = [];
      let storedEntryCount = 0;
      try { storedEntryCount = window.sessionStorage.length; } catch { return; }
      for (let index = 0; index < storedEntryCount; index += 1) {
        const key = window.sessionStorage.key(index);
        if (!key) continue;
        try {
          const saved: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
          if (key.startsWith(`paper-game-completion:${actorId}:`) && isCompletePaperGameRequest(saved)) {
            entries.push({ key, operationType: "complete_paper_vs_paper_game_v1", targetId: saved.completionId, idempotencyKey: saved.idempotencyKey, accepted: (value) => isAcceptedPaperGameCompletion(value, saved) || isRejectedPaperGameCompletion(value, saved.completionId) });
          } else if (key.startsWith(`paper-game-review:${actorId}:`) && isReviewPaperGameRequest(saved)) {
            const completionId = key.slice(`paper-game-review:${actorId}:`.length);
            entries.push({ key, operationType: "review_paper_vs_paper_game_v1", targetId: completionId, idempotencyKey: saved.idempotencyKey, accepted: (value) => isAcceptedPaperGameReview(value, completionId, saved) || isRejectedPaperGameCompletion(value, completionId) });
          } else if (key === identityStorageKey(actorId, tournamentId) && isBindPaperOfficialIdentityRequest(saved)) {
            entries.push({ key, operationType: "bind_paper_official_identity_v1", targetId: saved.bindingId, idempotencyKey: saved.idempotencyKey, accepted: (value) => isAcceptedPaperOfficialIdentity(value, saved, tournamentId) || isRejectedPaperOfficialIdentity(value, saved.bindingId) });
          }
        } catch { /* A malformed local value cannot be reconciled into authority. */ }
      }
      for (const entry of entries) {
        try {
          const result = await reconcileOperation(tournamentId, entry.operationType, entry.targetId, entry.idempotencyKey);
          if (result !== null && entry.accepted(result)) { clearLocked(entry.key); resolved += 1; }
        } catch { /* Keep the exact envelope for a later retry. */ }
      }
      if (!cancelled && resolved > 0) {
        setMessage(`${resolved} saved paper-card operation${resolved === 1 ? " was" : "s were"} reconciled with the tournament record.`);
        router.refresh();
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [actorId, router, tournamentId]);
  return message ? <p className="auth-note" role="status">{message}</p> : null;
}

function PaperGameForm({ actorId, tournamentId, game }: { actorId: string; tournamentId: string; game: PaperGameCandidate }) {
  const router = useRouter();
  const key = storageKey(actorId, game.gameId);
  const [sideAWinner, setSideAWinner] = useState<"a" | "b">("a");
  const [sideBWinner, setSideBWinner] = useState<"a" | "b">("a");
  const [sideAMargin, setSideAMargin] = useState("");
  const [sideBMargin, setSideBMargin] = useState("");
  const [sideAReference, setSideAReference] = useState("");
  const [sideBReference, setSideBReference] = useState("");
  const [locked, setLocked] = useState<CompletePaperGameRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [message, setMessage] = useState("");
  const numericSideAMargin = Number(sideAMargin);
  const numericSideBMargin = Number(sideBMargin);
  const claimsValid = Number.isInteger(numericSideAMargin) && numericSideAMargin >= 1 && numericSideAMargin <= 121
    && Number.isInteger(numericSideBMargin) && numericSideBMargin >= 1 && numericSideBMargin <= 121;
  const reciprocal = claimsValid && sideAWinner === sideBWinner && numericSideAMargin === numericSideBMargin;
  const valid = reciprocal && sideAReference.trim().length > 0 && sideBReference.trim().length > 0
    && sideAReference.trim().toLowerCase() !== sideBReference.trim().toLowerCase();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readLocked(key);
      if (!saved || saved.gameId !== game.gameId || saved.eventId !== game.eventId) { setStorageReady(true); return; }
      void reconcileOperation(tournamentId, "complete_paper_vs_paper_game_v1", saved.completionId, saved.idempotencyKey).then((result) => {
        if (result !== null && (isAcceptedPaperGameCompletion(result, saved) || isRejectedPaperGameCompletion(result, saved.completionId))) {
          clearLocked(key); setMessage("The saved paper-card entry was reconciled with the tournament record."); router.refresh(); return;
        }
        setSideAWinner(saved.sideAClaim.winnerSide); setSideBWinner(saved.sideBClaim.winnerSide);
        setSideAMargin(String(saved.sideAClaim.margin)); setSideBMargin(String(saved.sideBClaim.margin));
        setSideAReference(saved.sideAClaim.evidenceReference); setSideBReference(saved.sideBClaim.evidenceReference);
        setLocked(saved); setMessage("A prior paper-card completion may be unresolved. Retry sends the exact same protected request.");
      }).catch(() => {
        setSideAWinner(saved.sideAClaim.winnerSide); setSideBWinner(saved.sideBClaim.winnerSide);
        setSideAMargin(String(saved.sideAClaim.margin)); setSideBMargin(String(saved.sideBClaim.margin));
        setSideAReference(saved.sideAClaim.evidenceReference); setSideBReference(saved.sideBClaim.evidenceReference);
        setLocked(saved); setMessage("A prior paper-card completion may be unresolved. Retry sends the exact same protected request.");
      }).finally(() => setStorageReady(true));
    });
    return () => window.clearTimeout(timer);
  }, [game.eventId, game.gameId, key, router, tournamentId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storageReady || !valid || busy) return;
    const envelope = locked ?? {
      completionId: crypto.randomUUID(), eventId: game.eventId, gameId: game.gameId,
      expectedGameVersion: game.gameVersion,
      sideAClaim: { winnerSide: sideAWinner, margin: numericSideAMargin, evidenceReference: sideAReference.trim() },
      sideBClaim: { winnerSide: sideBWinner, margin: numericSideBMargin, evidenceReference: sideBReference.trim() },
      idempotencyKey: crypto.randomUUID(),
    } satisfies CompletePaperGameRequest;
    if (!locked && !saveLocked(key, envelope)) {
      setMessage("This browser cannot safely retain the request. Enable session storage before continuing.");
      return;
    }
    setLocked(envelope); setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/paper-game-completions`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope),
      });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedPaperGameCompletion(result, envelope)) {
        clearLocked(key); setLocked(null);
        setMessage("Both paper scorecards were recorded. A second official must independently confirm them before the result counts.");
        router.refresh(); return;
      }
      if (response.status === 409 && isRejectedPaperGameCompletion(result, envelope.completionId)) {
        clearLocked(key); setLocked(null);
        setMessage("The tournament server rejected this completion. Refresh the game list before trying again.");
        router.refresh(); return;
      }
      setMessage("The result is uncertain. Retry the same locked request; do not enter it again.");
    } catch {
      setMessage("Connection problem. Retry the same locked request; do not enter it again.");
    } finally { setBusy(false); }
  }

  const winnerName = sideAWinner === "a" ? game.sideA.displayName : game.sideB.displayName;
  const gamePoints = numericSideAMargin >= 31 ? 3 : 2;
  return <li className="correction-item">
    <p><strong>{game.eventName}</strong> · Game {game.gameNumber}</p>
    <p>{game.sideA.displayName} · ID # {game.sideA.verificationId}<br />{game.sideB.displayName} · ID # {game.sideB.verificationId}</p>
    <form onSubmit={submit}>
      <fieldset disabled={!storageReady || busy || !!locked}><legend>{game.sideA.displayName}&apos;s paper card</legend>
        <PrivatePaperCardPhoto tournamentId={tournamentId} gameId={game.gameId} cardSide="a" verificationId={game.sideA.verificationId} inputId={`${game.gameId}-a-photo`} label={game.sideA.displayName} disabled={!storageReady || busy || !!locked} />
        <label><input type="radio" name={`${game.gameId}-a-winner`} checked={sideAWinner === "a"} onChange={() => setSideAWinner("a")} /> {game.sideA.displayName} won</label>
        <label><input type="radio" name={`${game.gameId}-a-winner`} checked={sideAWinner === "b"} onChange={() => setSideAWinner("b")} /> {game.sideB.displayName} won</label>
        <label htmlFor={`${game.gameId}-a-margin`}>Spread Points</label>
        <input id={`${game.gameId}-a-margin`} inputMode="numeric" pattern="[0-9]*" maxLength={3} value={sideAMargin} onChange={(event) => setSideAMargin(event.target.value.replace(/\D/g, "").slice(0, 3))} />
      </fieldset>
      <fieldset disabled={!storageReady || busy || !!locked}><legend>{game.sideB.displayName}&apos;s paper card</legend>
        <PrivatePaperCardPhoto tournamentId={tournamentId} gameId={game.gameId} cardSide="b" verificationId={game.sideB.verificationId} inputId={`${game.gameId}-b-photo`} label={game.sideB.displayName} disabled={!storageReady || busy || !!locked} />
        <label><input type="radio" name={`${game.gameId}-b-winner`} checked={sideBWinner === "a"} onChange={() => setSideBWinner("a")} /> {game.sideA.displayName} won</label>
        <label><input type="radio" name={`${game.gameId}-b-winner`} checked={sideBWinner === "b"} onChange={() => setSideBWinner("b")} /> {game.sideB.displayName} won</label>
        <label htmlFor={`${game.gameId}-b-margin`}>Spread Points</label>
        <input id={`${game.gameId}-b-margin`} inputMode="numeric" pattern="[0-9]*" maxLength={3} value={sideBMargin} onChange={(event) => setSideBMargin(event.target.value.replace(/\D/g, "").slice(0, 3))} />
      </fieldset>
      <label htmlFor={`${game.gameId}-a-reference`}>{game.sideA.displayName}&apos;s paper-card reference</label>
      <input id={`${game.gameId}-a-reference`} value={sideAReference} maxLength={200} disabled={busy || !!locked} onChange={(event) => setSideAReference(event.target.value)} placeholder={`Example: card ${game.sideA.verificationId}`} />
      <label htmlFor={`${game.gameId}-b-reference`}>{game.sideB.displayName}&apos;s paper-card reference</label>
      <input id={`${game.gameId}-b-reference`} value={sideBReference} maxLength={200} disabled={busy || !!locked} onChange={(event) => setSideBReference(event.target.value)} placeholder={`Example: card ${game.sideB.verificationId}`} />
      {valid ? <p className="auth-note">Review: {winnerName} won by {numericSideAMargin}. Winner: {gamePoints} game points, +{numericSideAMargin}. Opponent: 0 game points, −{numericSideAMargin}.</p> : claimsValid && !reciprocal ? <p className="error-text" role="alert">The two paper cards do not match. Do not complete this game; send it for review.</p> : <p className="auth-note">Enter each original paper card separately, using two different card references and a possible spread point number.</p>}
      <label className="publication-confirmation"><input type="checkbox" required disabled={busy || !!locked} /> I compared both original paper scorecards and they show this same result.</label>
      <button className="primary full" type="submit" disabled={!storageReady || !valid || busy}>{!storageReady ? "Checking prior request…" : busy ? "Recording paper cards…" : locked ? "Retry locked request" : "Record for independent confirmation"}</button>
    </form>
    {message ? <p className="error-text" role="status">{message}</p> : null}
  </li>;
}

function reviewStorageKey(actorId: string, completionId: string) { return `paper-game-review:${actorId}:${completionId}`; }

function ReviewForm({ actorId, tournamentId, item }: { actorId: string; tournamentId: string; item: PaperGameReviewCase }) {
  const router = useRouter();
  const key = reviewStorageKey(actorId, item.completionId);
  const [sideAWinner, setSideAWinner] = useState<"a" | "b">("a");
  const [sideBWinner, setSideBWinner] = useState<"a" | "b">("a");
  const [sideAMargin, setSideAMargin] = useState("");
  const [sideBMargin, setSideBMargin] = useState("");
  const [sideAReference, setSideAReference] = useState("");
  const [sideBReference, setSideBReference] = useState("");
  const [locked, setLocked] = useState<ReviewPaperGameRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [message, setMessage] = useState("");
  const aMargin = Number(sideAMargin); const bMargin = Number(sideBMargin);
  const entered = Number.isInteger(aMargin) && aMargin >= 1 && aMargin <= 121
    && Number.isInteger(bMargin) && bMargin >= 1 && bMargin <= 121
    && sideAReference.trim().length > 0 && sideBReference.trim().length > 0
    && sideAReference.trim().toLowerCase() !== sideBReference.trim().toLowerCase();
  const exactCandidate = entered && aMargin === bMargin && sideAWinner === sideBWinner;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
        if (!isReviewPaperGameRequest(saved)) { setStorageReady(true); return; }
        void reconcileOperation(tournamentId, "review_paper_vs_paper_game_v1", item.completionId, saved.idempotencyKey).then((result) => {
          if (result !== null && (isAcceptedPaperGameReview(result, item.completionId, saved) || isRejectedPaperGameCompletion(result, item.completionId))) {
            clearLocked(key); setMessage("The saved paper-card confirmation was reconciled with the tournament record."); router.refresh(); return;
          }
          setLocked(saved); setSideAWinner(saved.sideAClaim.winnerSide); setSideBWinner(saved.sideBClaim.winnerSide);
          setSideAMargin(String(saved.sideAClaim.margin)); setSideBMargin(String(saved.sideBClaim.margin));
          setSideAReference(saved.sideAClaim.evidenceReference); setSideBReference(saved.sideBClaim.evidenceReference);
          setMessage("A prior confirmation may be unresolved. Retry sends the exact same protected decision.");
        }).catch(() => {
          setLocked(saved); setSideAWinner(saved.sideAClaim.winnerSide); setSideBWinner(saved.sideBClaim.winnerSide);
          setSideAMargin(String(saved.sideAClaim.margin)); setSideBMargin(String(saved.sideBClaim.margin));
          setSideAReference(saved.sideAClaim.evidenceReference); setSideBReference(saved.sideBClaim.evidenceReference);
          setMessage("A prior confirmation may be unresolved. Retry sends the exact same protected decision.");
        })
          .finally(() => setStorageReady(true));
      } catch { setStorageReady(true); /* A corrupt local retry cannot become server authority. */ }
    });
    return () => window.clearTimeout(timer);
  }, [item.completionId, key, router, tournamentId]);
  async function decide(decision: "approve" | "reject") {
    if (!storageReady || !entered || (decision === "approve" && !exactCandidate) || busy || (locked && locked.decision !== decision)) return;
    const request = locked ?? { decision, expectedGameVersion: item.gameVersion,
      sideAClaim: { winnerSide: sideAWinner, margin: aMargin, evidenceReference: sideAReference.trim() },
      sideBClaim: { winnerSide: sideBWinner, margin: bMargin, evidenceReference: sideBReference.trim() },
      idempotencyKey: crypto.randomUUID() } satisfies ReviewPaperGameRequest;
    if (!locked) { try { window.sessionStorage.setItem(key, JSON.stringify(request)); } catch { setMessage("This browser cannot safely retain the request. Enable session storage before continuing."); return; } }
    setLocked(request); setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/v1/paper-game-completions/${encodeURIComponent(item.completionId)}/reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedPaperGameReview(result, item.completionId, request)) {
        clearLocked(key); setLocked(null); setMessage(decision === "approve" ? "Independent confirmation accepted. The result now counts." : "Paper-card entry rejected. It did not affect scorecards or standings."); router.refresh(); return;
      }
      if (response.status === 409 && isRejectedPaperGameCompletion(result, item.completionId)) {
        clearLocked(key); setLocked(null);
        setMessage((result as { code: string }).code === "first_official_identity_changed"
          ? "The first official’s identity changed after entry. Approval is blocked; re-enter the cards and choose Reject / investigate to close this stale case."
          : "The server rejected this review. Refresh before trying again.");
        router.refresh(); return;
      }
      setMessage("The review is uncertain. Retry the same locked decision.");
    } catch { setMessage("Connection problem. Retry the same locked decision."); }
    finally { setBusy(false); }
  }
  return <li className="correction-item"><p><strong>{item.eventName}</strong> · Game {item.gameNumber}</p><p>{item.sideA.displayName} · ID # {item.sideA.verificationId}<br />{item.sideB.displayName} · ID # {item.sideB.verificationId}</p>
    <p className="auth-note">Independently read both original cards. The first official&apos;s entries are intentionally hidden.</p>
    <fieldset disabled={!storageReady || busy || !!locked}><legend>{item.sideA.displayName}&apos;s paper card</legend><PrivatePaperCardPhoto tournamentId={tournamentId} gameId={item.gameId} cardSide="a" verificationId={item.sideA.verificationId} inputId={`${item.completionId}-review-a-photo`} label={item.sideA.displayName} disabled={!storageReady || busy || !!locked} /><label><input type="radio" name={`${item.completionId}-review-a`} checked={sideAWinner === "a"} onChange={() => setSideAWinner("a")} /> {item.sideA.displayName} won</label><label><input type="radio" name={`${item.completionId}-review-a`} checked={sideAWinner === "b"} onChange={() => setSideAWinner("b")} /> {item.sideB.displayName} won</label><label>Spread Points<input inputMode="numeric" pattern="[0-9]*" maxLength={3} value={sideAMargin} onChange={(event) => setSideAMargin(event.target.value.replace(/\D/g, "").slice(0, 3))} /></label><label>Paper-card reference<input maxLength={200} value={sideAReference} onChange={(event) => setSideAReference(event.target.value)} /></label></fieldset>
    <fieldset disabled={!storageReady || busy || !!locked}><legend>{item.sideB.displayName}&apos;s paper card</legend><PrivatePaperCardPhoto tournamentId={tournamentId} gameId={item.gameId} cardSide="b" verificationId={item.sideB.verificationId} inputId={`${item.completionId}-review-b-photo`} label={item.sideB.displayName} disabled={!storageReady || busy || !!locked} /><label><input type="radio" name={`${item.completionId}-review-b`} checked={sideBWinner === "a"} onChange={() => setSideBWinner("a")} /> {item.sideA.displayName} won</label><label><input type="radio" name={`${item.completionId}-review-b`} checked={sideBWinner === "b"} onChange={() => setSideBWinner("b")} /> {item.sideB.displayName} won</label><label>Spread Points<input inputMode="numeric" pattern="[0-9]*" maxLength={3} value={sideBMargin} onChange={(event) => setSideBMargin(event.target.value.replace(/\D/g, "").slice(0, 3))} /></label><label>Paper-card reference<input maxLength={200} value={sideBReference} onChange={(event) => setSideBReference(event.target.value)} /></label></fieldset>
    {!entered ? <p className="auth-note">Enter both card results and two different paper-card references.</p> : entered && !exactCandidate ? <p className="error-text" role="alert">The cards you entered do not match. Approval is blocked; reject this entry for investigation.</p> : null}<div className="correction-actions"><button type="button" className="primary" disabled={!storageReady || !exactCandidate || busy || (!!locked && locked.decision !== "approve")} onClick={() => decide("approve")}>{busy && locked?.decision === "approve" ? "Confirming…" : "Confirm exact match"}</button><button type="button" className="secondary" disabled={!storageReady || !entered || busy || (!!locked && locked.decision !== "reject")} onClick={() => decide("reject")}>{busy && locked?.decision === "reject" ? "Rejecting…" : "Reject / investigate"}</button></div>{message ? <p className="error-text" role="status">{message}</p> : null}</li>;
}

function identityStorageKey(actorId: string, tournamentId: string) { return `paper-official-identity:${actorId}:${tournamentId}`; }

function IdentityBinding({ actorId, tournamentId, officials, roster }: { actorId: string; tournamentId: string; officials: { profileId: string; displayName: string; role: string; bindingVersion: number }[]; roster: { rosterEntryId: string; displayName: string }[] }) {
  const router = useRouter();
  const key = identityStorageKey(actorId, tournamentId);
  const [official, setOfficial] = useState(officials[0]?.profileId ?? "");
  const [choice, setChoice] = useState("nonparticipant");
  const [locked, setLocked] = useState<BindPaperOfficialIdentityRequest | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const value: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
        if (!isBindPaperOfficialIdentityRequest(value)) { setStorageReady(true); return; }
        void reconcileOperation(tournamentId, "bind_paper_official_identity_v1", value.bindingId, value.idempotencyKey).then((result) => {
          if (result !== null && (isAcceptedPaperOfficialIdentity(result, value, tournamentId) || isRejectedPaperOfficialIdentity(result, value.bindingId))) {
            clearLocked(key); setMessage("The saved identity confirmation was reconciled with the tournament record."); router.refresh(); return;
          }
          setLocked(value); setOfficial(value.officialProfileId);
          setChoice(value.bindingKind === "nonparticipant" ? "nonparticipant" : value.rosterEntryId ?? "nonparticipant");
          setMessage("A prior identity update may be unresolved. Retry sends the exact same protected request.");
        }).catch(() => {
          setLocked(value); setOfficial(value.officialProfileId);
          setChoice(value.bindingKind === "nonparticipant" ? "nonparticipant" : value.rosterEntryId ?? "nonparticipant");
          setMessage("A prior identity update may be unresolved. Retry sends the exact same protected request.");
        })
          .finally(() => setStorageReady(true));
      } catch { setStorageReady(true); /* No recoverable request. */ }
    });
    return () => window.clearTimeout(timer);
  }, [key, router, tournamentId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!storageReady || !official || busy) return;
    const request = locked ?? { bindingId: crypto.randomUUID(), officialProfileId: official, bindingKind: choice === "nonparticipant" ? "nonparticipant" : "roster_entry", rosterEntryId: choice === "nonparticipant" ? null : choice, expectedBindingVersion: officials.find((item) => item.profileId === official)?.bindingVersion ?? -1, idempotencyKey: crypto.randomUUID() } satisfies BindPaperOfficialIdentityRequest;
    if (!isBindPaperOfficialIdentityRequest(request)) return;
    if (!locked) {
      try { window.sessionStorage.setItem(key, JSON.stringify(request)); }
      catch { setMessage("This browser cannot safely retain the request. Enable session storage before continuing."); return; }
      setLocked(request);
    }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/paper-official-identities`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedPaperOfficialIdentity(result, request, tournamentId)) { clearLocked(key); setLocked(null); setMessage("Official identity confirmed."); router.refresh(); return; }
      if (response.status === 409 && isRejectedPaperOfficialIdentity(result, request.bindingId)) { clearLocked(key); setLocked(null); setMessage("The server rejected this identity confirmation. Refresh before retrying."); router.refresh(); return; }
      setMessage("Identity confirmation is uncertain. Retry the same locked request.");
    } catch { setMessage("Connection problem. Retry the same locked request."); }
    finally { setBusy(false); }
  }
  return officials.length ? <form onSubmit={submit}><h2>Confirm or correct official identity</h2><p className="auth-note">Confirm another official as a nonparticipant or bind them to their roster entry. A correction preserves the prior version. You cannot confirm yourself.</p><label>Official<select value={official} disabled={!storageReady || busy || !!locked} onChange={(event) => setOfficial(event.target.value)}>{officials.map((item) => <option key={item.profileId} value={item.profileId}>{item.displayName} ({item.role}) · version {item.bindingVersion}</option>)}</select></label><label>Identity<select value={choice} disabled={!storageReady || busy || !!locked} onChange={(event) => setChoice(event.target.value)}><option value="nonparticipant">Not a tournament participant</option>{roster.map((item) => <option key={item.rosterEntryId} value={item.rosterEntryId}>Roster: {item.displayName}</option>)}</select></label><button className="primary" disabled={!storageReady || busy}>{!storageReady ? "Checking prior request…" : busy ? "Confirming…" : locked ? "Retry locked request" : "Confirm identity"}</button>{message ? <p role="status">{message}</p> : null}</form> : null;
}

export default function PaperGameClient({ actorId, tournamentId, actorRole, actorIdentityConfirmed, unboundOfficials, rosterChoices, candidates, reviewCases }: { actorId: string; tournamentId: string; actorRole: "director" | "co_director" | "cross_checker"; actorIdentityConfirmed: boolean; unboundOfficials: { profileId: string; displayName: string; role: "director" | "co_director" | "cross_checker"; bindingVersion: number }[]; rosterChoices: { rosterEntryId: string; displayName: string }[]; candidates: PaperGameCandidate[]; reviewCases: PaperGameReviewCase[] }) {
  return <><SavedOperationReconciler actorId={actorId} tournamentId={tournamentId} />{actorRole !== "cross_checker" ? <IdentityBinding actorId={actorId} tournamentId={tournamentId} officials={unboundOfficials} roster={rosterChoices} /> : null}{!actorIdentityConfirmed ? <p className="error-text" role="status">Another director or co-director must confirm your official identity before you can record or review paper games.</p> : null}{actorRole === "cross_checker" && actorIdentityConfirmed ? <><h2>Record both paper cards</h2>{candidates.length ? <ul className="correction-list">{candidates.map((game) => <PaperGameForm key={game.gameId} actorId={actorId} tournamentId={tournamentId} game={game} />)}</ul> : <p className="auth-note">No unresolved scheduled games are available for paper-card entry.</p>}</> : null}<h2>Independent confirmations</h2>{actorIdentityConfirmed && reviewCases.length ? <ul className="correction-list">{reviewCases.map((item) => <ReviewForm key={item.completionId} actorId={actorId} tournamentId={tournamentId} item={item} />)}</ul> : <p className="auth-note">No paper-card confirmations are waiting for you.</p>}</>;
}
