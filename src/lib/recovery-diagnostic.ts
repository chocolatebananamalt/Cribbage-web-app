export type RecoveryStage = "capability" | "worker-register" | "worker-update" | "worker-ready" | "controller" | "protocol" | "document-lease" | "recovery-storage" | "owner-check";
const codes = new Set([
  "recovery_coordination_unavailable", "recovery_controller_unavailable",
  "recovery_controller_changed_or_unknown", "recovery_protocol_unavailable",
  "recovery_document_lease_unavailable", "recovery_invalid_transition",
  "recovery_reacquire_failed", "recovery_bfcache_requires_reload",
]);
export type RecoveryDiagnostic = { stage: RecoveryStage; code: string };
let latest: RecoveryDiagnostic | null = null;
export function recoveryDiagnostic(stage: RecoveryStage, error: unknown): RecoveryDiagnostic {
  const message = error instanceof Error ? error.message : "";
  return { stage, code: codes.has(message) ? message : "recovery_initialization_failed" };
}
export function readRecoveryDiagnostic(): RecoveryDiagnostic | null { return latest ? { ...latest } : null; }
export function resetRecoveryDiagnostic() { latest = null; }
/** In-memory only. Preserve the original rejection; never retain raw errors. */
export async function recoveryStage<T>(stage: RecoveryStage, operation: () => T | Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) { latest ??= recoveryDiagnostic(stage, error); throw error; }
}
