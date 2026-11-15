import "server-only";
import { fictionalDrawBoundaryEnabled } from "./fictional-draw-enabled";
import { createReviewedNativeHandlers } from "./reviewed-native-seating-handlers";
import { reviewedDrawNativePublicationEnabled } from "../seating/reviewed-draw-publication-result";
import { createClient } from "../supabase/server";
import { createRosterDrawProductionHandlers } from "./roster-random-draw-production";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "./route-boundary";
import { readBoundedJson } from "./bounded-json";
import { isSameOriginRequest } from "./same-origin";
import { allowedRoles } from "../auth/tournament-roles";

/** Source wiring only: hard-false gate BEFORE any auth/backend construction.
 * No admin writer and no caller-controlled privileged actor. Wrappers unapplied. */
export function createReviewedNativeProductionHandlers() {
  return createReviewedNativeHandlers({
    enabled: () => reviewedDrawNativePublicationEnabled() || fictionalDrawBoundaryEnabled(), fictionalScope: fictionalDrawBoundaryEnabled(), env: process.env,
    access: async tid => {
      const client = await createClient(), actorId = await requireVerifiedSubject(client);
      if (!actorId) return null;
      const roles = await client.rpc("get_tournament_roles_v1", { p_tournament_id: tid });
      if (roles.error || !Array.isArray(roles.data) || !roles.data.every(x => typeof x === "string" && allowedRoles.has(x))) throw new Error("roles_unavailable");
      return { actorId, roles: roles.data as string[] };
    },
    workspace: async (r, c, _actor, tid) => {
      const client = await createClient();
      const [draw, native] = await Promise.all([
        createRosterDrawProductionHandlers().workspaceGET(r, c),
        client.rpc("get_initial_seating_workspace", { p_tournament_id: tid }),
      ]);
      if (!draw.ok || native.error) throw new Error("workspace_unavailable");
      return { draw: await draw.json() as unknown, native: native.data as unknown };
    },
    publish: async (tid, request) => {
      const client = await createClient();
      return client.rpc("publish_reviewed_initial_seating_v1", { p_tournament_id: tid, p_request: request });
    },
    operation: async (tid, op) => {
      const client = await createClient();
      return client.rpc("get_reviewed_initial_seating_operation_v1", { p_tournament_id: tid, p_operation_id: op });
    },
    readJson: r => readBoundedJson(r, 110000), sameOrigin: isSameOriginRequest, json: apiJson, boundary: withApiFailureBoundary,
  });
}

