/**
 * Returns the only external browser connection origins this deployment needs.
 * A missing or malformed public Supabase URL deliberately adds no external
 * connection source; the application already fails closed during auth setup.
 */
export function configuredSupabaseConnectSources(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password
      || url.pathname !== "/" || url.search || url.hash) return [];
    return [url.origin, `wss://${url.host}`];
  } catch {
    return [];
  }
}
