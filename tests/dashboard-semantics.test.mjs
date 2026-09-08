import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/tournament-dashboard.tsx", "utf8");

test("dashboard keeps initial winner controls unpressed and review gated", () => {
  assert.match(source, /useState<"player" \| "opponent" \| null>\(null\)/);
  assert.match(source, /aria-pressed=\{winner === "player"\}/);
  assert.match(source, /aria-pressed=\{winner === "opponent"\}/);
  assert.match(source, /disabled=\{!score\}/);
});

test("score entry uses player-facing language without prototype workflow jargon", () => {
  assert.doesNotMatch(source, /FAST ENTRY/);
  assert.doesNotMatch(source, /1 of 3/);
  assert.doesNotMatch(source, /Derived result/);
  assert.match(source, /won by \{score\.margin\}/);
  assert.match(source, /Game Winner:/);
  assert.match(source, /<p className="eyebrow">SCORE ENTRY<\/p><h2 id="score-title">Game Result<\/h2>/);
});

test("score entry calls the entered value Spread Points without exposing its validation range", () => {
  assert.match(source, />Spread Points<\/label>/);
  assert.match(source, /aria-label="Spread points keypad"/);
  assert.doesNotMatch(source, /Winning margin/);
  assert.doesNotMatch(source, /1–121/);
});

test("scorecard preserves the requested paper-card structure and player-facing labels", () => {
  assert.match(source, /<p className="eyebrow">SCORECARD<\/p><h2 id="card-title">Barb Stevens, HI-296<\/h2>/);
  assert.match(source, /Game 3 of 12/);
  assert.match(source, /<th colSpan=\{2\} scope="colgroup">Game<\/th>/);
  assert.match(source, /<th colSpan=\{2\} scope="colgroup">Spread Points<\/th>/);
  assert.match(source, /<th rowSpan=\{2\} scope="col">Verification<\/th>/);
  assert.match(source, /Games Won/);
  assert.doesNotMatch(source, /PAPER-STYLE VIEW/);
  assert.doesNotMatch(source, /Checked by/);
});
