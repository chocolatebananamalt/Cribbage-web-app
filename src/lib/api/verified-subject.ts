type ClaimsClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims?: { sub?: unknown } } | null;
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
