type PublicRegistrationContext = { tournamentName: string };

export function readPublicRegistrationContext(value: unknown): PublicRegistrationContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 1 || typeof item.tournamentName !== "string") return null;
  const tournamentName = item.tournamentName.trim();
  return tournamentName.length >= 1 && tournamentName.length <= 200 ? { tournamentName } : null;
}
