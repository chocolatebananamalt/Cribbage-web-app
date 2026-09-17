"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Completion = { token: string; expiresAt: string };
const storageKey = "acc:event-check-in:completion";
const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function EventCheckInForm() {
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("Confirming the displayed check-in code…");
  const [busy, setBusy] = useState(false);
  const secondsLeft = useMemo(() => completion ? Math.max(0, Math.ceil((new Date(completion.expiresAt).valueOf() - now) / 1_000)) : 0, [completion, now]);
  const expired = !!completion && secondsLeft === 0;

  useEffect(() => {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) try { const saved = JSON.parse(raw) as Completion; if (typeof saved.token === "string" && new Date(saved.expiresAt).valueOf() > Date.now()) { const timer = window.setTimeout(() => { setCompletion(saved); setMessage("Complete check-in within the time shown."); }, 0); return () => window.clearTimeout(timer); } } catch { /* discard malformed local state */ }
    const credential = window.location.hash.slice(1);
    if (!credential) { const timer = window.setTimeout(() => setMessage("Scan the current QR code displayed at the event."), 0); return () => window.clearTimeout(timer); }
    void (async () => {
      try {
        const response = await fetch("/api/v1/event-check-in", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", body: JSON.stringify({ credential }) });
        const data = await response.json() as { status?: string; completionSession?: string; expiresAt?: string };
        if (!response.ok || data.status !== "ready" || !data.completionSession || !data.expiresAt) throw new Error();
        const next = { token: data.completionSession, expiresAt: data.expiresAt };
        window.history.replaceState(null, "", window.location.pathname);
        window.sessionStorage.setItem(storageKey, JSON.stringify(next)); setCompletion(next); setMessage("Complete check-in within the time shown.");
      } catch { window.history.replaceState(null, "", window.location.pathname); setMessage("This event check-in code is unavailable or expired. Please scan the current code on the event display."); }
    })();
  }, []);
  useEffect(() => { if (!completion) return; const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, [completion]);
  useEffect(() => { if (!expired) return; window.sessionStorage.removeItem(storageKey); const timer = window.setTimeout(() => setMessage("Your check-in time expired. Please scan the current code on the event display to begin again."), 0); return () => window.clearTimeout(timer); }, [expired]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!completion || expired) return; setBusy(true); setMessage("");
    const fields = new FormData(event.currentTarget);
    const body = { completionSession: completion.token, firstName: String(fields.get("firstName") ?? "").trim(), lastName: String(fields.get("lastName") ?? "").trim(), email: String(fields.get("email") ?? "").trim(), accNumber: String(fields.get("accNumber") ?? "").trim().toUpperCase() };
    try {
      const response = await fetch("/api/v1/event-check-in", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", body: JSON.stringify(body) });
      const data = await response.json().catch(() => null) as { status?: string } | null;
      if (response.ok && data?.status === "checked_in") { window.sessionStorage.removeItem(storageKey); setCompletion(null); setMessage("You are checked in. If you have not already activated app access, the tournament desk will send it after payment is confirmed. Digital scoring remains locked until Start Play."); }
      else if (response.ok && data?.status === "already_checked_in") { window.sessionStorage.removeItem(storageKey); setCompletion(null); setMessage("You are already checked in for this event."); }
      else if (response.ok && data?.status === "desk_required") { window.sessionStorage.removeItem(storageKey); setCompletion(null); setMessage("Please visit the tournament check-in desk to complete enrollment and payment."); }
      else setMessage("Your check-in time expired. Please scan the current code on the event display to begin again.");
    } catch { setMessage("This check-in request could not be sent. Please try the current displayed QR code or visit the desk."); }
    finally { setBusy(false); }
  }

  if (!completion) return <p className="live-status" role="status">{message}</p>;
  return <form className="setup-workspace" onSubmit={submit} aria-describedby="check-in-countdown">
    <section className="correction-item" aria-live="polite"><h2>Event Check-In</h2><p id="check-in-countdown"><strong>{format(secondsLeft)}</strong> remaining — complete check-in within the time shown.</p>{secondsLeft <= 60 && secondsLeft > 30 && !expired ? <p className="error-text">One minute or less remains.</p> : null}{secondsLeft <= 30 && !expired ? <p className="error-text">30 seconds remain.</p> : null}</section>
    <label>First name<input name="firstName" required maxLength={80} autoComplete="given-name" disabled={expired || busy} /></label><label>Last name<input name="lastName" required maxLength={80} autoComplete="family-name" disabled={expired || busy} /></label><label>Email<input name="email" type="email" required maxLength={320} autoComplete="email" disabled={expired || busy} /></label><label>ACC #<input name="accNumber" required pattern="[A-Z]{2}[0-9]+" maxLength={64} inputMode="text" autoCapitalize="characters" disabled={expired || busy} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); }} /></label><button className="primary" type="submit" disabled={busy || expired}>{busy ? "Checking in…" : "Check in for this event"}</button><p className="live-status" role="status">{message}</p>
  </form>;
}
