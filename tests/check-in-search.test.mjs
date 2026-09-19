import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root = process.cwd();
const search = await import(pathToFileURL(path.join(root, "src/lib/seating/check-in-search.ts")).href);

const entries = [
  { rosterEntryId: "00000000-0000-4000-8000-000000000001", displayName: "Ada Lovelace", state: "checked_in" },
  { rosterEntryId: "00000000-0000-4000-8000-000000000002", displayName: "Grace Hopper", state: "not_checked_in" },
  { rosterEntryId: "00000000-0000-4000-8000-000000000003", displayName: "Katherine Johnson", state: "late" },
];

test("check-in name search returns the complete roster for an empty query", () => {
  assert.equal(search.filterCheckInByName(entries, ""), entries);
  assert.equal(search.filterCheckInByName(entries, "   "), entries);
});

test("check-in name search is case-insensitive and matches partial names", () => {
  assert.deepEqual(search.filterCheckInByName(entries, "  HOP  ").map((entry) => entry.displayName), ["Grace Hopper"]);
  assert.deepEqual(search.filterCheckInByName(entries, "son").map((entry) => entry.displayName), ["Katherine Johnson"]);
});

test("check-in name search returns no entries when no player matches", () => {
  assert.deepEqual(search.filterCheckInByName(entries, "nobody"), []);
});

test("the Publish initial seating gate says on screen why it is unavailable", () => {
  const client = readFileSync("src/app/tournament/[tournamentId]/seating/seating-client.tsx", "utf8");
  // The plan auto-fills seats in roster order, so a plan with fewer seats than
  // players silently hands the overflow a seat that is already taken and the
  // publish button greys out. The director sees filled dropdowns and a dead
  // button. Every branch that disables the button has to name itself.
  assert.match(client, /Nobody is checked in yet, so there is no one to seat/);
  assert.match(client, /the plan holds \$\{seatCapacity\} seats and \$\{present\.length\} players are checked in/);
  assert.match(client, /share a Table\/Seat/);
  assert.match(client, /Tick the confirmation below to enable publishing/);
  const reason = client.indexOf("publishBlockedReason ?");
  const button = client.indexOf("Publish permanent initial seating");
  assert.ok(reason > -1 && reason < button, "the reason must render above the button it explains");
});
