import assert from "node:assert/strict";
import test from "node:test";
import { creationDateInputValue, combineLocalDateTime } from "../src/lib/setup-dates.ts";
test("creation date seeds support persisted display dates without inventing time or end date", () => {
  assert.equal(creationDateInputValue("02-03-2027"), "2027-02-03");
  assert.equal(creationDateInputValue("2027-02-03"), "2027-02-03");
  assert.equal(creationDateInputValue(""), "");
  assert.equal(creationDateInputValue("unknown"), "");
});
test("split datetime preserves explicit time and permits clearing either control", () => {
  assert.equal(combineLocalDateTime("2027-02-03", ""), "2027-02-03");
  assert.equal(combineLocalDateTime("2027-02-03", "09:30"), "2027-02-03T09:30");
  assert.equal(combineLocalDateTime("", "09:30"), "");
});
