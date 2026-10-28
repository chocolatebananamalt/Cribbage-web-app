"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { acquireRecoveryDocument } from "../lib/recovery-write-coordinator";
import { protectUnownedRecovery } from "../lib/auth/recovery-preflight";
import { ownerMarkersAllowActor, readRecoveryOwnerMarkers } from "../lib/auth/recovery-owner";
import { SharedDeviceSignOut } from "./shared-device-sign-out";

export function RecoveryDocumentBoundary({ actorId, children }: { actorId: string | null; children: React.ReactNode }) {
  const path = usePathname();
  const publicSample = path === "/demo";
  const [state, setState] = useState<"waiting" | "ready" | "blocked" | "owner-blocked">("waiting");
  const [verifiedActor, setVerifiedActor] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (publicSample) return;
    let mounted = true;
    void (async () => { await acquireRecoveryDocument(actorId); await protectUnownedRecovery(); })().then(() => { if (mounted) { setVerifiedActor(actorId); setState(actorId && !ownerMarkersAllowActor(readRecoveryOwnerMarkers(), actorId) ? "owner-blocked" : "ready"); } }, () => { if (mounted) { setVerifiedActor(actorId); setState("blocked"); } });
    return () => { mounted = false; };
  }, [actorId, publicSample]);
  if (publicSample) return children;
  if (state === "owner-blocked" && verifiedActor === actorId) return <main className="auth-shell"><section className="auth-card"><h1>Recovery account mismatch</h1><p>Saved recovery ownership is different or unknown. Keep pending work intact. Return to its original account; no records have been reassigned.</p><SharedDeviceSignOut /></section></main>;
  if (state !== "ready" || verifiedActor !== actorId) return <main className="auth-shell"><section className="auth-card"><h1>Tournament recovery safety</h1><p role="status">{state === "waiting" ? "Waiting for a safe tournament session. Keep pending work in other tabs intact." : "Recovery safety could not be established. Keep this account and its pending work intact. Finish work in other tournament tabs and close them, then reload. Unsupported browsers stay blocked; no security setting change is needed."}</p></section></main>;
  return children;
}
