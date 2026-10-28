"use client";
import { setAppRecoveryItem } from "../../../../../../lib/recovery-write-coordinator";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { isPlayoffOutcomeRequest, isPlayoffOutcomeResult, isRejectedPlayoffOutcome, type PlayoffOutcomeRequest, type PlayoffOutcomeSeries, type PlayoffOutcomeWorkspace } from "../../../../../../lib/api/playoff-outcome";

type Envelope = { kind: "playoff-outcome"; request: PlayoffOutcomeRequest };
const storageKey = (actorId: string, tournamentId: string, eventId: string) => `playoff-outcome:${actorId}:${tournamentId}:${eventId}`;
const blankSeries = (): [PlayoffOutcomeSeries, PlayoffOutcomeSeries, PlayoffOutcomeSeries] => [
  { winnerId: "", loserId: "", evidenceNote: "" },
  { winnerId: "", loserId: "", evidenceNote: "" },
  { winnerId: "", loserId: "", evidenceNote: "" },
];
const readStored = (key: string): { raw: string | null; envelope: Envelope | null; malformed: boolean } => {
  const raw = sessionStorage.getItem(key);
  if (raw === null) return { raw, envelope: null, malformed: false };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value) || (value as Record<string, unknown>).kind !== "playoff-outcome") return { raw, envelope: null, malformed: true };
    const envelope = value as Envelope;
    return { raw, envelope: isPlayoffOutcomeRequest(envelope.request) ? envelope : null, malformed: !isPlayoffOutcomeRequest(envelope.request) };
  } catch { return { raw, envelope: null, malformed: true }; }
};

function names(workspace: PlayoffOutcomeWorkspace) {
  return new Map(workspace.qualifiers.map((qualifier) => [qualifier.participantId, qualifier.displayName]));
}

export default function PlayoffOutcomeClient({ actorId, tournamentId, eventId, workspace }: { actorId: string; tournamentId: string; eventId: string; workspace: PlayoffOutcomeWorkspace | null }) {
  const router = useRouter();
  const key = storageKey(actorId, tournamentId, eventId);
  const [series, setSeries] = useState<[PlayoffOutcomeSeries, PlayoffOutcomeSeries, PlayoffOutcomeSeries]>(() => workspace?.result?.series ?? blankSeries());
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState<Envelope | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [message, setMessage] = useState("Loading playoff outcome workspace.");
  const flight = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = readStored(key);
      const saved = stored.envelope;
      if (!saved) { if (active) { setBusy(false); setStorageBlocked(stored.malformed); setMessage(stored.malformed ? "A saved playoff outcome request is malformed or unknown and was retained. Review or clear it explicitly before starting another save." : workspace ? "Choose the three supervised playoff results." : "Playoff outcomes could not be loaded. Check that this event has finalized qualification and the supported server capability is available."); } return; }
      setSeries(saved.request.series);
      try {
        const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/playoff-outcomes/reconciliation`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ idempotencyKey: saved.request.idempotencyKey }) });
        const envelope: unknown = response.ok ? await response.json().catch(() => null) : null;
        const result = envelope && typeof envelope === "object" && !Array.isArray(envelope) && "result" in envelope ? (envelope as { result: unknown }).result : undefined;
        if (!active) return;
        if (sessionStorage.getItem(key) !== stored.raw) { setStorageBlocked(true); setPending(saved); setBusy(false); setMessage("The saved playoff outcome request changed while it was being checked; it was retained and no receipt was cleared."); return; }
        if (isPlayoffOutcomeResult(result, tournamentId, eventId)) { sessionStorage.removeItem(key); setBusy(false); setPending(null); setStorageBlocked(false); setMessage("The playoff outcomes were saved. Refreshing the recorded result."); router.refresh(); return; }
        if (isRejectedPlayoffOutcome(result, eventId)) { sessionStorage.removeItem(key); setBusy(false); setPending(null); setStorageBlocked(false); setSeries(workspace?.result?.series ?? blankSeries()); setMessage("The server rejected the playoff outcome request. The latest recorded result has been restored."); router.refresh(); return; }
        if (result === null) { setPending(saved); setBusy(false); setStorageBlocked(false); setMessage("No server receipt is available yet. The exact playoff outcome request was retained; retry it after checking the server."); return; }
        setPending(saved); setBusy(false); setMessage("The prior playoff outcome request is unresolved and remains locked. Retry the exact request after checking the server.");
      } catch { if (active) { setPending(saved); setBusy(false); setMessage("The prior playoff outcome request is unresolved and remains locked. Retry the exact request after checking the server."); } }
    })();
    return () => { active = false; };
  }, [eventId, key, router, tournamentId, workspace]);

  async function save() {
  if (!workspace || busy || flight.current || storageBlocked) return;
    if (!pending && (!workspace.canRecord || workspace.legacyConflict || workspace.qualifiers.length !== 4)) return;
    if (!pending && workspace.result && JSON.stringify(series) === JSON.stringify(workspace.result.series)) { setMessage("These playoff outcomes are already recorded. Change a supervised result or source note before saving another version."); return; }
    const request: PlayoffOutcomeRequest = pending?.request ?? { qualificationResultVersionId: workspace.qualificationResultVersionId, expectedVersion: workspace.currentVersion, series, idempotencyKey: crypto.randomUUID() };
    if (!isPlayoffOutcomeRequest(request)) { setMessage("Complete all three playoff series with distinct winners, losers, and source notes of 200 characters or fewer."); return; }
    if (pending && JSON.stringify(pending.request.series) !== JSON.stringify(series)) { setMessage("The unresolved request is locked. Restore its exact series and notes before retrying."); return; }
    const envelope: Envelope = pending ?? { kind: "playoff-outcome", request };
    if (flight.current) return;
    flight.current = true; setBusy(true); setPending(envelope); setMessage("Saving the exact playoff outcome request.");
    try {
      const serialized = JSON.stringify(envelope);
      const existing = sessionStorage.getItem(key);
      if (existing !== null && existing !== serialized) { setStorageBlocked(true); setBusy(false); setMessage("Another playoff outcome request is already retained. Review it before starting a new save."); return; }
      setAppRecoveryItem(sessionStorage, key, serialized);
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/playoff-outcomes`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(envelope.request) });
      const result: unknown = await response.json().catch(() => null);
      if (sessionStorage.getItem(key) !== serialized) { setStorageBlocked(true); setMessage("The saved playoff outcome request changed while the write was pending; it was retained."); return; }
      if (response.ok && isPlayoffOutcomeResult(result, tournamentId, eventId)) { sessionStorage.removeItem(key); setPending(null); setBusy(false); setStorageBlocked(false); setMessage("Playoff outcomes saved. Refreshing the recorded result."); router.refresh(); return; }
      if (response.status === 409 && isRejectedPlayoffOutcome(result, eventId)) { sessionStorage.removeItem(key); setPending(null); setBusy(false); setStorageBlocked(false); setSeries(workspace.result?.series ?? blankSeries()); setMessage("The server rejected this playoff outcome request. The latest recorded result has been restored."); router.refresh(); return; }
      setMessage("The playoff outcome request is unresolved and remains locked for the exact retry.");
    } catch { setMessage("The playoff outcome request is unresolved and remains locked for the exact retry."); }
    finally { flight.current = false; setBusy(false); }
  }

  if (!workspace) return <section className="policy-settings" aria-labelledby="playoff-outcome-title"><h2 id="playoff-outcome-title">Playoff outcomes</h2><p role="status" className="auth-note">Playoff outcomes are unavailable because the server capability is not installed.</p></section>;
  const supported = workspace.canRecord && workspace.supportedFormat && !workspace.legacyConflict && workspace.qualifiers.length === 4;
  const qualifierNames = names(workspace);
  const slots = [[0, 3, "Semifinal 1: qualifier 1 vs qualifier 4"], [1, 2, "Semifinal 2: qualifier 2 vs qualifier 3"], [0, 1, "Final: semifinal winners"]] as const;
  const participantOptions = (index: number) => index === 2 ? series.slice(0, 2).flatMap((match) => [match.winnerId]).filter(Boolean) : [workspace.qualifiers[slots[index][0]]?.participantId, workspace.qualifiers[slots[index][1]]?.participantId].filter((id): id is string => Boolean(id));
  return <section className="policy-settings" aria-labelledby="playoff-outcome-title">
    <h2 id="playoff-outcome-title">Supervised playoff outcomes</h2>
    <p className="registration-note">Record the three Standard Singles playoff series. Qualifying order stays separate; the server records the final outcome projection.</p>
    {!supported ? <p role="status" className="auth-note">This event is not a supported first-pass Standard Singles Main with exactly four qualifiers, or a legacy result conflict must be resolved.</p> : null}
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy || storageBlocked || !!pending || !supported}>
        <legend>Series results and source notes</legend>
        {slots.map(([, , label], index) => <div className="correction-actions" key={label}><h3>{label}</h3>
          <label>Winner<select required value={series[index].winnerId} onChange={(event) => setSeries((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, winnerId: event.target.value } : item) as typeof current)}><option value="">Choose winner</option>{participantOptions(index).map((id) => <option key={id} value={id}>{qualifierNames.get(id) ?? id}</option>)}</select></label>
          <label>Loser<select required value={series[index].loserId} onChange={(event) => setSeries((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, loserId: event.target.value } : item) as typeof current)}><option value="">Choose loser</option>{participantOptions(index).map((id) => <option key={id} value={id}>{qualifierNames.get(id) ?? id}</option>)}</select></label>
          <label>Source note (200 characters maximum)<input required maxLength={200} value={series[index].evidenceNote} onChange={(event) => setSeries((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, evidenceNote: event.target.value } : item) as typeof current)} /></label>
        </div>)}
      </fieldset>
      <button className="primary" type="submit" disabled={busy || storageBlocked || (!pending && !supported)}>{busy ? "Saving…" : pending ? "Retry exact playoff outcome request" : `Record Playoff Outcomes Version ${workspace.currentVersion + 1}`}</button>
    </form>
    <p role="status" className="auth-note">{message}</p>
    {workspace.result ? <section className="correction-item"><h3>Current recorded playoff outcome</h3><p>Version {workspace.result.version} recorded at {workspace.result.recordedAt}.</p><p>Bracket source: {workspace.result.bracketSourceVersion}. MRP source: {workspace.result.mrpSourceVersion}.</p><ol>{workspace.result.series.map((match, index) => <li key={index}>{qualifierNames.get(match.winnerId) ?? match.winnerId} defeated {qualifierNames.get(match.loserId) ?? match.loserId}</li>)}</ol><table><caption>Server-derived outcome and MRP summary</caption><thead><tr><th>Qualifier</th><th>Cohort</th><th>Qualifying MRP</th><th>Playoff MRP</th><th>Total MRP</th></tr></thead><tbody>{workspace.result.outcomes.map((outcome) => <tr key={outcome.participantId}><td>{qualifierNames.get(outcome.participantId) ?? outcome.participantId}</td><td>{outcome.bandStart === outcome.bandEnd ? `Band ${outcome.bandStart}` : `Band ${outcome.bandStart}-${outcome.bandEnd}`}</td><td>{outcome.qualifyingMrp}</td><td>{outcome.playoffMrp}</td><td>{outcome.totalMrp}</td></tr>)}</tbody></table></section> : null}
  </section>;
}
