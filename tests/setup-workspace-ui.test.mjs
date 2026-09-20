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
  // The 20x20 sizing exists for checkboxes and radios. It must never be written
  // as a bare `.policy-settings input` rule: that shrank every text, date and
  // money field on 20 of the 21 forms down to a 26x22 target that could be
  // focused programmatically but was too small for a person to tap or type in.
  assert.ok(
    !/\.policy-settings input \{/.test(css),
    "the checkbox sizing must be scoped to [type=checkbox]/[type=radio], never a bare .policy-settings input rule",
  );
  assert.match(css, /\.policy-settings input\[type=checkbox\],\.policy-settings input\[type=radio\] \{ min-height:auto; width:20px; height:20px;/);
  assert.match(css, /\.policy-settings input:not\(\[type=checkbox\]\):not\(\[type=radio\]\) \{ width:100%; height:auto; min-height:46px;/);
  assert.match(css, /\.policy-settings>label:has\(input:not\(\[type=checkbox\]\):not\(\[type=radio\]\)\)/);
  // Every rule that stretches an input to full width must exclude checkboxes and
  // radios, so the inverse defect cannot appear either: a checkbox blown up to
  // 100% width inside a container that was only meant to size text fields.
  const stretchRules = css.match(/[^{};,]*input[^{;]*\{[^}]*width:100%[^}]*\}/g) ?? [];
  for (const rule of stretchRules) {
    const selector = rule.slice(0, rule.indexOf("{"));
    if (!selector.includes("policy-settings")) continue;
    assert.ok(
      selector.includes("[type=checkbox]") || selector.includes(":not([type=checkbox])"),
      `full-width input rule must exclude checkboxes and radios: ${selector.trim()}`,
    );
  }
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

test("tournament details must be saved before event setup unlocks", async () => {
  const client = await readFile(clientPath, "utf8");
  assert.match(client, /Save Tournament Details &amp; Continue/);
  assert.match(client, /Tournament Events is locked until the tournament details are saved/);
  assert.match(client, /payload: revisionId \? payload : \{ \.\.\.payload, events: \[\] \}/);
  assert.match(client, /stage: "details"/);
  assert.match(client, /disabled=\{!tournamentDetailsSaved \|\| busy \|\| !!pending/);
  assert.match(client, /if \(!payload \|\| !tournamentDetailsSaved \|\| pending \|\| activated\) return/);
  assert.match(client, /Tournament details saved\. Tournament Events is now available\./);
  assert.match(client, /Venue name and address/);
});
