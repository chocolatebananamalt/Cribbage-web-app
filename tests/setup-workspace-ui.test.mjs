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
  assert.doesNotMatch(client, /missing_tournament_contact/);
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
  for (const label of ["Tournament name", "Venue name", "Venue street address", "Venue city", "Venue State", "Venue ZIP", "Start date", "End date", "Time Zone", "First name", "Last name"]) {
    assert.match(client, new RegExp(label));
  }
  assert.match(client, /setup-span-4/);
  assert.match(client, /setup-span-6/);
  assert.match(client, /setup-span-2/);
  assert.match(client, /setup-director-info setup-span-12/);
  assert.match(client, /className="setup-director-fields"/);
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.setup-details-grid \{ width:min\(100%,860px\)/);
  assert.match(css, /\.setup-details-grid input:not\(\[type=checkbox\]\):not\(\[type=radio\]\),\.setup-details-grid select \{ height:46px; min-height:46px; \}/);
  assert.match(css, /\.setup-director-info \{ display:block;/);
  assert.match(css, /\.setup-director-help \{ margin:0 0 14px; \}/);
  assert.match(css, /\.setup-director-fields \{ display:grid; grid-template-columns:repeat\(12,minmax\(0,1fr\)\); align-items:start;/);
  assert.match(css, /@media \(min-width:701px\) and \(max-width:900px\).*\.setup-director-first,\.setup-director-last,\.setup-director-phone,\.setup-director-email \{ grid-column:span 3; \}/s);
  assert.match(css, /@media \(max-width:700px\).*\.setup-grid,\.setup-details-grid \{ width:100%; grid-template-columns:minmax\(0,1fr\)/s);
  assert.match(client, /Tournament Director Information \(shown to players\)/);
  assert.match(client, /Use the information players should see for this tournament\. It is separate from private account information\./);
  assert.match(client, /Mailing Address for Correspondence.*Note: This address will be visible to players/s);
  assert.doesNotMatch(client, /Tournament contact phone .*required/s);
  assert.doesNotMatch(client, /Tournament contact email .*required/s);
});

test("structured venue and Director name values are versioned without rewriting historic setups", async () => {
  const [api, migration] = await Promise.all([
    readFile(new URL("../src/lib/api/setup.ts", import.meta.url), "utf8"),
    readFile(new URL("../database/migrations/0233_structured_venue_and_director_names.sql", import.meta.url), "utf8"),
  ]);
  for (const key of ["venueName", "venueStreet", "venuePostalCode", "tournamentDirectorFirstName", "tournamentDirectorLastName"]) {
    assert.match(api, new RegExp(key));
    assert.match(migration, new RegExp(key));
  }
  assert.match(migration, /before insert on app\.tournament_setup_revisions/);
  assert.match(migration, /save_tournament_setup_version_before_structured_details/);
  assert.match(migration, /get_tournament_setup_workspace_before_structured_details/);
  assert.match(migration, /p_payload-array\['venueName','venueStreet','venuePostalCode','tournamentDirectorFirstName','tournamentDirectorLastName'\]/);
});
