import assert from "node:assert/strict";
import test from "node:test";
import { creationDateInputValue, combineLocalDateTime, tournamentDayCount, tournamentEndForDays } from "../src/lib/setup-dates.ts";
test("creation date seeds support persisted display dates without inventing time or end date", () => {
  assert.equal(creationDateInputValue("02-03-2027"), "2027-02-03");
  assert.equal(creationDateInputValue("2027-02-03"), "2027-02-03");
  assert.equal(creationDateInputValue(""), "");
  assert.equal(creationDateInputValue("unknown"), "");
});

test("inclusive tournament days cross calendar boundaries without elapsed-hour DST arithmetic", () => {
  for (const [start, days, end] of [
    ["2026-11-02", "1", "2026-11-02"], ["2026-11-02", "5", "2026-11-06"],
    ["2028-02-28", "3", "2028-03-01"], ["2027-02-28", "2", "2027-03-01"],
    ["2026-12-31", "2", "2027-01-01"], ["2026-03-07", "3", "2026-03-09"],
    ["2026-10-31", "3", "2026-11-02"],
  ]) {
    assert.equal(tournamentEndForDays(start, days), `${end}T23:59`);
    assert.equal(tournamentDayCount(`${start}T08:08`, `${end}T18:00`), Number(days));
  }
});

test("invalid dates, fractional/empty/negative durations and overflow fail closed", () => {
  for (const days of ["", "0", "-1", "1.5", "Infinity", "1e2", "9007199254740992"]) assert.equal(tournamentEndForDays("2026-11-02", days), null);
  assert.equal(tournamentEndForDays("2027-02-29", "1"), null);
  assert.equal(tournamentEndForDays("9999-12-31", "2"), null);
  assert.equal(tournamentDayCount("2026-11-02", "2026-11-01"), null);
  assert.equal(tournamentDayCount("", "2026-11-01"), null);
});
test("split datetime preserves explicit time and permits clearing either control", () => {
  assert.equal(combineLocalDateTime("2027-02-03", ""), "2027-02-03");
  assert.equal(combineLocalDateTime("2027-02-03", "09:30"), "2027-02-03T09:30");
  assert.equal(combineLocalDateTime("", "09:30"), "");
});
