"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PrivatePaperCardPhoto } from "../../../../components/private-paper-card-photo";
import { isAcceptedHybridCreate, isAcceptedHybridReview, isCreateHybridCaseRequest, isRejectedHybrid, isReviewHybridCaseRequest, type CreateHybridCaseRequest, type ReviewHybridCaseRequest } from "../../../../lib/api/hybrid-game";
import type { HybridGameItem } from "../../../../lib/hybrid-games/workspace";

const createKey = (actor: string, game: string) => "hybrid-game-create:" + actor + ":" + game;
const reviewKey = (actor: string, id: string) => "hybrid-game-review:" + actor + ":" + id;
function save(key: string, value: unknown) { try { sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function clear(key: string) { try { sessionStorage.removeItem(key); } catch { /* Server receipt remains authoritative. */ } }
async function reconcile(tournamentId: string, operationType: "create_hybrid_digital_paper_case_v1" | "review_hybrid_digital_paper_case_v1", targetId: string, idempotencyKey: string) {
  const response = await fetch("/api/v1/tournaments/" + encodeURIComponent(tournamentId) + "/hybrid-game-operations/reconciliation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationType, targetId, idempotencyKey }) });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok || !value || typeof value !== "object" || Array.isArray(value) || !("result" in value)) return undefined;
  return (value as { result: unknown }).result;
}

function SavedHybridReconciler({ actorId, tournamentId }: { actorId: string; tournamentId: string }) {
  const router = useRouter(); const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => { void (async () => {
      const entries: Array<{ key: string; type: "create_hybrid_digital_paper_case_v1" | "review_hybrid_digital_paper_case_v1"; target: string; operation: string; request: CreateHybridCaseRequest | ReviewHybridCaseRequest }> = [];
      let length = 0; try { length = sessionStorage.length; } catch { return; }
      for (let index = 0; index < length; index += 1) {
        const key = sessionStorage.key(index); if (!key) continue;
        try {
          const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
          if (key.startsWith("hybrid-game-create:" + actorId + ":") && isCreateHybridCaseRequest(value)) entries.push({ key, type: "create_hybrid_digital_paper_case_v1", target: value.caseId, operation: value.idempotencyKey, request: value });
          else if (key.startsWith("hybrid-game-review:" + actorId + ":") && isReviewHybridCaseRequest(value)) entries.push({ key, type: "review_hybrid_digital_paper_case_v1", target: key.slice(("hybrid-game-review:" + actorId + ":").length), operation: value.idempotencyKey, request: value });
        } catch { /* Malformed browser data cannot become authority. */ }
      }
      let resolved = 0;
      for (const entry of entries) try {
        const result = await reconcile(tournamentId, entry.type, entry.target, entry.operation);
        const recognized = entry.type === "create_hybrid_digital_paper_case_v1"
          ? isAcceptedHybridCreate(result, entry.request as CreateHybridCaseRequest) || isRejectedHybrid(result, entry.target)
          : isAcceptedHybridReview(result, entry.target, entry.request as ReviewHybridCaseRequest) || isRejectedHybrid(result, entry.target);
        if (result !== null && recognized) { clear(entry.key); resolved += 1; }
      } catch { /* Keep exact envelope for a later refresh. */ }
      if (!cancelled && resolved) { setMessage(String(resolved) + " saved mixed-card operation" + (resolved === 1 ? " was" : "s were") + " reconciled."); router.refresh(); }
    })(); });
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [actorId, router, tournamentId]);
  return message ? <p className="auth-note" role="status">{message}</p> : null;
}

function ClaimFields({ item, tournamentId, winner, setWinner, margin, setMargin, reference, setReference, disabled, photoInputId }: { item: HybridGameItem; tournamentId: string; winner: "a" | "b"; setWinner: (v: "a" | "b") => void; margin: string; setMargin: (v: string) => void; reference: string; setReference: (v: string) => void; disabled: boolean; photoInputId: string }) {
  const sideA = item.digitalSide === "a" ? item.digitalPlayerName : item.paperPlayerName;
  const sideB = item.digitalSide === "b" ? item.digitalPlayerName : item.paperPlayerName;
  return <fieldset disabled={disabled}><legend>{item.paperPlayerName}&apos;s paper card</legend>
    <PrivatePaperCardPhoto tournamentId={tournamentId} gameId={item.gameId} cardSide={item.digitalSide === "a" ? "b" : "a"} verificationId={item.paperVerificationId} inputId={photoInputId} label={item.paperPlayerName} disabled={disabled} />
    <label><input type="radio" checked={winner === "a"} onChange={() => setWinner("a")} />{sideA} won</label>
    <label><input type="radio" checked={winner === "b"} onChange={() => setWinner("b")} />{sideB} won</label>
    <label>Spread Points<input inputMode="numeric" pattern="[0-9]*" maxLength={3} value={margin} onChange={(event) => setMargin(event.target.value.replace(/\D/g, "").slice(0, 3))} /></label>
    <label>Paper-card reference<input maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} placeholder={"Example: card " + item.paperVerificationId} /></label>
  </fieldset>;
}

function CreateForm({ actorId, tournamentId, item }: { actorId: string; tournamentId: string; item: HybridGameItem }) {
  const router = useRouter(); const key = createKey(actorId, item.gameId);
  const [winner, setWinner] = useState<"a" | "b">(item.digitalWinnerSide); const [margin, setMargin] = useState(String(item.digitalMargin)); const [reference, setReference] = useState("");
  const [locked, setLocked] = useState<CreateHybridCaseRequest | null>(null); const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const valid = Number.isInteger(Number(margin)) && Number(margin) >= 1 && Number(margin) <= 121 && reference.trim().length > 0;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let saved: unknown = null; try { saved = JSON.parse(sessionStorage.getItem(key) ?? "null"); } catch { /* none */ }
      if (!isCreateHybridCaseRequest(saved)) { setReady(true); return; }
      void reconcile(tournamentId, "create_hybrid_digital_paper_case_v1", saved.caseId, saved.idempotencyKey).then((result) => {
        if (result !== null && (isAcceptedHybridCreate(result, saved) || isRejectedHybrid(result, saved.caseId))) { clear(key); router.refresh(); return; }
        setLocked(saved); setWinner(saved.paperClaim.winnerSide); setMargin(String(saved.paperClaim.margin)); setReference(saved.paperClaim.evidenceReference); setMessage("A saved request may be unresolved. Retry sends the exact same entry.");
      }).catch(() => { setLocked(saved); setMessage("A saved request may be unresolved. Retry sends the exact same entry."); }).finally(() => setReady(true));
    });
    return () => window.clearTimeout(timer);
  }, [key, router, tournamentId]);
  async function submit() {
    if (!ready || !valid || busy) return;
    const request: CreateHybridCaseRequest = locked ?? { caseId: crypto.randomUUID(), eventId: item.eventId!, gameId: item.gameId, expectedGameVersion: item.gameVersion, digitalSubmissionId: item.digitalSubmissionId, paperClaim: { winnerSide: winner, margin: Number(margin), evidenceReference: reference.trim() }, idempotencyKey: crypto.randomUUID() };
    if (!locked && !save(key, request)) { setMessage("This browser cannot safely retain the request."); return; }
    setLocked(request); setBusy(true);
    try {
      const response = await fetch("/api/v1/tournaments/" + encodeURIComponent(tournamentId) + "/hybrid-game-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedHybridCreate(result, request)) { clear(key); setLocked(null); setMessage("The sources match. A second official must independently confirm both before this result counts."); router.refresh(); }
      else if (response.status === 409 && isRejectedHybrid(result, request.caseId)) { clear(key); setLocked(null); setMessage("The server rejected this entry."); router.refresh(); }
      else setMessage("The result is uncertain. Retry the same locked request.");
    } catch { setMessage("Connection problem. Retry the same locked request."); } finally { setBusy(false); }
  }
  return <li className="correction-item"><p><strong>{item.eventName}</strong> · Game {item.gameNumber}</p><p>Digital: {item.digitalPlayerName}<br />Paper: {item.paperPlayerName} · ID # {item.paperVerificationId}</p>
    <p className="auth-note">Saved digital submission: side {item.digitalWinnerSide.toUpperCase()} won by {item.digitalMargin}. Independently enter the paper card below.</p>
    <ClaimFields item={item} tournamentId={tournamentId} winner={winner} setWinner={setWinner} margin={margin} setMargin={setMargin} reference={reference} setReference={setReference} disabled={!ready || busy || !!locked} photoInputId={`${item.gameId}-hybrid-photo`} />
    {valid && (winner !== item.digitalWinnerSide || Number(margin) !== item.digitalMargin) ? <p className="error-text" role="alert">The paper card does not exactly match the digital submission.</p> : null}
    <button className="primary full" disabled={!ready || !valid || winner !== item.digitalWinnerSide || Number(margin) !== item.digitalMargin || busy} onClick={submit}>{busy ? "Recording…" : locked ? "Retry locked request" : "Bind matching digital and paper entries"}</button>{message ? <p role="status">{message}</p> : null}</li>;
}

function ReviewForm({ actorId, tournamentId, item }: { actorId: string; tournamentId: string; item: HybridGameItem }) {
  const router = useRouter(); const key = reviewKey(actorId, item.caseId!);
  const [winner, setWinner] = useState<"a" | "b">("a"); const [margin, setMargin] = useState(""); const [reference, setReference] = useState("");
  const [digitalId, setDigitalId] = useState(""); const [digitalWinner, setDigitalWinner] = useState<"a" | "b">("a"); const [digitalMargin, setDigitalMargin] = useState("");
  const [locked, setLocked] = useState<ReviewHybridCaseRequest | null>(null); const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const valid = reference.trim().length > 0 && Number(margin) >= 1 && Number(margin) <= 121 && Number(digitalMargin) >= 1 && Number(digitalMargin) <= 121 && digitalId.length > 0;
  const exact = valid && digitalId === item.digitalSubmissionId && digitalWinner === item.digitalWinnerSide && Number(digitalMargin) === item.digitalMargin && winner === item.digitalWinnerSide && Number(margin) === item.digitalMargin;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let saved: unknown = null; try { saved = JSON.parse(sessionStorage.getItem(key) ?? "null"); } catch { /* none */ }
      if (!isReviewHybridCaseRequest(saved)) { setReady(true); return; }
      void reconcile(tournamentId, "review_hybrid_digital_paper_case_v1", item.caseId!, saved.idempotencyKey).then((result) => {
        if (result !== null && (isAcceptedHybridReview(result, item.caseId!, saved) || isRejectedHybrid(result, item.caseId!))) { clear(key); router.refresh(); return; }
        setLocked(saved); setWinner(saved.paperClaim.winnerSide); setMargin(String(saved.paperClaim.margin)); setReference(saved.paperClaim.evidenceReference); setDigitalId(saved.digitalSubmissionId); setDigitalWinner(saved.digitalWinnerSide); setDigitalMargin(String(saved.digitalMargin)); setMessage("A saved decision may be unresolved. Retry sends the exact same decision.");
      }).catch(() => { setLocked(saved); setMessage("A saved decision may be unresolved. Retry sends the exact same decision."); }).finally(() => setReady(true));
    });
    return () => window.clearTimeout(timer);
  }, [item.caseId, key, router, tournamentId]);
  async function decide(decision: "approve" | "reject") {
    if (!ready || !valid || busy || (locked && locked.decision !== decision) || (decision === "approve" && !exact)) return;
    const request: ReviewHybridCaseRequest = locked ?? { expectedGameVersion: item.gameVersion, digitalSubmissionId: digitalId, digitalWinnerSide: digitalWinner, digitalMargin: Number(digitalMargin), paperClaim: { winnerSide: winner, margin: Number(margin), evidenceReference: reference.trim() }, decision, idempotencyKey: crypto.randomUUID() };
    if (!locked && !save(key, request)) { setMessage("This browser cannot safely retain the decision."); return; }
    setLocked(request); setBusy(true);
    try {
      const response = await fetch("/api/v1/hybrid-game-cases/" + encodeURIComponent(item.caseId!) + "/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedHybridReview(result, item.caseId!, request)) { clear(key); setLocked(null); setMessage(request.decision === "approve" ? "Independent confirmation accepted. The reciprocal scorecards now count." : "Case rejected without changing scorecards."); router.refresh(); }
      else if (response.status === 409 && isRejectedHybrid(result, item.caseId!)) { clear(key); setLocked(null); setMessage("The server rejected this decision."); router.refresh(); }
      else setMessage("The decision is uncertain. Retry the exact locked request.");
    } catch { setMessage("Connection problem. Retry the exact locked request."); } finally { setBusy(false); }
  }
  return <li className="correction-item"><p><strong>{item.eventName}</strong> · Game {item.gameNumber}</p>
    <p>Independently read the immutable digital record, enter its identifier and result, then re-enter the original paper card.</p>
    <details><summary>Open immutable digital evidence</summary><p>Submission ID: <code>{item.digitalSubmissionId}</code><br />Recorded result: side {item.digitalWinnerSide.toUpperCase()} won by {item.digitalMargin}.</p></details>
    <fieldset disabled={!ready || busy || !!locked}><legend>Digital submission confirmation</legend><label>Submission ID<input value={digitalId} onChange={(event) => setDigitalId(event.target.value.trim())} /></label><label><input type="radio" checked={digitalWinner === "a"} onChange={() => setDigitalWinner("a")} />Side A won</label><label><input type="radio" checked={digitalWinner === "b"} onChange={() => setDigitalWinner("b")} />Side B won</label><label>Spread Points<input inputMode="numeric" maxLength={3} value={digitalMargin} onChange={(event) => setDigitalMargin(event.target.value.replace(/\D/g, "").slice(0, 3))} /></label></fieldset>
    <ClaimFields item={item} tournamentId={tournamentId} winner={winner} setWinner={setWinner} margin={margin} setMargin={setMargin} reference={reference} setReference={setReference} disabled={!ready || busy || !!locked} photoInputId={`${item.caseId}-hybrid-review-photo`} />
    {valid && !exact ? <p className="error-text" role="alert">The independently entered sources do not exactly match. Approval is blocked; reject for investigation.</p> : null}
    <div className="correction-actions"><button className="primary" disabled={!ready || !exact || busy || (!!locked && locked.decision !== "approve")} onClick={() => decide("approve")}>Confirm exact match</button><button className="secondary" disabled={!ready || !valid || busy || (!!locked && locked.decision !== "reject")} onClick={() => decide("reject")}>Reject / investigate</button></div>{message ? <p role="status">{message}</p> : null}</li>;
}

export default function HybridGameClient({ actorId, tournamentId, actorRole, actorIdentityConfirmed, candidates, reviewCases }: { actorId: string; tournamentId: string; actorRole: "director" | "co_director" | "cross_checker"; actorIdentityConfirmed: boolean; candidates: HybridGameItem[]; reviewCases: HybridGameItem[] }) {
  return <><SavedHybridReconciler actorId={actorId} tournamentId={tournamentId} />{!actorIdentityConfirmed ? <p className="error-text">Another director or co-director must confirm your official identity first.</p> : null}
    {actorRole === "cross_checker" && actorIdentityConfirmed ? <><h2>Match one digital entry to one paper card</h2>{candidates.length ? <ul className="correction-list">{candidates.map((item) => <CreateForm key={item.gameId} actorId={actorId} tournamentId={tournamentId} item={item} />)}</ul> : <p className="auth-note">No current mixed-scorecard games are waiting for a paper-card match.</p>}</> : null}
    <h2>Independent mixed-card confirmations</h2>{actorIdentityConfirmed && reviewCases.length ? <ul className="correction-list">{reviewCases.map((item) => <ReviewForm key={item.caseId} actorId={actorId} tournamentId={tournamentId} item={item} />)}</ul> : <p className="auth-note">No mixed-card confirmations are waiting for you.</p>}</>;
}
