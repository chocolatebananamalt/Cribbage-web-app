"use client";
import { setAppRecoveryItem } from "../../../../../../lib/recovery-write-coordinator";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { isPlayoffPlacementOutcome, isPlayoffPlacementRequest, isRejectedPlayoffPlacement, parsePlayoffPlacementEnvelope, type PlayoffPlacementRequest, type PlayoffPlacementWorkspace } from "../../../../../../lib/api/playoff-placement";

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

function readEnvelope(key: string): { raw: string | null; envelope: Envelope | null; malformed: boolean } {
  const raw = sessionStorage.getItem(key);
  if (raw === null) return { raw, envelope: null, malformed: false };
  try {
    const value: unknown = JSON.parse(raw);
    const request = parsePlayoffPlacementEnvelope(value);
    if (!request) return { raw, envelope: null, malformed: true };
    return { raw, envelope: { kind: "playoff-placement", ...request }, malformed: false };
  } catch { return { raw, envelope: null, malformed: true }; }
}

export default function PlayoffPlacementClient({ actorId, tournamentId, eventId, workspace }: {
  actorId: string; tournamentId: string; eventId: string; workspace: PlayoffPlacementWorkspace;
}) {
  const router = useRouter();
  const [placements, setPlacements] = useState(() => initialRows(workspace));
  const [busy, setBusy] = useState(true);
  const [locked, setLocked] = useState<Envelope | null>(null);
  const [storedRaw, setStoredRaw] = useState<string | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
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
      setStoredRaw(saved.raw);
      if (saved.malformed) { setStorageBlocked(true); setMessage("An unrecognized prior save is retained. Review or clear it before recording another result."); setBusy(false); return; }
      if (!saved.envelope) { setBusy(false); return; }
      const originalRaw = saved.raw;
      const removeIfUnchanged = () => { if (sessionStorage.getItem(key) === originalRaw) { sessionStorage.removeItem(key); return true; } return false; };
      setPlacements(saved.envelope!.placements.map(({ participantId, placement, mrpPlayoffExitRound }) => ({ participantId, placement, mrpPlayoffExitRound })));
      const result = await reconcile(saved.envelope);
      if (sessionStorage.getItem(key) !== originalRaw) { setStorageBlocked(true); setMessage("A newer saved request replaced this receipt; it was retained for safe recovery."); setBusy(false); return; }
      if (result === null) { if (sessionStorage.getItem(key) !== originalRaw) { setStorageBlocked(true); setMessage("A newer saved request replaced this receipt; it was retained for safe recovery."); } else { setLocked(saved.envelope); setPlacements(saved.envelope.placements.map(({ participantId, placement, mrpPlayoffExitRound }) => ({ participantId, placement, mrpPlayoffExitRound }))); setMessage("No server receipt is available yet. The exact placement request was retained; retry it after checking the server."); } setBusy(false); return; }
      if (isPlayoffPlacementOutcome(result, tournamentId, eventId)) { if (!removeIfUnchanged()) { setStorageBlocked(true); setMessage("A newer saved request replaced this receipt; it was retained for safe recovery."); setBusy(false); return; } setBusy(false); router.refresh(); return; }
      if (isRejectedPlayoffPlacement(result, eventId)) { if (!removeIfUnchanged()) { setStorageBlocked(true); setMessage("A newer saved request replaced this receipt; it was retained for safe recovery."); setBusy(false); return; } setLocked(null); setPlacements(initialRows(workspace)); setMessage("The prior save was rejected. The latest recorded version has been reloaded."); setBusy(false); router.refresh(); return; }
      setLocked(saved.envelope); setMessage("The prior save is unresolved and remains locked for safe recovery."); setBusy(false);
    })();
  }, [eventId, key, reconcile, router, tournamentId, workspace]);

  async function save() {
    if (inFlight.current || storageBlocked) return;
    inFlight.current = true;
    const candidate: Envelope = locked ?? {
      kind: "playoff-placement", qualificationResultVersionId: workspace.qualificationResultVersionId,
      expectedVersion: workspace.currentVersion, placements, idempotencyKey: crypto.randomUUID(),
    };
    if (locked && JSON.stringify(locked.placements) !== JSON.stringify(candidate.placements)) {
      setMessage("The unresolved save is locked. Restore its original placements before retrying."); inFlight.current = false; return;
    }
    const envelope = candidate;
    const request = requestFromEnvelope(envelope);
    if (!isPlayoffPlacementRequest(request)) { setMessage("Choose a different qualifier for each sequential playoff place, beginning with winner and runner-up."); inFlight.current = false; return; }
    try {
      const rawBeforeWrite = sessionStorage.getItem(key);
      if (rawBeforeWrite !== null && rawBeforeWrite !== storedRaw) { setStorageBlocked(true); setMessage("Another playoff placement request is already retained. Review it before recording a result."); return; }
      const rawAtSend = JSON.stringify(envelope);
      setAppRecoveryItem(sessionStorage, key, rawAtSend); setStoredRaw(rawAtSend); setLocked(envelope); setBusy(true); setMessage(null);
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/events/${eventId}/playoff-placements`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(request),
      });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isPlayoffPlacementOutcome(result, tournamentId, eventId)) {
        if (sessionStorage.getItem(key) !== rawAtSend) { setStorageBlocked(true); setMessage("A newer saved request replaced this receipt; it was retained for safe recovery."); return; }
        sessionStorage.removeItem(key); setLocked(null); router.refresh(); return;
      }
      if (response.status === 409 && isRejectedPlayoffPlacement(result, eventId)) {
        if (sessionStorage.getItem(key) !== rawAtSend) { setStorageBlocked(true); setMessage("A newer saved request replaced this receipt; it was retained for safe recovery."); return; }
        sessionStorage.removeItem(key); setLocked(null); setPlacements(initialRows(workspace)); setMessage("The server rejected these placements. The latest recorded version has been restored."); router.refresh(); return;
      }
      setMessage("This save is unresolved and remains locked until the server can confirm it.");
    } catch { setMessage("This save is unresolved and remains locked until the server can confirm it."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <section className="policy-settings" aria-labelledby="playoff-placement-title">
    <h2 id="playoff-placement-title">Supervised playoff placements</h2>
    <p className="registration-note"><strong>Separate result record.</strong> Record every qualifier&apos;s playoff finish and exit round here. The legacy MRP calculation and champion playoff credit are under review; do not use this editor as final MRP or ACC attestation. Qualifying-round rank remains unchanged.</p>
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy || !!locked || storageBlocked}>
        <legend>Winner, runner-up, and recorded places</legend>
        {placements.map((entry, index) => <div className="correction-actions" key={entry.placement}>
          <label>{index === 0 ? "Winner" : index === 1 ? "Runner-up" : `Legacy recorded place ${entry.placement}`}
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
      <button className="primary" type="submit" disabled={busy || storageBlocked}>{busy ? "Checking…" : locked ? "Retry exact placement request" : `Record Playoff Result Version ${workspace.currentVersion + 1}`}</button>
    </form>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
    {workspace.playoffResult ? <section className="correction-item"><h3>Current recorded legacy result</h3><p>Version {workspace.playoffResult.version} by {workspace.playoffResult.recordedBy}</p><ol>{workspace.playoffResult.placements.map((entry) => <li key={entry.participantId}>{entry.displayName} — {entry.placement === 1 ? "Winner" : entry.placement === 2 ? "Runner-up" : `Place ${entry.placement}`} · MRP exit round {entry.mrpPlayoffExitRound}</li>)}</ol></section> : null}
  </section>;
}
