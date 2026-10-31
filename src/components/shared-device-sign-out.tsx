"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearAppSessionStorage, countAppSessionStorageRecords } from "../lib/client-session-storage";
import { clearOfflineScoreStorage, countOfflineSubmissions } from "../lib/offline-score-queue";
import { recoveryActionGate, safeSwitchMessage, safeRecoveryBarrierMessage, type SafeSwitchStage } from "../lib/safe-device-switch";
import { beginSafeRecoverySwitch, cancelSafeRecoverySwitch, markRecoveryCleanupStarted, finishSafeRecoverySwitch, failSafeRecoverySwitch, finishPreservingRecoverySignOut } from "../lib/recovery-write-coordinator";
import { protectUnownedRecovery } from "../lib/auth/recovery-preflight";
import { clearRecoveryStorageOwner } from "../lib/auth/recovery-owner";

async function readLocalState() {
  const offlineCount = await countOfflineSubmissions();
  const retryCount = countAppSessionStorageRecords(window.sessionStorage);
  return { status: offlineCount === 0 && retryCount === 0 ? "safe" as const : "unsafe" as const, offlineCount, retryCount };
}

export function SharedDeviceSignOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchStage, setSwitchStage] = useState<SafeSwitchStage | null>(null);
  const gate = useRef(recoveryActionGate);
  const signOutUncertain = useRef(false);
  const cleanupComplete = useRef(false);
  const localReadInFlight = useRef(false);
  const [localState, setLocalState] = useState<{ status: "checking" | "safe" | "unsafe" | "unavailable"; offlineCount: number; retryCount: number }>({ status: "checking", offlineCount: 0, retryCount: 0 });

  const refreshLocalState = useCallback(async () => {
    if (localReadInFlight.current) return;
    localReadInFlight.current = true;
    try {
      setLocalState(await readLocalState());
    } catch {
      setLocalState({ status: "unavailable", offlineCount: 0, retryCount: 0 });
    } finally { localReadInFlight.current = false; }
  }, []);

  useEffect(() => {
    if (busy) return;
    const onVisible = () => { if (document.visibilityState === "visible") void refreshLocalState(); };
    const timer = window.setTimeout(onVisible, 0);
    // Same-document sessionStorage/IndexedDB writes do not fire a storage event.
    // Refresh descriptive counts only; every switch still rechecks under the
    // exclusive recovery barrier. Pause these reads during cleanup/sign-out.
    const interval = window.setInterval(onVisible, 1500);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [busy, refreshLocalState]);

  async function requestSignOut() {
    if (signOutUncertain.current) {
      const check = await fetch("/auth/sign-out-state", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "sign_out" }) });
      const state: unknown = check.ok ? await check.json() : null;
      if (state && typeof state === "object" && "status" in state && state.status === "signed_out") return;
      if (!state || typeof state !== "object" || !("status" in state) || state.status !== "signed_in") throw new Error("sign_out_unconfirmed");
      signOutUncertain.current = false;
    }
    try {
      const response = await fetch("/auth/sign-out", { method: "POST", credentials: "same-origin", cache: "no-store" });
      const outcome: unknown = response.ok ? await response.json().catch(() => null) : null;
      if (!outcome || typeof outcome !== "object" || !("status" in outcome) || outcome.status !== "signed_out") throw new Error("sign_out_unconfirmed");
      // Confirm that the browser actually received the cleared session cookies
      // before releasing the account-switch barrier.
      signOutUncertain.current = true;
      const check = await fetch("/auth/sign-out-state", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "sign_out" }) });
      const confirmed: unknown = check.ok ? await check.json().catch(() => null) : null;
      if (!confirmed || typeof confirmed !== "object" || !("status" in confirmed) || confirmed.status !== "signed_out") throw new Error("sign_out_unconfirmed");
    } catch { signOutUncertain.current = true; throw new Error("sign_out_unconfirmed"); }
  }

  async function signOut() {
    if (!gate.current.enter()) return;
    setBusy(true);
    setError(null);
    try {
      await beginSafeRecoverySwitch();
      await protectUnownedRecovery();
      await beginSafeRecoverySwitch();
      await requestSignOut();
      await beginSafeRecoverySwitch();
      finishPreservingRecoverySignOut();
      const destination = new URL("/sign-in", window.location.origin);
      window.location.replace(destination.toString());
    } catch {
      failSafeRecoverySwitch();
      setError("Sign-out did not complete. The local recovery copy was preserved; do not hand this device to another player yet.");
      setBusy(false);
      gate.current.leave();
    }
  }

  async function clearSafeAppData() {
    if (localState.status !== "safe" || !gate.current.enter()) return;
    setBusy(true);
    setError(null);
    let stage: SafeSwitchStage = "recovery-check";
    const progress = (next: SafeSwitchStage) => { stage = next; setSwitchStage(next); };
    progress(stage);
    try {
      await beginSafeRecoverySwitch();
      const current = await readLocalState();
      if (current.status !== "safe") {
        setLocalState(current);
        setError("This device now has unsent tournament work, so nothing was cleared. Let the app finish sending before handing the device to another player.");
        setBusy(false);
        setSwitchStage(null);
        gate.current.leave();
        await cancelSafeRecoverySwitch();
        return;
      }
      if (!cleanupComplete.current) {
        await markRecoveryCleanupStarted();
        await clearOfflineScoreStorage(progress);
        progress("retry-storage");
        clearAppSessionStorage(window.sessionStorage);
        // Cleanup is targeted and complete before removing either ownership marker.
        if (await countOfflineSubmissions() !== 0 || countAppSessionStorageRecords(window.sessionStorage) !== 0) throw new Error("recovery_clear_unconfirmed");
        clearRecoveryStorageOwner();
        cleanupComplete.current = true;
      }
      progress("sign-out");
      await beginSafeRecoverySwitch();
      await requestSignOut();
      await beginSafeRecoverySwitch();
      finishSafeRecoverySwitch();
      window.location.replace(new URL("/sign-in", window.location.origin).toString());
    } catch (error) {
      failSafeRecoverySwitch();
      setError(stage === "recovery-check" ? safeRecoveryBarrierMessage(error) : safeSwitchMessage(stage, true));
      setSwitchStage(null);
      setBusy(false);
      gate.current.leave();
      await refreshLocalState();
    }
  }

  const safetyMessage = localState.status === "checking" ? "Checking whether this device has any local tournament recovery work…"
    : localState.status === "safe" ? "This device has no unsent score entries or retry records. It may be safely cleared for a different player by pressing Clear safe app data and sign out below."
      : localState.status === "unsafe" ? `${localState.offlineCount ? `${localState.offlineCount} offline score ${localState.offlineCount === 1 ? "entry is" : "entries are"}` : "No offline score entries are"} ${localState.retryCount ? `${localState.offlineCount ? "and " : ""}${localState.retryCount} retry ${localState.retryCount === 1 ? "record is" : "records are"}` : ""} still stored locally. Sign out is safe for the same player, but this device must not be cleared or handed to a different player until synchronization/retry is complete.`
        : "The app cannot verify this device’s local recovery state. Keep it with the same player and try again after connectivity is restored.";

  return <div className="shared-device-sign-out"><button type="button" className="secondary" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button><p className="auth-note">Sign out is appropriate on a personal device or when the same player will return to this device. It keeps this app&apos;s offline recovery copy and retry records. It does not delete saved tournament records, personal files, browser history, or other websites&apos; data.</p><p className={localState.status === "safe" ? "auth-note" : "error-text"} role="status">{safetyMessage}</p>{localState.status === "safe" ? <button type="button" className="secondary danger-button" onClick={() => void clearSafeAppData()} disabled={busy}>Clear safe app data and sign out</button> : null}{switchStage ? <p className="auth-note" role="status">{safeSwitchMessage(switchStage)}</p> : null}{error ? <p className="error-text" role="alert">{error}</p> : null}</div>;
}
