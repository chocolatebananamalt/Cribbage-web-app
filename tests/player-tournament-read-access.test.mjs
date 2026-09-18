// A player who is checked in to an event has no row in app.tournament_roles.
// Only officials get one; a competitor becomes one solely if somebody adds them
// by hand. Seven read RPCs nevertheless gated on that table while listing
// 'player' among the roles they accept, so for an ordinary competitor each of
// them returned null or an empty array.
//
// Measured on the pilot database before migration 0219, for a profile that was
// checked in and held no role row:
//
//   get_tournament_roles_v1            -> []      (after: ["player"])
//   get_preliminary_event_standings    -> null    (after: renders)
//   get_tournament_result_events_v1    -> null    (after: renders)
//   get_satellite_results_workspace_v1 -> null    (after: renders)
//   get_event_side_pool_workspace_base_v1 -> null (after: renders)
//
// A profile with no role row and no participant row still gets [] and null
// after the migration, so nothing widened.
//
// public.get_tournament_role already had the right rule: union a derived
// 'player' onto the real rows when the caller is a checked-in participant. 0219
// lifts that into app.tournament_roles_effective and points the gates at it.
//
// These tests pin the gates against a later migration quietly reintroducing a
// body that reads the bare table -- which is how the defect would come back,
// since each of these functions is defined by copying its previous body.
//
// Verified fail-closed: pointing any of the seven back at app.tournament_roles
// turns this file red and names the function.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { resolveRoles } from "../src/lib/auth/tournament-roles.ts";
import { isSanctioningFeeRateOverrideResult } from "../src/lib/api/sanctioning-fee.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "database", "migrations");

// The read gates that accept a player. Each must resolve the caller's roles
// through the view, never the bare table.
const PLAYER_READ_GATES = [
  "get_tournament_roles_v1",
  "get_tournament_result_events_v1",
  "get_preliminary_event_standings",
  "get_satellite_results_workspace_v1",
  "get_standard_singles_qualification_result_v1",
  "get_finalized_standard_singles_event_report_v1",
  "get_event_side_pool_workspace_base_v1",
];

const migrationFiles = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();

// Strips -- line comments so prose mentioning a table name is not mistaken for
// a reference to it. This file's own explanatory comments would otherwise trip
// the assertions below.
function codeOnly(sql) {
  return sql
    .split("\n")
    .map((line) => {
      const at = line.indexOf("--");
      return at === -1 ? line : line.slice(0, at);
    })
    .join("\n");
}

// Returns the body of the last definition of `name` across all migrations, in
// migration order, which is the definition a rebuilt database ends up with.
function latestDefinitionOf(name) {
  const header = new RegExp(
    "create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?" + name + "\\s*\\(",
    "gi",
  );
  let latest = null;
  for (const file of migrationFiles) {
    const sql = codeOnly(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
    header.lastIndex = 0;
    let match;
    while ((match = header.exec(sql)) !== null) {
      const tagMatch = /\bas\s*(\$[A-Za-z0-9_]*\$)/i.exec(sql.slice(match.index));
      if (!tagMatch) continue;
      const tag = tagMatch[1];
      const start = match.index + tagMatch.index + tagMatch[0].length;
      const end = sql.indexOf(tag, start);
      if (end === -1) continue;
      latest = { file, body: sql.slice(start, end) };
    }
  }
  return latest;
}

test("the view that defines who counts as a player exists and derives it from check-in", () => {
  const sql = codeOnly(fs.readFileSync(
    path.join(migrationsDir, "0219_players_can_read_their_own_tournament_results.sql"),
    "utf8",
  ));

  assert.match(
    sql,
    /create\s+or\s+replace\s+view\s+app\.tournament_roles_effective/i,
    "0219 must define app.tournament_roles_effective",
  );
  assert.match(
    sql,
    /app\.event_participants/,
    "the view must derive players from event_participants",
  );
  assert.match(
    sql,
    /status\s*=\s*'checked_in'/,
    "only a checked-in participant counts as a player, matching public.get_tournament_role",
  );
  assert.match(
    sql,
    /profile_id\s+is\s+not\s+null/,
    "a participant with no linked profile must not produce a role row",
  );
  // 'union all' would double-count anyone holding both a real 'player' row and a
  // check-in, which get_tournament_roles_v1 would then return twice.
  assert.ok(
    /\bunion\b(?!\s+all)/i.test(sql),
    "the view must use union, not union all, so roles are not duplicated",
  );
});

for (const name of PLAYER_READ_GATES) {
  test(`${name} gates on the view, not the bare roles table`, () => {
    const latest = latestDefinitionOf(name);
    assert.ok(latest, `no migration defines ${name}`);

    const bare = latest.body.match(/app\.tournament_roles(?!_effective)/g) || [];
    assert.equal(
      bare.length,
      0,
      `${name} (last defined in ${latest.file}) still reads app.tournament_roles directly, ` +
        "so a checked-in player with no role row is locked out of it. Use " +
        "app.tournament_roles_effective.",
    );
    assert.match(
      latest.body,
      /app\.tournament_roles_effective/,
      `${name} must resolve roles through app.tournament_roles_effective`,
    );
  });
}

test("a voided payment does not satisfy the QR check-in money gate", () => {
  const latest = latestDefinitionOf("event_qr_player_is_paid_and_enrolled")
    ?? (() => {
      // The function lives in the app schema, so the public-qualified matcher
      // above misses it; fall back to an app-qualified scan.
      const header = /create\s+(?:or\s+replace\s+)?function\s+app\.event_qr_player_is_paid_and_enrolled\s*\(/gi;
      let found = null;
      for (const file of migrationFiles) {
        const sql = codeOnly(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
        header.lastIndex = 0;
        let match;
        while ((match = header.exec(sql)) !== null) {
          const tagMatch = /\bas\s*(\$[A-Za-z0-9_]*\$)/i.exec(sql.slice(match.index));
          if (!tagMatch) continue;
          const tag = tagMatch[1];
          const start = match.index + tagMatch.index + tagMatch[0].length;
          const end = sql.indexOf(tag, start);
          if (end === -1) continue;
          found = { file, body: sql.slice(start, end) };
        }
      }
      return found;
    })();

  assert.ok(latest, "no migration defines app.event_qr_player_is_paid_and_enrolled");
  // A void carries the full amount of the payment it reverses, so comparing the
  // newest row's amount to the amount owed without checking its type let a
  // voided payment read as settled.
  assert.match(
    latest.body,
    /event_type/,
    "the money gate must check the payment event type, or a void reads as paid",
  );
  assert.match(
    latest.body,
    /'received'/,
    "only a 'received' row settles an obligation",
  );
  // Checking the type must not also require a payment row to exist. A comped or
  // zero-fee entrant has an obligation of 0 and no payment at all, and the desk
  // gates on this same function, so demanding a 'received' row locks them out of
  // both the QR and the desk. Treat a missing or voided row as zero received and
  // compare, rather than failing outright.
  assert.match(
    latest.body,
    /case\s+when[\s\S]*?'received'[\s\S]*?else\s+0\s+end/i,
    "a non-received row must count as zero received, so a zero-fee entrant still settles",
  );
  assert.doesNotMatch(
    latest.body,
    /coalesce\(received\.event_type,''\)\s*=\s*'received'\s+and/i,
    "the strict form refuses a zero-fee entrant who has no payment row",
  );
});

test("an empty roles array is treated as missing, not as no access", () => {
  // The exact shape returned for a checked-in player before 0219.
  assert.deepEqual(resolveRoles([], "player"), ["player"]);
  assert.deepEqual(resolveRoles(null, "director"), ["director"]);
  assert.deepEqual(resolveRoles(undefined, "viewer"), ["viewer"]);
  // A real answer is preserved.
  assert.deepEqual(resolveRoles(["director", "player"], "director"), ["director", "player"]);
  // An unrecognised role is not trusted.
  assert.deepEqual(resolveRoles(["sysadmin"], "player"), ["player"]);
});

test("the sanctioning fee override guard accepts the shape the RPC actually returns", () => {
  const request = {
    eventKind: "main",
    rateCents: 250,
    reason: "state association rate",
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
  };

  // override_tournament_sanctioning_fee_rate_v1 returns a version, not a receipt.
  assert.equal(
    isSanctioningFeeRateOverrideResult(
      { status: "sanctioning_fee_rate_overridden", eventKind: "main", rateCents: 250, version: 1 },
      request,
    ),
    true,
  );

  // The shape this guard used to demand, which the RPC has never returned.
  assert.equal(
    isSanctioningFeeRateOverrideResult(
      {
        status: "sanctioning_fee_rate_overridden",
        eventKind: "main",
        rateCents: 250,
        receipt: "00000000-0000-4000-8000-000000000002",
      },
      request,
    ),
    false,
  );

  // A version is a sequence number and starts at 1.
  assert.equal(
    isSanctioningFeeRateOverrideResult(
      { status: "sanctioning_fee_rate_overridden", eventKind: "main", rateCents: 250, version: 0 },
      request,
    ),
    false,
  );
  assert.equal(
    isSanctioningFeeRateOverrideResult(
      { status: "sanctioning_fee_rate_overridden", eventKind: "main", rateCents: 250, version: 1.5 },
      request,
    ),
    false,
  );
  // Mismatched echo of the request is still rejected.
  assert.equal(
    isSanctioningFeeRateOverrideResult(
      { status: "sanctioning_fee_rate_overridden", eventKind: "consolation", rateCents: 250, version: 1 },
      request,
    ),
    false,
  );
});
