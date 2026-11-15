import { createHash, randomInt, randomUUID } from "node:crypto";
import { createLocalPlannerHandlers } from "../../../../lib/seating/local-planner-handler";
import { planLocalRandomSeating } from "../../../../lib/seating/local-random-plan";
import { apiJson, withApiFailureBoundary } from "../../../../lib/api/route-boundary";
import { readBoundedJson } from "../../../../lib/api/bounded-json";
import { isSameOriginRequest } from "../../../../lib/api/same-origin";
const handlers = createLocalPlannerHandlers({
  env: process.env, epochId: randomUUID(),
  digest: text => createHash("sha256").update(text).digest("hex"),
  draw: input => planLocalRandomSeating(input, maximum => randomInt(0, maximum)),
  readJson: request => readBoundedJson(request, 16384),
  sameOrigin: isSameOriginRequest,
  json: apiJson, boundary: withApiFailureBoundary,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
