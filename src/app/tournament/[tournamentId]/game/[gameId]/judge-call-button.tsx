"use client";

import { useState } from "react";

export function JudgeCallButton({ tournamentId, gameId }: { tournamentId: string; gameId: string }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function requestJudge() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/judge-calls`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "call", gameId }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok) {
        const accepted = data && typeof data === "object" ? (data as Record<string, unknown>).acceptedJudgeCount : 0;
        setStatus(Number(accepted) >= 2 ? "Two Judges accepted this call." : "Judge Call sent. Please wait for two Judges to accept.");
      } else {
        setStatus("A Judge Call cannot be opened for this game right now. Ask a tournament official for help.");
      }
    } finally {
      setBusy(false);
    }
  }

  return <div className="judge-call-player">
    <button type="button" className="secondary" disabled={busy} onClick={() => void requestJudge()}>{busy ? "Calling a Judge…" : "Call a Judge"}</button>
    {status ? <p className="auth-note" role="status">{status}</p> : null}
  </div>;
}
