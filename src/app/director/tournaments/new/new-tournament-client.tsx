"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewTournamentClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingRequest, setPendingRequest] = useState<{ name: string; plannedStartDate: string; idempotencyKey: string } | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const request = pendingRequest ?? { name: name.trim(), plannedStartDate, idempotencyKey: crypto.randomUUID() };
      if (!pendingRequest) setPendingRequest(request);
      const response = await fetch("/api/v1/director/tournaments", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = await response.json() as { tournamentId?: string; error?: string };
      if (response.ok && body.tournamentId) {
        setPendingRequest(null);
        router.push(`/tournament/${body.tournamentId}/setup`); router.refresh(); return;
      }
      setMessage(body.error === "duplicate_tournament" ? "A tournament with this name and date already exists." : body.error === "director_approval_required" ? "Director approval is required." : "The tournament could not be created. Please try again.");
    } catch { setMessage("The tournament could not be created. Please try again."); }
    finally { setBusy(false); }
  }

  return <form className="policy-settings" onSubmit={create}>
    <label>Tournament name<input required maxLength={200} value={name} onChange={(event) => { setName(event.target.value); setPendingRequest(null); }} placeholder="Full Rehearsal 09-16-2026" /></label>
    <label>Planned tournament date<input required type="date" value={plannedStartDate} onChange={(event) => { setPlannedStartDate(event.target.value); setPendingRequest(null); }} /></label>
    <button className="primary full" disabled={busy || !name.trim() || !plannedStartDate} type="submit">{busy ? "Creating…" : pendingRequest ? "Retry Exact Draft Creation" : "Create Draft and Continue Setup"}</button>
    {pendingRequest ? <p className="auth-note" role="status">That attempt did not confirm. Press Retry to send the identical request again, which cannot create a second tournament. Editing either field above starts a fresh attempt instead.</p> : null}
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </form>;
}
