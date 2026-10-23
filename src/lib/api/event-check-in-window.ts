// Browser-safe receipt codec; credential parsing remains server-only.
export function isDirectorWindowResult(value: unknown, action: "open" | "close", eventId: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  const keys = action === "open" ? ["status", "eventId", "version", "reopened"] : ["status", "eventId", "version", "unresolvedCount"];
  return Object.keys(result).length === keys.length && keys.every((key) => key in result)
    && result.status === (action === "open" ? "event_check_in_opened" : "event_check_in_closed")
    && result.eventId === eventId && Number.isSafeInteger(result.version) && (result.version as number) >= 1
    && (action === "open" ? typeof result.reopened === "boolean" : result.unresolvedCount === 0);
}
