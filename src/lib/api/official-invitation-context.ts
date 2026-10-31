import { isUuid } from "./validation.ts";
import { isSetupOfficialRole, type SetupOfficialRole } from "./setup-officials.ts";

export type OfficialInvitationContext = { status: "pending" | "accepted"; nominationId: string; tournamentName: string; role: SetupOfficialRole; expiresAt: string };
export function isOfficialInvitationContext(value: unknown): value is OfficialInvitationContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 5 && (v.status === "pending" || v.status === "accepted") && typeof v.nominationId === "string" && isUuid(v.nominationId)
    && typeof v.tournamentName === "string" && v.tournamentName.trim().length > 0
    && typeof v.role === "string" && isSetupOfficialRole(v.role)
    && typeof v.expiresAt === "string" && Number.isFinite(Date.parse(v.expiresAt));
}
