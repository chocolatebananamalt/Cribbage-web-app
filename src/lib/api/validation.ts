export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function readIdempotentBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (!isUuid(value.gameId) || !isUuid(value.idempotencyKey) || typeof value.requestHash !== "string" || value.requestHash.length < 16) return null;
  return value;
}
