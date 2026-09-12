"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  isOpenEventDisputeOutcome,
  isOpenEventDisputeRequest,
  isRejectedEventDispute,
  isResolvedEventDisputeOutcome,
  isResolveEventDisputeRequest,
  type EventDisputeWorkspace,
  type OpenEventDisputeRequest,
  type ResolveEventDisputeRequest,
} from "../../../../../../lib/api/event-disputes";
import { formatUtcDateTime } from "../../../../../../lib/date-time";

type OpenEnvelope = OpenEventDisputeRequest & { kind: "event-dispute-open" };
type ResolveEnvelope = ResolveEventDisputeRequest & { kind: "event-dispute-resolution" };

function readStored<T extends OpenEnvelope | ResolveEnvelope>(key: string, kind: T["kind"]): T | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (item.kind !== kind) return null;
    const { kind: _kind, ...request } = item;
    void _kind;
    const valid = kind === "event-dispute-open"
      ? isOpenEventDisputeRequest(request) : isResolveEventDisputeRequest(request);
    return valid ? value as T : null;
  } catch { return null; }
}

function store(key: string, value: OpenEnvelope | ResolveEnvelope) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function clear(key: string) { try { sessionStorage.removeItem(key); } catch { /* Server remains authoritative. */ } }

function ResolutionForm({ actorId, dispute }: {
  actorId: string;
  dispute: EventDisputeWorkspace["openDisputes"][number];
}) {
  const router = useRouter();
  const key = `event-dispute:resolve:${actorId}:${dispute.disputeId}`;
  const [note, setNote] = useState("");
  const [locked, setLocked] = useState<ResolveEnvelope | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readStored<ResolveEnvelope>(key, "event-dispute-resolution");
      if (saved) { setNote(saved.resolutionNote); setLocked(saved); setMessage("A prior resolution may be unresolved. Retry sends the exact same protected request."); }
    });
    return () => window.clearTimeout(timer);
  }, [key]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dispute.canResolve || busy) return;
    const envelope = locked ?? { kind: "event-dispute-resolution" as const, resolutionNote: note.trim(), idempotencyKey: crypto.randomUUID() };
    const { kind: _kind, ...request } = envelope;
    void _kind;
    if (!isResolveEventDisputeRequest(request)) { setMessage("Enter a short resolution note without line breaks."); return; }
    if (!locked && !store(key, envelope)) { setMessage("This browser cannot retain the protected retry. Enable session storage before continuing."); return; }
    setLocked(envelope); setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/disputes/${encodeURIComponent(dispute.disputeId)}/resolution`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolutionNote: request.resolutionNote, idempotencyKey: request.idempotencyKey }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.ok && isResolvedEventDisputeOutcome(payload, dispute.disputeId)) {
        clear(key); setLocked(null); router.refresh(); return;
      }
      if (response.status === 409 && isRejectedEventDispute(payload, dispute.disputeId, true)) {
        clear(key); setLocked(null); setMessage("The server rejected that resolution. Refresh and review the current dispute state."); router.refresh(); return;
      }
      setMessage("The resolution is unresolved. Retry sends the same protected request.");
    } catch { setMessage("The resolution is unresolved. Retry sends the same protected request."); }
    finally { setBusy(false); }
  }

  if (!dispute.canResolve) return <p className="auth-note">You are a participant in this game, so an independent official must resolve this dispute.</p>;
  return <form onSubmit={submit}>
    <label htmlFor={`resolution-${dispute.disputeId}`}>Resolution note</label>
    <textarea id={`resolution-${dispute.disputeId}`} value={note} maxLength={500} disabled={busy || !!locked} onChange={(event) => setNote(event.target.value)} />
    <button className="primary full" type="submit" disabled={busy || !note.trim()}>{busy ? "Resolving…" : locked ? "Retry locked resolution" : "Resolve dispute"}</button>
    {message ? <p className="error-text" role="status">{message}</p> : null}
  </form>;
}

export default function DisputeClient({ actorId, tournamentId, eventId, workspace }: {
  actorId: string;
  tournamentId: string;
  eventId: string;
  workspace: EventDisputeWorkspace;
}) {
  const router = useRouter();
  const openKey = `event-dispute:open:${actorId}:${eventId}`;
  const firstGame = workspace.games.find((game) => game.canOpen)?.gameId ?? "";
  const [gameId, setGameId] = useState(firstGame);
  const [summary, setSummary] = useState("");
  const [locked, setLocked] = useState<OpenEnvelope | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readStored<OpenEnvelope>(openKey, "event-dispute-open");
      if (saved) { setGameId(saved.gameId); setSummary(saved.summary); setLocked(saved); setMessage("A prior opening request may be unresolved. Retry sends the exact same protected request."); }
    });
    return () => window.clearTimeout(timer);
  }, [openKey]);

  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const envelope = locked ?? { kind: "event-dispute-open" as const, disputeId: crypto.randomUUID(), gameId, summary: summary.trim(), idempotencyKey: crypto.randomUUID() };
    const { kind: _kind, ...request } = envelope;
    void _kind;
    if (!isOpenEventDisputeRequest(request)) { setMessage("Choose a game and enter a short summary without line breaks."); return; }
    if (!locked && !store(openKey, envelope)) { setMessage("This browser cannot retain the protected retry. Enable session storage before continuing."); return; }
    setLocked(envelope); setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/events/${encodeURIComponent(eventId)}/disputes`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disputeId: request.disputeId, gameId: request.gameId, summary: request.summary, idempotencyKey: request.idempotencyKey }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.ok && isOpenEventDisputeOutcome(payload, request, tournamentId, eventId)) {
        clear(openKey); setLocked(null); router.refresh(); return;
      }
      if (response.status === 409 && isRejectedEventDispute(payload, request.disputeId)) {
        clear(openKey); setLocked(null); setMessage("The server rejected that dispute request. Refresh and review the current game state."); router.refresh(); return;
      }
      setMessage("The dispute request is unresolved. Retry sends the same protected request.");
    } catch { setMessage("The dispute request is unresolved. Retry sends the same protected request."); }
    finally { setBusy(false); }
  }

  return <>
    <section className="correction-item" aria-labelledby="open-dispute-title">
      <h2 id="open-dispute-title">Open a dispute</h2>
      {workspace.games.some((game) => game.canOpen) || locked ? <form onSubmit={open}>
        <label htmlFor="dispute-game">Published game</label>
        <select id="dispute-game" value={gameId} disabled={busy || !!locked} onChange={(event) => setGameId(event.target.value)}>
          <option value="">Choose a game</option>
          {workspace.games.filter((game) => game.canOpen || game.gameId === locked?.gameId).map((game) => <option key={game.gameId} value={game.gameId}>Game {game.roundNumber}.{game.matchInstance} · {game.sideAName} / {game.sideBName} · {game.state.replaceAll("_", " ")}</option>)}
        </select>
        <label htmlFor="dispute-summary">Concern summary</label>
        <textarea id="dispute-summary" value={summary} maxLength={500} disabled={busy || !!locked} onChange={(event) => setSummary(event.target.value)} />
        <button className="primary full" type="submit" disabled={busy || !gameId || !summary.trim()}>{busy ? "Recording…" : locked ? "Retry locked request" : "Open dispute"}</button>
      </form> : <p className="auth-note">No published game is currently eligible for a new dispute.</p>}
      {message ? <p className="error-text" role="status">{message}</p> : null}
    </section>
    <h2>Open disputes</h2>
    {workspace.openDisputes.length ? <ul className="correction-list">{workspace.openDisputes.map((dispute) => <li className="correction-item" key={dispute.disputeId}>
      <h3>Game {dispute.matchInstance}: {dispute.sideAName} / {dispute.sideBName}</h3>
      <p>{dispute.summary}</p>
      <p className="auth-note">Opened by {dispute.openedBy} at <time dateTime={dispute.openedAt}>{formatUtcDateTime(dispute.openedAt)}</time>.</p>
      <ResolutionForm actorId={actorId} dispute={dispute} />
    </li>)}</ul> : <p className="auth-note">No open disputes are recorded for this event.</p>}
  </>;
}
