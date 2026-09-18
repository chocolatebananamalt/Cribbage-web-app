import { redirect, notFound } from "next/navigation";
import { createClient } from "../supabase/server";

const allowedRoles = new Set(["director", "co_director", "player", "cross_checker", "judge", "viewer"]);

export async function requireTournamentAccess(tournamentId: string) {
  const supabase = await createClient();
  const signIn = `/sign-in?next=/tournament/${encodeURIComponent(tournamentId)}`;
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  // A claims error means this browser has no usable session: an expired or
  // revoked refresh token, or Supabase unreachable. That is the same position a
  // signed-out visitor is in, and getCurrentSubject already treats it that way
  // (src/lib/auth/current-subject.ts). notFound() here produced a permanent 404
  // carrying no control at all, because a server render cannot clear the dead
  // cookie and nothing on a 404 leads back to sign-in. The sign-in page handles
  // a broken cookie already, so the redirect actually recovers.
  if (claimsError) redirect(signIn);
  const profileId = claims?.claims?.sub;
  if (typeof profileId !== "string") redirect(signIn);

  const { data: role, error } = await supabase.rpc("get_tournament_role", { p_tournament_id: tournamentId });

  if (error || typeof role !== "string" || !allowedRoles.has(role)) notFound();
  return { user: { id: profileId }, role };
}
