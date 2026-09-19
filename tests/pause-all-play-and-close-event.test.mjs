// Pause All Play and Close Event (migration 0229).
//
// Neither control has a live fixture yet, so this file verifies the two things
// a reading of the diff cannot: that the deployed-shape rules the house relies
// on are actually present in the SQL and the routes, and that the request and
// response predicates behave on real values rather than on their type
// declarations. The predicates are imported and executed; the SQL and the
// route files are read, which is the same approach tests/game-api-semantics
// takes for modules that import next/server.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const MIGRATION = "database/migrations/0229_pause_all_play_and_close_event.sql";
const SUBMISSIONS = "src/app/api/v1/games/[id]/submissions/route.ts";
const PAUSE_ROUTE = "src/app/api/v1/tournaments/[id]/events/[eventId]/play-pause/route.ts";
const CLOSE_ROUTE = "src/app/api/v1/tournaments/[id]/events/[eventId]/play-close/route.ts";
const LIB = "src/lib/api/event-control.ts";
const REPLAY_ROUTE = "src/app/api/v1/offline-score-replay/route.ts";
const PAGE = "src/app/tournament/[tournamentId]/event-control/page.tsx";
const CLIENT = "src/app/tournament/[tournamentId]/event-control/event-control-client.tsx";

const WRITE_FUNCTIONS = ["set_event_play_pause_v1", "close_event_play_v1", "reopen_event_play_v1"];

test("every new write RPC carries the house authorization, receipt and audit shape", () => {
  const sql = read(MIGRATION);
  for (const name of WRITE_FUNCTIONS) {
    const start = sql.indexOf(`create or replace function public.${name}(`);
    assert.ok(start > 0, `${name} is missing`);
    const body = sql.slice(start, sql.indexOf("\n$$;", start));
    assert.match(body, /language plpgsql security definer set search_path=''/, `${name} must be a definer with an empty search_path`);
    // Without this the function is callable by anyone PostgREST lets through,
    // and a security definer body would then run as its owner.
    assert.match(body, /auth\.jwt\(\)->>'role'\), ''\) <> 'service_role'/, `${name} must refuse a caller that is not service_role`);
    assert.match(body, /raise exception using errcode='P0001'/, `${name} must raise rather than return on a non service_role caller`);
    assert.match(body, /pg_catalog\.pg_advisory_xact_lock/, `${name} must take the idempotency lock`);
    assert.match(body, /'event-play-gate:'\|\|p_event_id::text/, `${name} must serialize against the other lifecycle writes on the same event`);
    assert.match(body, /insert into app\.operation_receipts/, `${name} must write a receipt`);
    assert.match(body, /insert into app\.audit_events/, `${name} must write an audit row`);
    assert.match(body, new RegExp(`v_existing\\.operation_type='${name}' and v_existing\\.request_hash=v_hash`), `${name} must replay only its own receipt`);
    assert.match(body, /in\('director','co_director'\)/, `${name} must require a director role`);
  }
});

test("the migration revokes and grants every function it defines, then reloads PostgREST", () => {
  const sql = read(MIGRATION);
  for (const name of [...WRITE_FUNCTIONS, "get_event_control_workspace_v1"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([a-z,]+\\) from public,anon,authenticated;`), `${name} is not revoked`);
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([a-z,]+\\) to service_role;`), `${name} is not granted to service_role`);
  }
  // The gate is the one exception, and deliberately so: the score submission
  // route runs on the player's own session, not a secret key.
  assert.match(sql, /revoke all on function public\.get_game_play_gate_v1\(uuid\) from public,anon;/);
  assert.match(sql, /grant execute on function public\.get_game_play_gate_v1\(uuid\) to authenticated,service_role;/);
  assert.doesNotMatch(sql, /grant execute on function public\.set_event_play_pause_v1[^;]*to authenticated/);
  assert.doesNotMatch(sql, /grant execute on function public\.close_event_play_v1[^;]*to authenticated/);
  assert.match(sql, /notify pgrst,'reload schema';\s*$/);
});

test("the new history tables are append-only and ordered by sequence, not by clock", () => {
  const sql = read(MIGRATION);
  for (const table of ["event_play_pauses", "event_play_closes"]) {
    assert.match(sql, new RegExp(`create table app\\.${table}\\(`), `${table} is missing`);
    assert.match(sql, new RegExp(`alter table app\\.${table} force row level security;`));
    assert.match(sql, new RegExp(`revoke all on table app\\.${table} from public,anon,authenticated;`));
    assert.match(sql, new RegExp(`create trigger ${table}_immutable before update or delete on app\\.${table}`), `${table} must refuse update and delete`);
    assert.match(sql, new RegExp(`create index ${table}_event_idx on app\\.${table}\\(event_id,sequence_number desc\\);`));
  }
  // clock_timestamp() can tie inside one busy second. A tie on "which row is
  // newest" would flip an event between paused and running at random, so both
  // state readers order by the identity column.
  for (const reader of ["event_play_pause_state_v1", "event_play_close_state_v1"]) {
    const start = sql.indexOf(`create or replace function app.${reader}(`);
    assert.ok(start > 0, `${reader} is missing`);
    const body = sql.slice(start, sql.indexOf("\n$$;", start));
    assert.match(body, /order by \w+\.sequence_number desc limit 1/, `${reader} must pick the newest row by sequence number`);
    assert.doesNotMatch(body, /order by [\w.]*recorded_at/, `${reader} must not break a tie on a timestamp`);
  }
});

test("close readiness reuses the one authoritative definition of a resolved game", () => {
  const sql = read(MIGRATION);
  const start = sql.indexOf("create or replace function app.event_play_close_readiness_v1(");
  const body = sql.slice(start, sql.indexOf("\n$$;", start));
  // A hand-rolled check on canonical_games.state would refuse to close an event
  // whose last game was settled by an operational forfeit or an approved
  // device-failure recovery, both of which this helper already counts.
  assert.match(body, /app\.game_is_authoritatively_resolved_v1\(scheduled\.canonical_game_id\)/);
  assert.doesNotMatch(body, /state in\('verified'/, "readiness must not re-derive verified from canonical_games.state");
  assert.match(body, /'unresolvedGames',count\(\*\) filter\(where not app\.game_is_authoritatively_resolved_v1/);
});

test("close requires an explicit server-side confirmation and reports its counts on refusal", () => {
  const sql = read(MIGRATION);
  const start = sql.indexOf("create or replace function public.close_event_play_v1(");
  const body = sql.slice(start, sql.indexOf("\n$$;", start));
  // A tick that exists only in the browser is a decoration. start_event_play_v1
  // checks the same flag server side and this operation is no smaller.
  assert.match(body, /p_confirmed is distinct from true/);
  assert.match(body, /'code','games_unresolved',\s*'scheduledGames',v_scheduled,'resolvedGames',v_resolved,'unresolvedGames',v_unresolved/);
  assert.match(body, /'code','no_scheduled_games'/);
  assert.match(body, /'code','team_event_unsupported'/);
});

test("reopening is refused once anything downstream has read the closed scorecard", () => {
  const sql = read(MIGRATION);
  const start = sql.indexOf("create or replace function app.event_play_reopen_is_safe_v1(");
  const body = sql.slice(start, sql.indexOf("\n$$;", start));
  for (const table of [
    "qualification_result_versions",
    "standard_singles_settlement_drafts",
    "standard_singles_playoff_result_versions",
    "standard_singles_settlement_final_versions",
  ]) {
    assert.match(body, new RegExp(`app\\.${table} \\w+ where \\w+\\.event_id=p_event_id`), `${table} must block a reopen`);
  }
  assert.match(read(MIGRATION), /if not app\.event_play_reopen_is_safe_v1\(p_event_id\) then\s*\n\s*return jsonb_build_object\('status','rejected','code','downstream_activity'\);/);
});

test("no bound repetition count in this migration can reach PostgreSQL's limit", () => {
  // The engine caps a {n,m} count at 255 and raises "invalid repetition
  // count(s)" the moment the pattern is evaluated, which is how the
  // registration link stayed broken from 0203 to 0228. Every length bound here
  // is a comparison instead.
  const sql = read(MIGRATION);
  const offenders = sql.split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter((entry) => !entry.line.startsWith("--"))
    .flatMap((entry) => [...entry.line.matchAll(/\{\s*(\d+)\s*(?:,\s*(\d+)\s*)?\}/g)].map(() => `${entry.number}: ${entry.line}`));
  assert.deepEqual(offenders, [], `express a length bound as a comparison:\n${offenders.join("\n")}`);
  assert.match(sql, /check\(length\(reason\) between 1 and 1000\)/);
});

test("the score submission gate runs after identity and before the score is written", () => {
  const route = read(SUBMISSIONS);
  const identity = route.indexOf("requireVerifiedSubject(supabase)");
  const gate = route.indexOf('supabase.rpc("get_game_play_gate_v1"');
  const submit = route.indexOf('supabase.rpc("submit_game_score"');
  assert.ok(identity > 0 && gate > 0 && submit > 0, "the submissions route must still authenticate, gate, then submit");
  assert.ok(gate > identity, "an unauthenticated caller must not be able to probe the gate");
  assert.ok(gate < submit, "the gate is pointless after the score has already been written");
  // A gate that cannot be read must refuse. Accepting scores into a closed
  // event because the check failed is the outcome the control exists to stop.
  assert.match(route, /if \(gate\.error\) return apiJson\(\{ error: "operation_unavailable" \}, \{ status: 503 \}\);/);
  assert.match(route, /gate\.data === "paused" \|\| gate\.data === "closed"/);
  assert.match(route, /code: gate\.data === "paused" \? "event_play_paused" : "event_play_closed"/);
  assert.match(route, /status: 409/);
  // The hot path stays on RPCs only, which tests/game-api-semantics also asserts.
  assert.doesNotMatch(route, /\.from\(|\.insert\(|\.update\(/);
  assert.doesNotMatch(route, /error\.message/);
  assert.doesNotMatch(route, /createServerOnlyAdminClient/, "the player's own session is enough to read the gate");
});

test("a paused or closed refusal is not definitive, so the player's entry survives for retry", async () => {
  const operations = await import(pathToFileURL(path.join(root, "src/lib/api/game-operation.ts")).href);
  const gameId = "11111111-1111-4111-8111-111111111111";
  for (const code of ["event_play_paused", "event_play_closed"]) {
    const payload = { status: "rejected", game_id: gameId, code };
    // isDefinitiveScoreMutationFailure clears the stored envelope when this is
    // true. Both codes are deliberately outside the allowlist so the browser
    // keeps the entry and the same result can be sent again after a resume.
    assert.equal(operations.isRejectedSubmissionOperation(payload, gameId), false, `${code} must not be treated as definitive`);
  }
  assert.equal(operations.isRejectedSubmissionOperation({ status: "rejected", game_id: gameId, code: "not_assigned" }, gameId), true);
});

// The gate on games/[id]/submissions alone would have enforced almost nothing.
// score-entry.tsx submit() takes that route only when a recovered retry
// envelope already exists; an ordinary first entry is written to the device
// queue and synced through /api/v1/offline-score-replay.
test("the route that carries a first-time score is gated too", () => {
  const entry = read("src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx");
  const submit = entry.slice(entry.indexOf("const submit = async ()"));
  const firstBranch = submit.indexOf("if (!pendingSubmission)");
  const directPost = submit.indexOf("/api/v1/games/${context.gameId}/submissions");
  assert.ok(firstBranch > 0 && directPost > firstBranch, "a first entry still goes to the queue before the direct route");
  assert.match(submit.slice(firstBranch, directPost), /saveOffline\(\)[\s\S]*syncOffline\(record\)/);

  const replay = read(REPLAY_ROUTE);
  const actor = replay.indexOf("raw.verifiedActorId !== identity.subject");
  const gate = replay.indexOf('supabase.rpc("get_game_play_gate_v1"');
  const capability = replay.indexOf('admin.rpc("get_offline_submission_capability_v1"');
  assert.ok(actor > 0 && gate > 0 && capability > 0, "the replay route must authenticate, gate, then read the capability");
  assert.ok(gate > actor, "the gate must not run for a caller who is not the signed actor");
  // A pause must not burn a capability or write a rejection row that somebody
  // then has to talk the player through.
  assert.ok(gate < capability, "the gate must run before any capability work");
  assert.match(replay, /if \(gate\.error\) return apiJson\(\{ error: "operation_unavailable" \}, \{ status: 503 \}\);/);
  assert.match(replay, /status: 423/);
  // The contract this route already had must be intact.
  assert.match(replay, /requireVerifiedIdentity/);
  assert.match(replay, /crypto\.subtle\.verify/);
  assert.match(replay, /p_capability_id: raw\.capabilityId/);
});

test("a paused replay leaves the player's queued score on the device", async () => {
  const contract = await import(pathToFileURL(path.join(root, "src/lib/offline-score-queue-contract.ts")).href);
  for (const code of ["event_play_paused", "event_play_closed"]) {
    // canDeleteOfflineQueueRecord only deletes against a well-formed receipt.
    // The refusal body is not one, so the entry cannot be dropped even if the
    // status were ever changed to 409 by mistake.
    assert.equal(contract.isOfflineReplayReceipt({ error: code }), false, `${code} must never read as a replay receipt`);
  }
  const entry = read("src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx");
  // 423 is neither of the two statuses that reach the delete path, and it is
  // not 401, so the player is told the entry is still on the device and Sync
  // Saved Entry stays available.
  assert.match(entry, /if \(response\.ok \|\| response\.status === 409\) \{/);
  assert.match(entry, /deleteOfflineSubmission\(record\.intent\.queueId\)/);
  assert.match(entry, /Your saved offline entry is still on this device\. Tap Sync Saved Entry to try again\./);
  const replay = read(REPLAY_ROUTE);
  assert.doesNotMatch(replay, /event_play_paused" : "event_play_closed" \}, \{ status: 409/);
});

test("both new routes follow the archive route shape and avoid the page-only access helper", () => {
  for (const file of [PAUSE_ROUTE, CLOSE_ROUTE]) {
    const route = read(file);
    assert.match(route, /withApiFailureBoundary/, `${file} must use the failure boundary`);
    assert.match(route, /isSameOriginRequest\(request\)/, `${file} must reject a cross-origin mutation`);
    assert.match(route, /readSmallJson\(request\)/, `${file} must bound the body`);
    assert.match(route, /requireVerifiedSubject\(await createClient\(\)\)/, `${file} must verify the caller`);
    assert.match(route, /createServerOnlyAdminClient\(\)/, `${file} must call the RPC with the secret key`);
    assert.match(route, /status: 409/, `${file} must report a refusal as a refusal`);
    assert.match(route, /operation_unavailable" \}, \{ status: 503 \}/, `${file} must report a transport failure as 503`);
    // requireTournamentAccess signals by throwing, which inside the failure
    // boundary reads as a fault and answers 503 instead of 401 or 404.
    assert.doesNotMatch(route, /requireTournamentAccess/, `${file} must not use the page-only access helper`);
  }
  assert.match(read(PAUSE_ROUTE), /set_event_play_pause_v1/);
  assert.match(read(CLOSE_ROUTE), /close_event_play_v1/);
  assert.match(read(CLOSE_ROUTE), /reopen_event_play_v1/);
  // The route forwards the caller's own confirmation rather than a literal,
  // so the check inside close_event_play_v1 is a real second layer. The
  // request contract is what guarantees the value is true for a close.
  assert.match(read(CLOSE_ROUTE), /p_confirmed: body\.confirmed/);
  assert.match(read("src/lib/api/event-control.ts"), /value\.confirmed === true/);
});

test("the request predicates accept exactly the four supported bodies", async () => {
  const lib = await import(pathToFileURL(path.join(root, LIB)).href);
  const key = "22222222-2222-4222-8222-222222222222";

  assert.equal(lib.isEventPlayPauseRequest({ action: "pause", reason: "Lunch break", idempotencyKey: key }), true);
  assert.equal(lib.isEventPlayPauseRequest({ action: "resume", reason: "Back from lunch", idempotencyKey: key }), true);
  assert.equal(lib.isEventPlayPauseRequest({ action: "close", reason: "Lunch break", idempotencyKey: key }), false);
  // A pause nobody can explain an hour later is the one an official cannot lift.
  assert.equal(lib.isEventPlayPauseRequest({ action: "pause", reason: "   ", idempotencyKey: key }), false);
  assert.equal(lib.isEventPlayPauseRequest({ action: "pause", reason: "x".repeat(1001), idempotencyKey: key }), false);
  assert.equal(lib.isEventPlayPauseRequest({ action: "pause", reason: "Lunch", idempotencyKey: "not-a-uuid" }), false);
  assert.equal(lib.isEventPlayPauseRequest({ action: "pause", reason: "Lunch", idempotencyKey: key, extra: 1 }), false);

  assert.equal(lib.isEventPlayCloseRequest({ action: "close", reason: "Play finished", confirmed: true, idempotencyKey: key }), true);
  // The tick is part of the request, not part of the page.
  assert.equal(lib.isEventPlayCloseRequest({ action: "close", reason: "Play finished", idempotencyKey: key }), false);
  assert.equal(lib.isEventPlayCloseRequest({ action: "close", reason: "Play finished", confirmed: false, idempotencyKey: key }), false);
  assert.equal(lib.isEventPlayCloseRequest({ action: "reopen", reason: "Closed too early", idempotencyKey: key }), true);
  assert.equal(lib.isEventPlayCloseRequest({ action: "reopen", reason: "Closed too early", confirmed: true, idempotencyKey: key }), false);
  assert.equal(lib.isEventPlayCloseRequest(null), false);
  assert.equal(lib.isEventPlayCloseRequest([{ action: "reopen", reason: "x", idempotencyKey: key }]), false);
});

test("the result predicates accept what the RPCs return and nothing else", async () => {
  const lib = await import(pathToFileURL(path.join(root, LIB)).href);
  const eventId = "33333333-3333-4333-8333-333333333333";

  assert.equal(lib.isEventPlayPauseResult({ status: "event_play_paused", eventId, pauseState: "paused" }), true);
  assert.equal(lib.isEventPlayPauseResult({ status: "event_play_resumed", eventId, pauseState: "open" }), true);
  assert.equal(lib.isEventPlayPauseResult({ status: "already_paused", eventId }), true);
  assert.equal(lib.isEventPlayPauseResult({ status: "not_paused", eventId }), true);
  assert.equal(lib.isEventPlayPauseResult({ status: "rejected", code: "not_director" }), true);
  assert.equal(lib.isEventPlayPauseResult({ status: "event_play_paused", eventId }), false);
  assert.equal(lib.isEventPlayPauseResult({ status: "something_else", eventId }), false);

  assert.equal(lib.isEventPlayCloseResult({ status: "event_play_closed", eventId, closeState: "closed", scheduledGames: 40, resolvedGames: 40, unresolvedGames: 0 }), true);
  assert.equal(lib.isEventPlayCloseResult({ status: "event_play_reopened", eventId, closeState: "open" }), true);
  assert.equal(lib.isEventPlayCloseResult({ status: "already_closed", eventId }), true);
  assert.equal(lib.isEventPlayCloseResult({ status: "not_closed", eventId }), true);
  const unresolved = { status: "rejected", code: "games_unresolved", scheduledGames: 40, resolvedGames: 38, unresolvedGames: 2 };
  assert.equal(lib.isEventPlayCloseResult(unresolved), true);
  // A half-populated count set is a payload these RPCs never produce, and it
  // would render as "0 of 0 games" on the director's screen.
  assert.equal(lib.isEventPlayCloseResult({ status: "rejected", code: "games_unresolved", unresolvedGames: 2 }), false);
  assert.equal(lib.isEventPlayCloseResult({ status: "event_play_closed", eventId, closeState: "open", scheduledGames: 1, resolvedGames: 1, unresolvedGames: 0 }), false);

  const message = lib.eventControlRejectionMessage(unresolved);
  assert.match(message, /2 of 40/, "the refusal must name the games the director has to go and find");
  assert.match(lib.eventControlRejectionMessage({ status: "rejected", code: "downstream_activity" }), /reopened/);
});

test("the workspace predicate refuses a payload the page would render as blanks", async () => {
  const lib = await import(pathToFileURL(path.join(root, LIB)).href);
  const event = {
    eventId: "44444444-4444-4444-8444-444444444444",
    name: "Main", format: "standard_singles", scoringMethod: "digital",
    playState: "in_progress", started: true, teamEvent: false,
    pauseState: "paused", pausedAt: "2026-09-18T12:00:00Z", pauseAction: "paused",
    pauseReason: "Lunch break", pauseActor: "A Director",
    closeState: "open", closedAt: null, closeAction: null, closeReason: null, closeActor: null,
    canReopen: true, readiness: { scheduledGames: 40, resolvedGames: 38, unresolvedGames: 2 },
  };
  assert.equal(lib.isEventControlWorkspace({ tournamentName: "Fall Open", tournamentStatus: "open", events: [event] }), true);
  assert.equal(lib.isEventControlWorkspace({ tournamentName: "Fall Open", tournamentStatus: "open", events: [] }), true);
  assert.equal(lib.isEventControlWorkspace({ tournamentName: "Fall Open", tournamentStatus: "open", events: [{ ...event, readiness: null }] }), false);
  assert.equal(lib.isEventControlWorkspace({ tournamentName: "Fall Open", tournamentStatus: "open", events: [{ ...event, pauseState: "halted" }] }), false);
  assert.equal(lib.isEventControlWorkspace({ tournamentName: "Fall Open", tournamentStatus: "open", events: [{ ...event, readiness: { scheduledGames: 1.5, resolvedGames: 0, unresolvedGames: 1 } }] }), false);
  assert.equal(lib.isEventControlWorkspace(null), false);
});

test("the control page renders per request and is director only", () => {
  const page = read(PAGE);
  // Without a dynamic render this page is prerendered, ships scripts with no
  // CSP nonce, and its buttons never hydrate.
  assert.match(page, /export const dynamic = "force-dynamic";/);
  assert.match(page, /requireTournamentAccess\(tournamentId\)/);
  assert.match(page, /\["director", "co_director"\]\.includes\(access\.role\)/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /get_event_control_workspace_v1/);
  assert.match(page, /isEventControlWorkspace\(data\)/);
  const client = read(CLIENT);
  assert.match(client, /^"use client";/);
  // A lazy useState initializer runs during the server render too.
  assert.doesNotMatch(client, /useState\(\(\) =>/);
  assert.doesNotMatch(client, /crypto\.randomUUID\(\)[^;]*\n?\s*(const|let) \[/);
  assert.match(client, /router\.refresh\(\)/, "the panel must not keep showing the state it had before the action");
});

test("the hub links the screen, and no page this feature does not own was edited", () => {
  // While this feature was being built the assertion here was the opposite: the
  // hub link was returned as a snippet and the hub was asserted untouched,
  // because two agents editing one hub page in the same hour is how a
  // tournament loses a working screen. The main thread has since added it, and
  // a screen a director cannot reach is the same as a screen that does not
  // exist, so this now asserts the link is present.
  const hub = read("src/app/tournament/[tournamentId]/page.tsx");
  assert.match(hub, /\/event-control`}>Event play control</, "the director needs a way to reach Pause All Play");
  const setup = read("src/app/tournament/[tournamentId]/setup/setup-client.tsx");
  assert.doesNotMatch(setup, /event-control/);
  const schedule = read("src/app/tournament/[tournamentId]/schedule/schedule-client.tsx");
  assert.doesNotMatch(schedule, /event_play_pause|event-control/);
});

// PostgREST resolves an RPC by the SET of argument names, so a call that sends
// a name the function does not declare is a runtime PGRST202 that every route
// here reports as 503. Nothing else in this feature would catch it: it is not a
// type error and not a lint error.
test("every argument name this feature sends is declared by the function it targets", () => {
  const sql = read(MIGRATION);
  const declared = new Map();
  for (const match of sql.matchAll(/create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)/gi)) {
    declared.set(match[1].toLowerCase(), new Set([...match[2].matchAll(/\b(p_[a-z0-9_]+)\b/gi)].map((name) => name[1].toLowerCase())));
  }
  assert.equal(declared.size, 5, `0229 should declare five public functions, found ${[...declared.keys()].join(", ")}`);

  const mismatches = [];
  for (const file of [SUBMISSIONS, PAUSE_ROUTE, CLOSE_ROUTE, PAGE]) {
    const source = read(file);
    for (const call of source.matchAll(/\.rpc\("([a-z0-9_]+)",\s*\{([^}]*)\}/gi)) {
      const params = declared.get(call[1].toLowerCase());
      if (!params) continue;
      const sent = [...call[2].matchAll(/\b(p_[a-z0-9_]+)\s*:/gi)].map((name) => name[1].toLowerCase());
      assert.ok(sent.length > 0, `${file} calls ${call[1]} with no named arguments, which the parser cannot check`);
      for (const name of sent) if (!params.has(name)) mismatches.push(`${file} sends ${name} to ${call[1]}, which declares only ${[...params].sort().join(", ")}`);
      for (const name of params) if (!sent.includes(name)) mismatches.push(`${file} omits ${name} from ${call[1]}`);
    }
  }
  assert.deepEqual(mismatches, [], `an unknown or missing argument name is a live 503:\n${mismatches.join("\n")}`);
});

// tests/tournament-route-reachability.test.mjs fails for any segment under the
// workspace that no other file links to, and this feature is forbidden from
// editing the hub. The snippet handed back in the result is therefore load
// bearing, and this asserts it is the shape that test recognises rather than
// something that merely looks like a link.
test("the hub snippet this feature returns satisfies the reachability contract", () => {
  const snippet = '<Link className="guide-link" href={`/tournament/${tournamentId}/event-control`}>Event play control</Link>';
  const needle = "}/event-control";
  const at = snippet.indexOf(needle);
  assert.ok(at > 0, "the snippet must interpolate the tournament id immediately before the segment");
  assert.ok(snippet.slice(Math.max(0, at - 60), at).includes("/tournament/"), "the href must sit under the tournament workspace");
  assert.equal(snippet[at + needle.length], "`", "the segment must end the template literal, with no trailing path");
  assert.ok(fs.existsSync(path.join(root, PAGE)), "the page the snippet points at must exist");
});

test("every string this feature puts in front of a person obeys the copy standard", () => {
  // Em dash, en dash and a double hyphen used as punctuation are banned
  // outright. An ordinary hyphen inside a compound word is fine.
  for (const file of [LIB, PAGE, CLIENT, PAUSE_ROUTE, CLOSE_ROUTE]) {
    const source = read(file);
    assert.doesNotMatch(source, /—/, `${file} contains an em dash`);
    assert.doesNotMatch(source, /–/, `${file} contains an en dash`);
    assert.doesNotMatch(source, /[^-]--[^-]/, `${file} contains a double hyphen`);
  }
});
