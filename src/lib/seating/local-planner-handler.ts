import { isUuid } from "../api/validation.ts";
import { isLocalSeatingPlannerEnabled, isLoopbackPlannerUrl, isLocalSeatingRequest, isLocalSeatingReceipt, canonicalLocalPlan, localSeatingAlgorithm, localSeatingNotice, type LocalSeatingReceipt } from "../api/local-seating-planner.ts";
import type { LocalRandomPlanInput, LocalRandomPlanResult } from "./local-random-plan.ts";

type Dependencies<Reply, Req extends Request> = {
  env: Record<string, string | undefined>; epochId: string;
  digest: (text: string) => string | Promise<string>;
  draw: (input: LocalRandomPlanInput) => LocalRandomPlanResult | Promise<LocalRandomPlanResult>;
  readJson: (request: Request) => Promise<unknown>; sameOrigin: (request: Req) => boolean;
  json: (body: unknown, init?: ResponseInit) => Reply;
  boundary: (run: () => Promise<Reply>) => Promise<Reply>;
  maxEntries?: number;
};
/** Ephemeral anonymous planning receipts, NOT a tournament/audit database. */
export function createLocalPlannerHandlers<Reply, Req extends Request = Request>(d: Dependencies<Reply, Req>) {
  if (!isUuid(d.epochId)) throw new Error("Invalid local planner epoch");
  const limit = d.maxEntries ?? 64;
  if (!Number.isInteger(limit) || limit < 1 || limit > 128) throw new Error("Invalid local planning cache bound");
  const cache = new Map<string, { inputDigest: string; outcome: Promise<LocalSeatingReceipt | null> }>();
  const fail = (status: number, error: string) => d.json({ error }, { status });
  const available = (request: Req) => {
    if (!isLocalSeatingPlannerEnabled(d.env) || !isLoopbackPlannerUrl(request.url)) return false;
    // Next development requests can normalize the URL hostname. Never let that
    // turn a non-loopback HTTP Host into a local-only planning capability.
    const host = request.headers.get("host");
    return host === null || (/^(?:localhost|127\.0\.0\.1)(?::[0-9]{1,5})?$/.test(host) && isLoopbackPlannerUrl(`http://${host}`));
  };
  return {
    GET: (request: Req) => d.boundary(async () => {
      if (!available(request)) return fail(404, "not_found");
      const query = new URL(request.url).searchParams;
      if ([...query].length === 0) return d.json({ kind: "local-seating-planner-v1", epochId: d.epochId, algorithmVersion: localSeatingAlgorithm, notice: localSeatingNotice, authoritative: false, databaseWritten: false, persistentAudit: false });
      if ([...query.keys()].sort().join() !== "epochId,operationId,plannerId" || !isUuid(query.get("plannerId")) || !isUuid(query.get("operationId")) || !isUuid(query.get("epochId"))) return fail(400, "invalid_request");
      if (query.get("epochId") !== d.epochId) return fail(503, "planning_outcome_unknown");
      const prior = cache.get(`${query.get("plannerId")}:${query.get("operationId")}`);
      const receipt = prior ? await prior.outcome : null;
      return receipt ? d.json(receipt) : fail(503, "planning_outcome_unknown");
    }),
    POST: (request: Req) => d.boundary(async () => {
      if (!available(request)) return fail(404, "not_found");
      if (!d.sameOrigin(request)) return fail(403, "invalid_origin");
      const body = await d.readJson(request);
      if (!isLocalSeatingRequest(body)) return fail(400, "invalid_anonymous_planning_request");
      if (body.epochId !== d.epochId) return fail(409, "planner_restarted");
      const inputDigest = await d.digest(canonicalLocalPlan(body.input));
      if (inputDigest !== body.inputDigest) return fail(400, "planning_input_changed");
      const key = `${body.plannerId}:${body.operationId}`, prior = cache.get(key);
      if (prior) {
        if (prior.inputDigest !== inputDigest) return fail(409, "planning_operation_conflict");
        const receipt = await prior.outcome;
        return receipt ? d.json(receipt) : fail(503, "planning_outcome_unknown");
      }
      if (cache.size >= limit) return fail(503, "local_planning_cache_full");
      // Reserve the promise BEFORE invoking entropy. Concurrent equal requests
      // share one outcome; failed/unknown operations never sample again.
      const outcome = Promise.resolve().then(() => d.draw(body.input)).then(result => {
        const receipt: LocalSeatingReceipt = { kind: "local-seating-receipt-v1", plannerId: body.plannerId, operationId: body.operationId, epochId: d.epochId, inputDigest, result, authoritative: false, databaseWritten: false, persistentAudit: false };
        return isLocalSeatingReceipt(receipt, body) ? receipt : null;
      }).catch(() => null);
      cache.set(key, { inputDigest, outcome });
      const receipt = await outcome;
      return receipt ? d.json(receipt) : fail(503, "planning_outcome_unknown");
    }),
  };
}
