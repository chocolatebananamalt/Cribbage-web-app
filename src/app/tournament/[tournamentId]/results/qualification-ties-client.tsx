"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isQualificationTieRequest, isQualificationTieOutcome, qualificationTieOutcomeMatches, type QualificationTieRequest, type QualificationTieWorkspace, type QualificationTieGroup } from "../../../../lib/api/qualification-ties";
import { isUuid } from "../../../../lib/api/validation";
import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";
import { SyntheticEventArtifactView, SyntheticEventNotice } from "../../../../components/synthetic-event-notice";
import type { SyntheticEventContext, SyntheticEventArtifact } from "../../../../lib/api/synthetic-event-evidence";
type Envelope = { kind: "qualification-tie"; operationId: string; request: QualificationTieRequest };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const validEnvelope = (v: unknown): v is Envelope => object(v) && Object.keys(v).sort().join() === "kind,operationId,request"
  && v.kind === "qualification-tie" && isUuid(v.operationId) && isQualificationTieRequest(v.request);

function TieForm({ group, names, disabled, save, artifact, syntheticMode }: { group: QualificationTieGroup; names: Map<string, string>; disabled: boolean; save: (g: QualificationTieGroup, winner: string, reason: string, evidence: string) => void; artifact?: SyntheticEventArtifact; syntheticMode: boolean }) {
  const [winner, setWinner] = useState(group.headToHeadWinnerId ?? ""), [reason, setReason] = useState(""), [evidence, setEvidence] = useState(""), [confirmed, setConfirmed] = useState(false);
  const manual = group.method === "one_game_playoff";
  return <article className="correction-item">
    <h3>Numeric rank {group.numericRank}{group.affectsQualificationCut ? " — qualification cutoff" : " — ranking tie"}</h3>
    <p>{group.candidateIds.map(id => names.get(id) ?? id).join(" and ")} have identical game points, wins, net spread and gross positive winning spreads. Their qualifying scores stay unchanged.</p>
    {group.resolution ? <><p><strong>Tie resolved: {names.get(group.resolution.winnerId) ?? group.resolution.winnerId} ranks higher.</strong> Method: {group.resolution.method === "head_to_head" ? "Qualifying-round head-to-head" : "One-game playoff"}.</p><p>Evidence: {group.resolution.evidenceReference}. Reason: {group.resolution.reason}.</p><p>Recorded by {group.resolution.recordedBy} at {group.resolution.recordedAt}.</p></>
    : group.method === "blocked" ? <p role="alert">Director review required. Multiway ties and multiple or ambiguous qualifying meetings are unsupported; no winner can be recorded here.</p>
    : <fieldset disabled={disabled || (syntheticMode && !artifact)}>
      {manual ? <><p>{artifact ? "This fixture uses an explicitly simulated outcome; no physical game is claimed. Select only the winner in the source-bound simulated record." : "No qualifying-round head-to-head result is available. Play a separate one-game playoff. Cut for first deal. Record only its winner here; do not enter its points into qualifying scorecards."}</p>{artifact && <SyntheticEventArtifactView artifact={artifact}/>}<label>{artifact ? "Simulated one-game playoff winner" : "One-game playoff winner"}<select value={winner} onChange={e => { setWinner(e.target.value); setConfirmed(false); }}><option value="">Choose the {artifact ? "simulated" : "actual"} winner</option>{group.candidateIds.filter(id => !artifact || (artifact.payload.participantIds as unknown[] | undefined)?.includes(id)).map(id => <option key={id} value={id}>{names.get(id) ?? id}</option>)}</select></label></>
      : <><p>The server found one qualifying-round head-to-head game: <strong>{names.get(group.headToHeadWinnerId!) ?? group.headToHeadWinnerId} won.</strong> Game reference: {group.headToHeadGameId}. The client cannot choose a different winner.</p>{artifact && <SyntheticEventArtifactView artifact={artifact}/>}</>}
      {!artifact && <label>Resolution reason<input value={reason} maxLength={500} onChange={e => { setReason(e.target.value); setConfirmed(false); }}/></label>}
      {!artifact && <label>Evidence or playoff record reference<input value={evidence} maxLength={500} onChange={e => { setEvidence(e.target.value); setConfirmed(false); }}/></label>}
      <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>{artifact ? "I confirm this is a simulated outcome; no physical game was played." : manual ? "I confirm this is the winner of the separately played one-game playoff." : "I reviewed the server-derived qualifying-round head-to-head result."}</label>
      <button type="button" disabled={artifact ? winner !== artifact.payload.winnerId || !confirmed : !winner || !reason.trim() || !evidence.trim() || !confirmed} onClick={() => save(group, winner, reason, evidence)}>Record qualification tie resolution</button>
    </fieldset>}
  </article>;
}
export default function QualificationTiesClient({ actorId, tournamentId, eventId, source, candidates, syntheticContext: tournamentSyntheticContext }: {
  actorId: string; tournamentId: string; eventId: string; source: QualificationTieWorkspace | null;
  candidates: Array<{ id: string; displayName: string }>;
  syntheticContext?: SyntheticEventContext | null;
}) {
  const syntheticContext = tournamentSyntheticContext?.eventIds.includes(eventId) ? tournamentSyntheticContext : null;
  const router = useRouter(), flight = useRef(false), key = `qualification-finalization:ties:${actorId}:${eventId}`;
  const url = `/api/v1/tournaments/${tournamentId}/events/${eventId}/qualification-ties`;
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [pending, setPending] = useState<Envelope | null>(null);
  const [message, setMessage] = useState("Checking retained qualification tie work.");
  const tieArtifacts = source ? syntheticContext?.artifacts.filter(item => item.kind === "qualification_tie" && item.eventId === eventId && item.sourceDigest === source.sourceFingerprint) ?? [] : [];
  function finish(raw: string, e: Envelope, result: unknown) {
    if (!isQualificationTieOutcome(result, eventId) || !qualificationTieOutcomeMatches(result, e.request)) { setMessage("Outcome remains uncertain. The exact request is retained."); return; }
    if (result.status === "rejected" && result.code === "idempotency_conflict") { setBlocked(true); setMessage("Operation identity conflict. Retained work was preserved for review."); return; }
    try {
      if (sessionStorage.getItem(key) !== raw) throw Error("retained_work_changed");
      sessionStorage.removeItem(key);
    } catch { setBlocked(true); setMessage("Outcome received, but retained work could not be cleared safely."); return; }
    setPending(null);
    setMessage(result.status === "rejected" ? `Request rejected: ${result.code.replaceAll("_", " ")}. Refresh sources before another decision.` : "Qualification tie resolution recorded. Qualifying scores are unchanged.");
    if (result.status !== "rejected") router.refresh();
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      let raw: string | null;
      try { raw = sessionStorage.getItem(key); } catch { setBlocked(true); setReady(true); setMessage("Recovery storage unavailable. Recording is blocked."); return; }
      if (!raw) { setReady(true); setMessage("Review the tied scorecards and current source evidence."); return; }
      let e: unknown; try { e = JSON.parse(raw); } catch { e = null; }
      if (!validEnvelope(e)) { setBlocked(true); setReady(true); setMessage("Unrecognized retained request; it was not overwritten."); return; }
      setPending(e); setBusy(true);
      try {
        const response = await fetch(`${url}/reconciliation`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationId: e.operationId, request: e.request }) });
        const result: unknown = response.ok ? await response.json() : null;
        if (!active) return;
        if (object(result) && Object.keys(result).sort().join() === "authorized,result" && result.authorized === true) {
          if (result.result !== null) finish(raw, e, result.result); else setMessage("No completed receipt. Retry only the exact retained request.");
        } else setMessage("Reconciliation unavailable. The exact request remains retained.");
      } catch { if (active) setMessage("Connection interrupted. The exact request remains retained."); }
      finally { if (active) { setBusy(false); setReady(true); } }
    })();
    return () => { active = false; };
    // Reconcile retained identity on mount; never replay a mutation on source refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, url]);
  async function submit(e: Envelope, retained: boolean) {
    if (flight.current || !ready || blocked) return;
    flight.current = true; setBusy(true);
    const raw = JSON.stringify(e);
    try {
      if (retained ? sessionStorage.getItem(key) !== raw : !!sessionStorage.getItem(key)) throw Error("retained_work_changed");
      if (!retained) setAppRecoveryItem(sessionStorage, key, raw);
      setPending(e);
      const response = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-idempotency-key": e.operationId }, body: JSON.stringify(e.request) });
      const result: unknown = await response.json().catch(() => null);
      finish(raw, e, result);
    } catch { setMessage("Recording could not be confirmed. Retained work stays intact; retry uses the same request."); }
    finally { flight.current = false; setBusy(false); }
  }
  const locked = !ready || busy || blocked || pending !== null || !source || source.finalized || source.blockers.length > 0;
  return <section className="correction-item" aria-labelledby="qualification-ties-title">
    {syntheticContext && <SyntheticEventNotice context={syntheticContext}/>}
    <h2 id="qualification-ties-title">Qualification tie review</h2>
    <p>ACC 2025 Rulebook Appendix A20: compare qualifying-round head-to-head when available; otherwise record a separately played one-game playoff. This changes ranking only. Optional Q Pool cash ties use their own policy.</p>
    <p role="status">{message}</p>
    {!source ? <p role="alert">Tie-resolution service unavailable. Existing scorecards and history are unchanged; unresolved ties remain blocked.</p> : <>
      {!!source.blockers.length && <p role="alert">Recording blocked: {source.blockers.join(", ").replaceAll("_", " ")}.</p>}
      {source.groups.map(g => { const artifact = g.method !== "blocked" ? tieArtifacts.find(item => Array.isArray(item.payload.participantIds) && [...item.payload.participantIds as string[]].sort().join() === [...g.candidateIds].sort().join() && item.payload.method === g.method) : undefined; const payloadWinner = artifact?.payload.winnerId; const validArtifact = artifact && typeof payloadWinner === "string" && g.candidateIds.includes(payloadWinner) ? artifact : undefined; return <TieForm key={source.sourceFingerprint + g.candidateIds.join()} group={g} artifact={validArtifact} syntheticMode={!!syntheticContext} names={new Map(candidates.map(c => [c.id, c.displayName]))} disabled={locked || (!!syntheticContext && g.method !== "blocked" && !validArtifact)} save={(group, winnerId, reason, evidenceReference) => {
        if (validArtifact && winnerId !== validArtifact.payload.winnerId) return;
        const request = { expectedSourceFingerprint: source.sourceFingerprint, participantIds: group.candidateIds as [string, string], winnerId, method: group.method, reason: validArtifact ? `TEST ONLY SYNTHETIC: ${validArtifact.reference}` : reason, evidenceReference: validArtifact ? validArtifact.reference : evidenceReference };
        if (isQualificationTieRequest(request)) void submit({ kind: "qualification-tie", operationId: crypto.randomUUID(), request }, false);
      }}/>})}
      <p className="auth-note" style={{ overflowWrap: "anywhere" }}>Tie source fingerprint {source.sourceFingerprint}.</p>
    </>}
    {pending && <button type="button" disabled={!ready || busy || blocked} onClick={() => void submit(pending, true)}>Retry exact qualification tie request</button>}
  </section>;
}
