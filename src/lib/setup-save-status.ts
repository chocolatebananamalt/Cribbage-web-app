// A save time is evidence from a verified persisted revision, never the browser clock.
export function formatSetupSavedAt(value: string | null, timezone: string): string | null {
  if (!value || !/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" }).format(date);
  } catch { return null; }
}
