"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { DirectorAccessWorkspace } from "../lib/api/director-administration";

export function DirectorAccessActions({ access }: { access: DirectorAccessWorkspace }) {
  const [pending, setPending] = useState(!!access.pendingApplicationId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const operationId = useRef<string | null>(null);

  async function requestAccess() {
    setBusy(true); setMessage("");
    try {
      operationId.current ??= crypto.randomUUID();
      const response = await fetch("/api/v1/director-applications", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: operationId.current }),
      });
      const body = await response.json() as { status?: string; error?: string };
      if (response.ok && body.status === "application_submitted") {
        operationId.current = null;
        setPending(true); setMessage("Your director-access request was submitted.");
      } else setMessage(body.error === "existing_authorization" ? "Your director authorization is already on file." : "The request could not be submitted. Please try again.");
    } catch { setMessage("The request could not be submitted. Please try again."); }
    finally { setBusy(false); }
  }

  return <section className="director-actions" aria-labelledby="director-actions-title">
    <h2 id="director-actions-title">Tournament directing</h2>
    {access.canCreateTournament ? <Link className="primary-action" href="/director/tournaments/new">Create Tournament</Link>
      : access.directorStatus === "suspended" ? <p className="auth-note">Tournament creation is currently suspended. Existing tournament access is unchanged.</p>
      : pending ? <p className="auth-note">Your director-access request is waiting for administrator review.</p>
      : <button className="secondary full" type="button" disabled={busy} onClick={requestAccess}>{busy ? "Submitting…" : "Request director access"}</button>}
    {access.isPlatformAdmin ? <Link className="secondary admin-link" href="/platform/directors">Director Administration</Link> : null}
    {message ? <p className="success-text" role="status">{message}</p> : null}
  </section>;
}
