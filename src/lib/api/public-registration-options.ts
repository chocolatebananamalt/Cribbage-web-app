export type TournamentRegistrationContact = {
  phone: string;
  email: string;
  mailingAddress: string;
};

export type PublicRegistrationOptions = {
  tournamentName: string;
  acceptedMethods: Array<"cash" | "check">;
  tournamentContact: TournamentRegistrationContact;
};

export function isPublicRegistrationOptions(value: unknown): value is PublicRegistrationOptions {
  if (!value || typeof value !== "object" || Object.keys(value).length !== 3) return false;
  const item = value as Record<string, unknown>;
  const contact = item.tournamentContact;
  if (!contact || typeof contact !== "object" || Array.isArray(contact) || Object.keys(contact).length !== 3) return false;
  const fields = contact as Record<string, unknown>;
  return typeof item.tournamentName === "string"
    && item.tournamentName.trim().length > 0
    && item.tournamentName.length <= 200
    && Array.isArray(item.acceptedMethods)
    && item.acceptedMethods.length >= 1
    && item.acceptedMethods.length <= 2
    && item.acceptedMethods.every((method) => method === "cash" || method === "check")
    && new Set(item.acceptedMethods).size === item.acceptedMethods.length
    && typeof fields.phone === "string"
    && fields.phone.trim().length >= 7
    && fields.phone.length <= 40
    && typeof fields.email === "string"
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)
    && typeof fields.mailingAddress === "string"
    && fields.mailingAddress.length <= 500;
}
