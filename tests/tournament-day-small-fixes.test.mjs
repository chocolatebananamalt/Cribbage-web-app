import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { mrpBlockerMessage, publishedMrpGameCounts } from "../src/lib/results/mrp-blocker-message.ts";
import { parseRosterCsv } from "../src/lib/roster/csv.ts";
import { calculateStandardSinglesMrpReference } from "../src/lib/results/standard-singles-mrp-reference.ts";

const WORKSPACE = "src/app/tournament/[tournamentId]";

// The ACC published schedule is the source of truth for which game counts can
// be rated. The rehearsal ran a 9-game Main, which has no published row, and the
// screen printed the bare enum "unsupported game count". A director cannot tell
// a broken feature from a correct refusal by reading that.
test("the game counts named in the message are the ones the calculator accepts", () => {
  for (const [eventType, counts] of Object.entries(publishedMrpGameCounts)) {
    for (const gameCount of counts) {
      const result = calculateStandardSinglesMrpReference({
        eventType, gameCount, qualifierCount: 2, qualificationRank: 2, gamePoints: 0, playoffExitRound: null,
      });
      assert.notEqual(result.status === "blocked" ? result.code : null, "unsupported_game_count",
        `${eventType} at ${gameCount} games is named in the message, so it must be a published count`);
    }
  }
});

test("a game count outside the published schedule is refused by the calculator", () => {
  for (const [eventType, gameCount] of [["main", 9], ["main", 13], ["consolation", 11]]) {
    const result = calculateStandardSinglesMrpReference({
      eventType, gameCount, qualifierCount: 2, qualificationRank: 1, gamePoints: 12, playoffExitRound: null,
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.code, "unsupported_game_count", `${eventType} at ${gameCount} games has no published row`);
  }
});

test("the blocked message explains the refusal instead of printing the code", () => {
  const message = mrpBlockerMessage("unsupported_game_count", 9);
  assert.match(message, /12, 14, 16, 18, 20, 21 or 22/, "the supported Main counts must be named");
  assert.match(message, /7, 8, 9, 10 or 12/, "the supported Consolation counts must be named");
  assert.match(message, /configured for 9 games/);
  assert.match(message, /by hand/, "the director needs to be told what to do instead");
  assert.ok(!message.includes("unsupported game count"), "the raw code must not be the message");
});

test("every blocker the server can return has its own sentence", () => {
  const sql = readFileSync("database/migrations/0190_automatic_standard_singles_mrp_results.sql", "utf8");
  const codes = [...sql.matchAll(/'code','([a-z_]+)'/g)].map((match) => match[1]);
  assert.ok(codes.length >= 6, "the migration must still be the source of the code list");
  for (const code of codes) {
    if (code === "idempotency_conflict") continue; // not an MRP blocker; a retry collision
    const message = mrpBlockerMessage(code);
    assert.ok(!message.includes(code.replaceAll("_", " ")), `${code} still falls through to the raw enum`);
  }
});

// A blank template the director can fill in, rather than a paragraph describing
// the columns. The header must be one parseRosterCsv actually accepts.
test("the roster CSV template header is accepted by the roster parser", () => {
  const client = readFileSync(`${WORKSPACE}/roster/roster-client.tsx`, "utf8");
  const header = /new Blob\(\["([^"]+)\\n"\], \{ type: "text\/csv;charset=utf-8" \}\)/.exec(client);
  assert.ok(header, "the roster screen must build a template blob");
  const rows = parseRosterCsv(`${header[1]}\nAda,Lovelace,ada@example.com,HI296,Paper\n`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].firstName, "Ada");
  assert.equal(rows[0].lastName, "Lovelace");
  assert.equal(rows[0].accNumber, "HI296");
});

// Both pages were dead ends. correction-policy had no outbound link at all.
test("the correction screens link back out", () => {
  for (const page of ["corrections", "correction-policy"]) {
    const source = readFileSync(`${WORKSPACE}/${page}/page.tsx`, "utf8");
    assert.match(source, /Back to Tournament<\/Link>/, `${page} must offer a way back to the workspace`);
    assert.match(source, /import Link from "next\/link"/, `${page} must import Link`);
  }
});

// The gate was read once on mount. A score submitted, or a retry queued, after
// that read still showed "safe", and clearing then deleted unsent work.
test("clearing shared-device data re-reads the gate at the moment it clears", () => {
  const component = readFileSync("src/components/shared-device-sign-out.tsx", "utf8");
  const clear = /async function clearSafeAppData\(\)[\s\S]*?\n  \}/.exec(component);
  assert.ok(clear, "clearSafeAppData must still exist");
  const check = clear[0].indexOf("await readLocalState()");
  const wipe = clear[0].indexOf("clearOfflineScoreStorage()");
  assert.ok(check !== -1, "the gate must be re-read inside the clear");
  assert.ok(check < wipe, "the re-read must happen before anything is deleted");
  assert.match(component, /visibilitychange/, "returning to the tab must refresh the gate");
});
