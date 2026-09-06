"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setError(null);
    try {
      const supabase = createClient();
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const next = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\") ? requestedNext : "/";
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const result = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (result.error) throw result.error;
      setStatus("Check your email for a secure sign-in link.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start sign-in.");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="sign-in-title">
        <p className="eyebrow">ACC TOURNAMENT DESK</p>
        <h1 id="sign-in-title">Sign in</h1>
        <p className="lede">Use your email to receive a secure, one-time sign-in link.</p>
        <form onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <button className="primary-action" type="submit">Email me a sign-in link</button>
        </form>
        {status ? <p role="status">{status}</p> : null}
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        <p className="auth-note">Authentication is not connected until the two public Supabase environment variables are configured.</p>
      </section>
    </main>
  );
}
