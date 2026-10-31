export type CheckInCompletion = { token: string; expiresAt: string };
export const checkInCompletionStorageKey = "acc:event-check-in:completion";

export function parseCheckInCompletion(raw: string | null): CheckInCompletion | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length !== 2 || typeof record.token !== "string" || !record.token || typeof record.expiresAt !== "string" || !Number.isFinite(Date.parse(record.expiresAt))) return null;
    return { token: record.token, expiresAt: record.expiresAt };
  } catch { return null; }
}

// Only an expired, structurally valid public completion can be discarded.
// Re-read before removal so a newer completion is never cleared by an old timer.
export function removeExpiredCheckInCompletion(storage: Pick<Storage, "getItem" | "removeItem">, raw: string | null, now: number): boolean {
  const completion = parseCheckInCompletion(raw);
  if (!completion || Date.parse(completion.expiresAt) > now || storage.getItem(checkInCompletionStorageKey) !== raw) return false;
  storage.removeItem(checkInCompletionStorageKey);
  return true;
}
