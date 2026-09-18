import { redirect, notFound } from "next/navigation";
import { createClient } from "../supabase/server";

const allowedRoles = new Set(["director", "co_director", "player", "cross_checker", "judge", "viewer"]);

export async function requireTournamentAccess(tournamentId: string) {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) notFound();
  const profileId = claims?.claims?.sub;
  if (typeof profileId !== "string") redirect(`/sign-in?next=/tournament/${encodeURIComponent(tournamentId)}`);

  const [{ data: role, error }, rolesResult] = await Promise.all([
    supabase.rpc("get_tournament_role", { p_tournament_id: tournamentId }),
    supabase.rpc("get_tournament_roles_v1", { p_tournament_id: tournamentId }),
  ]);

  if (error || typeof role !== "string" || !allowedRoles.has(role)) notFound();
  const roles = Array.isArray(rolesResult.data) && rolesResult.data.every((item) => typeof item === "string" && allowedRoles.has(item))
    ? rolesResult.data
    : [role];
  return { user: { id: profileId }, role, roles };
}
