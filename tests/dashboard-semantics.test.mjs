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
  assert.match(source, /Enter a possible spread point number\./);
  assert.match(source, /won by \{score\.margin\}/);
  assert.match(source, /Main \(\{eventGames\} games\)/);
});

test("scorecard has grouped paper-card headers and touch scrolling", () => {
  assert.match(source, /title="Barb Stevens, HI-296"/);
  assert.match(source, /<th colSpan=\{2\} scope="colgroup">Game<\/th>/);
  assert.match(source, /<th colSpan=\{2\} scope="colgroup">Spread Points<\/th>/);
  assert.match(source, /<th scope="col">Opponent<\/th>/);
  assert.match(source, /<th scope="col">Verification<\/th>/);
  assert.match(source, /<th scope="col">ID Number<\/th>/);
  assert.match(source, /Net Points/);
  assert.match(source, /Games Won/);
  assert.match(styles, /-webkit-overflow-scrolling:touch/);
  assert.match(styles, /touch-action:pan-y/);
});

test("prototype navigation includes review and all requested operational screens", () => {
  assert.match(source, /setScreen\("review"\)/);
  assert.match(source, /title="Review Current Game Result"/);
  assert.match(source, /title="Seating & Paper Cards"/);
  assert.match(source, /title="Scorecard Review"/);
  assert.match(source, /title="Tournament Events"/);
  assert.match(source, /title="Tournament Financials"/);
  assert.match(source, /title="Grass Roots Results"/);
});
