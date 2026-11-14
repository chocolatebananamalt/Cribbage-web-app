"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  isMixedCapability, isMixedOwnHybrid, isMixedOwnAckRequest, isMixedOfficialEnvelope,
  isMixedOfficialWorkspace, isMixedOwnAckReceipt, isMixedOfficialReceipt, isMixedRejectedReceipt,
  mixedRehearsalNotice, type MixedCapability, type MixedOwnHybrid, type MixedOwnAckRequest,
  type MixedOfficialEnvelope, type MixedOfficialPhase, type MixedOfficialWorkspace,
  type MixedScopedReceipt, type MixedArtifact, type MixedPaperCandidate, type MixedPaperReviewCase,
  type MixedHybridItem,
} from "../lib/api/synthetic-mixed-evidence";
import { isUuid } from "../lib/api/validation";
import { assertRecoveryStorageOwner } from "../lib/auth/recovery-owner";
import { setAppRecoveryItem } from "../lib/recovery-write-coordinator";
import { mixedRecoveryKey, readMixedRecovery, removeExactMixedRecovery, type MixedPending, type MixedPhase, type MixedScope } from "../lib/mixed-rehearsal-recovery";
import type { AssignedGameSummary } from "../lib/games/my-games-decision";
import { deriveScore } from "../lib/score";

type Body = MixedOwnAckRequest | MixedOfficialEnvelope;
type Retained = { value: MixedPending<Body>; serialized: string };
type Props = { actorId: string; tournamentId: string; eventId: string; games: AssignedGameSummary[]; initialGameId?: string };
const phases: MixedPhase[] = ["own-ack", "paper-capture", "paper-review", "hybrid-capture", "hybrid-review"];
const bodyValidator = (phase: MixedPhase) => (value: unknown): value is Body => phase === "own-ack" ? isMixedOwnAckRequest(value) : isMixedOfficialEnvelope(value, phase);
const ready = (capability: MixedCapability | null) => !!capability?.sourceCurrent && capability.tournamentOpen && capability.eventStarted;
const claimMetadata = (body: Body) => "request" in body ? body.request : body;
const endpoint = (base: string, scope: MixedScope) => scope.phase === "own-ack" ? `${base}/synthetic-mixed-games/${scope.gameId}` : `${base}/synthetic-mixed-official/${scope.phase.replace("-", "/")}`;

/** Separate local rehearsal UI; it never enrolls a fixture or changes identities. */
export default function MixedRehearsalClient({ actorId, tournamentId, eventId, games, initialGameId }: Props) {
  const base = `/api/v1/tournaments/${tournamentId}/events/${eventId}`;
  const [gameId, setGameId] = useState(initialGameId ?? games.find(game => game.progressionStatus === "current")?.gameId ?? "");
  const [capability, setCapability] = useState<MixedCapability | null>(null);
  const [own, setOwn] = useState<MixedOwnHybrid | null>(null);
  const [official, setOfficial] = useState<MixedOfficialWorkspace | null>(null);
  const [retained, setRetained] = useState<Retained[]>([]), [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [message, setMessage] = useState("Loading rehearsal status.");
  const [rejected, setRejected] = useState<string | null>(null);
  const currentCapability = capability && isMixedCapability(capability, actorId, tournamentId, eventId) ? capability : null;
  const currentOfficial = official && isMixedOfficialWorkspace(official, actorId, tournamentId, eventId) ? official : null;
  const inCurrentScope = (scope: MixedScope) => scope.actorId === actorId && scope.tournamentId === tournamentId && scope.eventId === eventId;
  const currentRetained = retained.filter(entry => inCurrentScope(entry.value));
  const latestScope = useRef({ actorId, tournamentId, eventId });
  useLayoutEffect(() => { latestScope.current = { actorId, tournamentId, eventId }; }, [actorId, tournamentId, eventId]);
  const isLatestScope = (scope: Pick<MixedScope, "actorId" | "tournamentId" | "eventId">) =>
    scope.actorId === latestScope.current.actorId && scope.tournamentId === latestScope.current.tournamentId && scope.eventId === latestScope.current.eventId;
  const inFlight = useRef(false);
  const readGeneration = useRef(0);

  const scanRecovery = useCallback(() => {
    const prefix = `synthetic-mixed-operation:${actorId}:${tournamentId}:${eventId}:`;
    const entries: Retained[] = []; let unsafe = false;
    try {
      assertRecoveryStorageOwner(actorId);
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i); if (!key?.startsWith(prefix)) continue;
        const suffix = key.slice(prefix.length).split(":");
        if (suffix.length !== 2 || !isUuid(suffix[0]) || !phases.includes(suffix[1] as MixedPhase)) { unsafe = true; continue; }
        const scope: MixedScope = { actorId, tournamentId, eventId, gameId: suffix[0], phase: suffix[1] as MixedPhase };
        const result = readMixedRecovery(sessionStorage, scope, bodyValidator(scope.phase));
        if (result.kind === "blocked") unsafe = true;
        if (result.kind === "pending") entries.push({ value: result.value, serialized: result.serialized });
      }
    } catch { unsafe = true; }
    setRetained(entries); setBlocked(unsafe);
    return !unsafe;
  }, [actorId, tournamentId, eventId]);

  const reload = useCallback(async () => {
    const generation = ++readGeneration.current;
    setLoaded(false); setOwn(null); setOfficial(null); setCapability(null);
    const response = await fetch(`${base}/synthetic-mixed-capability`, { cache: "no-store", credentials: "same-origin" });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok || !isMixedCapability(value, actorId, tournamentId, eventId)) throw new Error("capability_unavailable");
    const [ownRead, officialRead] = await Promise.all([
      value.isDigitalParticipant && games.some(game => game.gameId === gameId) ? fetch(`${base}/synthetic-mixed-games/${gameId}`, { cache: "no-store", credentials: "same-origin" }) : null,
      value.isOfficial ? fetch(`${base}/synthetic-mixed-official`, { cache: "no-store", credentials: "same-origin" }) : null,
    ]);
    let nextOwn: MixedOwnHybrid | null = null, nextOfficial: MixedOfficialWorkspace | null = null;
    if (ownRead) {
      const data: unknown = await ownRead.json().catch(() => null);
      if (ownRead.ok && isMixedOwnHybrid(data, tournamentId, eventId, gameId)) nextOwn = data;
      else if (ownRead.status !== 404) throw new Error("own_rehearsal_unavailable");
    }
    if (officialRead) {
      const data: unknown = await officialRead.json().catch(() => null);
      if (!officialRead.ok || !isMixedOfficialWorkspace(data, actorId, tournamentId, eventId)) throw new Error("official_rehearsal_unavailable");
      nextOfficial = data;
    }
    if (generation !== readGeneration.current || !isLatestScope({ actorId, tournamentId, eventId })) throw new Error("superseded_rehearsal_read");
    const latest = nextOfficial?.capability;
    const merged: MixedCapability = { ...value,
      sourceCurrent: value.sourceCurrent && (latest?.sourceCurrent ?? true),
      tournamentOpen: value.tournamentOpen && (latest?.tournamentOpen ?? true),
      eventStarted: value.eventStarted && (latest?.eventStarted ?? true),
      isDigitalParticipant: value.isDigitalParticipant && (latest?.isDigitalParticipant ?? true),
      officialIdentityConfirmed: value.officialIdentityConfirmed && (latest?.officialIdentityConfirmed ?? true),
    };
    setCapability(merged); setOwn(nextOwn); setOfficial(nextOfficial); setLoaded(true);
    return { capability: merged, own: nextOwn, official: nextOfficial };
  }, [base, actorId, tournamentId, eventId, gameId, games]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      scanRecovery();
      void reload().then(() => { if (!cancelled) setMessage("Rehearsal status loaded. No result has been entered automatically."); })
        .catch(() => { if (!cancelled) setMessage("Rehearsal status is unavailable. Keep saved work intact; no action is enabled."); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); readGeneration.current += 1; };
  }, [reload, scanRecovery]);

  async function send(entry: Retained) {
    if (inFlight.current || blocked || !inCurrentScope(entry.value) || !isLatestScope(entry.value)) return;
    inFlight.current = true; setBusy(true); setRejected(null);
    try {
      assertRecoveryStorageOwner(actorId);
      if (sessionStorage.getItem(mixedRecoveryKey(entry.value)) !== entry.serialized) throw new Error("retained_request_changed");
      const response = await fetch(endpoint(base, entry.value), { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(entry.value.request) });
      const value: unknown = await response.json().catch(() => null);
      if (!isLatestScope(entry.value)) return;
      const scope = entry.value, body = entry.value.request;
      const accepted = response.ok && (scope.phase === "own-ack"
        ? isMixedOwnAckRequest(body) && isMixedOwnAckReceipt(value, actorId, tournamentId, eventId, scope.gameId, body)
        : isMixedOfficialEnvelope(body, scope.phase) && isMixedOfficialReceipt(value, actorId, tournamentId, eventId, scope.gameId, scope.phase, body));
      assertRecoveryStorageOwner(actorId);
      if (sessionStorage.getItem(mixedRecoveryKey(scope)) !== entry.serialized) throw new Error("retained_request_changed");
      if (accepted) {
        if (!removeExactMixedRecovery(sessionStorage, scope, entry.serialized)) throw new Error("retained_request_changed");
        scanRecovery();
        const result = (value as MixedScopedReceipt).result;
        setMessage(scope.phase === "own-ack" ? "Your fictional-opponent acknowledgment is recorded. It does not verify the game."
          : result.authoritative === true && result.scorelinesCreated === true ? "Game verified through the rehearsal review. The scorecard is updated."
          : result.status === "pending_review" ? "Capture saved. Review is still required; the game is not verified."
          : "Review recorded as rejected. No scorelines were created.");
        try { await reload(); } catch { if (isLatestScope(entry.value)) setMessage(previous => `${previous} Current status could not be refreshed.`); }
      } else if (response.status === 409 && isMixedRejectedReceipt(value, actorId, tournamentId, eventId, scope.gameId, scope.phase, body)) {
        const code = (value as MixedScopedReceipt).result.code;
        if (code !== "idempotency_conflict") setRejected(entry.serialized);
        setMessage(code === "idempotency_conflict" ? "Operation identity conflicts with saved history. Keep this exact request; ask the director to review it."
          : "This attempt was not accepted. It is retained until fresh status is checked; no success is claimed.");
      } else setMessage("The outcome is unknown. Keep this exact request and use Retry Exact Request when connected. Do not enter it again.");
    } catch { if (isLatestScope(entry.value)) { setMessage("The outcome could not be confirmed. The exact request is retained; no success is claimed."); scanRecovery(); } }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function prepare(scope: MixedScope, body: Body) {
    if (inFlight.current || busy || blocked || retained.length || !loaded
      || !inCurrentScope(scope) || !isLatestScope(scope)
      || !ready(currentCapability)
      || (scope.phase === "own-ack" ? !currentCapability?.isDigitalParticipant : !currentCapability?.isOfficial || !currentCapability.officialIdentityConfirmed)) return;
    const metadata = claimMetadata(body);
    const value: MixedPending<Body> = { ...scope, protocol: "synthetic-mixed-ui-v1", artifactId: metadata.artifactId, expectedGameVersion: metadata.expectedGameVersion, idempotencyKey: body.idempotencyKey, request: body };
    const serialized = JSON.stringify(value);
    try {
      assertRecoveryStorageOwner(actorId);
      const existing = readMixedRecovery(sessionStorage, scope, bodyValidator(scope.phase));
      if (existing.kind !== "empty" || !bodyValidator(scope.phase)(body)) throw new Error("pending_or_invalid");
      setAppRecoveryItem(sessionStorage, mixedRecoveryKey(scope), serialized);
      if (sessionStorage.getItem(mixedRecoveryKey(scope)) !== serialized) throw new Error("recovery_write_unconfirmed");
      const entry = { value, serialized }; setRetained([entry]); await send(entry);
    } catch { scanRecovery(); setMessage("The request could not be safely retained. Nothing new was sent; keep this account and its work intact."); }
  }

  async function resetRejected(entry: Retained) {
    if (busy || inFlight.current || rejected !== entry.serialized || !inCurrentScope(entry.value) || !isLatestScope(entry.value)) return;
    setBusy(true);
    try {
      const latest = await reload();
      if (entry.value.phase === "own-ack") {
        const response = await fetch(`${base}/synthetic-mixed-games/${entry.value.gameId}`, { cache: "no-store", credentials: "same-origin" });
        const value: unknown = await response.json().catch(() => null);
        const body = entry.value.request;
        if (!response.ok || !isMixedOwnHybrid(value, tournamentId, eventId, entry.value.gameId) || !isMixedOwnAckRequest(body)
          || value.artifactId !== entry.value.artifactId || value.digitalSubmissionId !== body.digitalSubmissionId) throw new Error("retained_game_readback_unavailable");
      } else if (!latest.official?.capability.officialIdentityConfirmed || !latest.official.artifacts.some(artifact => artifact.gameId === entry.value.gameId && artifact.artifactId === entry.value.artifactId)) throw new Error("retained_official_readback_unavailable");
      if (!isLatestScope(entry.value)) return;
      assertRecoveryStorageOwner(actorId);
      if (!removeExactMixedRecovery(sessionStorage, entry.value, entry.serialized)) throw new Error("changed");
      setRejected(null); scanRecovery(); setMessage("The rejected attempt is resolved and current status is loaded. Review the form before making a new attempt.");
    } catch { if (isLatestScope(entry.value)) setMessage("Fresh status or recovery could not be verified. The rejected request remains intact."); }
    finally { setBusy(false); }
  }

  const disabled = busy || blocked || retained.length > 0 || !loaded || !ready(currentCapability);
  const selected = games.find(game => game.gameId === gameId);
  // Evidence belongs to one assigned game, never the previously selected game.
  const selectedOwn = loaded && own && selected
    && isMixedOwnHybrid(own, tournamentId, eventId, selected.gameId) ? own : null;
  function selectGame(nextGameId: string) {
    if (busy || blocked || retained.length > 0) return;
    readGeneration.current += 1;
    setLoaded(false); setOwn(null); setOfficial(null); setCapability(null);
    setMessage("Loading the selected game. No action is enabled until its status is checked.");
    setGameId(nextGameId);
  }
  const scopeFor = (id: string, phase: MixedPhase): MixedScope => ({ actorId, tournamentId, eventId, gameId: id, phase });
  return <div className="mixed-rehearsal">
    <p role="note"><strong>LOCAL MIXED REHEARSAL.</strong> {mixedRehearsalNotice} Digital/Digital games keep the ordinary two entries and two confirmations.</p>
    <p role="status" aria-live="polite">{message}</p>
    <button type="button" className="secondary" disabled={busy} onClick={() => { scanRecovery(); void reload().catch(() => setMessage("Current status is unavailable. Saved work remains intact.")); }}>Refresh rehearsal status</button>
    {blocked && <p role="alert">Saved rehearsal work is malformed or its ownership cannot be verified. Keep it intact; no new action is allowed.</p>}
    {currentRetained.map(entry => <section key={mixedRecoveryKey(entry.value)} aria-label="Retained rehearsal request"><h2>Saved request waiting for a known outcome</h2><p>{entry.value.phase} · Game reference {entry.value.gameId}. New actions remain locked.</p><button type="button" className="primary" disabled={busy || blocked} onClick={() => void send(entry)}>Retry Exact Request</button>{rejected === entry.serialized && <button type="button" className="secondary" disabled={busy} onClick={() => void resetRejected(entry)}>Check latest status and resolve rejected attempt</button>}</section>)}
    {currentCapability && !ready(currentCapability) && <p role="alert">New operations are unavailable because the fixture source, open tournament or event start is not current. Retained exact retries remain available.</p>}
    {currentCapability?.isDigitalParticipant && <section aria-label="Your rehearsal games"><h2>Your game</h2><label>Assigned Game<select disabled={busy || retained.length > 0 || blocked} value={gameId} onChange={event => selectGame(event.target.value)}><option value="">Choose your assigned game</option>{games.map(game => <option key={game.gameId} value={game.gameId}>Game {game.gameNumber} · {game.opponentName} · Tournament ID# {game.opponentVerificationId}</option>)}</select></label>
      {selected && <><p><strong>{selected.playerName ?? "Your account"}</strong> · Tournament ID# {selected.playerVerificationId}; current Table/Seat {selected.playerTableSeat}</p><p>Opponent: {selected.opponentName} · Tournament ID# {selected.opponentVerificationId}; current Table/Seat {selected.opponentTableSeat}</p><a className="guide-link" href={`/tournament/${tournamentId}/game/${gameId}`}>Open your ordinary score-entry form</a></>}
      {selectedOwn && selected ? <OwnAcknowledgment key={`${gameId}:${selectedOwn.artifactId}:${selectedOwn.gameVersion}:${selectedOwn.acknowledged}`} item={selectedOwn} game={selected} disabled={disabled} submit={body => void prepare(scopeFor(gameId, "own-ack"), body)} /> : loaded && selected ? <p>No scripted Paper/Digital result is available for this assigned game. Do not infer a result or enter on another player&apos;s behalf. Digital/Digital play uses the ordinary score-entry form.</p> : null}
      <a className="guide-link" href={`/tournament/${tournamentId}/scorecard?event=${eventId}`}>View your Scorecard</a>
    </section>}
    {currentOfficial && <section aria-label="Official rehearsal checks"><h2>Official checks</h2><p>Read the generated fictional evidence and enter the result separately. You may not check your own game. Paper/Digital review requires a different eligible official from capture. These checks do not claim independent physical-paper or human play.</p>{!currentCapability?.officialIdentityConfirmed && <p role="alert">Your official identity is not confirmed. No official action is enabled.</p>}
      {(["paper-capture", "paper-review", "hybrid-capture", "hybrid-review"] as MixedOfficialPhase[]).map(phase => {
        const items = phase === "paper-capture" ? currentOfficial.paperCandidates : phase === "paper-review" ? currentOfficial.paperReviewCases : phase === "hybrid-capture" ? currentOfficial.hybridCandidates : currentOfficial.hybridReviewCases;
        return <section key={phase}><h3>{phase.startsWith("paper") ? "Paper/Paper" : "Paper/Digital"} · {phase.endsWith("capture") ? "Capture" : "Review"}</h3>{items.length === 0 && <p>No eligible current games for this step.</p>}{items.map(item => { const artifact = currentOfficial.artifacts.find(artifact => artifact.gameId === item.gameId); return artifact ? <OfficialEntry key={`${phase}:${item.gameId}:${item.gameVersion}`} phase={phase} item={item} artifact={artifact} disabled={disabled || !currentCapability?.officialIdentityConfirmed} submit={body => void prepare(scopeFor(item.gameId, phase), body)} /> : <p key={item.gameId} role="alert">Generated evidence is unavailable; this game is locked.</p>; })}</section>;
      })}
    </section>}
  </div>;
}

function OwnAcknowledgment({ item, game, disabled, submit }: { item: MixedOwnHybrid; game: AssignedGameSummary; disabled: boolean; submit: (body: MixedOwnAckRequest) => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const won = item.scriptedWinnerSide === game.playerSide, score = deriveScore(item.scriptedSpreadPoints, won ? "player" : "opponent");
  const matches = item.digitalSubmissionId !== null && item.digitalWinnerSide === item.scriptedWinnerSide && item.digitalMargin === item.scriptedSpreadPoints;
  return <section aria-label="Your fictional-opponent acknowledgment"><h3>Fictional paper opponent</h3><p>Scripted test result: <strong>{won ? "WON" : "LOST"} · {score.playerGamePoints} Game Points · {won ? "+" : "-"}{item.scriptedSpreadPoints} Spread Points</strong>.</p>
    <p>Enter only your own result in the ordinary form, return here, then refresh. This opponent did not physically play you.</p>
    {item.acknowledged ? <p role="status">Your acknowledgment is already recorded. That acknowledgment alone does not verify the game; view the Scorecard for its current result.</p> : <><p>{item.digitalSubmissionId === null ? "Your own submitted entry has not been found yet." : !matches ? "Your saved entry differs from the scripted result. Do not acknowledge it; ask the director to review the discrepancy." : "Your own saved entry matches the scripted result."}</p><label><input type="checkbox" checked={confirmed} disabled={disabled || !matches} onChange={event => setConfirmed(event.target.checked)} />I acknowledge only my own entry against a fictional opponent. No independent human play is claimed.</label><button type="button" className="primary" disabled={disabled || !matches || !confirmed} onClick={() => { if (item.digitalSubmissionId) submit({ artifactId: item.artifactId, expectedGameVersion: item.gameVersion, digitalSubmissionId: item.digitalSubmissionId, confirmed: true, idempotencyKey: crypto.randomUUID() }); }}>Record My Fictional-Opponent Acknowledgment</button></>}
  </section>;
}

type OfficialItem = MixedPaperCandidate | MixedPaperReviewCase | MixedHybridItem;
function OfficialEntry({ phase, item, artifact, disabled, submit }: { phase: MixedOfficialPhase; item: OfficialItem; artifact: MixedArtifact; disabled: boolean; submit: (body: MixedOfficialEnvelope) => void }) {
  const [aWinner, setAWinner] = useState(""), [bWinner, setBWinner] = useState(""), [aMargin, setAMargin] = useState(""), [bMargin, setBMargin] = useState(""), [confirmed, setConfirmed] = useState(false);
  const [digitalId, setDigitalId] = useState(""), [digitalWinner, setDigitalWinner] = useState(""), [digitalMargin, setDigitalMargin] = useState("");
  const paper = phase.startsWith("paper"), review = phase.endsWith("review");
  const hybrid = "digitalSide" in item ? item : null;
  const sideAName = "sideA" in item ? item.sideA.displayName : hybrid?.digitalSide === "a" ? hybrid.digitalPlayerName : hybrid?.paperPlayerName;
  const sideBName = "sideB" in item ? item.sideB.displayName : hybrid?.digitalSide === "b" ? hybrid.digitalPlayerName : hybrid?.paperPlayerName;
  const valid = (winner: string, margin: string) => ["a", "b"].includes(winner) && /^\d{1,3}$/.test(margin) && Number(margin) >= 1 && Number(margin) <= 121;
  const digitalReentryMatches = !review || paper || (!!hybrid && digitalId === hybrid.digitalSubmissionId && digitalWinner === hybrid.digitalWinnerSide && Number(digitalMargin) === hybrid.digitalMargin && valid(digitalWinner, digitalMargin));
  const canSubmit = confirmed && valid(aWinner, aMargin) && (!paper || valid(bWinner, bMargin)) && digitalReentryMatches;
  const claim = (winner: string, margin: string, reference: string) => ({ winnerSide: winner as "a" | "b", margin: Number(margin), evidenceReference: reference });
  function send() {
    if (disabled || !canSubmit) return;
    const common = { artifactId: artifact.artifactId, expectedGameVersion: item.gameVersion };
    let request: MixedOfficialEnvelope["request"];
    if (paper) {
      const fields = { ...common, sideAClaim: claim(aWinner, aMargin, artifact.sideAReference), sideBClaim: claim(bWinner, bMargin, artifact.sideBReference) };
      request = review && "completionId" in item ? { ...fields, completionId: item.completionId, decision: "approve" } : { ...fields, gameId: item.gameId, completionId: crypto.randomUUID() };
    } else {
      if (!hybrid) return;
      const fields = { ...common, digitalSubmissionId: review ? digitalId : hybrid.digitalSubmissionId, paperClaim: claim(aWinner, aMargin, hybrid.digitalSide === "a" ? artifact.sideBReference : artifact.sideAReference) };
      request = review && hybrid.caseId ? { ...fields, caseId: hybrid.caseId, digitalWinnerSide: digitalWinner as "a" | "b", digitalMargin: Number(digitalMargin), decision: "approve" } : { ...fields, gameId: item.gameId, caseId: crypto.randomUUID() };
    }
    const body = { gameId: item.gameId, request, idempotencyKey: crypto.randomUUID() };
    if (isMixedOfficialEnvelope(body, phase)) submit(body);
  }
  const fields = (label: string, winner: string, setWinner: (value: string) => void, margin: string, setMargin: (value: string) => void) => <fieldset disabled={disabled}><legend>{label}</legend><label>Winner<select value={winner} onChange={event => setWinner(event.target.value)}><option value="">Choose from the generated card</option><option value="a">{sideAName} won</option><option value="b">{sideBName} won</option></select></label><label>Spread Points<input inputMode="numeric" pattern="[0-9]*" maxLength={3} value={margin} onChange={event => setMargin(event.target.value.replace(/\D/g, "").slice(0, 3))} /></label></fieldset>;
  return <article className="mixed-rehearsal-game"><h4>Game {item.gameNumber}: {sideAName} / {sideBName}</h4><p>Game reference: {item.gameId}</p><details><summary>Read generated fictional evidence</summary><pre>{artifact.text}</pre></details>
    {review && hybrid && <><details><summary>Read the saved digital entry</summary><p>Digital submission ID: <strong>{hybrid.digitalSubmissionId}</strong></p><p>{hybrid.digitalWinnerSide === "a" ? sideAName : sideBName} won · {hybrid.digitalMargin} Spread Points.</p></details><label>Re-Enter Digital Submission ID<input disabled={disabled} value={digitalId} onChange={event => setDigitalId(event.target.value)} autoComplete="off" /></label>{fields("Re-enter the saved digital result", digitalWinner, setDigitalWinner, digitalMargin, setDigitalMargin)}</>}
    {fields(paper ? "Generated card A" : "Generated paper card", aWinner, setAWinner, aMargin, setAMargin)}{paper && fields("Generated card B — enter separately", bWinner, setBWinner, bMargin, setBMargin)}
    <label><input type="checkbox" disabled={disabled} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I entered the generated evidence for this rehearsal. I do not claim physical originals or independent human play.</label><button type="button" className="primary" disabled={disabled || !canSubmit} onClick={send}>{review ? "Record Rehearsal Review" : "Save Rehearsal Capture"}</button>
  </article>;
}
