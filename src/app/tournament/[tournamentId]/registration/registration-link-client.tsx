"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { isRegistrationLinkState, type RegistrationLinkState } from "../../../../lib/api/registration-link";
import { formatUtcDateTime } from "../../../../lib/date-time";

type OneTimeLink = { url: string; expiresAt: string };
type LinkResponse = { status: "issued" | "rotated"; credential: string; expiresAt: string; linkId?: string; version?: number };

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

export default function RegistrationLinkClient({ tournamentId, initialState }: { tournamentId: string; initialState: RegistrationLinkState }) {
  const [state, setState] = useState(initialState);
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [maxClaims, setMaxClaims] = useState("200");
  const [maxClaimsPerHour, setMaxClaimsPerHour] = useState("100");
  const [oneTimeLink, setOneTimeLink] = useState<OneTimeLink | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [message, setMessage] = useState(stateMessage(initialState));
  const [busy, setBusy] = useState(false);
  const basePayload = useMemo(() => ({ expiresAt: toInstant(expiresAt), maxClaims: Number(maxClaims), maxClaimsPerHour: Number(maxClaimsPerHour) }), [expiresAt, maxClaims, maxClaimsPerHour]);
  const formValid = !!basePayload.expiresAt && Number.isInteger(basePayload.maxClaims) && basePayload.maxClaims >= 1 && basePayload.maxClaims <= 2000 && Number.isInteger(basePayload.maxClaimsPerHour) && basePayload.maxClaimsPerHour >= 1 && basePayload.maxClaimsPerHour <= 1000;

  useEffect(() => {
    let active = true;
    if (!oneTimeLink) return;
    void QRCode.toDataURL(oneTimeLink.url, { errorCorrectionLevel: "M", margin: 1, width: 280 }).then((value) => { if (active) setQrImage(value); }).catch(() => { if (active) setQrImage(null); });
    return () => { active = false; };
  }, [oneTimeLink]);

  async function request(path: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/registration-links${path}`, { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", credentials: "same-origin", body: JSON.stringify(body) });
    return { status: response.status, body: await response.json().catch(() => null) };
  }
  async function refreshState() {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/registration-links`, { cache: "no-store", credentials: "same-origin" });
    const result: unknown = response.ok ? await response.json().catch(() => null) : null;
    if (!isRegistrationLinkState(result)) throw new Error("Registration link state is unavailable.");
    setState(result);
  }
  async function saveOneTimeLink(result: LinkResponse) {
    const url = `${window.location.origin}/register#${result.credential}`;
    setOneTimeLink({ url, expiresAt: result.expiresAt });
    try { await refreshState(); }
    catch { setMessage("Link created, but its status could not be refreshed. Save the QR code and refresh before any replacement or close action."); return; }
    setMessage("Link created. Copy or print the QR code now; its secret cannot be shown again after you leave this screen.");
  }
  async function issueOrRotate() {
    if (busy || !formValid || !basePayload.expiresAt || state.status === "closed") return;
    setBusy(true); setOneTimeLink(null); setQrImage(null); setMessage("Creating a protected registration link…");
    try {
      const rotating = state.status === "open";
      const body = rotating ? { ...basePayload, expectedLinkId: state.linkId, expectedVersion: state.version, operationId: crypto.randomUUID() } : { ...basePayload, operationId: crypto.randomUUID() };
      const result = await request(rotating ? "/rotate" : "", body);
      if (result.status === 201 && exactLinkResponse(result.body)) { await saveOneTimeLink(result.body); return; }
      setMessage(result.status === 409 ? "The link changed before this request completed. Refresh before trying again." : "The registration link could not be created. No QR code was shown.");
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
  async function copy() { if (!oneTimeLink) return; try { await navigator.clipboard.writeText(oneTimeLink.url); setMessage("Registration link copied. Treat it like a temporary key while it is active."); } catch { setMessage("This browser could not copy the link. Select it manually before leaving this screen."); } }

  return <section className="registration-link-manager"><p className="registration-note" role="status">{message}</p><div className="registration-link-state"><strong>Current status</strong><span>{stateMessage(state)}</span></div><fieldset disabled={busy}><legend>{state.status === "open" ? "Replace active link" : "Create registration link"}</legend><label>Link expiry<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label><label>Maximum registrations<input inputMode="numeric" value={maxClaims} onChange={(event) => setMaxClaims(event.target.value)} /></label><label>Maximum registrations per hour<input inputMode="numeric" value={maxClaimsPerHour} onChange={(event) => setMaxClaimsPerHour(event.target.value)} /></label></fieldset><div className="registration-link-actions"><button className="primary" type="button" disabled={busy || !formValid || state.status === "closed"} onClick={() => void issueOrRotate()}>{busy ? "Working…" : state.status === "open" ? "Replace Link" : "Create Link"}</button>{state.status === "open" ? <button className="secondary" type="button" disabled={busy} onClick={() => void close()}>Close Link</button> : null}</div>{oneTimeLink ? <section className="registration-link-secret" aria-label="One-time registration link"><h2>QR-ready registration link</h2>{qrImage ? <Image src={qrImage} alt="QR code for the tournament registration link" width={280} height={280} unoptimized /> : <p>Preparing QR code…</p>}<label>Registration URL<input readOnly value={oneTimeLink.url} aria-label="Registration URL" /></label><p>Expires {formatUtcDateTime(oneTimeLink.expiresAt)}. This exact URL will not be recoverable from the app after you dismiss it.</p><button className="secondary" type="button" onClick={() => void copy()}>Copy Link</button><button className="secondary" type="button" onClick={() => { setOneTimeLink(null); setQrImage(null); }}>I Have Saved It</button></section> : null}</section>;
}
