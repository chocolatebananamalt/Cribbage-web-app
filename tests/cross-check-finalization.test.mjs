// Finalize Cross-Checking is a new orchestration over stores that already
// exist, so almost everything that can go wrong here is a disagreement between
// two places rather than a bug inside one of them: the condition list the RPC
// builds versus the list the guard accepts, the readiness the screen shows
// versus the readiness the writer recomputes, the boundary the route is
// supposed to have versus the one it has. These tests check the agreements.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  crossCheckConditionCodes,
  finalizeCrossCheckingMessage,
  isCrossCheckFinalizationWorkspace,
  isFinalizeCrossCheckingRequest,
  isFinalizeCrossCheckingResult,
} from "../src/lib/api/cross-check-finalization.ts";

const root = process.cwd();
const tournamentId = "a2300000-0000-4000-8000-000000000001";
const operationId = "a2300000-0000-4000-8000-000000000002";

const migrationPath = path.join(root, "database/migrations/0230_finalize_cross_checking.sql");
const routePath = path.join(root, "src/app/api/v1/tournaments/[id]/cross-check-finalization/route.ts");
const pagePath = path.join(root, "src/app/tournament/[tournamentId]/cross-check-finalization/page.tsx");
const clientPath = path.join(root, "src/app/tournament/[tournamentId]/cross-check-finalization/cross-check-finalization-client.tsx");
const guardPath = path.join(root, "src/lib/api/cross-check-finalization.ts");

function conditions(outstandingCodes) {
  return crossCheckConditionCodes.map((code) => ({
    code,
    outstanding: outstandingCodes.includes(code),
    count: outstandingCodes.includes(code) ? 2 : 0,
    sentence: `Sentence for ${code}.`,
  }));
}

function workspace(outstandingCodes, finalization = null) {
  return {
    tournamentId,
    tournamentName: "Synthetic Tournament",
    tournamentStatus: "open",
    conditions: conditions(outstandingCodes),
    outstanding: outstandingCodes,
    finalization,
    canFinalize: finalization === null && outstandingCodes.length === 0,
  };
}

test("a ready workspace and a blocked workspace are both exact", () => {
  assert.equal(isCrossCheckFinalizationWorkspace(workspace([]), tournamentId), true);
  assert.equal(isCrossCheckFinalizationWorkspace(workspace(["disputes_unresolved"]), tournamentId), true);
  assert.equal(isCrossCheckFinalizationWorkspace(
    workspace([], { finalizedAt: "2026-09-18T18:00:00+00:00", finalizedBy: "The Director" }), tournamentId), true);
  assert.equal(isCrossCheckFinalizationWorkspace(workspace([]), operationId), false);
  assert.equal(isCrossCheckFinalizationWorkspace({ ...workspace([]), extra: 1 }, tournamentId), false);
});

test("readiness cannot be claimed while any condition is outstanding", () => {
  // The whole point of the screen is that the button's state is the server's
  // answer. A payload that says ready while a condition is outstanding is the
  // exact shape that would produce a button that is enabled and then refuses.
  assert.equal(isCrossCheckFinalizationWorkspace(
    { ...workspace(["games_not_verified"]), canFinalize: true }, tournamentId), false);
  assert.equal(isCrossCheckFinalizationWorkspace(
    { ...workspace([]), canFinalize: false }, tournamentId), false);
  assert.equal(isCrossCheckFinalizationWorkspace(
    { ...workspace([]), finalization: { finalizedAt: "2026-09-18T18:00:00+00:00", finalizedBy: "The Director" } },
    tournamentId), false);
});

test("count and outstanding cannot disagree, and the outstanding list is derived not asserted", () => {
  const drifted = workspace(["corrections_pending"]);
  drifted.conditions[4] = { ...drifted.conditions[4], count: 0 };
  assert.equal(isCrossCheckFinalizationWorkspace(drifted, tournamentId), false);

  const lying = workspace(["corrections_pending"]);
  lying.outstanding = ["disputes_unresolved"];
  assert.equal(isCrossCheckFinalizationWorkspace(lying, tournamentId), false);

  const short = workspace(["corrections_pending"]);
  short.conditions = short.conditions.slice(1);
  assert.equal(isCrossCheckFinalizationWorkspace(short, tournamentId), false);

  const reordered = workspace([]);
  reordered.conditions = [reordered.conditions[1], reordered.conditions[0], ...reordered.conditions.slice(2)];
  assert.equal(isCrossCheckFinalizationWorkspace(reordered, tournamentId), false);

  const negative = workspace([]);
  negative.conditions[2] = { ...negative.conditions[2], count: -1 };
  assert.equal(isCrossCheckFinalizationWorkspace(negative, tournamentId), false);
});

test("the request and result contracts are exact", () => {
  assert.equal(isFinalizeCrossCheckingRequest({ idempotencyKey: operationId }), true);
  assert.equal(isFinalizeCrossCheckingRequest({ idempotencyKey: "not-a-uuid" }), false);
  assert.equal(isFinalizeCrossCheckingRequest({ idempotencyKey: operationId, reason: "x" }), false);

  assert.equal(isFinalizeCrossCheckingResult({
    status: "cross_checking_finalized", tournamentId, tournamentName: "Synthetic Tournament",
    finalizedAt: "2026-09-18T18:00:00+00:00",
  }), true);
  assert.equal(isFinalizeCrossCheckingResult({
    status: "already_finalized", tournamentId, finalizedAt: "2026-09-18T18:00:00+00:00",
  }), true);
  assert.equal(isFinalizeCrossCheckingResult({ status: "rejected", code: "not_director" }), true);
  assert.equal(isFinalizeCrossCheckingResult({
    status: "rejected", code: "disputes_unresolved", outstanding: ["disputes_unresolved"],
  }), true);
  assert.equal(isFinalizeCrossCheckingResult({ status: "rejected", code: "" }), false);
  assert.equal(isFinalizeCrossCheckingResult({ status: "rejected", code: "x", outstanding: [] }), false);
  assert.equal(isFinalizeCrossCheckingResult({ status: "finalized" }), false);
  assert.equal(isFinalizeCrossCheckingResult(null), false);
});

test("a refusal naming a condition does not restate that condition in different words", () => {
  // The screen is already showing the condition's own sentence and count.
  for (const code of crossCheckConditionCodes) {
    assert.match(finalizeCrossCheckingMessage(code), /Reload to see what is outstanding/);
  }
  assert.match(finalizeCrossCheckingMessage("not_director"), /director or co-director/);
  assert.match(finalizeCrossCheckingMessage("something_new"), /could not be finalized/);
});

test("the migration and the guard agree on the condition list, in order", async () => {
  const sql = await readFile(migrationPath, "utf8");
  // Only the condition builder. The two public functions also carry a 'code'
  // key, for their rejection payloads, and those are a different vocabulary.
  const builderAt = sql.indexOf("create or replace function app.cross_check_finalization_conditions_v1");
  const builder = sql.slice(builderAt, sql.indexOf("$$;", builderAt));
  assert.ok(builderAt > 0, "the condition builder is missing");
  const codes = [...builder.matchAll(/'code', '([a-z0-9_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(codes, [...crossCheckConditionCodes],
    "the RPC builds a condition the client guard would reject, or drops one the client still expects");
});

test("the migration is additive, audited, service-only, and scoped to active events", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create table app\.cross_check_finalizations/);
  assert.match(sql, /alter table app\.cross_check_finalizations enable row level security/);
  assert.match(sql, /alter table app\.cross_check_finalizations force row level security/);
  assert.match(sql, /cross_check_finalizations_immutable/);
  assert.match(sql, /execute function app\.reject_immutable_history\(\)/);
  assert.match(sql, /unique \(tournament_id\)/);
  assert.match(sql, /insert into app\.operation_receipts/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /'cross_checking_finalized'/);
  assert.match(sql, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(sql, /grant execute on function public\.finalize_cross_checking_v1\(uuid, uuid, uuid\) to service_role/);
  assert.match(sql, /grant execute on function public\.get_cross_check_finalization_workspace_v1\(uuid, uuid\) to service_role/);
  assert.match(sql, /revoke all on function public\.finalize_cross_checking_v1\(uuid, uuid, uuid\) from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.get_cross_check_finalization_workspace_v1\(uuid, uuid\) from public, anon, authenticated/);
  assert.match(sql, /notify pgrst, 'reload schema'/);

  // Both public functions must refuse a caller that is not the server.
  const serverOnly = sql.match(/auth\.jwt\(\)->>'role'\), ''\) <> 'service_role'/g) ?? [];
  assert.equal(serverOnly.length, 2, "both public functions must carry the service_role check");

  // A retired or replaced event keeps its rows forever, so a count that is not
  // scoped to an active event can leave a tournament permanently unable to
  // finalize over work that was deliberately abandoned. The condition function
  // joins app.events nine times, once per event-scoped store, and every one of
  // them is scoped. Comments are stripped first: counting them too is how this
  // assertion first read 10 and looked correct.
  const code = sql.split(/\r?\n/).filter((line) => !line.trimStart().startsWith("--")).join("\n");
  const joins = code.match(/join app\.events event_row/g) ?? [];
  const activeScopes = code.match(/operational_state = 'active'/g) ?? [];
  assert.equal(joins.length, 9, "the condition function joins app.events once per event-scoped store");
  assert.equal(activeScopes.length, joins.length, "every count over event-scoped rows must be scoped to an active event");

  // Nothing existing is rewritten. If this ever fails, the change stopped being
  // additive and needs the anchored pg_get_functiondef patch that 0228 uses.
  assert.doesNotMatch(sql, /pg_get_functiondef/);
  assert.doesNotMatch(sql, /alter table app\.(?!cross_check_finalizations)/);
  assert.doesNotMatch(sql, /update app\.tournaments/,
    "recording cross-check completion must not move the tournament's own status");
});

test("the writer recomputes every condition itself rather than trusting the screen", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const writer = sql.slice(sql.indexOf("create or replace function public.finalize_cross_checking_v1"));
  assert.match(writer, /app\.cross_check_finalization_conditions_v1\(p_tournament_id\)/,
    "the writer must recount inside its own transaction");
  const recountAt = writer.indexOf("app.cross_check_finalization_conditions_v1(p_tournament_id)");
  const lockAt = writer.indexOf("from app.tournaments where id = p_tournament_id for update");
  const insertAt = writer.indexOf("insert into app.cross_check_finalizations");
  assert.ok(lockAt > 0 && lockAt < recountAt && recountAt < insertAt,
    "the tournament row lock must be held before the recount, and the recount must precede the insert");
  assert.match(writer, /jsonb_array_length\(v_outstanding\) > 0/,
    "any outstanding condition must refuse the write");
  // A refusal that wrote a receipt would poison the retry: the client holds one
  // operation id across retries, so the replay branch would return the stale
  // refusal after the director cleared the condition.
  const refusalAt = writer.indexOf("'status', 'rejected',\n      'code', v_outstanding->>0");
  const receiptAt = writer.indexOf("insert into app.operation_receipts");
  assert.ok(refusalAt > 0 && receiptAt > refusalAt, "the outstanding-condition refusal must return before any receipt is written");
});

test("the route carries the private mutation boundary", async () => {
  const route = await readFile(routePath, "utf8");
  assert.match(route, /withApiFailureBoundary/);
  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /readSmallJson\(request\)/);
  assert.match(route, /requireVerifiedSubject\(await createClient\(\)\)/);
  assert.match(route, /createServerOnlyAdminClient\(\)/);
  assert.match(route, /isFinalizeCrossCheckingRequest/);
  assert.match(route, /isFinalizeCrossCheckingResult/);
  assert.match(route, /status: 409/);
  assert.match(route, /status: 503/);
  // The actor is the verified subject, never anything the request body carries.
  assert.match(route, /p_actor_id: subject/);
  assert.doesNotMatch(route, /p_actor_id: body/);
});

test("the page renders per request, reads only the scoped RPC, and 404s on refusal", async () => {
  const page = await readFile(pagePath, "utf8");
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /requireTournamentAccess\(tournamentId\)/);
  assert.match(page, /get_cross_check_finalization_workspace_v1/);
  assert.match(page, /p_actor_id: access\.user\.id/);
  assert.match(page, /if \(error \|\| !isCrossCheckFinalizationWorkspace\(data, tournamentId\)\) notFound\(\)/);
});

test("the client holds one operation id across retries and never reads a browser global during render", async () => {
  const client = await readFile(clientPath, "utf8");
  assert.match(client, /useRef<string \| null>\(null\)/);
  assert.match(client, /operationId\.current \?\?= crypto\.randomUUID\(\)/);
  assert.match(client, /disabled=\{busy \|\| !workspace\.canFinalize\}/,
    "the action must be disabled while anything is outstanding");
  // A lazy useState initializer runs during the first render, on the server
  // included, which is how seating-directory-client answered 500 for every
  // role. Nothing here may read window at all.
  assert.doesNotMatch(client, /useState\(\(\)/);
  assert.doesNotMatch(client, /\bwindow\./);
});

test("no user-facing string carries a dash the copy standard forbids", async () => {
  const sql = await readFile(migrationPath, "utf8");
  // Every SQL comment opens with a double hyphen, so the comments are dropped
  // first and only the quoted literals, which are the strings a director
  // actually reads, are judged. This holds only while no line puts code and a
  // trailing comment together, which is asserted rather than assumed.
  const lines = sql.split(/\r?\n/);
  assert.deepEqual(lines.filter((line) => /\S\s*--/.test(line) && !line.trimStart().startsWith("--")), [],
    "a trailing comment on a code line would break the literal extraction below");
  const code = lines.filter((line) => !line.trimStart().startsWith("--")).join("\n");
  const literals = [...code.matchAll(/'([^']*)'/g)].map((match) => match[1]);
  for (const literal of literals) {
    assert.ok(!/[–—]|--/.test(literal), `migration string literal breaks the copy standard: ${literal}`);
  }
  for (const file of [routePath, pagePath, clientPath, guardPath]) {
    const source = await readFile(file, "utf8");
    assert.ok(!/[–—]/.test(source), `${file} contains an em dash or en dash`);
    assert.ok(!/--/.test(source), `${file} contains a double hyphen`);
  }
});

test("no regular expression in the migration can exceed the engine's repetition limit", async () => {
  const sql = await readFile(migrationPath, "utf8");
  // PostgreSQL caps a bound repetition count at 255 and raises 2201B when it is
  // exceeded, at evaluation time, on every call regardless of input. 0230 needs
  // no bound repetition at all, so the safe count here is zero rather than a
  // limit to stay under.
  assert.deepEqual([...sql.matchAll(/\{\s*\d+\s*(?:,\s*\d*\s*)?\}/g)].map((match) => match[0]), []);
});
