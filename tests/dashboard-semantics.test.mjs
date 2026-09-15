import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync("src/app/tournament-dashboard.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");
const protectedSeating = readFileSync("src/app/tournament/[tournamentId]/seating/seating-client.tsx", "utf8");

function collectTsxSources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxSources(fullPath);
    return entry.name.endsWith(".tsx") ? [readFileSync(fullPath, "utf8")] : [];
  });
}

test("dashboard keeps initial winner controls unpressed and review gated", () => {
  assert.match(source, /useState<"player" \| "opponent" \| null>\(null\)/);
  assert.match(source, /aria-pressed=\{winner === "player"\}/);
  assert.match(source, /aria-pressed=\{winner === "opponent"\}/);
  assert.match(source, /disabled=\{!score\}/);
});

test("demo exposes the on-device paper-card photo aid", () => {
  assert.match(source, /Paper-card photo aid/);
  assert.match(source, /LocalPaperCardPhoto/);
  assert.match(source, /photo stays on this device/i);
  assert.match(source, /initialScreen/);
  const demoPage = readFileSync("src/app/demo/page.tsx", "utf8");
  assert.match(demoPage, /requestedScreen === "corrections"/);
  assert.match(demoPage, /<TournamentDashboard initialScreen=\{initialScreen\}/);
});

test("score entry uses the approved result wording and rejects an impossible spread", () => {
  assert.doesNotMatch(source, /FAST ENTRY/);
  assert.doesNotMatch(source, /Derived result/);
  assert.match(source, /title="Current Game Results"/);
  assert.match(source, /Game Winner:/);
  assert.match(source, /marginText \? "Enter a possible spread point number\." : "Enter spread points\."/);
  assert.match(source, /Enter a possible spread point number\./);
  assert.match(source, /old\.length >= 3 \? old/);
  assert.match(source, /<label htmlFor="margin">Spread Points:<\/label><output id="margin"[\s\S]*?<Skunk/);
  assert.match(source, /Game 3 · Demo Player: Table A \/ Seat 1 · Sample Opponent: Table A \/ Seat 2/);
  assert.match(source, /won by \{score\.margin\}/);
  assert.match(source, /Main \(\{eventGames\} games\)/);
});

test("scorecard has grouped paper-card headers and touch scrolling", () => {
  assert.match(source, /title="Demo Player, DEMO-001"/);
  assert.match(source, /<th colSpan=\{2\} scope="colgroup">Game<\/th>/);
  assert.match(source, /<th colSpan=\{2\} scope="colgroup">Spread Points<\/th>/);
  assert.match(source, /rowSpan=\{2\} scope="col">Opponent<span>Name<\/span>/);
  assert.match(source, /rowSpan=\{2\} scope="col">Verification<span>ID #<\/span>/);
  assert.match(source, /Net Spread Points/);
  assert.match(source, /2<\/strong> Games Won/);
  assert.match(source, /ID #<strong>D-1<\/strong>/);
  assert.match(source, /Verification Pending Opponent Entry/);
  assert.match(source, /Updated Total Calculations Pending Opponent Entry/);
  assert.match(source, /formatScorecardSpread/);
  assert.match(source, /const spreadCell = \(value: number\) => value === 0 \? "—" : formatScorecardSpread\(value\)/);
  assert.match(source, /className="total-pending-cell"/);
  assert.match(source, /Entry Not Submitted/);
  assert.match(source, /<Scorecard score=\{submitted \? score : null\} pending=\{submitted\}/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /<th scope="col">\(−\)<\/th>/);
  assert.match(styles, /th:nth-child\(4\) \{ font-size:20px/);
  assert.match(styles, /-webkit-overflow-scrolling:touch/);
  assert.match(styles, /touch-action:pan-y/);
  assert.match(styles, /overflow-x:hidden/);
});

test("scorecard remains readable and keyboard-scrollable on narrow phones", () => {
  const scorecardPage = readFileSync("src/app/tournament/[tournamentId]/scorecard/page.tsx", "utf8");
  assert.match(source, /scorecard-frame" role="region" aria-label="Scorecard table; scroll horizontally on small screens" tabIndex=\{0\}/);
  assert.match(scorecardPage, /scorecard-frame" role="region" aria-label="Scorecard table; scroll horizontally on small screens" tabIndex=\{0\}/);
  assert.match(styles, /\.scorecard-frame \{ overflow-x:auto; overflow-y:hidden; \}/);
  assert.match(styles, /\.scorecard-header,\.scorecard-body,\.scorecard-footer \{ min-width:560px; \}/);
});

test("authentication cards cannot expand the page beyond a narrow phone", () => {
  assert.match(styles, /\.auth-shell \{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(styles, /\.auth-card \{[^}]*min-width:0;[^}]*max-width:100%;[^}]*overflow-wrap:anywhere/);
  assert.match(styles, /@media \(max-width:380px\) \{ \.auth-shell \{ padding:16px; \}\.auth-card \{ padding:24px; \}\.auth-card h1 \{ font-size:32px; \} \}/);
});

test("flyer preview collapses after its desktop grid rule on narrow phones", () => {
  const desktopRule = styles.indexOf(".flyer-events { display:grid; grid-template-columns:1fr 1fr;");
  const mobileRule = styles.indexOf("@media (max-width:700px) { .flyer-events { grid-template-columns:minmax(0,1fr); } }");
  assert.ok(desktopRule >= 0 && mobileRule > desktopRule);
});

test("the app provides a browser icon without a missing favicon request", () => {
  assert.match(readFileSync("src/app/icon.svg", "utf8"), /ACC Tournament Desk/);
});

test("prototype navigation includes review and all requested operational screens", () => {
  assert.match(source, /setScreen\("review"\)/);
  assert.match(source, /title="Review Current Game Result"/);
  assert.match(source, /title="Seating"/);
assert.match(source, /Seating Assignments and Table Plan/);
  assert.match(source, /Search player name/);
  assert.match(source, /Assigned Table - Seat/);
  assert.match(source, /<span>\{table\}-\{seat\}<\/span>/);
  assert.match(source, /seating-print-head/);
  assert.match(styles, /@page \{ margin:\.5in; \}/);
  assert.match(source, /const columnSize = 28/);
  assert.match(source, /Scorecard type/);
  assert.match(source, /title="Table Plan"/);
  assert.match(source, /title="Tournament Flyer Format Preview"/);
  assert.match(source, /Qualification Preview/);
  assert.match(source, /Open Sample Qualification PDF/);
  assert.doesNotMatch(source, /Topaz Satellite/);
  assert.match(source, /Satellite Events/);
  assert.match(source, /Canadian Doubles/);
  assert.match(source, /Set Up Tournament/);
  assert.match(source, /Import Existing Flyer/);
  assert.match(source, /Prototype format preview only - information is not saved or submitted/);
  assert.match(source, /Format preview only - no file is uploaded or extracted here/);
  assert.match(source, /Qualification Rules Pending/);
  assert.match(source, /SAMPLE - SANCTIONING PENDING/);
  assert.doesNotMatch(source, /ACC SANCTIONED TOURNAMENT/);
  assert.match(source, /Not Offered/);
  assert.match(source, /mainGameOptions/);
  assert.match(source, /qPoolOptions/);
  assert.match(source, /satelliteGameOptions/);
  assert.match(source, /Close Registration & Assign Seating/);
  assert.match(source, /Table\/Seat and permanent verification IDs are generated only after registration closes/);
  assert.match(source, /title="Quick Reference Search"/);
  assert.match(source, /className="panel flyer-preview"/);
  assert.match(source, /Previous Screen/);
  assert.match(source, /Rulebook/);
  assert.match(source, /GAME 3/);
  assert.match(source, /ACC Rulebook Cached/);
  assert.match(source, /ACC Rulebook Online/);
  assert.match(source, /PrintableSeatingList/);
  assert.match(source, /<strong>Tournament Events and Flyer<\/strong>/);
  assert.match(source, /seating-print-title/);
  assert.match(source, /title="Scorecard Review"/);
  assert.match(source, /title="Tournament Events and Flyer"/);
  assert.match(source, /title="Tournament Financials"/);
  assert.match(source, /title="Tournament Results"/);
});

test("qualification preview separates playoff results and places the high non-qualifier after qualifiers", () => {
  const previewStart = source.indexOf('screen === "qualifiers"');
  const previewEnd = source.indexOf('screen === "rulebook"', previewStart);
  const preview = source.slice(previewStart, previewEnd);
  assert.ok(previewStart >= 0 && previewEnd > previewStart);
  assert.doesNotMatch(preview, /\["Winner"|\["Runner-up"/);
  assert.ok(preview.indexOf('["Qualifiers"') < preview.indexOf('["High Non-Qualifier"'));
  assert.match(preview, /Shown immediately after the last qualifier/);
  assert.match(preview, /Not a qualifier/);
  assert.match(preview, /onClick=\{\(\) => setScreen\("resultDetails"\)\}>Previous Screen<\/button>/);
});

test("October pilot event summary distinguishes configured events from deferred work", () => {
  const operationsStart = source.indexOf('screen === "operations"');
  const setupStart = source.indexOf('screen === "setup"', operationsStart);
  const operations = source.slice(operationsStart, setupStart);
  const eventsStart = source.indexOf('screen === "flyer"');
  const financeStart = source.indexOf('screen === "finance"', eventsStart);
  const events = source.slice(eventsStart, financeStart);
  assert.match(operations, /<strong>Tournament Events and Flyer<\/strong>/);
  assert.match(operations, /<button type="button" disabled><b>⚖<\/b><strong>Judge Desk<\/strong>/);
  assert.doesNotMatch(operations, /setScreen\("judge"\)/);
  assert.match(events, /title="Tournament Events and Flyer"/);
  assert.match(events, /label="TOURNAMENT EVENTS AND FLYER"/);
  assert.match(events, /\["Main Event", "Standard · 12 games", "Configured"\]/);
  assert.match(events, /\["Consolation Event", "Standard · 9 games", "Configured"\]/);
  assert.match(events, /\["Satellite Events", "Each configured event appears here", "View events"\]/);
  assert.match(events, /Traditional\/Canadian Doubles · shared Digital or Paper card/);
  assert.match(events, /October ready/);
  assert.doesNotMatch(events, /Digital scoring deferred/);
  assert.match(events, /Flyer creation/);
});

test("player check-in search is accessible and cannot change the full attendance or seating inputs", () => {
  for (const contents of [source, protectedSeating]) {
    assert.match(contents, /type="search"/);
    assert.match(contents, /Search player name/);
    assert.match(contents, /Showing \{visibleCheckIn\.length\} of/);
    assert.match(contents, /aria-live="polite"/);
    assert.match(contents, /No player matches that name\./);
  }
  assert.match(protectedSeating, /filterCheckInByName\(checkIn, checkInSearch\)/);
  assert.match(protectedSeating, /const present = useMemo\(\(\) => checkIn\.filter/);
  assert.match(protectedSeating, /draft\(checkIn,/);
  assert.doesNotMatch(protectedSeating, /draft\(visibleCheckIn|visibleCheckIn\.filter\(\(entry\) => entry\.state/);
});

test("new-tab links cannot retain control of an application tab", () => {
  const links = collectTsxSources("src").flatMap((contents) => [...contents.matchAll(/<a\b[^>]*\btarget="_blank"[^>]*>/g)]);
  assert.ok(links.length > 0, "the app intentionally opens cached and official Rulebook references in a new tab");
  assert.ok(links.every((match) => /\brel="noreferrer"/.test(match[0])), "every new-tab link must sever opener and referrer access");
});

test("interactive controls meet the baseline touch-target and keyboard-focus contract", () => {
  assert.match(styles, /button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible/);
  assert.match(styles, /outline:3px solid #2058b6/);
  assert.match(styles, /\.sort-controls button \{ min-height:44px/);
  assert.match(styles, /\.event-tabs button \{ min-height:44px/);
  assert.match(styles, /\.keypad button \{ min-height:56px/);
  assert.match(styles, /\.pick \{ min-height:56px/);
  assert.match(styles, /@media \(max-width:700px\) \{ \.nav \{ display:grid; grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.nav button \{ min-height:52px/);
});
