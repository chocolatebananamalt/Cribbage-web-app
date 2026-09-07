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
  assert.match(source, /wins by \{score\.margin\}/);
});

test("score entry calls the entered value Spread Points without exposing its validation range", () => {
  assert.match(source, />Spread Points<\/label>/);
  assert.match(source, /aria-label="Spread points keypad"/);
  assert.doesNotMatch(source, /Winning margin/);
  assert.doesNotMatch(source, /1–121/);
});
