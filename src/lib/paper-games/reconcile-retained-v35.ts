/** Receipt lookup only. A historical outcome never verifies a current game.
 * Removal is delegated to the existing synchronous recovery coordinator. */
export async function reconcileRetainedPaperOperationV35(port: {
  current: () => boolean;
  raw: string;
  read: () => string | null;
  lookup: () => Promise<unknown>;
  accepted: (value: unknown) => boolean;
  remove: (expectedRaw: string) => boolean;
}): Promise<boolean> {
  try {
    if (!port.current() || port.read() !== port.raw) return false;
    const result = await port.lookup();
    if (!port.current() || result === null || !port.accepted(result)) return false;
    if (!port.current() || port.read() !== port.raw) return false;
    return port.current() && port.remove(port.raw);
  } catch { return false; }
}
