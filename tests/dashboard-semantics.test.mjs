import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/tournament-dashboard.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

test("dashboard keeps initial winner controls unpressed and review gated", () => {
  assert.match(source, /useState<"player" \| "opponent" \| null>\(null\)/);
  assert.match(source, /aria-pressed=\{winner === "player"\}/);
  assert.match(source, /aria-pressed=\{winner === "opponent"\}/);
  assert.match(source, /disabled=\{!score\}/);
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
  assert.match(source, /Game 3 · Barb: Table A \/ Seat 7 · Steve: Table A \/ Seat 8/);
  assert.match(source, /won by \{score\.margin\}/);
  assert.match(source, /Main \(\{eventGames\} games\)/);
});

test("scorecard has grouped paper-card headers and touch scrolling", () => {
  assert.match(source, /title="Barb Stevens, HI-296"/);
  assert.match(source, /<th colSpan=\{2\} scope="colgroup">Game<\/th>/);
  assert.match(source, /<th colSpan=\{2\} scope="colgroup">Spread Points<\/th>/);
  assert.match(source, /rowSpan=\{2\} scope="col">Opponent<span>Name<\/span>/);
  assert.match(source, /rowSpan=\{2\} scope="col">Verification<span>ID #<\/span>/);
  assert.match(source, /Net Spread Points/);
  assert.match(source, /2<\/strong> Games Won/);
  assert.match(source, /ID #<strong>A-7<\/strong>/);
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
  assert.match(source, /title="Tournament Flyer"/);
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
  assert.match(source, /Events and Flyer/);
  assert.match(source, /seating-print-title/);
  assert.match(source, /title="Scorecard Review"/);
  assert.match(source, /title="Tournament Events"/);
  assert.match(source, /title="Tournament Financials"/);
  assert.match(source, /title="Tournament Results"/);
});

test("interactive controls meet the baseline touch-target and keyboard-focus contract", () => {
  assert.match(styles, /button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible/);
  assert.match(styles, /outline:3px solid #2058b6/);
  assert.match(styles, /\.sort-controls button \{ min-height:44px/);
  assert.match(styles, /\.event-tabs button \{ min-height:44px/);
  assert.match(styles, /\.keypad button \{ min-height:56px/);
  assert.match(styles, /\.pick \{ min-height:56px/);
});
