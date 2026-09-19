"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { archiveRejectionMessage, isTournamentArchiveResult } from "../../../lib/api/tournament-archive";

export function ArchiveTournamentClient({ tournamentId, tournamentName }: { tournamentId: string; tournamentName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Held across retries so a request that may already have been applied is
  // retried as the same operation rather than counted twice.
  const operationId = useRef<string | null>(null);

  async function archive() {
    setBusy(true); setMessage("");
    try {
      operationId.current ??= crypto.randomUUID();
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/archive`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "archive", reason: reason.trim(), idempotencyKey: operationId.current }),
      });
      const body = await response.json().catch(() => null) as unknown;
      if (!isTournamentArchiveResult(body)) { setMessage("The tournament could not be archived. Reload and try again."); return; }
      if (body.status === "rejected") { setMessage(archiveRejectionMessage(body.code)); return; }
      operationId.current = null;
      router.push("/"); router.refresh();
    } catch { setMessage("The tournament could not be archived. Reload and try again."); }
    finally { setBusy(false); }
  }

  if (!confirming) {
    return <section className="workspace-archive" aria-labelledby="archive-tournament-title">
      <h2 id="archive-tournament-title">Archive this tournament</h2>
      <p className="auth-note">Archiving removes this tournament from everyone&apos;s tournament list. Nothing is deleted: the roster, payments, scores, corrections and the full audit history are all kept, and the primary director can restore it. Archiving also frees this name and date to be used for a new tournament.</p>
      <button className="secondary" type="button" onClick={() => setConfirming(true)}>Archive tournament</button>
    </section>;
  }

  return <section className="workspace-archive" aria-labelledby="archive-tournament-title">
    <h2 id="archive-tournament-title">Archive this tournament</h2>
    <p className="auth-note">This removes <strong>{tournamentName}</strong> from the tournament list for every person who can see it. It does not delete any record, and you can restore it.</p>
    <label>Reason (*required)<input value={reason} maxLength={1000} disabled={busy} onChange={(event) => setReason(event.target.value)} placeholder="Rehearsal finished; archiving so it stops appearing beside the real tournament." /></label>
    <button className="secondary danger-button" type="button" disabled={busy || !reason.trim()} onClick={() => void archive()}>{busy ? "Archiving…" : "Yes, archive this tournament"}</button>
    <button className="secondary" type="button" disabled={busy} onClick={() => { setConfirming(false); setMessage(""); }}>Cancel</button>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </section>;
}
