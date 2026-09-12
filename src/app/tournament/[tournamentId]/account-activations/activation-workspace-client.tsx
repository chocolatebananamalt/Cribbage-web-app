"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isActivationCancellationResult, isActivationDecisionResult, isActivationIssueResult, type ActivationWorkspace } from "../../../../lib/api/roster-account-activation";

type OneTimeLink = { rosterName: string; url: string; expiresAt: string };
function activationExpiry() { return new Date(Date.now() + 30 * 60 * 1000).toISOString(); }

export default function ActivationWorkspaceClient({ tournamentId, workspace }: { tournamentId: string; workspace: ActivationWorkspace }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [oneTimeLink, setOneTimeLink] = useState<OneTimeLink | null>(null);
  const [phrases, setPhrases] = useState<Record<string, string>>({});

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(body) });
    return { response, body: await response.json().catch(() => null) as unknown };
  }

  async function issue(rosterEntryId: string, rosterName: string) {
    if (busyId) return;
    setBusyId(rosterEntryId); setMessage("Creating a private activation link…"); setOneTimeLink(null);
    try {
      const expiresAt = activationExpiry();
      const result = await post(`/api/v1/tournaments/${tournamentId}/account-activations`, { rosterEntryId, expiresAt, operationId: crypto.randomUUID() });
      if (result.response.ok && isActivationIssueResult(result.body)) {
        setOneTimeLink({ rosterName, url: `${window.location.origin}/activate#${result.body.credential}`, expiresAt: result.body.expiresAt });
        setMessage("Link created. Give it directly to the named player now; the secret cannot be shown again after it is dismissed.");
        router.refresh(); return;
      }
      setMessage(result.response.status === 409 ? "The roster entry already changed or has an active link. Refresh before trying again." : "No activation link was shown. Refresh to confirm the current status before trying again.");
    } catch { setMessage("The result is uncertain. Refresh to confirm whether a link was created before trying again."); }
    finally { setBusyId(null); }
  }

  async function approve(requestId: string) {
    if (busyId) return;
    const confirmationPhrase = (phrases[requestId] ?? "").trim().toUpperCase();
    setBusyId(requestId); setMessage("Confirming the witnessed request…");
    try {
      const result = await post(`/api/v1/tournaments/${tournamentId}/account-activation-requests/${requestId}`, { requestId, decision: "approve", confirmationPhrase, operationId: crypto.randomUUID() });
      if (result.response.ok && isActivationDecisionResult(result.body, requestId)) {
        setPhrases((current) => { const next = { ...current }; delete next[requestId]; return next; });
        setMessage("Player account activated by the tournament server."); router.refresh(); return;
      }
      setMessage(result.response.status === 409 ? "The server rejected the approval. Check the phrase, request status, and separate-witness requirement." : "The result is uncertain. Refresh the pending list before trying again.");
    } catch { setMessage("The result is uncertain. Refresh the pending list before trying again."); }
    finally { setBusyId(null); }
  }

  async function cancel(activationId: string) {
    if (busyId) return;
    setBusyId(activationId); setMessage("Cancelling the activation…");
    try {
      const result = await post(`/api/v1/tournaments/${tournamentId}/account-activations/${activationId}/cancellation`, { activationId, operationId: crypto.randomUUID() });
      if (result.response.ok && isActivationCancellationResult(result.body, activationId)) {
        setOneTimeLink(null); setMessage("Activation cancelled by the tournament server."); router.refresh(); return;
      }
      setMessage(result.response.status === 409 ? "The server rejected the cancellation. Refresh to review the current state." : "The cancellation result is uncertain. Refresh before taking another action.");
    } catch { setMessage("The cancellation result is uncertain. Refresh before taking another action."); }
    finally { setBusyId(null); }
  }

  async function copyLink() {
    if (!oneTimeLink) return;
    try { await navigator.clipboard.writeText(oneTimeLink.url); setMessage("Private activation link copied."); }
    catch { setMessage("This browser could not copy the link. Select it manually before leaving this screen."); }
  }

  const issued = workspace.rosterEntries.filter((entry) => entry.activation?.state === "issued");
  return <section aria-label={`Account activation workspace for ${workspace.tournamentName}`}>
    <p role="status" className="auth-note">{message ?? "No account is linked until the server accepts an independently witnessed approval."}</p>
    {oneTimeLink ? <section className="correction-item" aria-label="One-time player activation link"><h2>Private link for {oneTimeLink.rosterName}</h2><label>Activation URL<input readOnly value={oneTimeLink.url} aria-label="Activation URL" /></label><p>Expires {new Date(oneTimeLink.expiresAt).toLocaleString()}.</p><button className="secondary" type="button" onClick={() => void copyLink()}>Copy Link</button><button className="secondary" type="button" onClick={() => setOneTimeLink(null)}>I Have Shared It</button></section> : null}
    <section><h2>Pending in-person confirmations</h2>{workspace.pendingRequests.length === 0 ? <p>No player is awaiting confirmation.</p> : workspace.pendingRequests.map((request) => <article className="correction-item" key={request.requestId}><h3>{request.rosterDisplayName}</h3><p><strong>Request ID</strong><br /><code>{request.requestId}</code></p><p>Expires {new Date(request.expiresAt).toLocaleString()}.</p>{request.canApprove ? <label>Witness phrase<input autoComplete="off" value={phrases[request.requestId] ?? ""} onChange={(event) => setPhrases((current) => ({ ...current, [request.requestId]: event.target.value.toUpperCase() }))} placeholder="ABCD-EFGH" maxLength={9} /></label> : <p role="note">A different director or co-director must approve this request.</p>}<button className="primary" type="button" disabled={!!busyId || !request.canApprove || !/^[A-Z]{4}-[A-Z]{4}$/.test(phrases[request.requestId] ?? "")} onClick={() => void approve(request.requestId)}>Approve witnessed match</button><button className="secondary" type="button" disabled={!!busyId} onClick={() => void cancel(request.activationId)}>Cancel Request</button></article>)}</section>
    <section><h2>Players without linked accounts</h2>{workspace.rosterEntries.length === 0 ? <p>Every roster entry is linked.</p> : workspace.rosterEntries.map((entry) => <article className="correction-item" key={entry.rosterEntryId}><h3>{entry.displayName}</h3>{entry.activation ? <p>{entry.activation.state === "pending" ? "Waiting for in-person confirmation" : entry.activation.state === "issued" ? "Link issued; player has not requested confirmation" : "Previous link expired"} · {new Date(entry.activation.expiresAt).toLocaleString()}</p> : <p>No active link.</p>}{!entry.activation || entry.activation.state === "expired" ? <button className="primary" type="button" disabled={!!busyId} onClick={() => void issue(entry.rosterEntryId, entry.displayName)}>Create Private Link</button> : null}</article>)}</section>
    {issued.length > 0 ? <section><h2>Issued links</h2><p>Cancel a link that was lost or sent to the wrong person before creating another.</p>{issued.map((entry) => <button className="secondary" type="button" disabled={!!busyId} key={entry.activation?.activationId} onClick={() => void cancel(entry.activation!.activationId)}>Cancel link for {entry.displayName}</button>)}</section> : null}
  </section>;
}
