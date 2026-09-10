"use client";

import { useEffect, useState } from "react";

declare global { interface Window { __accRegistrationCredential?: string } }
const payment = ["cash", "check", "other", "unspecified"] as const;

export default function RegistrationForm() {
  const [credential, setCredential] = useState<string | null>(null); const [message, setMessage] = useState("Checking registration link…");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [acc, setAcc] = useState(""); const [method, setMethod] = useState<typeof payment[number]>("unspecified");
  useEffect(() => { const timer = window.setTimeout(() => { const value = window.__accRegistrationCredential; delete window.__accRegistrationCredential; if (!value) { setMessage("This registration link is unavailable."); return; } setCredential(value); setMessage(""); }, 0); return () => window.clearTimeout(timer); }, []);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!credential) return; setMessage("Submitting registration…"); try { const response = await fetch("/api/v1/registration/claims", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential, displayName: name, email, accNumber: acc, intendedPaymentMethod: method, operationId: crypto.randomUUID() }) }); const result: unknown = await response.json().catch(() => null); if (response.ok && !!result && typeof result === "object" && (result as Record<string, unknown>).status === "received") { setCredential(null); setMessage("Your registration was received for review."); return; } setMessage("This registration link is unavailable. Please contact the tournament director."); } catch { setMessage("This registration link is unavailable. Please contact the tournament director."); } }
  return <section className="auth-card" aria-labelledby="registration-title"><p className="eyebrow">TOURNAMENT REGISTRATION</p><h1 id="registration-title">Register for Tournament</h1>{credential ? <form onSubmit={submit}><label>Name<input required value={name} maxLength={160} onChange={e => setName(e.target.value)} /></label><label>Email<input required type="email" value={email} maxLength={320} onChange={e => setEmail(e.target.value)} /></label><label>ACC Number (if known)<input value={acc} maxLength={64} onChange={e => setAcc(e.target.value)} /></label><label>Planned payment<select value={method} onChange={e => setMethod(e.target.value as typeof method)}>{payment.map(value => <option key={value} value={value}>{value}</option>)}</select></label><button className="primary" type="submit">Submit Registration</button></form> : null}<p className="auth-note" role="status">{message}</p></section>;
}
