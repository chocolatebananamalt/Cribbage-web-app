import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientPath = new URL("../src/app/tournament/[tournamentId]/setup/setup-client.tsx", import.meta.url);
const pagePath = new URL("../src/app/tournament/[tournamentId]/setup/page.tsx", import.meta.url);
const landingPath = new URL("../src/app/tournament/[tournamentId]/page.tsx", import.meta.url);
const cssPath = new URL("../src/app/globals.css", import.meta.url);

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
  assert.match(client, /event\.sidePools\.length >= 6/);
  assert.match(client, /Click Add Main Event to enter its event name, fees, date and time, included items, and Q Pools/);
  assert.match(client, /Click Add Q Pool to enter its type, entry fee, and optional note/);
  assert.match(client, /Click Add Side Pool to enter its type, entry fee, and optional note\. Each event may have up to six Side Pools\./);
  assert.match(client, /Add Q Pool limit reached/);
  assert.match(client, /Add Side Pool limit reached/);
  assert.match(client, /Remove Q Pool/);
  assert.match(client, /Remove Side Pool/);
  assert.match(client, /Coffee, donuts, lunch, etc\./);
  assert.match(client, /aria-describedby=\{`\$\{event\.clientRowId\}-fee-includes-help`\}/);
});

test("setup text, date, and money controls are not reduced to checkbox dimensions", async () => {
  const css = await readFile(cssPath, "utf8");
  const genericCheckboxRule = css.lastIndexOf(".policy-settings input { min-height:auto; width:20px; height:20px;");
  const setupInputRule = css.lastIndexOf(".policy-settings.setup-workspace input { width:100%; height:auto; min-height:46px;");
  const setupLabelRule = css.lastIndexOf(".policy-settings.setup-workspace .setup-grid label,.policy-settings.setup-workspace .setup-subsection label { display:grid;");
  assert.ok(genericCheckboxRule >= 0, "expected the existing policy checkbox rule");
  assert.ok(setupInputRule > genericCheckboxRule, "setup input dimensions must override the checkbox rule");
  assert.ok(setupLabelRule > genericCheckboxRule, "setup labels must override the policy checkbox layout");
});

test("setup saves are recoverable and never presented as operational activation", async () => {
  const client = await readFile(clientPath, "utf8");
  assert.match(client, /sessionStorage\.setItem/);
  assert.match(client, /Retry exact saved request/);
  assert.match(client, /isSavedSetup/);
  assert.match(client, /Save All Events Draft/);
  assert.match(client, /Finalize All Events \/ Open Registration/);
  assert.match(client, /Finalizing opens registration; it does not start play, close registration, assign seats, charge anyone, or publish results/);
  assert.match(client, /Please confirm you intend to open registration for these events/);
  assert.match(client, /Event finalization status could not be checked/);
  assert.match(client, /missing_tournament_contact/);
  assert.doesNotMatch(client, />Activate Tournament Events</);
});
