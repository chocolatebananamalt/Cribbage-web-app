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
