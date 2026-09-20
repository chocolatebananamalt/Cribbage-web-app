"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { isRegistrationLinkState, type RegistrationLinkState } from "../../../../lib/api/registration-link";
import { formatUtcDateTime } from "../../../../lib/date-time";

type OneTimeLink = { url: string; expiresAt: string; view: "qr" | "link" };
type LinkResponse = { status: "issued" | "rotated"; credential: string; expiresAt: string; linkId?: string; version?: number };
type RevealResponse = { status: "revealable"; credential: string };
type CredentialAvailability = "checking" | "recoverable" | "legacy_unrecoverable";

function defaultExpiry() { const value = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); value.setSeconds(0, 0); return value.toISOString().slice(0, 16); }
function toInstant(value: string) { const date = new Date(value); return Number.isFinite(date.valueOf()) ? date.toISOString() : null; }
function stateMessage(state: RegistrationLinkState) {
  if (state.status === "none") return "No registration link has been created.";
  if (state.status === "open") return `Active link · expires ${formatUtcDateTime(state.expiresAt)}`;
  if (state.status === "expired") return "This registration link has expired. Replace it before sharing.";
  return "This registration link is closed.";
}
function exactLinkResponse(value: unknown): value is LinkResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (item.status === "issued" || item.status === "rotated") && typeof item.credential === "string" && typeof item.expiresAt === "string";
}
function exactRevealResponse(value: unknown): value is RevealResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 2 && item.status === "revealable" && typeof item.credential === "string";
}

export default function RegistrationLinkClient({ tournamentId, initialState }: { tournamentId: string; initialState: RegistrationLinkState }) {
  const [state, setState] = useState(initialState);
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [maxClaims, setMaxClaims] = useState("200");
  const [maxClaimsPerHour, setMaxClaimsPerHour] = useState("100");
  const [oneTimeLink, setOneTimeLink] = useState<OneTimeLink | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // Replace and Close both invalidate the QR code players are scanning, on one
  // click, with no way back. Close registration and Publish seating each make the
  // director tick a box first; these two did not, and they are the two that can
  // strand a room full of people mid-registration. Nothing destructive happens
  // until this is set and then confirmed.
  const [confirming, setConfirming] = useState<"replace" | "close" | null>(null);
  const [credentialAvailability, setCredentialAvailability] = useState<CredentialAvailability>(initialState.status === "open" ? "checking" : "legacy_unrecoverable");
  const basePayload = useMemo(() => ({ expiresAt: toInstant(expiresAt), maxClaims: Number(maxClaims), maxClaimsPerHour: Number(maxClaimsPerHour) }), [expiresAt, maxClaims, maxClaimsPerHour]);
  const formValid = !!basePayload.expiresAt && Number.isInteger(basePayload.maxClaims) && basePayload.maxClaims >= 1 && basePayload.maxClaims <= 2000 && Number.isInteger(basePayload.maxClaimsPerHour) && basePayload.maxClaimsPerHour >= 1 && basePayload.maxClaimsPerHour <= 1000;

  useEffect(() => {
    let active = true;
    if (!oneTimeLink) return;
    void QRCode.toDataURL(oneTimeLink.url, { errorCorrectionLevel: "M", margin: 1, width: 280 }).then((value) => { if (active) setQrImage(value); }).catch(() => { if (active) setQrImage(null); });
    return () => { active = false; };
  }, [oneTimeLink]);

  useEffect(() => {
    if (initialState.status !== "open") return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/v1/tournaments/${tournamentId}/registration-links/reveal-availability`, {
          method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", credentials: "same-origin",
          body: JSON.stringify({ expectedLinkId: initialState.linkId, expectedVersion: initialState.version, operationId: crypto.randomUUID() }),
        });
        const result: unknown = response.ok ? await response.json().catch(() => null) : null;
        const availability = result && typeof result === "object" ? (result as { status?: unknown }).status : null;
        if (active) setCredentialAvailability(availability === "recoverable" || availability === "legacy_unrecoverable" ? availability : "legacy_unrecoverable");
      } catch { if (active) setCredentialAvailability("legacy_unrecoverable"); }
    })();
    return () => { active = false; };
  }, [initialState, tournamentId]);

  async function request(path: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/registration-links${path}`, { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", credentials: "same-origin", body: JSON.stringify(body) });
    return { status: response.status, body: await response.json().catch(() => null) };
  }
  async function refreshState() {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/registration-links`, { cache: "no-store", credentials: "same-origin" });
    const result: unknown = response.ok ? await response.json().catch(() => null) : null;
    if (!isRegistrationLinkState(result)) throw new Error("Registration link state is unavailable.");
    setState(result);
    return result;
  }
  async function refreshCredentialAvailability(currentState: RegistrationLinkState) {
    if (currentState.status !== "open") { setCredentialAvailability("legacy_unrecoverable"); return; }
    setCredentialAvailability("checking");
    const result = await request("/reveal-availability", { expectedLinkId: currentState.linkId, expectedVersion: currentState.version, operationId: crypto.randomUUID() });
    if (result.status === 200 && result.body && typeof result.body === "object") {
      const availability = (result.body as { status?: unknown }).status;
      if (availability === "recoverable" || availability === "legacy_unrecoverable") { setCredentialAvailability(availability); return; }
    }
    setCredentialAvailability("legacy_unrecoverable");
  }
  async function saveOneTimeLink(result: LinkResponse, view: OneTimeLink["view"] = "qr", notice = "Registration link created. Its active QR code and link can be viewed again here while registration remains open.") {
    const url = `${window.location.origin}/register#${result.credential}`;
    setOneTimeLink({ url, expiresAt: result.expiresAt, view });
    try { const currentState = await refreshState(); await refreshCredentialAvailability(currentState); }
    catch { setMessage("Link created, but its status could not be refreshed. Save the QR code and refresh before any replacement or close action."); return; }
    setMessage(notice);
  }
  async function issueOrRotate() {
    if (busy || !formValid || !basePayload.expiresAt || state.status === "closed") return;
    setBusy(true); setOneTimeLink(null); setQrImage(null); setMessage("Creating a protected registration link…");
    try {
      const rotating = state.status === "open";
      const body = rotating ? { ...basePayload, expectedLinkId: state.linkId, expectedVersion: state.version, operationId: crypto.randomUUID() } : { ...basePayload, operationId: crypto.randomUUID() };
      const result = await request(rotating ? "/rotate" : "", body);
      if (result.status === 201 && exactLinkResponse(result.body)) { await saveOneTimeLink(result.body); return; }
      const code = result.body && typeof result.body === "object" ? (result.body as { error?: unknown }).error : null;
      setMessage(code === "registration_link_reveal_key_required" ? "This server is missing the registration link encryption setting, so no link can be created yet. Set ACC_REGISTRATION_LINK_REVEAL_KEY in the hosting environment to 32 random bytes and redeploy. Nothing else on this page is affected." : code === "registration_contact_required" ? "Before creating or replacing a QR link, save the current Tournament Setup. Only the player-facing Director information deliberately entered there can appear on registration." : result.status === 409 ? "The link changed before this request completed. Refresh before trying again." : "The registration link could not be created. No QR code was shown.");
    } catch { setMessage("The registration link could not be created. No QR code was shown."); } finally { setBusy(false); }
  }
  async function close() {
    if (busy || state.status !== "open") return;
    setBusy(true); setOneTimeLink(null); setQrImage(null); setMessage("Closing the registration link…");
    try {
      const result = await request("/close", { expectedLinkId: state.linkId, expectedVersion: state.version, operationId: crypto.randomUUID() });
      if (result.status === 200 && result.body && typeof result.body === "object" && (result.body as { status?: unknown }).status === "closed") { setState({ ...state, status: "closed", version: (result.body as { version: number }).version }); setMessage("Registration link closed."); return; }
      setMessage(result.status === 409 ? "The link changed before it could be closed. Refresh before trying again." : "The registration link could not be closed.");
    } catch { setMessage("The registration link could not be closed."); } finally { setBusy(false); }
  }
  async function reveal(view: OneTimeLink["view"]) {
    if (busy || state.status !== "open" || credentialAvailability !== "recoverable") return;
    setBusy(true); setOneTimeLink(null); setQrImage(null); setMessage("Retrieving the active registration link…");
    try {
      const result = await request("/reveal", { expectedLinkId: state.linkId, expectedVersion: state.version, operationId: crypto.randomUUID() });
      if (result.status === 200 && exactRevealResponse(result.body)) {
        await saveOneTimeLink({ status: "issued", credential: result.body.credential, expiresAt: state.expiresAt }, view, "Active registration access shown. Viewing it did not change the QR code or link.");
        return;
      }
      const code = result.body && typeof result.body === "object" ? (result.body as { error?: unknown }).error : null;
      setMessage(code === "legacy_credential_unavailable" ? "This legacy active link continues to work but cannot be shown again. Replace it only when you are ready to invalidate the old QR code." : "The active registration link changed before it could be shown. Refresh before trying again.");
    } catch { setMessage("The active registration link could not be shown. Refresh and try again."); } finally { setBusy(false); }
  }
  async function copy() { if (!oneTimeLink) return; try { await navigator.clipboard.writeText(oneTimeLink.url); setMessage("Registration link copied. Treat it like a temporary key while it is active."); } catch { setMessage("This browser could not copy the link. Select it manually before leaving this screen."); } }

  return <section className="registration-link-manager"><div className="registration-link-state"><strong>Current status</strong><span>{stateMessage(state)}</span></div>{state.status === "open" ? <section className="registration-link-secret" aria-label="Active registration access"><h2>Active registration access</h2>{credentialAvailability === "checking" ? <p>Checking whether this active link can be displayed again…</p> : credentialAvailability === "recoverable" ? <><p>Display this same code at the tournament or copy the same link again without invalidating it.</p><div className="registration-link-actions"><button className="primary" type="button" disabled={busy} onClick={() => void reveal("qr")}>View Active QR Code</button><button className="secondary" type="button" disabled={busy} onClick={() => void reveal("link")}>View Active Link</button><button className="secondary" type="button" disabled={busy} onClick={() => setConfirming("close")}>Close Link</button></div></> : <p>This legacy active link continues to work, but it cannot be shown again. Replace it only when you are ready to invalidate the old QR code.</p>}</section> : null}<fieldset disabled={busy}><legend>{state.status === "open" ? "Replace active QR code and link" : "Create registration link"}</legend>{state.status === "open" ? <p>Replacing the link immediately invalidates the active QR code and URL.</p> : null}<label>Link expiry<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label><label>Maximum registrations<input inputMode="numeric" value={maxClaims} onChange={(event) => setMaxClaims(event.target.value)} /></label><label>Maximum registrations per hour<input inputMode="numeric" value={maxClaimsPerHour} onChange={(event) => setMaxClaimsPerHour(event.target.value)} /></label></fieldset><div className="registration-link-actions"><button className="secondary" type="button" disabled={busy || !formValid || state.status === "closed"} onClick={() => { if (state.status === "open") setConfirming("replace"); else void issueOrRotate(); }}>{busy ? "Working…" : state.status === "open" ? "Replace Active QR Code and Link" : "Create Link"}</button></div>{confirming ? <section className="registration-link-secret" aria-label="Confirm registration link change"><h2>{confirming === "replace" ? "Replace the active QR code and link?" : "Close the registration link?"}</h2><p>{confirming === "replace" ? "The QR code players are scanning right now stops working the moment it is replaced. Anyone holding the old link, or a printed copy of the old code, sees only that the registration link is unavailable. A new QR code and link are created in its place." : "Registration stops immediately. The QR code players are scanning right now stops working, and nobody can submit a new registration until a new link is created."}</p><p>Registrations already received are kept either way.</p><div className="registration-link-actions"><button className="primary" type="button" disabled={busy} onClick={() => { const action = confirming; setConfirming(null); if (action === "replace") void issueOrRotate(); else void close(); }}>{confirming === "replace" ? "Yes, replace the QR code and link" : "Yes, close the link"}</button><button className="secondary" type="button" disabled={busy} onClick={() => setConfirming(null)}>Cancel</button></div></section> : null}{oneTimeLink ? <section className="registration-link-secret" aria-label="Active registration link"><h2>{oneTimeLink.view === "qr" ? "Active registration QR code" : "Active registration link"}</h2>{oneTimeLink.view === "qr" ? qrImage ? <Image src={qrImage} alt="QR code for the tournament registration link" width={280} height={280} unoptimized /> : <p>Preparing QR code…</p> : null}<label>Registration URL<input readOnly value={oneTimeLink.url} aria-label="Registration URL" /></label><p>Expires {formatUtcDateTime(oneTimeLink.expiresAt)}. Viewing this link does not change it.</p><button className="secondary" type="button" onClick={() => void copy()}>Copy Link</button><button className="secondary" type="button" onClick={() => { setOneTimeLink(null); setQrImage(null); }}>Done</button></section> : null}{message ? <p className="registration-note" role="status">{message}</p> : null}</section>;
}
