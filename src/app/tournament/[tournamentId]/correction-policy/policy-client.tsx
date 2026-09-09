"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CorrectionPolicy } from "../../../../lib/corrections/policy";

type Envelope = { idempotencyKey: string; reasonRequired: boolean; requiredApprovals: 0 | 1; expectedPolicyVersion: number };

function validEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.idempotencyKey === "string" && typeof item.reasonRequired === "boolean" && (item.requiredApprovals === 0 || item.requiredApprovals === 1) && Number.isSafeInteger(item.expectedPolicyVersion) && (item.expectedPolicyVersion as number) >= 0;
}

function storedEnvelope(storageKey: string) {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const candidate: unknown = raw ? JSON.parse(raw) : null;
    return validEnvelope(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function storeEnvelope(storageKey: string, envelope: Envelope) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

function clearEnvelope(storageKey: string) {
  try { window.sessionStorage.removeItem(storageKey); } catch { /* The completed server receipt remains authoritative. */ }
}

type ReconciliationState = "configured" | "rejected" | "unresolved";

export function CorrectionPolicyClient({ actorId, policy }: { actorId: string; policy: CorrectionPolicy }) {
  const router = useRouter();
  const storageKey = `acc-correction:policy:${actorId}:${policy.tournamentId}`;
  const [reasonRequired, setReasonRequired] = useState(policy.reasonRequired);
  const [requiredApprovals, setRequiredApprovals] = useState<0 | 1>(policy.requiredApprovals);
  const [hydrated, setHydrated] = useState(false);
  const [locked, setLocked] = useState<Envelope | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const reconcile = useCallback(async (envelope: Envelope): Promise<ReconciliationState> => {
    const response = await fetch(`/api/v1/tournaments/${policy.tournamentId}/correction-policy/reconciliation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: envelope.idempotencyKey }) });
    if (!response.ok) return "unresolved";
    const payload: unknown = await response.json().catch(() => null);
    const result = payload && typeof payload === "object" ? (payload as Record<string, unknown>).result : null;
    if (!result || typeof result !== "object") return "unresolved";
    const state = (result as Record<string, unknown>).status;
    return state === "configured" ? "configured" : state === "rejected" ? "rejected" : "unresolved";
  }, [policy.tournamentId]);

  useEffect(() => { const timer = window.setTimeout(async () => {
    const saved = storedEnvelope(storageKey);
    if (saved) {
      const result = await reconcile(saved);
      if (result === "configured") { clearEnvelope(storageKey); router.refresh(); return; }
      if (result === "rejected") {
        clearEnvelope(storageKey);
        setStatus("The tournament server did not accept the earlier policy change. The current recorded policy is shown below.");
        setHydrated(true);
        return;
      }
      setReasonRequired(saved.reasonRequired); setRequiredApprovals(saved.requiredApprovals); setLocked(saved); setStatus("A previous policy save is awaiting a safe retry. Its settings are locked until it is retried or this page is refreshed.");
    }
    setHydrated(true);
  }); return () => window.clearTimeout(timer); }, [storageKey, router, reconcile]);

  async function save() {
    if (!hydrated || busy || !policy.canConfigure) return;
    let envelope = locked;
    if (!envelope) {
      envelope = { idempotencyKey: crypto.randomUUID(), reasonRequired, requiredApprovals, expectedPolicyVersion: policy.policyVersion };
      if (!storeEnvelope(storageKey, envelope)) {
        setStatus("This browser cannot safely retain a policy request for recovery. Enable session storage before saving.");
        return;
      }
    }
    setBusy(true); setStatus(null);
    try {
      const response = await fetch(`/api/v1/tournaments/${policy.tournamentId}/correction-policy`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope) });
      if (!response.ok) {
        if (response.status < 500) { clearEnvelope(storageKey); setLocked(null); } else setLocked(envelope);
        setStatus(response.status === 409 ? "The tournament server cannot accept this policy now. Refresh to see the current policy." : "The policy save could not be completed. Retry uses the same protected request.");
        return;
      }
      clearEnvelope(storageKey); setLocked(null); router.refresh();
    } catch {
      setLocked(envelope); setStatus("Network issue. Retry uses the same protected request.");
    } finally { setBusy(false); }
  }

  return <section className="policy-settings"><p>Active policy version {policy.policyVersion}. Each saved change is preserved as a new version for future corrections; existing corrections keep their original policy.</p><label><input type="checkbox" checked={reasonRequired} disabled={!hydrated || busy || !!locked || !policy.canConfigure} onChange={(event) => setReasonRequired(event.target.checked)} /> Require a short reason for every correction</label><fieldset disabled={!hydrated || busy || !!locked || !policy.canConfigure}><legend>Correction authority</legend><label><input type="radio" checked={requiredApprovals === 0} onChange={() => setRequiredApprovals(0)} /> Apply a permitted correction immediately</label><label><input type="radio" checked={requiredApprovals === 1} onChange={() => setRequiredApprovals(1)} /> Require an independent cross-checker, director, or co-director approval</label></fieldset>{policy.canConfigure ? <button className="primary full" type="button" disabled={!hydrated || busy} onClick={save}>{busy ? "Saving policy…" : locked ? "Retry policy save" : "Save correction policy"}</button> : <p className="auth-note">This tournament is no longer configurable. The recorded policy remains visible for audit.</p>}{status ? <p className="error-text" role="alert">{status}</p> : null}</section>;
}
