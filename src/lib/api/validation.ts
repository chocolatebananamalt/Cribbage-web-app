// PostgreSQL's uuid type accepts a canonical 8-4-4-4-12 hexadecimal value
// without requiring RFC version or variant bits. Route validation must accept
// the same persisted tournament identifiers as the chooser before server-side
// authorization decides whether the current actor may access them.
const postgresUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && postgresUuidPattern.test(value);
}

export function readIdempotentBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (!isUuid(value.gameId) || !isUuid(value.idempotencyKey) || typeof value.requestHash !== "string" || value.requestHash.length < 16) return null;
  return value;
}
