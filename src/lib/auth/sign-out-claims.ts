/** Interpret only the installed SDK's explicit empty-session result. */
export function signOutClaimsStatus(data: unknown, error: unknown): "signed_out" | "signed_in" | "unconfirmed" {
  if (error && typeof error === "object" && "name" in error && error.name === "AuthSessionMissingError") return "signed_out";
  if (error !== null) return "unconfirmed";
  if (data === null) return "signed_out";
  if (!data || typeof data !== "object" || !("claims" in data) || !data.claims || typeof data.claims !== "object" || !("sub" in data.claims)) return "unconfirmed";
  return typeof data.claims.sub === "string" && data.claims.sub.trim().length > 0 ? "signed_in" : "unconfirmed";
}
