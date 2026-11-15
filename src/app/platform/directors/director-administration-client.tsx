"use client";

import { useState } from "react";
import type { DirectorAdminWorkspace } from "../../../lib/api/director-administration";

export function DirectorAdministrationClient({ initial }: { initial: DirectorAdminWorkspace }) {
  const [workspace, setWorkspace] = useState(initial);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/v1/platform/directors", { cache: "no-store" });
    if (response.ok) setWorkspace(await response.json() as DirectorAdminWorkspace);
  }

  async function review(applicationId: string, decision: "approve" | "reject", accVerified: boolean) {
    setBusy(applicationId); setMessage("");
    try {
      const response = await fetch(`/api/v1/platform/director-applications/${applicationId}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, accVerified, note: decision === "approve" ? "Approved for tournament creation in the app" : "Director access request declined", idempotencyKey: crypto.randomUUID() }),
      });
      if (!response.ok) { const body = await response.json() as { error?: string }; setMessage(body.error ?? "Review could not be saved."); }
      else { await refresh(); setMessage(decision === "approve" ? "Director access approved." : "Director request rejected."); }
    } catch { setMessage("Review could not be saved."); }
    finally { setBusy(""); }
  }

  async function changeStatus(profileId: string, status: "approved" | "suspended") {
    const note = window.prompt(status === "suspended" ? "Reason for suspension" : "Reason for restoring access");
    if (!note?.trim()) return;
    setBusy(profileId); setMessage("");
    try {
      const response = await fetch(`/api/v1/platform/directors/${profileId}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, note: note.trim(), idempotencyKey: crypto.randomUUID() }),
      });
      if (!response.ok) { const body = await response.json() as { error?: string }; setMessage(body.error ?? "Status could not be saved."); }
      else { await refresh(); setMessage(status === "approved" ? "Director access restored." : "Director creation access suspended."); }
    } catch { setMessage("Status could not be saved."); }
    finally { setBusy(""); }
  }

  const pending = workspace.applications.filter((item) => item.status === "pending");
  return <div className="director-admin-workspace">
    {message ? <p className="success-text" role="status">{message}</p> : null}
    <section><h2>Pending requests</h2>{pending.length ? <ul className="director-admin-list">{pending.map((application) => <li key={application.applicationId}>
      <div><strong>{application.displayName}</strong><span>Requested {new Date(application.submittedAt).toLocaleDateString()}</span></div>
      <div className="director-admin-buttons"><button className="primary" disabled={!!busy} onClick={() => review(application.applicationId, "approve", false)}>Approve App Access</button>
      {workspace.administratorType === "acc_administrator" ? <button className="secondary" disabled={!!busy} onClick={() => review(application.applicationId, "approve", true)}>Approve + ACC Verify</button> : null}
      <button className="secondary" disabled={!!busy} onClick={() => review(application.applicationId, "reject", false)}>Reject</button></div>
    </li>)}</ul> : <p className="auth-note">No director requests are waiting.</p>}</section>
    <section><h2>Approved directors</h2>{workspace.authorizations.length ? <ul className="director-admin-list">{workspace.authorizations.map((authorization) => <li key={authorization.profileId}>
      <div><strong>{authorization.displayName}</strong><span>{authorization.accVerified ? "ACC-verified director" : "Approved for app use"} · {authorization.status}</span></div>
      <button className="secondary" disabled={!!busy} onClick={() => changeStatus(authorization.profileId, authorization.status === "approved" ? "suspended" : "approved")}>{authorization.status === "approved" ? "Suspend Creation Access" : "Restore Creation Access"}</button>
    </li>)}</ul> : <p className="auth-note">No approved directors yet.</p>}</section>
  </div>;
}
