"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Availability = { tournamentName: string } | null;

export default function RegistrationForm({ token }: { token: string }) {
  const [availability, setAvailability] = useState<Availability>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operationId = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/registration/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<Availability> : null)
      .then(setAvailability)
      .catch(() => setAvailability(null))
      .finally(() => setLoaded(true));
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !availability) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    if (!operationId.current) {
      const storageKey = `registration-operation:${token}`;
      const stored = window.sessionStorage.getItem(storageKey);
      operationId.current = stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored) ? stored : crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, operationId.current);
    }
    try {
      const response = await fetch(`/api/v1/registration/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: form.get("displayName"), email: form.get("email"), accNumber: form.get("accNumber"), intendedPaymentMethod: form.get("paymentMethod"), idempotencyKey: operationId.current }),
      });
      if (response.status === 201) { setComplete(true); return; }
      if (response.status === 400) { setError("Please check the information and try again."); return; }
      if (response.status === 409) { setError("Your previous registration request has different details. Please contact the tournament director rather than sending another claim."); return; }
      if (response.status === 429) { setError("Registration is temporarily busy. Please wait a few minutes and try again."); return; }
      setError("This registration link is unavailable. Please contact the tournament director.");
    } catch {
      setError("We could not reach the tournament desk. Please try again; your submission will not be duplicated.");
    } finally { setBusy(false); }
  }

  if (!loaded) return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">ACC TOURNAMENT DESK</p><p role="status">Opening registration…</p></section></main>;
  if (!availability) return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">ACC TOURNAMENT DESK</p><h1>Registration unavailable</h1><p className="auth-note">This registration link is closed or unavailable. Please contact the tournament director.</p></section></main>;
  if (complete) return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">{availability.tournamentName}</p><h1>Registration received</h1><p role="status">Thank you. The tournament director will review your registration and payment directly. This does not assign a seat or confirm payment.</p></section></main>;
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="registration-title"><p className="eyebrow">ACC TOURNAMENT DESK</p><h1 id="registration-title">Register for {availability.tournamentName}</h1><p className="auth-note">Send your registration for director review. Payment and seating are confirmed separately.</p><form onSubmit={submit}><label htmlFor="display-name">First and last name</label><input id="display-name" name="displayName" autoComplete="name" required maxLength={160} /><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={320} /><label htmlFor="acc-number">ACC number (if you have one)</label><input id="acc-number" name="accNumber" maxLength={64} /><label htmlFor="payment-method">Planned payment method</label><select id="payment-method" name="paymentMethod" defaultValue="unspecified"><option value="unspecified">Not yet decided</option><option value="cash">Cash</option><option value="check">Check</option><option value="other">Other</option></select><button className="primary-action" type="submit" disabled={busy}>{busy ? "Sending…" : "Send registration"}</button></form>{error ? <p className="error-text" role="alert">{error}</p> : null}</section></main>;
}
