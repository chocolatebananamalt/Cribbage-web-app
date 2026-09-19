// Desk check-in and account activation are two audited database operations
// that both write an idempotency receipt keyed on
// (actor_profile_id, client_operation_id). Composing them into one director
// action therefore has exactly two ways to go quietly wrong: one operation id
// reused across both steps, which turns step two into an idempotency_conflict,
// and step two's thrown transport failure escaping to the route boundary,
// which reports 503 for an action that already checked the player in. Both are
// pinned below.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const load = (file) => import(pathToFileURL(path.join(root, file)).href);

const guards = await load("src/lib/api/check-in-and-send-app-access.ts");
const composition = await load("src/lib/check-in-and-send-app-access.ts");

const routeFile = "src/app/api/v1/tournaments/[id]/event-check-in-app-access/route.ts";
const clientFile = "src/app/tournament/[tournamentId]/event-check-in/event-check-in-client.tsx";
const pageFile = "src/app/tournament/[tournamentId]/event-check-in/page.tsx";
const writtenFiles = [
  "src/lib/api/check-in-and-send-app-access.ts",
  "src/lib/check-in-and-send-app-access.ts",
  routeFile,
  pageFile,
  clientFile,
  "tests/check-in-and-send-app-access.test.mjs",
];
const shippedFiles = writtenFiles.filter((file) => !file.startsWith("tests/"));

const actorId = "00000000-0000-4000-8000-000000000001";
const tournamentId = "00000000-0000-4000-8000-000000000002";
const eventId = "00000000-0000-4000-8000-000000000003";
const rosterEntryId = "00000000-0000-4000-8000-000000000004";
const checkInOperationId = "00000000-0000-4000-8000-000000000005";
const activationOperationId = "00000000-0000-4000-8000-000000000006";
const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

const input = { actorId, tournamentId, eventId, rosterEntryId, expiresAt, checkInOperationId, activationOperationId };

function recorder(handlers) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ name, args });
      const handler = handlers[name];
      if (!handler) throw new Error(`unexpected rpc ${name}`);
      return handler(args);
    },
  };
}

const deskCheckedIn = () => ({ data: { status: "checked_in", eventId, rosterEntryId, source: "desk" }, error: null });
const activationIssued = (args) => ({
  data: {
    status: "issued",
    activationId: args.p_activation_id,
    rosterEntryId,
    tournamentId,
    expiresAt: expiresAt.toISOString(),
  },
  error: null,
});

test("a valid request carries one operation id per step and a server enforced link lifetime", () => {
  const body = { eventId, rosterEntryId, expiresAt: expiresAt.toISOString(), checkInOperationId, activationOperationId };
  assert.equal(guards.isCheckInAndSendAppAccessRequest(body), true);
  // One id shared by both steps is the collision this route exists to avoid.
  assert.equal(guards.isCheckInAndSendAppAccessRequest({ ...body, activationOperationId: checkInOperationId }), false);
  assert.equal(guards.isCheckInAndSendAppAccessRequest({ ...body, extra: 1 }), false);
  assert.equal(guards.isCheckInAndSendAppAccessRequest({ ...body, eventId: "not-a-uuid" }), false);
  // The issue RPC raises outside five to sixty minutes rather than rejecting.
  assert.equal(guards.isCheckInAndSendAppAccessRequest({ ...body, expiresAt: new Date(Date.now() + 60_000).toISOString() }), false);
  assert.equal(guards.isCheckInAndSendAppAccessRequest({ ...body, expiresAt: new Date(Date.now() + 61 * 60 * 1000).toISOString() }), false);
  assert.equal(guards.isCheckInAndSendAppAccessRequest({ ...body, expiresAt: "2030-01-01 12:00:00" }), false);
});

test("both steps succeed and each database call gets its own operation id", async () => {
  const client = recorder({ desk_check_in_event_v1: deskCheckedIn, issue_roster_account_activation_v1: activationIssued });
  const outcome = await composition.checkInAndSendAppAccess(client, input);
  assert.equal(outcome.outcome, "reported");
  assert.deepEqual(outcome.result.checkIn, { status: "checked_in" });
  assert.equal(outcome.result.appAccess.status, "issued");
  assert.equal(guards.isCheckInAndSendAppAccessResult(outcome.result), true);

  assert.deepEqual(client.calls.map((call) => call.name), ["desk_check_in_event_v1", "issue_roster_account_activation_v1"]);
  assert.equal(client.calls[0].args.p_idempotency_key, checkInOperationId);
  assert.equal(client.calls[1].args.p_operation_id, activationOperationId);
  assert.notEqual(client.calls[0].args.p_idempotency_key, client.calls[1].args.p_operation_id);
  // The bearer secret is created in the app and never travels to the database.
  const transmitted = JSON.stringify(client.calls);
  assert.equal(transmitted.includes(outcome.result.appAccess.credential), false);
  assert.match(outcome.result.appAccess.credential, /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
});

test("a rejected check-in leaves the link unattempted rather than attempted and failed", async () => {
  const client = recorder({
    desk_check_in_event_v1: async () => ({ data: { status: "rejected", code: "window_not_open" }, error: null }),
    issue_roster_account_activation_v1: async () => assert.fail("the link must not be issued when check-in did not happen"),
  });
  const outcome = await composition.checkInAndSendAppAccess(client, input);
  assert.deepEqual(outcome, { outcome: "reported", result: { checkIn: { status: "rejected", code: "window_not_open" }, appAccess: { status: "not_attempted" } } });
  assert.deepEqual(client.calls.map((call) => call.name), ["desk_check_in_event_v1"]);
});

test("a link failure after a successful check-in still reports the check-in", async () => {
  const thrown = recorder({
    desk_check_in_event_v1: deskCheckedIn,
    issue_roster_account_activation_v1: async () => ({ data: null, error: { message: "connection reset" } }),
  });
  const outcome = await composition.checkInAndSendAppAccess(thrown, input);
  assert.deepEqual(outcome.result, { checkIn: { status: "checked_in" }, appAccess: { status: "unavailable" } });

  const rejected = recorder({
    desk_check_in_event_v1: deskCheckedIn,
    issue_roster_account_activation_v1: async () => ({ data: { status: "rejected", code: "activation_unavailable" }, error: null }),
  });
  assert.deepEqual((await composition.checkInAndSendAppAccess(rejected, input)).result, {
    checkIn: { status: "checked_in" },
    appAccess: { status: "rejected", code: "activation_unavailable" },
  });

  // A replayed operation id proves a prior link exists whose secret cannot be
  // rebuilt, so there is nothing to hand the player.
  const replayed = recorder({
    desk_check_in_event_v1: deskCheckedIn,
    issue_roster_account_activation_v1: async () => ({ data: { status: "issued", activationId: rosterEntryId, rosterEntryId, tournamentId, expiresAt: expiresAt.toISOString() }, error: null }),
  });
  assert.deepEqual((await composition.checkInAndSendAppAccess(replayed, input)).result, {
    checkIn: { status: "checked_in" },
    appAccess: { status: "credential_unavailable" },
  });
});

test("every partial outcome tells the director the player IS checked in", () => {
  // Every state in this list is reached only AFTER check-in succeeded, so the
  // first clause has to be the fact the director acts on: the player at the
  // desk is checked in and only the link needs retrying.
  for (const step of [{ status: "unavailable" }, { status: "credential_unavailable" }, { status: "rejected", code: "activation_unavailable" }, { status: "rejected", code: "idempotency_conflict" }, { status: "rejected", code: "anything_else" }]) {
    assert.match(guards.appAccessFailureMessage(step), /^(The player is checked in)\./, `"${guards.appAccessFailureMessage(step)}" buries the check-in`);
  }
  // not_attempted is the one state that is NOT a partial success: composition
  // only produces it when check-in itself was rejected. It used to open with
  // "The player is checked in", which is the exact opposite of what happened,
  // and this test required it to.
  const notAttempted = guards.appAccessFailureMessage({ status: "not_attempted" });
  assert.match(notAttempted, /^The player was not checked in/, "not_attempted must not claim a check-in that did not happen");
  assert.doesNotMatch(notAttempted, /The player is checked in/);
  assert.match(guards.checkInRejectionMessage("window_not_open"), /Event check-in is not open/);
  assert.match(guards.checkInRejectionMessage("already_checked_in_to_another_event"), /already checked into another event that has not finished/);
  assert.match(guards.checkInRejectionMessage("something_new"), /was not checked in/);
});

test("an already checked-in player is a confirmed step one, not a failure", async () => {
  const client = recorder({
    desk_check_in_event_v1: async () => ({ data: { status: "already_checked_in", eventId, rosterEntryId }, error: null }),
    issue_roster_account_activation_v1: activationIssued,
  });
  const outcome = await composition.checkInAndSendAppAccess(client, input);
  assert.deepEqual(outcome.result.checkIn, { status: "already_checked_in" });
  assert.equal(outcome.result.appAccess.status, "issued");
});

test("an unreadable check-in result is never reported as a check-in", async () => {
  for (const response of [{ data: null, error: { message: "down" } }, { data: null, error: null }, { data: { status: "surprise" }, error: null }]) {
    const client = recorder({
      desk_check_in_event_v1: async () => response,
      issue_roster_account_activation_v1: async () => assert.fail("nothing follows an unreadable check-in"),
    });
    assert.deepEqual(await composition.checkInAndSendAppAccess(client, input), { outcome: "unavailable" });
  }
});

test("the result guard refuses a body that claims a status it cannot support", () => {
  const issued = { status: "issued", credential: `2f1c5f7a-1b2c-4d3e-8f90-0a1b2c3d4e5f.${"a".repeat(43)}`, expiresAt: expiresAt.toISOString() };
  assert.equal(guards.isCheckInAndSendAppAccessResult({ checkIn: { status: "checked_in" }, appAccess: issued }), true);
  assert.equal(guards.isCheckInAndSendAppAccessResult({ checkIn: { status: "checked_in" }, appAccess: { status: "issued", credential: "not-a-credential", expiresAt: expiresAt.toISOString() } }), false);
  assert.equal(guards.isCheckInAndSendAppAccessResult({ checkIn: { status: "rejected" }, appAccess: { status: "not_attempted" } }), false);
  assert.equal(guards.isCheckInAndSendAppAccessResult({ checkIn: { status: "checked_in" } }), false);
  assert.equal(guards.isCheckInAndSendAppAccessResult(null), false);
});

test("the route authorizes like its siblings and reports the check-in step in its status code", () => {
  const route = read(routeFile);
  assert.match(route, /requireVerifiedSubject/);
  // requireTournamentAccess throws redirect/notFound, which the API failure
  // boundary would report as 503 instead of 401 or 404.
  assert.doesNotMatch(route, /requireTournamentAccess/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /readSmallJson/);
  assert.match(route, /withApiFailureBoundary/);
  assert.match(route, /createServerOnlyAdminClient/);
  assert.match(route, /accountActivationEnabled/);
  const unauthorized = route.indexOf('"unauthorized"');
  const composed = route.indexOf("checkInAndSendAppAccess(");
  assert.ok(unauthorized > 0 && composed > unauthorized, "the composed action runs only after the identity check");
  assert.match(route, /outcome === "unavailable"\) return apiJson\(\{ error: "operation_unavailable" \}, \{ status: 503 \}\)/);
  assert.match(route, /checkIn\.status === "rejected"\) return apiJson\(outcome\.result, \{ status: 409 \}\)/);
});

test("no part of this feature sends email", () => {
  // Scanned over the shipped files only. Including this file would match the
  // words in the pattern below and make the check pass or fail on itself.
  const transport = new RegExp(["\\bresend\\b", "nodemailer", "sendMail", "sendEmail", "smtp"].join("|"), "i");
  for (const file of shippedFiles) {
    assert.doesNotMatch(read(file), transport, `${file} reaches for an email transport`);
  }
  // Delivery is fail-closed by owner decision, so the screen has to say what
  // it actually does instead of implying a message went out.
  const client = read(clientFile);
  assert.match(client, /No email is sent\./);
  assert.match(client, /Nothing is emailed\./);
  assert.doesNotMatch(client, /email delivery configuration has passed its live test/);
});

test("the desk control is offered only to a player with no account and no live link", () => {
  const client = read(clientFile);
  assert.match(client, /appAccessOffers/);
  assert.match(client, /entry\.activationState === null \|\| entry\.activationState === 'expired'/);
  assert.match(client, /Check in and send app access/);
  assert.match(client, /Send app access/);
  assert.match(client, /disabled=\{busy \|\| !row\.paid \|\| event\?\.windowState !== 'open'\}/);
  // Two ids in the request body, mirroring the two receipts the server writes.
  assert.match(client, /checkInOperationId: crypto\.randomUUID\(\), activationOperationId: crypto\.randomUUID\(\)/);
  // The credential must not live in the message state that the next click clears.
  assert.match(client, /setAppAccessLink\(\{ displayName, url: `\$\{window\.location\.origin\}\/activate#\$\{data\.appAccess\.credential\}`/);
  // Only a transport failure leaves the check-in state genuinely unknown. A
  // refused request wrote nothing, and telling the desk to go and look costs
  // time it does not have.
  assert.match(client, /response\.status === 503/);
  assert.match(client, /The request was refused and nothing was recorded\./);
});

test("the witnessed approval protocol is restated rather than weakened", () => {
  const client = read(clientFile);
  assert.match(client, /a different signed-in director confirms their request in person/);
  assert.match(client, /No account is linked yet\./);
  assert.match(client, /account-activations/);
  // Nothing here may approve, decide, or link on the director's behalf.
  assert.doesNotMatch(client, /decide_roster_account_activation_v1|confirmationPhrase/);
  assert.doesNotMatch(read(routeFile), /decide_roster_account_activation_v1|confirmationPhrase/);
});

test("the account read is a soft secondary read that cannot take the check-in desk offline", () => {
  const page = read(pageFile);
  assert.match(page, /getRosterAccountActivationWorkspace/);
  assert.match(page, /try \{/);
  assert.match(page, /catch \{\s*return null;/);
  // notFound() belongs to the primary workspace read only.
  const secondary = page.slice(page.indexOf("async function readAppAccess"));
  assert.doesNotMatch(secondary, /notFound\(\)/);
  assert.match(page, /appAccess=\{appAccess\}/);
});

test("the check-in desk keeps the behaviour and copy the existing suites pin", () => {
  // This feature edits two files that other suites assert against, and rule 3
  // forbids running those suites here, so their expectations are repeated.
  const client = read(clientFile);
  const page = read(pageFile);
  assert.match(client, /Close becomes available after every enrolled player is checked in or marked as a no-show/);
  assert.match(client, /already checked into another event that has not finished/);
  assert.match(client, /row\.events\?\.find/);
  assert.match(client, /row\.checkedInEventIds\?\.includes/);
  assert.match(client, /className="event-check-in-selector"/);
  assert.match(client, /<span>Event<\/span><select/);
  assert.match(page, /Open each event independently/);
  assert.match(page, /Multiple event windows may be open/);
  assert.doesNotMatch(page, /Open one event at a time/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
});

test("every file written for this feature meets the copy standard", () => {
  // Built from code points so this file does not have to contain the very
  // characters it forbids, which would make the check assert against itself.
  const forbidden = [
    { label: "an em dash", pattern: new RegExp(String.fromCharCode(0x2014)) },
    { label: "an en dash", pattern: new RegExp(String.fromCharCode(0x2013)) },
    { label: "a double hyphen", pattern: new RegExp(String.fromCharCode(45, 45)) },
  ];
  for (const file of writtenFiles) {
    const source = read(file);
    for (const { label, pattern } of forbidden) assert.doesNotMatch(source, pattern, `${file} contains ${label}`);
  }
});

test("no bound repetition in this feature can exceed the PostgreSQL regex limit", () => {
  // tests/sql-regex-repetition-limit.test.mjs enforces this for SQL. The
  // credential pattern here is the one bounded repetition the feature adds.
  const source = read("src/lib/api/check-in-and-send-app-access.ts");
  for (const [, bound] of source.matchAll(/\{\d*,?(\d+)\}/g)) {
    assert.ok(Number(bound) <= 255, `a bound repetition of ${bound} exceeds the engine limit`);
  }
});
