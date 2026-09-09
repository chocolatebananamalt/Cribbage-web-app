"use client";

import { useState } from "react";
import { clearThenSignOut } from "../lib/client-session-storage";

export function SharedDeviceSignOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    let localClearFailed = false;
    try {
      const outcome = await clearThenSignOut(window.sessionStorage, async () => {
        const response = await fetch("/auth/sign-out", { method: "POST", headers: { "x-acc-shared-device": "1" }, credentials: "same-origin", cache: "no-store" });
        return response.ok;
      });
      localClearFailed = outcome.localClearFailed;
      if (!outcome.signedOut) throw new Error("sign_out_unavailable");
      const destination = new URL("/sign-in", window.location.origin);
      if (localClearFailed) destination.searchParams.set("notice", "local_clear_review");
      window.location.replace(destination.toString());
    } catch {
      setError(localClearFailed ? "The device could not clear local tournament data or complete sign-out. Do not hand this device to another person; close the browser and try again." : "This device’s local tournament data was cleared, but sign-out could not be completed. Try again before handing over this device.");
      setBusy(false);
    }
  }

  return <div className="shared-device-sign-out"><button type="button" className="secondary" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out and clear this device"}</button>{error ? <p className="error-text" role="alert">{error}</p> : null}</div>;
}
