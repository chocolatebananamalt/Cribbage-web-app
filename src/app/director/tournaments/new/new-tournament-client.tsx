"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isTournamentCreated } from "../../../../lib/api/director-administration";

type CreateRequest = { name: string; plannedStartDate: string; idempotencyKey: string };
function readPendingRequest(storageKey: string): CreateRequest | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null"); if (!value || typeof value !== "object") return null; const request = value as Partial<CreateRequest>; return typeof request.name === "string" && typeof request.plannedStartDate === "string" && typeof request.idempotencyKey === "string" ? { name: request.name, plannedStartDate: request.plannedStartDate, idempotencyKey: request.idempotencyKey } : null; } catch { return null; } }
function writePendingRequest(storageKey: string, request: CreateRequest) { try { sessionStorage.setItem(storageKey, JSON.stringify(request)); return true; } catch { return false; } }
function clearPendingRequest(storageKey: string) { try { sessionStorage.removeItem(storageKey); } catch { /* server receipt remains authoritative */ } }
function storeCreationReceipt(actorId: string, receipt: { status: "tournament_created"; tournamentId: string; tournamentName: string; tournamentDate: string }) { try { sessionStorage.setItem(`tournament-creation-seed:${actorId}:${receipt.tournamentId}`, JSON.stringify(receipt)); } catch { /* navigation and server receipt remain authoritative */ } }

export function NewTournamentClient({ actorId }: { actorId: string }) {
  const router = useRouter();
  const pendingStorageKey = `director-new-tournament-pending:${actorId}`;
  const [name, setName] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingRequest, setPendingRequest] = useState<CreateRequest | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => { const timer = window.setTimeout(() => { const recovered = readPendingRequest(pendingStorageKey); if (recovered) { setPendingRequest(recovered); setName(recovered.name); setPlannedStartDate(recovered.plannedStartDate); } setHydrated(true); }, 0); return () => window.clearTimeout(timer); }, [pendingStorageKey]);

  async function create(event: React.FormEvent) {
    event.preventDefault(); if (!hydrated || busy || inFlight.current) return; inFlight.current = true; setBusy(true); setMessage("");
    try {
      const request = pendingRequest ?? { name: name.trim(), plannedStartDate, idempotencyKey: crypto.randomUUID() };
      if (!pendingRequest) { if (!writePendingRequest(pendingStorageKey, request)) { setMessage("This browser cannot safely retain the request for recovery."); return; } setPendingRequest(request); }
      const response = await fetch("/api/v1/director/tournaments", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = await response.json() as { tournamentId?: string; error?: string };
      if (response.ok && isTournamentCreated(body)) {
        storeCreationReceipt(actorId, body); clearPendingRequest(pendingStorageKey); setPendingRequest(null);
        router.push(`/tournament/${body.tournamentId}/setup`); router.refresh(); return;
      }
      if (response.status >= 400 && response.status < 500) { clearPendingRequest(pendingStorageKey); setPendingRequest(null); setMessage(body.error === "duplicate_tournament" ? "A tournament with this name and date already exists." : body.error === "director_approval_required" ? "Director approval is required." : "The tournament was not created. Review the form and try again."); }
      else setMessage("The creation request could not be confirmed. Retry the same request when the connection is available.");
    } catch { setMessage("The creation request could not be confirmed. Retry the same request when the connection is available."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <form className="policy-settings" onSubmit={create}>
    <label>Tournament name<input required maxLength={200} disabled={busy || !!pendingRequest || !hydrated} value={name} onChange={(event) => { setName(event.target.value); clearPendingRequest(pendingStorageKey); }} placeholder="Full Rehearsal 09-16-2026" /></label>
    <label>Planned tournament date<input required type="date" disabled={busy || !!pendingRequest || !hydrated} value={plannedStartDate} onChange={(event) => { setPlannedStartDate(event.target.value); clearPendingRequest(pendingStorageKey); }} /></label>
    <button className="primary full" disabled={busy || !hydrated || !name.trim() || !plannedStartDate} type="submit">{busy ? "Creating…" : pendingRequest ? "Retry Exact Draft Creation" : "Create Draft and Continue Setup"}</button>
    {pendingRequest && !busy ? <p className="auth-note" role="status">The request could not be confirmed. Press Retry to send the identical request again. The fields stay locked until this request is confirmed or explicitly rejected.</p> : null}
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </form>;
}
