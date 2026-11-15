/** Display only. Counts and recovery safety are determined by their existing readers. */
export function localRecoveryCountCopy(offlineCount: number, retryCount: number): string {
  if (offlineCount === 0 && retryCount === 0) return "No offline score entries or retry records are stored locally.";
  const parts = [
    offlineCount ? `${offlineCount} offline score ${offlineCount === 1 ? "entry" : "entries"}` : "",
    retryCount ? `${retryCount} retry ${retryCount === 1 ? "record" : "records"}` : "",
  ].filter(Boolean);
  return `${parts.join(" and ")} ${offlineCount + retryCount === 1 ? "is" : "are"} still stored locally.`;
}
