"use client";

import { FormEvent, useEffect, useState } from "react";

export default function EventCheckInForm() {
  const [credential, setCredential] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setCredential(window.location.hash.slice(1)), 0); return () => window.clearTimeout(timer); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const fields = new FormData(event.currentTarget);
    const body = { credential, firstName: String(fields.get('firstName') ?? '').trim(), lastName: String(fields.get('lastName') ?? '').trim(), email: String(fields.get('email') ?? '').trim(), accNumber: String(fields.get('accNumber') ?? '').trim().toUpperCase() };
    try {
      const response = await fetch('/api/v1/event-check-in', { method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store', body: JSON.stringify(body) });
      const data = await response.json().catch(() => null) as { status?: string } | null;
      if (response.ok && data?.status === 'checked_in') setMessage('You are checked in. If you have not already activated app access, the tournament desk will send it after payment is confirmed. Digital scoring remains locked until Start Play.');
      else if (response.ok && data?.status === 'already_checked_in') setMessage('You are already checked in for this event.');
      else if (response.ok && data?.status === 'desk_required') setMessage('Please visit the tournament check-in desk to complete enrollment and payment.');
      else setMessage('This event check-in code is unavailable or expired. Please scan the current code on the event display.');
    } catch { setMessage('This check-in request could not be sent. Please try the current displayed QR code or visit the desk.'); }
    finally { setBusy(false); }
  }
  return <form className="setup-workspace" onSubmit={submit}><label>First name<input name="firstName" required maxLength={80} autoComplete="given-name" /></label><label>Last name<input name="lastName" required maxLength={80} autoComplete="family-name" /></label><label>Email<input name="email" type="email" required maxLength={320} autoComplete="email" /></label><label>ACC # (if known)<input name="accNumber" maxLength={64} inputMode="text" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ''); }} /></label><button className="primary" type="submit" disabled={busy || !credential}>{busy ? 'Checking in…' : 'Check in for this event'}</button>{!credential ? <p className="error-text" role="alert">Scan the current QR code displayed at the event.</p> : null}{message ? <p className="live-status" role="status">{message}</p> : null}</form>;
}
