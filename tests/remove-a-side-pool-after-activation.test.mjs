import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { canRetireSidePool, isRetireSidePoolRequest, isSidePoolRetirementResult, retirementRejectionMessage } from "../src/lib/api/side-pool-retirement.ts";

// A Side Pool added by mistake during setup became unremovable the moment the
// revision was activated: SidePoolEditor closes with the revision, and the Side
// Pools page had no control for it. 0231 adds the removal where the pool now
// lives, as a retirement rather than a delete, and refuses any pool that has
// ever been used.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");

const sql = read("database/migrations/0231_remove_a_side_pool_after_activation.sql");
const route = read("src/app/api/v1/tournaments/[id]/side-pools/retire/route.ts");
const lib = read("src/lib/api/side-pool-retirement.ts");
const client = read("src/app/tournament/[tournamentId]/side-pools/side-pools-client.tsx");

const withoutComments = sql.split(/\r?\n/).filter((line) => !line.trimStart().startsWith("--")).join("\n");

test("the RPC follows the house contract for a server-only audited operation", () => {
  assert.match(sql, /create or replace function public\.retire_event_side_pool_v1\(/);
  assert.match(sql, /language plpgsql security definer set search_path=''/);
  assert.match(sql, /if coalesce\(\(select auth\.jwt\(\)->>'role'\), ''\) <> 'service_role' then\s*\n\s*raise exception/);
  assert.match(sql, /encode\(extensions\.digest\(convert_to\(jsonb_build_array\(\s*\n\s*'retire_event_side_pool_v1'/);
  assert.match(sql, /pg_catalog\.pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(p_actor_id::text\|\|':'\|\|p_operation_id::text,0\)\)/);
  assert.match(sql, /'idempotency_conflict'/);
  assert.match(sql, /insert into app\.operation_receipts/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /'side_pool_retired'/);
  assert.match(sql, /revoke all on function public\.retire_event_side_pool_v1\(uuid,uuid,uuid,uuid,text,uuid\) from public,anon,authenticated;/);
  assert.match(sql, /grant execute on function public\.retire_event_side_pool_v1\(uuid,uuid,uuid,uuid,text,uuid\) to service_role;/);
  assert.match(sql, /notify pgrst,'reload schema';/);
});

// The definition version row carries a foreign key on
// (operation_receipt_id, tournament_id), so the receipt has to exist first. 0224
// writes its receipt after the state change; copying that order here would fail
// the key on every call.
test("the receipt is written before the definition version it is referenced by", () => {
  const receipt = withoutComments.indexOf("insert into app.operation_receipts");
  const definition = withoutComments.indexOf("insert into app.event_side_pool_definition_versions");
  const audit = withoutComments.indexOf("insert into app.audit_events");
  assert.ok(receipt > 0 && definition > receipt, "the receipt insert must precede the definition version insert");
  assert.ok(audit > definition, "the audit row records a change that has already been written");
});

test("removal is a retirement, and nothing is deleted", () => {
  assert.match(
    withoutComments,
    /insert into app\.event_side_pool_definition_versions\(pool_id,tournament_id,event_id,version,\s*\n\s*category_code,display_name,entry_fee_minor,active,actor_profile_id,operation_receipt_id\)/,
  );
  // Name, category and fee are carried forward unchanged from the current
  // version. Only `active` moves, so the retired row still says what the pool was.
  assert.match(
    withoutComments,
    /v_definition\.category_code,v_definition\.display_name,v_definition\.entry_fee_minor,false,/,
  );
  assert.match(withoutComments, /v_definition\.version\+1/);
  for (const destructive of [/\bdelete\s+from\b/i, /\bdrop\s+(table|function|trigger|constraint)\b/i, /\bupdate\s+app\./i, /\btruncate\b/i]) {
    assert.ok(!destructive.test(withoutComments), `0231 must not contain ${destructive}`);
  }
  // Retired rows leave through the `active` filter every reader already applies,
  // so no existing function has to change and no reader can be missed.
  assert.ok(
    !/create (or replace )?function public\.(get_event_side_pool_workspace|configure_tournament_setup_side_pools|add_event_side_pool)/.test(withoutComments),
    "0231 redefines no existing function; the active flag is what the readers already filter on",
  );
});

// Money reaches a pool through an election, and team money lives in its own
// table (0176). Counting only the singles table would let a pool a team paid
// into be retired as if it were empty.
test("every table the pool owns is counted before it may be retired", () => {
  for (const table of [
    "app.event_side_pool_election_versions",
    "app.event_side_pool_team_election_versions",
    "app.event_side_pool_payout_versions",
    "app.event_side_pool_team_payout_versions",
    "app.event_side_pool_policy_versions",
    "app.event_side_pool_reconciliations",
  ]) {
    assert.match(withoutComments, new RegExp(`select count\\(\\*\\) from ${table.replace(/\./g, "\\.")} where pool_id=p_pool_id`));
  }
  assert.match(withoutComments, /v_elections \+ v_team_elections \+ v_payouts \+ v_team_payouts \+ v_policies \+ v_reconciliations > 0/);
  assert.match(withoutComments, /'side_pool_has_activity'/);
});

test("a pool that holds money says so, and says it first", () => {
  const money = withoutComments.indexOf("'side_pool_has_money'");
  const activity = withoutComments.indexOf("'side_pool_has_activity'");
  assert.ok(money > 0, "a paid-into pool is refused with its own code");
  assert.ok(money < activity, "money is reported as money rather than as generic activity");
  assert.match(withoutComments, /if v_collected > 0 then/);
  // The same latest-version-per-beneficiary arithmetic the workspace reports as
  // collectedMinor, so the amount the director is told matches the screen.
  assert.match(withoutComments, /select distinct on\(singles\.participant_id\)/);
  assert.match(withoutComments, /select distinct on\(teams\.team_entry_id\)/);
  assert.match(withoutComments, /'collectedMinor',v_collected/);
});

test("an already retired pool is an answer, not a rejection, and a missing one is", () => {
  assert.match(withoutComments, /if not v_definition\.active then\s*\n\s*return jsonb_build_object\('status','side_pool_already_retired'/);
  assert.match(withoutComments, /'rejected','code','pool_unavailable'/);
  assert.match(withoutComments, /role in\('director','co_director'\)/);
  assert.match(withoutComments, /'rejected','code','not_director'/);
});

// PostgreSQL cannot evaluate a bound repetition count above 255, and the failure
// is at run time, on every call. 0231 needs no regex at all.
test("0231 writes no regex bound", () => {
  assert.ok(!/\{\s*\d+\s*(,\s*\d+\s*)?\}/.test(withoutComments), "express a length bound as a comparison");
});

test("the route is a boundary before it is a proxy", () => {
  assert.match(route, /withApiFailureBoundary/);
  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /readSmallJson\(request\)/);
  assert.match(route, /isRetireSidePoolRequest\(body\)/);
  assert.match(route, /requireVerifiedSubject\(await createClient\(\)\)/);
  assert.match(route, /createServerOnlyAdminClient\(\)/);
  assert.match(route, /admin\.rpc\("retire_event_side_pool_v1"/);
  assert.match(route, /status: 403/);
  assert.match(route, /status: 400/);
  assert.match(route, /status: 401/);
  assert.match(route, /status: 409/);
  assert.match(route, /status: 503/);
  // requireTournamentAccess signals by throwing, which the failure boundary
  // would report as a 503. API routes never call it.
  assert.ok(!route.includes("requireTournamentAccess"));
  // Measured inside the handler. The import block names the same helpers in a
  // different order, so reading the whole file would compare the wrong lines.
  const handler = route.slice(route.indexOf("export async function POST"));
  const origin = handler.indexOf("isSameOriginRequest");
  const subject = handler.indexOf("requireVerifiedSubject");
  const rpc = handler.indexOf("admin.rpc");
  assert.ok(origin < subject && subject < rpc, "identity is established before the operation runs");
});

test("the shared side pool mutation contract is untouched", () => {
  const shared = read("src/lib/api/side-pools.ts");
  // Scoped to the two shapes that would mean removal had been folded into the
  // shared union, so an unrelated edit to that file cannot turn this red.
  assert.ok(!shared.includes("retire_event_side_pool"), "removal has its own request type and its own route");
  assert.ok(!/action === "retire/.test(shared), "the exact-key mutation union stays at eight actions");
  assert.match(client, new RegExp("side-pools/retire"), "the control posts to the dedicated segment");
});

test("the request and the result are validated by hand, both directions", () => {
  assert.match(lib, /export function isRetireSidePoolRequest/);
  assert.match(lib, /Object\.keys\(value\)\.length === 4/);
  assert.match(lib, /value\.reason\.trim\(\)\.length <= 500/);
  assert.match(lib, /export function isSidePoolRetirementResult/);
  assert.match(lib, /value\.status === "side_pool_already_retired"/);
});

// The button disappearing is a convenience. The RPC is the rule, and it asks the
// tables the same question this predicate asks the workspace payload.
test("the control offers itself only for a pool with no history", () => {
  assert.match(lib, /export function canRetireSidePool/);
  for (const clause of [
    /pool\.elections\.length === 0/,
    /pool\.payouts\.length === 0/,
    /pool\.policy === null/,
    /pool\.collectedMinor === 0/,
    /pool\.paidMinor === 0/,
    /!pool\.finalized/,
    /team\.elections\.some\(\(election\) => election\.poolId === pool\.poolId\)/,
    /team\.payouts\.some\(\(payout\) => payout\.poolId === pool\.poolId\)/,
  ]) assert.match(lib, clause);
  assert.match(client, /if \(!canRetireSidePool\(pool, teamBeneficiaries\)\) return null;/);
});

test("removal takes a confirmation and a reason, and retries as one operation", () => {
  assert.match(client, /const \[confirming, setConfirming\] = useState\(false\)/);
  assert.match(client, /Remove this Side Pool<\/button>/);
  assert.match(client, /Yes, remove this Side Pool/);
  assert.match(client, /Keep Side Pool/);
  assert.match(client, /disabled=\{parentBusy \|\| busy \|\| !reason\.trim\(\)\}/);
  assert.match(client, /const operationId = useRef<string \| null>\(null\)/);
  assert.match(client, /operationId\.current \?\?= crypto\.randomUUID\(\)/);
  assert.match(client, /retirementRejectionMessage\(body\.code, body\.activity\)/);
  assert.match(client, /router\.refresh\(\)/);
  // A client component renders once on the server, where crypto and window do
  // not exist. Every id is minted inside the handler.
  assert.ok(!/useState\(\(\) =>[^)]*crypto\./.test(client), "no browser global may be read during render");
});

test("a director is told what a refusal means in words, without a dash", () => {
  assert.match(lib, /side_pool_has_money/);
  assert.match(lib, /side_pool_has_activity/);
  assert.match(lib, /Refund and void each election first/);
  // Built from char codes so this file can assert the rule without breaking it.
  const banned = [["em dash", String.fromCharCode(0x2014)], ["en dash", String.fromCharCode(0x2013)], ["double hyphen", "--"]];
  for (const [name, source] of [["side-pool-retirement.ts", lib], ["side-pools-client.tsx", client]]) {
    for (const [label, mark] of banned) {
      assert.ok(!source.includes(mark), `${name} must contain no ${label}`);
    }
  }
});

// Everything above this line reads source text. That proves the code says what
// it says, and nothing about what it does: canRetireSidePool could return true
// for a pool full of money and every assertion above would still pass. These
// call the four exported functions with real payloads.
const UUID_POOL = "11111111-1111-4111-8111-111111111111";
const UUID_EVENT = "22222222-2222-4222-8222-222222222222";
const UUID_KEY = "33333333-3333-4333-8333-333333333333";

const cleanPool = {
  poolId: UUID_POOL, elections: [], payouts: [], policy: null,
  collectedMinor: 0, paidMinor: 0, finalized: false,
};

test("canRetireSidePool allows a pool with no history at all", () => {
  assert.equal(canRetireSidePool(cleanPool, []), true);
});

test("canRetireSidePool refuses every kind of history, one at a time", () => {
  const cases = [
    ["an election", { ...cleanPool, elections: [{ electionId: "e1", elected: true }] }, []],
    ["a payout", { ...cleanPool, payouts: [{ payoutId: "p1" }] }, []],
    ["a posted payout policy", { ...cleanPool, policy: { ratio: 5 } }, []],
    ["money received", { ...cleanPool, collectedMinor: 2000 }, []],
    ["money paid out", { ...cleanPool, paidMinor: 2000 }, []],
    ["a finalized pool", { ...cleanPool, finalized: true }, []],
    ["a team election", cleanPool, [{ elections: [{ poolId: UUID_POOL }], payouts: [] }]],
    ["a team payout", cleanPool, [{ elections: [], payouts: [{ poolId: UUID_POOL }] }]],
  ];
  for (const [label, pool, teams] of cases) {
    assert.equal(canRetireSidePool(pool, teams), false, `${label} must block removal`);
  }
});

test("a team record against a DIFFERENT pool does not block this one", () => {
  const other = [{ elections: [{ poolId: UUID_EVENT }], payouts: [{ poolId: UUID_EVENT }] }];
  assert.equal(canRetireSidePool(cleanPool, other), true);
});

test("isRetireSidePoolRequest takes a well formed request and nothing else", () => {
  const good = { eventId: UUID_EVENT, poolId: UUID_POOL, reason: "Added by mistake", idempotencyKey: UUID_KEY };
  assert.equal(isRetireSidePoolRequest(good), true);
  const bad = [
    ["no reason", { ...good, reason: "" }],
    ["a whitespace reason", { ...good, reason: "   " }],
    ["an overlong reason", { ...good, reason: "x".repeat(501) }],
    ["a non-uuid pool", { ...good, poolId: "pool-1" }],
    ["an extra field", { ...good, extra: true }],
    ["a missing field", { eventId: UUID_EVENT, poolId: UUID_POOL, reason: "why" }],
    ["not an object", "retire it"],
    ["null", null],
    ["an array", [good]],
  ];
  for (const [label, value] of bad) {
    assert.equal(isRetireSidePoolRequest(value), false, `${label} must be refused`);
  }
  assert.equal(isRetireSidePoolRequest({ ...good, reason: "x".repeat(500) }), true, "exactly 500 characters is allowed");
});

test("isSidePoolRetirementResult only accepts the three shapes the RPC returns", () => {
  const retired = { status: "side_pool_retired", poolId: UUID_POOL, eventId: UUID_EVENT, displayName: "Early Bird", version: 2 };
  assert.equal(isSidePoolRetirementResult(retired), true);
  assert.equal(isSidePoolRetirementResult({ status: "side_pool_already_retired", poolId: UUID_POOL, eventId: UUID_EVENT }), true);
  assert.equal(isSidePoolRetirementResult({ status: "rejected", code: "side_pool_has_money" }), true);
  // A retirement is an appended version, so version 1 would mean the original
  // definition came back as though it had been retired.
  assert.equal(isSidePoolRetirementResult({ ...retired, version: 1 }), false, "version must be above 1");
  assert.equal(isSidePoolRetirementResult({ ...retired, version: 2.5 }), false);
  assert.equal(isSidePoolRetirementResult({ status: "rejected" }), false, "a rejection must carry a code");
  assert.equal(isSidePoolRetirementResult({ status: "something_else" }), false);
  assert.equal(isSidePoolRetirementResult(null), false);
});

test("every rejection code the RPC can return has its own sentence", () => {
  const codes = [...withoutComments.matchAll(/'code'\s*,\s*'([a-z_]+)'/g)].map((match) => match[1]);
  assert.ok(codes.length > 0, "the migration must still be the source of the code list");
  for (const code of new Set(codes)) {
    const message = retirementRejectionMessage(code);
    assert.notEqual(message, "The Side Pool could not be removed. Reload and try again.",
      `${code} falls through to the generic message`);
  }
});

test("the money message states the amount the pool is holding", () => {
  const activity = { elections: 1, teamElections: 0, payouts: 0, teamPayouts: 0, policies: 0, reconciliations: 0, collectedMinor: 2500 };
  assert.match(retirementRejectionMessage("side_pool_has_money", activity), /\$25\.00/);
  assert.doesNotMatch(retirementRejectionMessage("side_pool_has_money"), /\$/, "with no activity payload it must not invent a figure");
});

// Measured live against production on 2026-09-19: retire the pool, then press
// the same quick-add preset, and the page answers "Side Pool request rejected:
// duplicate pool name." The confirmation panel had promised the opposite, that
// the name was freed and the pool could be added back under the same name and
// fee. The cause is that event_side_pool_active_name_unique_idx is unique over
// ROWS, (event_id, lower(trim(display_name))) where active, not over the newest
// version of each pool, so version 1 keeps saying active=true and keeps holding
// the name. The definition table is append-only, so that row can never be
// changed. Nothing pinned this copy, which is why it was wrong.
test("the removal confirmation does not promise an undo it cannot deliver", () => {
  const client = readFileSync(
    fileURLToPath(new URL("../src/app/tournament/[tournamentId]/side-pools/side-pools-client.tsx", import.meta.url)),
    "utf8");
  const panel = /Nobody has elected into this pool[\s\S]*?Keep Side Pool/.exec(client);
  assert.ok(panel, "the removal confirmation panel must still exist");
  const copy = panel[0];
  assert.doesNotMatch(copy, /name and its slot are freed/,
    "the name is NOT freed; only the slot is");
  assert.doesNotMatch(copy, /add it again with the same name/,
    "re-adding under the same name is refused duplicate_pool_name");
  assert.match(copy, /cannot be undone/i,
    "the director must be told this is one way before they press it");
  assert.match(copy, /slot is freed/,
    "the slot genuinely is freed and that is worth saying");
});

test("duplicate pool name explains why no pool by that name is visible", () => {
  const client = readFileSync(
    fileURLToPath(new URL("../src/app/tournament/[tournamentId]/side-pools/side-pools-client.tsx", import.meta.url)),
    "utf8");
  const map = /const errors: Record<string, string> = \{[\s\S]*?\};/.exec(client);
  assert.ok(map, "the add-path error map must still exist");
  assert.match(map[0], /duplicate_pool_name:/,
    "otherwise the director sees the bare enum 'duplicate pool name'");
  const message = /duplicate_pool_name: "([^"]+)"/.exec(map[0])[1];
  assert.match(message, /removed pool keeps its name/,
    "the message must say why the name is taken when nothing by that name is on the page");
});
