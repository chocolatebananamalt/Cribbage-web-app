export type SafeSwitchStage = "recovery-check" | "offline-database" | "offline-database-blocked" | "offline-cache" | "retry-storage" | "sign-out";

/** Never display raw errors: these reasons contain no account or recovery data. */
export function safeRecoveryBarrierMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  const prefix = "Recovery-state check failed before cleanup. No additional data was cleared and sign-out was not attempted during this attempt. ";
  if (code === "other_tournament_tabs_or_unknown_inventory") return prefix + "Another tournament tab or an unconfirmed browser window prevented exclusive access. Finish and save work in other tournament tabs, then close those tabs. Keep this account signed in.";
  if (["recovery_controller_unavailable", "recovery_controller_changed_or_unknown", "recovery_protocol_unavailable"].includes(code)) return prefix + "The app could not verify its recovery worker. Keep this account signed in and preserve pending work. Record this message for support before reloading or trying again.";
  if (["recovery_inventory_unavailable", "recovery_lock_inventory_unavailable", "recovery_coordination_unavailable", "recovery_document_lease_unavailable", "recovery_reacquire_failed", "recovery_navigation_lease_pending"].includes(code)) return prefix + "The app could not verify its browser recovery locks or window inventory. Keep this account signed in and preserve pending work. Record this message for support; do not clear browser storage.";
  return prefix + "The recovery safety check could not be completed. Keep this account signed in and preserve pending work. Record this message for support; do not clear browser storage.";
}

export function safeSwitchMessage(stage: SafeSwitchStage, failed = false): string {
  if (stage === "offline-database-blocked") return "Local database clearing is still pending because another tab has an open connection. Keep this account signed in. Let other tournament tabs finish their work, then close those tabs. Do not reload this tab or retry clearing; it will continue when the connection closes.";
  if (!failed) return `Safe account switch: ${stage}. Keep this tab open until sign-out completes.`;
  const messages: Record<Exclude<SafeSwitchStage, "offline-database-blocked">, string> = {
    "recovery-check": "Recovery-state check failed. Nothing further was cleared. Keep this device with the same player.",
    "offline-database": "Local database clearing failed. Sign-out was not attempted. Keep this device with the same player.",
    "offline-cache": "Offline page-cache clearing failed after database clearing. Sign-out was not attempted. Keep this device with the same player.",
    "retry-storage": "Retry-record clearing failed. Sign-out was not attempted. Keep this device with the same player.",
    "sign-out": "Local app-data clearing finished, but server sign-out could not be confirmed. Keep this device with the same player until its session is checked.",
  };
  return messages[stage];
}

/** Covers the entire lifetime of a blocked deletion, not just a React render. */
export function createSafeSwitchGate() {
  let running = false;
  return {
    enter() { if (running) return false; running = true; return true; },
    leave() { running = false; },
  };
}

/** Shared by separate sign-in/sign-out controls mounted in one document. */
export const recoveryActionGate = createSafeSwitchGate();
