import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workspace = fs.readFileSync("src/app/tournament/[tournamentId]/page.tsx", "utf8");
const checkIn = fs.readFileSync("src/app/tournament/[tournamentId]/event-check-in/page.tsx", "utf8");

test("tournament workspace groups normal operations by director phase", () => {
  for (const label of [
    "1. Set up", "2. Registration and payments", "3. Check-in and seating",
    "4. Cross-check and recovery", "5. Results and reporting",
  ]) assert.match(workspace, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(workspace, /Registration and roster/);
  assert.match(workspace, /Event Check-In/);
  assert.match(workspace, /Payments and expenses/);
  assert.match(workspace, /Tournament Results/);
});

test("event check-in accurately describes independent event windows", () => {
  assert.match(checkIn, /Open each event independently/);
  assert.match(checkIn, /Multiple event windows may be open/);
  assert.doesNotMatch(checkIn, /Open one event at a time/);
});
