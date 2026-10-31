"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { normalizeEmailSignInError } from "../../lib/auth/email-sign-in-error";
import { createClient } from "../../lib/supabase/client";
import { submitCoordinatedAuthentication } from "../../lib/auth/recovery-auth-client";
import { SharedDeviceSignOut } from "../../components/shared-device-sign-out";

// Both sign-in paths land on the same place, and an open redirect here would
// hand a signed-in session to whatever a crafted link pointed at.
function safeNext(): string {
  const requestedNext = new URLSearchParams(window.location.search).get("next");
  return requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\") ? requestedNext : "/";
}

export function SignInForm({ handoffWarning }: { handoffWarning: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  const requestInFlight = useRef(false);

  useEffect(() => {
    if (cooldownSeconds === null) return;
    const timer = window.setTimeout(() => {
      if (cooldownSeconds <= 1) {
        setCooldownSeconds(null);
        setError(null);
        return;
      }
      setCooldownSeconds(cooldownSeconds - 1);
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current || cooldownSeconds !== null) return;
    requestInFlight.current = true;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const supabase = createClient();
      const next = safeNext();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const result = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (result.error) throw result.error;
      setStatus("Check your email for a secure sign-in link.");
    } catch (caught) {
      const failure = normalizeEmailSignInError(caught);
      setError(failure.message);
      setCooldownSeconds(failure.cooldownSeconds);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  // The password path exists because the emailed link is a single point of
  // failure. When delivery is slow, throttled, or filtered, a director standing
  // at the desk has no way in at all. A password the account holder set
  // themselves is the same account and the same authorization, reached without
  // waiting on a mail server.
  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setStatus(null);
    setError(null);
    setBusy(true);
    try {
      const result = await submitCoordinatedAuthentication({ mode: "password", email: email.trim(), password, attemptId: crypto.randomUUID(), next: safeNext() });
      if (result.status === "signed_in") window.location.assign(result.next);
      else setError(result.message);
    } catch {
      setError("Sign-in is paused. Finish pending work and close other tournament tabs, then try again. Recovery work was preserved.");
    } finally {
      setPassword("");
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="sign-in-title">
        <p className="eyebrow">ACC TOURNAMENT DESK</p>
        <h1 id="sign-in-title">Sign in</h1>
        <p className="lede">Use your email to receive a secure, one-time sign-in link.</p>
        {handoffWarning ? <p className="error-text" role="alert">Sign-out completed, but this browser could not confirm that local tournament data was cleared. Close this browser before another person uses this device.</p> : null}
        {usePassword ? (
          <form onSubmit={submitPassword}>
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="primary-action" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <button className="primary-action" type="submit" disabled={busy || cooldownSeconds !== null}>{busy ? "Requesting sign-in link." : "Email me a sign-in link"}</button>
          </form>
        )}
        {status ? <p role="status">{status}</p> : null}
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        {cooldownSeconds !== null ? <p className="auth-note" aria-live="off">Email link requests available in {cooldownSeconds} {cooldownSeconds === 1 ? "second" : "seconds"}.</p> : null}
        <button className="secondary" type="button" disabled={busy} onClick={() => { setUsePassword(!usePassword); setStatus(null); setError(null); setPassword(""); }}>
          {usePassword ? "Use an emailed sign-in link instead" : "Sign in with a password instead"}
        </button>
        <p className="auth-note">{usePassword
          ? "A password works only if one has been set on this account. Nothing else about the account changes either way."
          : "This app uses passwordless email sign-in. A password is available as a fallback when email is slow or filtered."}</p>
        <details><summary>Local recovery and account handoff</summary><p>Pending work must stay with its original account. Empty local app data can be cleared explicitly after its safety check.</p><SharedDeviceSignOut /></details>
      </section>
    </main>
  );
}
