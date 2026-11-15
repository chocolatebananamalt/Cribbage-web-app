import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "../env.ts";

type ServerOnlySupabaseEnv = {
  url: string;
  secretKey: string;
};

/**
 * Returns the credential boundary for server-only operations that must not be
 * callable through a browser's publishable Supabase client. This is deliberately
 * separate from the cookie-backed client used by ordinary player routes.
 */
export function getServerOnlySupabaseEnv(
  env: Record<string, string | undefined> = process.env,
): ServerOnlySupabaseEnv {
  const { url } = getPublicSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("Server-only Supabase execution is not configured.");
  }

  if (!secretKey.startsWith("sb_secret_")) {
    throw new Error("Server-only Supabase execution requires a scoped secret API key.");
  }

  return { url, secretKey };
}

/**
 * Use only after the route has independently verified the caller and narrowed
 * its input. Secret-key clients bypass Row Level Security and must never be
 * passed to a client component or used as a substitute for authorization.
 */
export function createServerOnlyAdminClient(
  env: Record<string, string | undefined> = process.env,
) {
  const { url, secretKey } = getServerOnlySupabaseEnv(env);
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
