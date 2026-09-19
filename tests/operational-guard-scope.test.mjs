import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const migrations = readdirSync("database/migrations").filter((name) => name.endsWith(".sql")).sort();
const sql = (name) => readFileSync(`database/migrations/${name}`, "utf8");
const stripComments = (text) => text.split(/\r?\n/).filter((line) => !line.trimStart().startsWith("--")).join("\n");
const latestDefining = (pattern) => migrations.map(sql).map(stripComments).filter((text) => pattern.test(text)).at(-1);

// "Add New Tournament Events" created the events, then returned 503 and wedged the
// director. append_tournament_setup_events_v1 activates each amended event against the
// NEW revision, and configure_tournament_setup_side_pools_v1 refused any revision that
// had activations, so the guard fired on every amendment by construction.
test("an amended setup revision may still bind its side pools", () => {
  const latest = latestDefining(/function public\.configure_tournament_setup_side_pools_v1\(/);
  assert.ok(latest, "no migration defines configure_tournament_setup_side_pools_v1");
  const guard = /if exists\(select 1 from app\.tournament_setup_activations[\s\S]*?setup_lifecycle_closed/.exec(latest);
  assert.ok(guard, "the lifecycle guard must still exist for finalized revisions");
  assert.match(
    guard[0],
    /not exists\(select 1 from app\.tournament_setup_amendments/,
    "a revision recorded in tournament_setup_amendments is an amendment, not a finalized setup, and must not be treated as lifecycle-closed",
  );
});

// The buttons rendered and the RPC refused across the whole window they exist for:
// registration closed, play not yet started.
test("an event may be cancelled after registration closes and before play starts", () => {
  const latest = latestDefining(/change_event_lifecycle_v1/);
  assert.ok(latest, "no migration touches change_event_lifecycle_v1");
  assert.match(
    latest,
    /registration_status not in \(''open'', ''closed''\)/,
    "cancelling an under-subscribed event happens after registration closes; event_already_started is what keeps it safe",
  );
});

// Four of six predicates scoped to the roster entry. The two start predicates asked only
// whether ANY event in the tournament had started, so the first start froze the whole roster.
test("withdrawing one player is scoped to that player's own events", () => {
  const latest = latestDefining(/set_roster_entry_active_status_v1/);
  assert.ok(latest, "no migration touches set_roster_entry_active_status_v1");
  const guard = /v_new_guard :=([\s\S]*?);\n/.exec(latest);
  assert.ok(guard, "the replacement guard must be present");
  assert.ok(
    !/from app\.event_play_starts where tournament_id=p_tournament_id\)/.test(guard[1]),
    "an unscoped start predicate freezes every player once any event starts",
  );
  for (const scoped of ["ep.roster_entry_id=p_roster_entry_id", "m.roster_entry_id=p_roster_entry_id"]) {
    assert.ok(guard[1].includes(scoped), `the start predicates must scope to the roster entry (${scoped})`);
  }
  assert.ok(
    guard[1].includes("from app.event_team_members where tournament_id=p_tournament_id and roster_entry_id=p_roster_entry_id"),
    "team membership must block withdrawal the way an event_participants row already does",
  );
});

// The UI forced the director to tick "I reviewed the possible match and confirmed this is
// a different person", then dropped that confirmation for a roster-only collision, because
// it keyed the sent value off collisionClaimIds (claim vs claim) instead of the flag the
// button itself is gated on.
test("the director's distinct-person confirmation is the value that gets recorded", () => {
  const client = readFileSync("src/app/tournament/[tournamentId]/roster/registration-claim-review-client.tsx", "utf8");
  const envelope = /duplicateResolution: [^\n]*?confirmed_distinct_person[^\n]*?: null/.exec(client);
  assert.ok(envelope, "the review envelope must set duplicateResolution");
  assert.match(
    envelope[0],
    /claim\.requiresDistinctConfirmation/,
    "the recorded resolution must use the same flag that gates the button, or the confirmation is silently dropped",
  );
  assert.ok(
    !/claim\.collisionClaimIds\.length \? "confirmed_distinct_person"/.test(client),
    "collisionClaimIds covers claim-vs-claim only and misses a collision with an existing roster entry",
  );
});
