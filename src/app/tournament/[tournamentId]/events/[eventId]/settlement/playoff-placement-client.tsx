"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { isPlayoffPlacementOutcome, isPlayoffPlacementRequest, isRejectedPlayoffPlacement, type PlayoffPlacementRequest, type PlayoffPlacementWorkspace } from "../../../../../../lib/api/playoff-placement";

type Envelope = PlayoffPlacementRequest & { kind: "playoff-placement" };
const storageKey = (actorId: string, eventId: string) => `playoff-placement:${actorId}:${eventId}`;

function requestFromEnvelope({ kind: _kind, ...request }: Envelope): PlayoffPlacementRequest {
  void _kind;
  return request;
}

function initialRows(workspace: PlayoffPlacementWorkspace) {
  return workspace.playoffResult?.placements.map(({ participantId, placement, mrpPlayoffExitRound }) => ({ participantId, placement, mrpPlayoffExitRound }))
    ?? workspace.qualifierChoices.map((choice, index) => ({ participantId: choice.participantId, placement: index + 1, mrpPlayoffExitRound: 1 }));
}

function readEnvelope(key: string): Envelope | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value) || (value as Record<string, unknown>).kind !== "playoff-placement") return null;
    const envelope = value as Envelope;
    return isPlayoffPlacementRequest(requestFromEnvelope(envelope)) ? envelope : null;
  } catch { return null; }
}

export default function PlayoffPlacementClient({ actorId, tournamentId, eventId, workspace }: {
  actorId: string; tournamentId: string; eventId: string; workspace: PlayoffPlacementWorkspace;
}) {
  const router = useRouter();
  const [placements, setPlacements] = useState(() => initialRows(workspace));
  const [busy, setBusy] = useState(true);
  const [locked, setLocked] = useState<Envelope | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const key = storageKey(actorId, eventId);

  const reconcile = useCallback(async (envelope: Envelope) => {
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/playoff-placements/reconciliation`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store",
        body: JSON.stringify({ idempotencyKey: envelope.idempotencyKey }),
      });
      const data: unknown = response.ok ? await response.json().catch(() => null) : null;
      return data && typeof data === "object" && !Array.isArray(data) && "result" in data ? (data as { result: unknown }).result : undefined;
    } catch { return undefined; }
  }, [eventId, tournamentId]);

  useEffect(() => {
    void (async () => {
      const saved = readEnvelope(key);
      if (!saved) { setBusy(false); return; }
      const result = await reconcile(saved);
      if (result === null) { sessionStorage.removeItem(key); setMessage("The prior save did not reach the server. Review the placements before saving again."); setBusy(false); return; }
      if (isPlayoffPlacementOutcome(result, tournamentId, eventId)) { sessionStorage.removeItem(key); setBusy(false); router.refresh(); return; }
      if (isRejectedPlayoffPlacement(result, eventId)) { sessionStorage.removeItem(key); setLocked(null); setPlacements(initialRows(workspace)); setMessage("The prior save was rejected. The latest recorded version has been reloaded."); setBusy(false); router.refresh(); return; }
      setLocked(saved); setMessage("The prior save is unresolved and remains locked for safe recovery."); setBusy(false);
    })();
  }, [eventId, key, reconcile, router, tournamentId, workspace]);

  async function save() {
    const candidate: Envelope = {
      kind: "playoff-placement", qualificationResultVersionId: workspace.qualificationResultVersionId,
      expectedVersion: workspace.currentVersion, placements, idempotencyKey: locked?.idempotencyKey ?? crypto.randomUUID(),
    };
    if (locked && JSON.stringify({ ...locked, kind: undefined, idempotencyKey: undefined }) !== JSON.stringify({ ...candidate, kind: undefined, idempotencyKey: undefined })) {
      setMessage("The unresolved save is locked. Restore its original placements before retrying."); return;
    }
    const envelope = locked ?? candidate;
    const request = requestFromEnvelope(envelope);
    if (!isPlayoffPlacementRequest(request)) { setMessage("Choose a different qualifier for each sequential playoff place, beginning with winner and runner-up."); return; }
    try {
      sessionStorage.setItem(key, JSON.stringify(envelope)); setLocked(envelope); setBusy(true); setMessage(null);
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/playoff-placements`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(request),
      });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isPlayoffPlacementOutcome(result, tournamentId, eventId)) { sessionStorage.removeItem(key); setLocked(null); router.refresh(); return; }
      if (response.status === 409 && isRejectedPlayoffPlacement(result, eventId)) { sessionStorage.removeItem(key); setLocked(null); setPlacements(initialRows(workspace)); setMessage("The server rejected these placements. The latest recorded version has been restored."); router.refresh(); return; }
      setMessage("This save is unresolved and remains locked until the server can confirm it.");
    } catch { setMessage("This save is unresolved and remains locked until the server can confirm it."); }
    finally { setBusy(false); }
  }

  return <section className="policy-settings" aria-labelledby="playoff-placement-title">
    <h2 id="playoff-placement-title">Supervised playoff placements</h2>
    <p className="registration-note"><strong>Separate result record.</strong> Record every qualifier&apos;s playoff finish and exit round here. The server uses the ACC published MRP schedule effective August 1, 2016; Qualifying-round rank remains unchanged. An exit round is the round in which the player lost or won; a bye counts as a round.</p>
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy}>
        <legend>Winner, runner-up, and recorded places</legend>
        {placements.map((entry, index) => <div className="correction-actions" key={entry.placement}>
          <label>{index === 0 ? "Winner" : index === 1 ? "Runner-up" : `Place ${entry.placement}`}
            <select value={entry.participantId} onChange={(event) => setPlacements((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, participantId: event.target.value } : item))}>
              <option value="">Choose a qualifier</option>
              {workspace.qualifierChoices.map((choice) => <option key={choice.participantId} value={choice.participantId}>{choice.displayName} · qualifying rank {choice.qualificationRank}</option>)}
            </select>
          </label>
          <label>MRP playoff exit round
            <input type="number" min="1" max="9" value={entry.mrpPlayoffExitRound} onChange={(event) => setPlacements((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, mrpPlayoffExitRound: Number(event.target.value) } : item))} />
          </label>
        </div>)}
      </fieldset>
      <button className="primary" type="submit" disabled={busy}>{busy ? "Checking…" : `Record Playoff Result Version ${workspace.currentVersion + 1}`}</button>
    </form>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
    {workspace.playoffResult ? <section className="correction-item"><h3>Current recorded playoff result</h3><p>Version {workspace.playoffResult.version} by {workspace.playoffResult.recordedBy}</p><ol>{workspace.playoffResult.placements.map((entry) => <li key={entry.participantId}>{entry.displayName} — {entry.placement === 1 ? "Winner" : entry.placement === 2 ? "Runner-up" : `Place ${entry.placement}`} · MRP exit round {entry.mrpPlayoffExitRound}</li>)}</ol></section> : null}
  </section>;
}
