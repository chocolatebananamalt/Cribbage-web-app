"use client";

import { useEffect, useState } from "react";
import { clearAppSessionStorage, countAppSessionStorageRecords } from "../lib/client-session-storage";
import { clearOfflineScoreStorage, countOfflineSubmissions } from "../lib/offline-score-queue";

export function SharedDeviceSignOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localState, setLocalState] = useState<{ status: "checking" | "safe" | "unsafe" | "unavailable"; offlineCount: number; retryCount: number }>({ status: "checking", offlineCount: 0, retryCount: 0 });

  async function readLocalState() {
    const [offlineCount] = await Promise.all([countOfflineSubmissions()]);
    const retryCount = countAppSessionStorageRecords(window.sessionStorage);
    return { status: offlineCount === 0 && retryCount === 0 ? "safe" as const : "unsafe" as const, offlineCount, retryCount };
  }

  async function refreshLocalState() {
    try {
      setLocalState(await readLocalState());
    } catch {
      setLocalState({ status: "unavailable", offlineCount: 0, retryCount: 0 });
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshLocalState(); }, 0);
    const onVisible = () => { if (document.visibilityState === "visible") void refreshLocalState(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/auth/sign-out", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("sign_out_unavailable");
      const destination = new URL("/sign-in", window.location.origin);
      window.location.replace(destination.toString());
    } catch {
      setError("Sign-out did not complete. The local recovery copy was preserved; do not hand this device to another player yet.");
      setBusy(false);
    }
  }

  async function clearSafeAppData() {
    if (busy || localState.status !== "safe") return;
    setBusy(true);
    setError(null);
    try {
      const current = await readLocalState();
      if (current.status !== "safe") {
        setLocalState(current);
        setError("This device now has unsent tournament work, so nothing was cleared. Let the app finish sending before handing the device to another player.");
        setBusy(false);
        return;
      }
      await clearOfflineScoreStorage();
      clearAppSessionStorage(window.sessionStorage);
      const response = await fetch("/auth/sign-out", { method: "POST", headers: { "x-acc-clear-safe-app-data": "1" }, credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("sign_out_unavailable");
      window.location.replace(new URL("/sign-in", window.location.origin).toString());
    } catch {
      setError("Safe app-data clearing did not finish. The device should not be handed to another player until its recovery state has been checked.");
      setBusy(false);
      await refreshLocalState();
    }
  }

  const safetyMessage = localState.status === "checking" ? "Checking whether this device has any local tournament recovery work…"
    : localState.status === "safe" ? "This device has no unsent score entries or retry records. It may be safely cleared for a different player by pressing Clear safe app data and sign out below."
      : localState.status === "unsafe" ? `${localState.offlineCount ? `${localState.offlineCount} offline score ${localState.offlineCount === 1 ? "entry is" : "entries are"}` : "No offline score entries are"} ${localState.retryCount ? `${localState.offlineCount ? "and " : ""}${localState.retryCount} retry ${localState.retryCount === 1 ? "record is" : "records are"}` : ""} still stored locally. Sign out is safe for the same player, but this device must not be cleared or handed to a different player until synchronization/retry is complete.`
        : "The app cannot verify this device’s local recovery state. Keep it with the same player and try again after connectivity is restored.";

  return <div className="shared-device-sign-out"><button type="button" className="secondary" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button><p className="auth-note">Sign out is appropriate on a personal device or when the same player will return to this device. It keeps this app&apos;s offline recovery copy and retry records. It does not delete saved tournament records, personal files, browser history, or other websites&apos; data.</p><p className={localState.status === "safe" ? "auth-note" : "error-text"} role="status">{safetyMessage}</p>{localState.status === "safe" ? <button type="button" className="secondary danger-button" onClick={() => void clearSafeAppData()} disabled={busy}>Clear safe app data and sign out</button> : null}{error ? <p className="error-text" role="alert">{error}</p> : null}</div>;
}
