"use client";

import { useCallback, useEffect, useState } from "react";

import { isAcceptedEventChange, isRejectedEventChange, type EventChangeRequest } from "../../../../lib/api/event-changes";

type EventRow = { eventId: string; name: string; eventType: string; format: string; operationalState: "active" | "retired" | "replaced"; participantCount: number; hasStarted: boolean; replacementEventId: string | null; reason: string | null };
type Workspace = { tournamentName: string; canManage: boolean; events: EventRow[] };

function isWorkspace(value: unknown): value is Workspace {
  return !!value && typeof value === "object" && typeof (value as Record<string, unknown>).tournamentName === "string"
    && typeof (value as Record<string, unknown>).canManage === "boolean" && Array.isArray((value as Record<string, unknown>).events);
}

export default function EventChangesClient({ tournamentId }: { tournamentId: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("Loading event changes…");
  const [busy, setBusy] = useState(false);
  const [pendingChange, setPendingChange] = useState<{ event: EventRow; action: "retire" | "replace" } | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/event-changes`, { cache: "no-store", credentials: "same-origin" });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !isWorkspace(data)) throw new Error("workspace");
    setWorkspace(data); setMessage(data.canManage ? "Only the primary director may make these exceptional changes." : "Only the primary director may make these exceptional changes.");
  }, [tournamentId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(() => setMessage("Event changes are temporarily unavailable. Refresh to retry.")); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function change(event: EventRow, action: "retire" | "replace") {
    if (!workspace?.canManage || !reason.trim() || busy) return;
    setPendingChange(null);
    const request: EventChangeRequest = { eventId: event.eventId, action, reason: reason.trim(), idempotencyKey: crypto.randomUUID() };
    setBusy(true); setMessage(`${action === "retire" ? "Retiring" : "Creating replacement for"} ${event.name}…`);
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/event-changes`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedEventChange(data, request)) { setReason(""); await load(); setMessage(action === "retire" ? "Event retired. Existing registrations and payment history were preserved." : "Replacement event created. Eligible enrollments and their tournament-level payment credit references were carried forward; review the replacement before play."); return; }
      if (response.status === 409 && isRejectedEventChange(data)) { setMessage(`No event change was made: ${(data as { code: string }).code.replaceAll("_", " ")}.`); return; }
      setMessage("The event change was not completed. No records were removed.");
    } catch { setMessage("The event change was not completed. No records were removed."); }
    finally { setBusy(false); }
  }
  if (!workspace) return <p className="auth-note" role="status">{message}</p>;
  return <section className="setup-amendment"><p className="auth-note">Cancel/Retire and Cancel/Replace preserve event, roster, payment, and audit history. They are unavailable after Start Play. Co-directors cannot use them.</p>
    {workspace.canManage ? <label>Required director reason<textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label> : null}
    <p className={message.includes("unavailable") || message.includes("not completed") ? "error-text" : "auth-note"} role="status">{message}</p>
    <ul className="event-change-list">{workspace.events.map((event) => <li key={event.eventId}><strong>{event.name}</strong> — {event.operationalState}; {event.participantCount} enrolled{event.hasStarted ? "; play has started" : ""}{event.reason ? `; ${event.reason}` : ""}
      {workspace.canManage && event.operationalState === "active" && !event.hasStarted ? <span className="setup-actions"><button type="button" className="secondary danger-button" disabled={busy || !reason.trim()} onClick={() => setPendingChange({ event, action: "retire" })}>Cancel / Retire</button><button type="button" className="secondary" disabled={busy || !reason.trim()} onClick={() => setPendingChange({ event, action: "replace" })}>Cancel / Replace</button></span> : null}
    </li>)}</ul>{pendingChange ? <section className="setup-amendment" role="alertdialog" aria-modal="true" aria-labelledby="event-change-confirmation-title"><h2 id="event-change-confirmation-title">{pendingChange.action === "retire" ? "Retire this event?" : "Cancel and replace this event?"}</h2><p>{pendingChange.action === "retire" ? "The event, registrations, payment history, and audit history remain available. New enrollment will stop." : "The original event remains in history. Eligible enrollments and tournament-level payment credit references will be copied to a separately identified replacement for your review."}</p><div className="setup-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setPendingChange(null)}>Cancel</button><button type="button" className={pendingChange.action === "retire" ? "secondary danger-button" : "primary"} disabled={busy} onClick={() => void change(pendingChange.event, pendingChange.action)}>{pendingChange.action === "retire" ? "Yes, Retire Event" : "Yes, Cancel & Replace"}</button></div></section> : null}
  </section>;
}
