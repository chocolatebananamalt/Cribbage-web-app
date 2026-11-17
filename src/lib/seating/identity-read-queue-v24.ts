export type IdentityReadQueueV24 = { enqueue: (read: () => Promise<void>, signal: AbortSignal) => void };

/** Scoped to one Seating view; no profile cache, storage or shared Auth state. */
export function createIdentityReadQueueV24(): IdentityReadQueueV24 {
  const waiting: Array<{ read: () => Promise<void>; signal: AbortSignal }> = [];
  let active = 0;
  function pump() {
    while (active < 2 && waiting.length) {
      const next = waiting.shift()!;
      if (next.signal.aborted) continue;
      active++;
      void Promise.resolve().then(async () => {
        if (!next.signal.aborted) await next.read();
      }).catch(() => { /* Each view reports its own unavailable read. */ }).finally(() => { active--; pump(); });
    }
  }
  return { enqueue(read, signal) { if (!signal.aborted) { waiting.push({ read, signal }); pump(); } } };
}
