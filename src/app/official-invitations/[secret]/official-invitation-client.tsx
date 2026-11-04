"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { isOfficialInvitationContext, type OfficialInvitationContext } from "../../../lib/api/official-invitation-context";

const roles = { co_director: "Co-Director", cross_checker: "Cross-Checker", judge: "Judge" };
export default function OfficialInvitationClient({ invitationId, initial, legacy = false, signedIn = true }: { invitationId: string; initial: OfficialInvitationContext | null; legacy?: boolean; signedIn?: boolean }) {
  const [context, setContext] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [legacyAccepted, setLegacyAccepted] = useState(false);
  const inFlight = useRef(false);
  const accepted = legacyAccepted || context?.status === "accepted";
  const endpoint = `/api/v1/official-invitations/${encodeURIComponent(invitationId)}`;
  async function check() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
      const result: unknown = await response.json();
      if (response.ok && isOfficialInvitationContext(result) && result.nominationId === invitationId) {
        setContext(result); setUncertain(false); setMessage(result.status === "accepted" ? "Your acceptance is confirmed." : "Still awaiting your acceptance. Check the tournament and role before accepting.");
      } else { setContext(null); setMessage("This invitation is unavailable or does not match your signed-in email."); }
    } catch { setMessage("The result is still uncertain. Check status again before accepting."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function accept() {
    if (inFlight.current || accepted || uncertain || !signedIn || (!legacy && !context)) return;
    inFlight.current = true; setBusy(true);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", cache: "no-store", body: "{}" });
      const result: unknown = await response.json();
      if (response.ok && result && typeof result === "object" && "tournamentId" in result && typeof result.tournamentId === "string") {
        if (context) setContext({ ...context, status: "accepted" }); else setLegacyAccepted(true);
        setMessage("You are now an approved tournament official. Open Your Tournaments to continue.");
      } else {
        setUncertain(true); setMessage(legacy ? "Acceptance was not confirmed. Open Your Tournaments to check your access, then reload this invitation before trying again." : response.status >= 500 || response.ok ? "The result is uncertain. Check status before trying again." : "Acceptance was not confirmed. Check status; the invitation may be expired or unavailable.");
      }
    } catch { setUncertain(true); setMessage(legacy ? "The result is uncertain. Open Your Tournaments to check your access, then reload this invitation before trying again." : "The result is uncertain. Check status before trying again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <><p className="eyebrow">TOURNAMENT OFFICIALS</p><h1>Accept official invitation</h1>
    {context ? <div className="card-context"><h2>{context.tournamentName}</h2><p>Invited role: <strong>{roles[context.role]}</strong></p><p>Acceptance deadline: <time dateTime={context.expiresAt}>{new Date(context.expiresAt).toISOString().replace("T", " ").replace(".000Z", " UTC")}</time></p></div> : null}
    <p role="status" className="auth-note">{message || (accepted ? "Your official acceptance is confirmed." : !signedIn ? "Sign in with the exact invited email, then return to this link. No authority is granted until you accept." : legacy ? "Confirm only if you were invited as a tournament official." : context ? "Check this tournament and role. Accept only if this is your invitation." : "This invitation is unavailable or does not match your signed-in email.")}</p>
    <button className="primary" disabled={busy || accepted || uncertain || !signedIn || (!legacy && !context)} onClick={() => void accept()}>{busy ? "Checking invitation…" : accepted ? "Accepted" : "Accept invitation"}</button>
    {!legacy && signedIn ? <button type="button" className="secondary" disabled={busy} onClick={() => void check()}>Check acceptance status</button> : null}
    {legacy && uncertain ? <p className="field-help">Open Your Tournaments to check your access. Reload this invitation before another attempt; no automatic retry will be made.</p> : null}
    {!signedIn ? <Link className="guide-link" href={`/sign-in?next=${encodeURIComponent(`/official-invitations/${invitationId}`)}`}>Sign in</Link> : null}
    <Link className="guide-link" href="/">Your Tournaments</Link>
  </>;
}
