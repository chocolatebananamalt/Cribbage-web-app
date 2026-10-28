"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { acquireRecoveryDocument } from "../lib/recovery-write-coordinator";
import { protectUnownedRecovery } from "../lib/auth/recovery-preflight";
import { ownerMarkersAllowActor, readRecoveryOwnerMarkers } from "../lib/auth/recovery-owner";
import { SharedDeviceSignOut } from "./shared-device-sign-out";
import { readRecoveryDiagnostic, recoveryDiagnostic, recoveryStage, resetRecoveryDiagnostic, type RecoveryDiagnostic } from "../lib/recovery-diagnostic";

export function RecoveryDocumentBoundary({ actorId, children }: { actorId: string | null; children: React.ReactNode }) {
  const path = usePathname();
  const publicSample = path === "/demo";
  const [state, setState] = useState<"waiting" | "ready" | "blocked" | "owner-blocked">("waiting");
  const [verifiedActor, setVerifiedActor] = useState<string | null | undefined>(undefined);
  const [diagnostic, setDiagnostic] = useState<RecoveryDiagnostic | null>(null);
  useEffect(() => {
    if (publicSample) return;
    let mounted = true;
    resetRecoveryDiagnostic();
    void (async () => {
      await acquireRecoveryDocument(actorId);
      await recoveryStage("recovery-storage", () => protectUnownedRecovery());
      const ownerBlocked = await recoveryStage("owner-check", () => actorId && !ownerMarkersAllowActor(readRecoveryOwnerMarkers(), actorId));
      if (mounted) { setVerifiedActor(actorId); setState(ownerBlocked ? "owner-blocked" : "ready"); }
    })().catch((error: unknown) => {
      if (mounted) {
        const safe = readRecoveryDiagnostic() ?? recoveryDiagnostic("document-lease", error);
        setDiagnostic(safe);
        console.warn("Recovery initialization blocked", safe.stage, safe.code);
        setVerifiedActor(actorId); setState("blocked");
      }
    });
    return () => { mounted = false; };
  }, [actorId, publicSample]);
  if (publicSample) return children;
  if (state === "owner-blocked" && verifiedActor === actorId) return <main className="auth-shell"><section className="auth-card"><h1>Recovery account mismatch</h1><p>Saved recovery ownership is different or unknown. Keep pending work intact. Return to its original account; no records have been reassigned.</p><SharedDeviceSignOut /></section></main>;
  if (state !== "ready" || verifiedActor !== actorId) return <main className="auth-shell"><section className="auth-card"><h1>Tournament recovery safety</h1><p role="status">{state === "waiting" ? "Waiting for a safe tournament session. Keep pending work in other tabs intact." : "Recovery safety could not be established. Keep this account and its pending work intact. No security setting change is needed."}</p>{state === "blocked" && diagnostic && <p>Diagnostic: {diagnostic.stage} / {diagnostic.code}</p>}</section></main>;
  return children;
}
