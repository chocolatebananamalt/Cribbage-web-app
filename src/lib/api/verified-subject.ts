type ClaimsClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims?: { sub?: unknown; session_id?: unknown } } | null;
      error: unknown;
    }>;
  };
};

export async function requireVerifiedSubject(supabase: ClaimsClient) {
  const { data, error } = await supabase.auth.getClaims();
  if (error) throw new Error("claims_unavailable");
  const subject = data?.claims?.sub;
  return typeof subject === "string" && subject.length > 0 ? subject : null;
}

export async function requireVerifiedIdentity(supabase: ClaimsClient) {
  const { data, error } = await supabase.auth.getClaims();
  if (error) throw new Error("claims_unavailable");
  const subject = data?.claims?.sub;
  const sessionId = data?.claims?.session_id;
  return typeof subject === "string" && subject.length > 0 && typeof sessionId === "string" && sessionId.length > 0
    ? { subject, sessionId }
    : null;
}
