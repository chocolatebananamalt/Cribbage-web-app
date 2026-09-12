import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientPath = new URL("../src/app/tournament/[tournamentId]/setup/setup-client.tsx", import.meta.url);
const pagePath = new URL("../src/app/tournament/[tournamentId]/setup/page.tsx", import.meta.url);
const landingPath = new URL("../src/app/tournament/[tournamentId]/page.tsx", import.meta.url);

test("directors can reach the protected tournament setup workspace", async () => {
  const [page, landing] = await Promise.all([readFile(pagePath, "utf8"), readFile(landingPath, "utf8")]);
  assert.match(page, /requireTournamentAccess/);
  assert.match(page, /\["director", "co_director"\]\.includes\(access\.role\)/);
  assert.match(landing, /Set Up Tournament/);
  assert.match(landing, /\/setup/);
});

test("setup workspace exposes the October pilot event and Q Pool menus", async () => {
  const client = await readFile(clientPath, "utf8");
  for (const required of [
    "Add Main Event", "Add Consolation Event", "Add Satellite Event",
    "Double Elimination", "Consy Lite", "Canadian Doubles",
    "Equal (Pays All Equally)", "Graduated (1-in-10)", "Top 4",
  ]) assert.match(client, new RegExp(required.replace(/[()]/g, "\\$&")));
  assert.match(client, /formatForStyle/);
  assert.match(client, /event\.qPools\.length >= 2/);
});

test("setup saves are recoverable and never presented as operational activation", async () => {
  const client = await readFile(clientPath, "utf8");
  assert.match(client, /sessionStorage\.setItem/);
  assert.match(client, /Retry exact saved request/);
  assert.match(client, /isSavedSetup/);
  assert.match(client, /Save Tournament Setup/);
  assert.doesNotMatch(client, />Activate Tournament</);
});
