"use client";
import { useEffect, useRef, useState } from "react";
import { submitCoordinatedAuthentication } from "../../../lib/auth/recovery-auth-client";
import { SharedDeviceSignOut } from "../../../components/shared-device-sign-out";
import { safeAuthNext } from "../../../lib/auth/recovery-auth";

export function CompleteSignIn() {
  const code = useRef<string | null>(null), next = useRef("/"), started = useRef(false);
  const [available, setAvailable] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    const fragment = new URLSearchParams(location.hash.slice(1));
    if (!code.current && fragment.has("code")) {
      const value = fragment.get("code") ?? "";
      if (/^[A-Za-z0-9_-]{8,2048}$/.test(value)) { code.current = value; next.current = safeAuthNext(fragment.get("next")); }
      history.replaceState(null, "", location.pathname);
    }
    setAvailable(!!code.current);
  }, []);
  async function complete() {
    if (!code.current || started.current) return;
    started.current = true; setBusy(true); setMessage("");
    try {
      const result = await submitCoordinatedAuthentication({ mode: "code", code: code.current, attemptId: crypto.randomUUID(), next: next.current });
      code.current = null; setAvailable(false);
      if (result.status === "signed_in") { location.replace(result.next); return; }
      setMessage(result.message);
    } catch {
      // No POST was submitted when coordinated preflight rejects. Keep this code
      // in memory for an explicit retry after other tabs finish/close.
      started.current = false;
      setMessage("Sign-in is paused. Finish pending work and close other tournament tabs, then retry here. Nothing was exchanged or cleared by this preflight.");
    } finally { setBusy(false); }
  }
  return <main className="auth-shell"><section className="auth-card"><h1>Complete secure sign-in</h1><p>Before accepting this session, the app checks that another player’s recovery work cannot be lost.</p>{available ? <button type="button" onClick={() => void complete()} disabled={busy}>{busy ? "Checking recovery safety…" : "Complete sign-in"}</button> : <p>Open the original email link again if it has not been consumed. One-time codes are never saved or automatically replayed.</p>}{message ? <p role="status">{message}</p> : null}<details><summary>Recovery handoff after a guest check-in</summary><p>If completed guest check-in left unknown ownership, use the safe-clear action only when no pending work remains. Then reopen the original unconsumed email link. Pending records are never cleared by sign-in.</p><SharedDeviceSignOut /></details></section></main>;
}
