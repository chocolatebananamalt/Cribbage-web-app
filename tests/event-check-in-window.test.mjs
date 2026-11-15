import test from "node:test";
import assert from "node:assert/strict";
import { isDirectorWindowResult } from "../src/lib/api/event-check-in-window.ts";
const id = "10000000-0000-4000-8000-000000000001";
test("only exact action-bound event check-in receipts confirm a window change", () => {
  const closed = { status: "event_check_in_closed", eventId: id, version: 2, unresolvedCount: 0 };
  assert.equal(isDirectorWindowResult(closed, "close", id), true);
  for (const invalid of [null, {}, { status: "closed" }, { ...closed, eventId: "other" }, { ...closed, unresolvedCount: 1 }, { ...closed, version: 0 }, { ...closed, extra: true }]) assert.equal(isDirectorWindowResult(invalid, "close", id), false);
  assert.equal(isDirectorWindowResult(closed, "open", id), false);
  assert.equal(isDirectorWindowResult({ status: "event_check_in_opened", eventId: id, version: 3, reopened: true }, "open", id), true);
});
