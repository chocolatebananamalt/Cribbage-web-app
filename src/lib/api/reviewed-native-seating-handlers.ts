import type { NextRequest } from "next/server";
import { isUuid } from "./validation.ts";
import { isLoopbackPlannerUrl } from "./local-seating-planner.ts";
import { rosterDrawEnabled } from "./roster-random-draw-handlers.ts";
import { isRosterDrawWorkspace, type RosterDrawWorkspace } from "./roster-random-draw.ts";
import { isSeatingWorkspace, type SeatingWorkspace } from "./seating-workspace.ts";
import { isReviewedDrawPublicationRequest } from "../seating/reviewed-draw-publication.ts";
import { readReviewedDrawPublicationResult, readReviewedDrawPublicationOperation } from "../seating/reviewed-draw-publication-result.ts";
type Context = { params: Promise<{ id: string; operationId?: string }> };
type Access = { actorId: string; roles: string[] };
type RpcResult = { data: unknown; error: unknown };
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
export type ReviewedNativeWorkspace = { kind: "reviewed-native-workspace-v1"; actorId: string; tournamentId: string; draw: RosterDrawWorkspace; native: SeatingWorkspace };
export function isReviewedNativeWorkspace(v: unknown, actorId: string, tournamentId: string): v is ReviewedNativeWorkspace {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  return Object.keys(x).sort().join() === "actorId,draw,kind,native,tournamentId" && x.kind === "reviewed-native-workspace-v1" && x.actorId === actorId && x.tournamentId === tournamentId
    && isRosterDrawWorkspace(x.draw, actorId, tournamentId) && isSeatingWorkspace(x.native);
}
export function createReviewedNativeHandlers<Reply>(d: {
  enabled: () => boolean; fictionalScope?: boolean; env: Record<string, string | undefined>; access: (tid: string) => Promise<Access | null>;
  workspace: (r: NextRequest, c: Context, actorId: string, tid: string) => Promise<{ draw: unknown; native: unknown }>;
  publish: (tid: string, request: unknown) => Promise<RpcResult>; operation: (tid: string, op: string) => Promise<RpcResult>;
  readJson: (r: NextRequest) => Promise<unknown>; sameOrigin: (r: NextRequest) => boolean;
  json: (body: unknown, init?: ResponseInit) => Reply; boundary: (f: () => Promise<Reply>) => Promise<Reply>;
}) {
  const fail = (status: number, error: string) => d.json({ error }, { status });
  const permitted = (a: Access | null): a is Access => !!a && uuid(a.actorId) && Array.isArray(a.roles) && a.roles.some(r => r === "director" || r === "co_director");
  async function enter(r: NextRequest, c: Context, write = false): Promise<{ reply: Reply } | { actorId: string; tid: string; operationId: string | undefined }> {
    // Production supplies the hard-false gate. Environment/client flags cannot
    // enable an untested wrapper or construct an auth/backend client first.
    if (!d.enabled() || (!d.fictionalScope && (!rosterDrawEnabled(d.env) || !isLoopbackPlannerUrl(r.url)))) return { reply: fail(404, "not_found") };
    const host = r.headers.get("host");
    if (!d.fictionalScope && host !== null && !/^(?:localhost|127\.0\.0\.1)(?::[0-9]{1,5})?$/.test(host)) return { reply: fail(404, "not_found") };
    if (write && !d.sameOrigin(r)) return { reply: fail(403, "invalid_origin") };
    const p = await c.params;
    if (!uuid(p.id)) return { reply: fail(400, "invalid_request") };
    const access = await d.access(p.id);
    if (!access) return { reply: fail(401, "unauthorized") };
    if (!permitted(access)) return { reply: fail(403, "forbidden") };
    return { actorId: access.actorId, tid: p.id, operationId: p.operationId };
  }
  const stillPermitted = async (actorId: string, tid: string) => { const a = await d.access(tid); return permitted(a) && a.actorId === actorId; };
  return {
    GET: (r: NextRequest, c: Context) => d.boundary(async () => {
      const e = await enter(r, c); if ("reply" in e) return e.reply;
      const w = await d.workspace(r, c, e.actorId, e.tid);
      if (!await stillPermitted(e.actorId, e.tid)) return fail(403, "forbidden");
      const body = { kind: "reviewed-native-workspace-v1", actorId: e.actorId, tournamentId: e.tid, ...w };
      return isReviewedNativeWorkspace(body, e.actorId, e.tid) ? d.json(body) : fail(503, "workspace_unavailable");
    }),
    POST: (r: NextRequest, c: Context) => d.boundary(async () => {
      const e = await enter(r, c, true); if ("reply" in e) return e.reply;
      const body = await d.readJson(r); if (!isReviewedDrawPublicationRequest(body)) return fail(400, "invalid_request");
      // Do not freshness-prefilter an exact accepted replay. The atomic SQL core
      // rechecks source/role and derives assignments for genuinely new work.
      const out = await d.publish(e.tid, body);
      if (!await stillPermitted(e.actorId, e.tid)) return fail(403, "forbidden");
      if (out.error) return fail(503, "operation_outcome_unknown");
      const outcome = readReviewedDrawPublicationResult(out.data, { actorId: e.actorId, tournamentId: e.tid, request: body });
      return outcome.kind === "unknown" ? fail(503, "operation_outcome_unknown") : d.json(out.data, { status: outcome.kind === "accepted" ? 200 : outcome.kind === "retry-exact" ? 503 : 409 });
    }),
    operationGET: (r: NextRequest, c: Context) => d.boundary(async () => {
      const e = await enter(r, c); if ("reply" in e) return e.reply;
      if (!uuid(e.operationId)) return fail(400, "invalid_request");
      const out = await d.operation(e.tid, e.operationId);
      if (!await stillPermitted(e.actorId, e.tid)) return fail(403, "forbidden");
      if (out.error || !out.data || typeof out.data !== "object" || !("request" in out.data) || !isReviewedDrawPublicationRequest(out.data.request)) return fail(503, "operation_outcome_unknown");
      const outcome = readReviewedDrawPublicationOperation(out.data, { actorId: e.actorId, tournamentId: e.tid, request: out.data.request });
      return outcome.kind === "accepted" && outcome.receipt.operationId === e.operationId ? d.json(out.data) : fail(503, "operation_outcome_unknown");
    }),
  };
}

