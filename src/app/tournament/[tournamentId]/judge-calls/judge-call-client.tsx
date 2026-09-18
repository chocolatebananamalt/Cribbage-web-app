"use client";

import { useEffect, useState } from "react";

import type { LiveJudgeCallsWorkspace } from "../../../../lib/api/live-judge-calls";

type Call = LiveJudgeCallsWorkspace["calls"][number];

function messageFor(error: unknown) {
  const code = error && typeof error === "object" ? (error as Record<string, unknown>).error : undefined;
  if (code === "judge_calls_unavailable") return "Judge Calls are available only to assigned judges.";
  return "This Judge Call could not be updated. Refresh and try again.";
}

export default function JudgeCallClient({ tournamentId, initialWorkspace }: { tournamentId: string; initialWorkspace: LiveJudgeCallsWorkspace }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function refresh() {
    const response = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/judge-calls`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== "object" || !Array.isArray((data as LiveJudgeCallsWorkspace).calls)) {
      setStatus(messageFor(data));
      return;
    }
    setWorkspace(data as LiveJudgeCallsWorkspace);
  }

  useEffect(() => {
    const timer = window.setInterval(() => { void refresh(); }, 10_000);
    return () => window.clearInterval(timer);
  });

  async function act(call: Call, action: "accept" | "resolve") {
    setBusyGameId(call.gameId);
    setStatus("");
    try {
      const response = await fetch(`/api/v1/tournaments/${encodeURIComponent(tournamentId)}/judge-calls`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, gameId: call.gameId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(messageFor(data));
        return;
      }
      setStatus(action === "resolve" ? "Situation resolved. The Judge Call has been cleared." : "You accepted this Judge Call.");
      await refresh();
    } finally {
      setBusyGameId(null);
    }
  }

  return <section className="judge-call-list" aria-live="polite">
    <button type="button" className="secondary full" onClick={() => void refresh()}>Refresh Judge Calls</button>
    {status ? <p className="live-status" role="status">{status}</p> : null}
    {workspace.calls.length === 0 ? <p className="auth-note">No Judge Calls need attention.</p> : <ul className="plain-list">
      {workspace.calls.map((call) => <li key={call.gameId} className="judge-call-item">
        <strong>Table/Seat {call.tableSeat}</strong>
        <p>{call.acceptedJudgeCount >= 2 ? "Two Judges accepted this call." : `${call.acceptedJudgeCount} of 2 Judges accepted this call.`}</p>
        {call.assignedToMe
          ? <button type="button" className="primary" disabled={busyGameId === call.gameId} onClick={() => void act(call, "resolve")}>{busyGameId === call.gameId ? "Saving…" : "Situation Resolved"}</button>
          : call.availableToAccept
            ? <button type="button" className="primary" disabled={busyGameId === call.gameId} onClick={() => void act(call, "accept")}>{busyGameId === call.gameId ? "Accepting…" : "Accept Judge Call"}</button>
            : <p className="auth-note">Two Judges accepted this call.</p>}
      </li>)}
    </ul>}
  </section>;
}
