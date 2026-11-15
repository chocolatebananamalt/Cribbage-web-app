// TEST ONLY: executes unchanged production route source with fixture identity/RPC.
// This is not a real Supabase authentication provider or a production adapter.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import ts from "typescript";
import { NextRequest } from "next/server";
import * as operations from "../../src/lib/api/game-operation";
import { apiJson, readSmallJson, withApiFailureBoundary } from "../../src/lib/api/route-boundary";
import { isSameOriginRequest } from "../../src/lib/api/same-origin";
import { isUuid } from "../../src/lib/api/validation";
import * as offlineContract from "../../src/lib/offline-score-queue-contract";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
export function makeFixtureScoreRoute(kind: "submissions" | "confirmations" | "offline-capability" | "offline-score-replay", getIdentity: () => Promise<{ actorId: string; rpc: Rpc } | null>, adminRpc?: Rpc) {
  const filename = kind === "offline-score-replay" ? path.join(process.cwd(), "src/app/api/v1/offline-score-replay/route.ts") : path.join(process.cwd(), "src/app/api/v1/games/[id]", kind, "route.ts");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  return async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const identity = await getIdentity(), loaded = { exports: {} as { POST?: (r: NextRequest, c: typeof context) => Promise<Response> } };
    const dependencies = (name: string) => {
      if (name === "next/server") return { NextRequest };
      if (name.endsWith("/api/game-operation")) return operations;
      if (name.endsWith("/api/route-boundary")) return { apiJson, readSmallJson, withApiFailureBoundary, requireVerifiedSubject: async () => identity?.actorId ?? null, requireVerifiedIdentity: async () => identity ? { subject: identity.actorId, sessionId: identity.actorId } : null };
      if (name.endsWith("/api/validation")) return { isUuid };
      if (name.endsWith("/api/same-origin")) return { isSameOriginRequest };
      if (name.endsWith("/offline-score-queue-contract")) return offlineContract;
      if (name.endsWith("/supabase/private-admin")) return { createServerOnlyAdminClient: () => ({ rpc: adminRpc ?? (async () => ({ data: null, error: "fixture_admin_unavailable" })) }) };
      if (name.endsWith("/supabase/server")) return { createClient: async () => ({ rpc: identity?.rpc ?? (async () => ({ data: null, error: "fixture_not_signed_in" })) }) };
      throw new Error(`Unsupported normal-route fixture dependency: ${name}`);
    };
    vm.runInNewContext(compiled, { exports: loaded.exports, require: dependencies, crypto: globalThis.crypto, Buffer, TextEncoder, Uint8Array }, { filename });
    if (!loaded.exports.POST) throw new Error("Original score route was not exported");
    return loaded.exports.POST(request, context);
  };
}
