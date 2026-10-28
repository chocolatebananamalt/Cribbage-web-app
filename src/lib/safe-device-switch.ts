export type SafeSwitchStage = "recovery-check" | "offline-database" | "offline-database-blocked" | "offline-cache" | "retry-storage" | "sign-out";

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
