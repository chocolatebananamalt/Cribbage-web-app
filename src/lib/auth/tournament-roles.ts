export const allowedRoles = new Set(["director", "co_director", "player", "cross_checker", "judge", "viewer"]);

// An empty array is a missing answer, not an answer of "no roles". A checked-in
// player holds no row in app.tournament_roles, so before migration 0219
// get_tournament_roles_v1 returned [] for every competitor while
// get_tournament_role resolved the same person to "player". Treating [] as
// authoritative hid the pages that key off `roles` from exactly the people
// entitled to them. Falling back to [role] keeps this page correct even against
// a database that has not taken 0219 yet.
//
// Lives apart from require-tournament-access.ts so it can be tested without
// pulling in next/navigation.
export function resolveRoles(data: unknown, role: string): string[] {
  return Array.isArray(data) && data.length > 0
    && data.every((item) => typeof item === "string" && allowedRoles.has(item))
    ? (data as string[])
    : [role];
}
