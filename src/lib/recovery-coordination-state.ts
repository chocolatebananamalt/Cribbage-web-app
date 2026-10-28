/** Pure lifecycle shared by the application recovery coordinator and local tests. */
export type RecoveryCoordinationPhase = "acquiring" | "ready" | "draining" | "exclusive" | "partial-failure" | "signed-out" | "authenticated" | "session-ended";

export function createRecoveryCoordinationState() {
  let phase: RecoveryCoordinationPhase = "acquiring";
  let activeWriters = 0;
  let resolveDrain: (() => void) | null = null;
  let draining: Promise<void> | null = null;
  let destructiveStarted = false;
  return {
    snapshot: () => ({ phase, activeWriters, destructiveStarted }),
    ready() {
      if (destructiveStarted || activeWriters || phase !== "acquiring") throw new Error("recovery_invalid_transition");
      phase = "ready";
      draining = null;
    },
    assertWriteAllowed() {
      if (phase !== "ready") throw new Error("recovery_write_barrier_closed");
    },
    enterWriter() {
      if (phase !== "ready") throw new Error("recovery_write_barrier_closed");
      activeWriters++;
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        activeWriters--;
        if (!activeWriters) { resolveDrain?.(); resolveDrain = null; }
      };
    },
    drain() {
      if (draining) return draining;
      if (phase !== "ready") throw new Error("recovery_invalid_transition");
      phase = "draining";
      draining = activeWriters ? new Promise<void>(resolve => { resolveDrain = resolve; }) : Promise.resolve();
      return draining;
    },
    exclusive() {
      if (phase !== "draining" || activeWriters) throw new Error("recovery_invalid_transition");
      phase = "exclusive";
    },
    reacquiring() {
      if (destructiveStarted || activeWriters || (phase !== "exclusive" && phase !== "draining")) throw new Error("recovery_invalid_transition");
      phase = "acquiring";
      draining = null;
    },
    destructiveStep() {
      if (phase !== "exclusive" && phase !== "partial-failure") throw new Error("recovery_invalid_transition");
      destructiveStarted = true;
    },
    fail() {
      if (phase !== "exclusive" && phase !== "partial-failure") throw new Error("recovery_invalid_transition");
      phase = "partial-failure";
    },
    signedOut() {
      if (!destructiveStarted || (phase !== "exclusive" && phase !== "partial-failure")) throw new Error("recovery_invalid_transition");
      phase = "signed-out";
    },
    authenticated() {
      if (destructiveStarted || (phase !== "exclusive" && phase !== "partial-failure")) throw new Error("recovery_invalid_transition");
      phase = "authenticated";
    },
    sessionEnded() {
      if (destructiveStarted || (phase !== "exclusive" && phase !== "partial-failure")) throw new Error("recovery_invalid_transition");
      phase = "session-ended";
    },
  };
}

/** Enclose the entire asynchronous write, including preparation before IDB.
 * Never just guard the call before its first await. */
export async function trackRecoveryWriter<T>(state: ReturnType<typeof createRecoveryCoordinationState>, write: () => Promise<T>): Promise<T> {
  const finish = state.enterWriter();
  try { return await write(); } finally { finish(); }
}
