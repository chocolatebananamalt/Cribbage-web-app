import test from "node:test";
import assert from "node:assert/strict";
import { adjudicateRule12Fixture } from "../src/lib/rule12-discrepancy.ts";

const card = (id, apparentQualifier, recordedOutcome, recordedMargin, recordedColumn) => ({ id, apparentQualifier, recordedOutcome, recordedMargin, recordedColumn });
const values = (result) => result.cards.map(({ id, outcome, margin, plusPoints, minusPoints, gamePoints }) => ({ id, outcome, margin, plusPoints, minusPoints, gamePoints }));

test("Rule 12.2(a) moves the apparent qualifier to the opposing smaller claimed spread", () => {
  const result = adjudicateRule12Fixture("a", [card("a", true, "win", 21, "plus"), card("b", false, "loss", 16, "minus")]);
  assert.deepEqual(values(result), [
    { id: "a", outcome: "win", margin: 16, plusPoints: 16, minusPoints: 0, gamePoints: 2 },
    { id: "b", outcome: "loss", margin: 16, plusPoints: 0, minusPoints: 16, gamePoints: 0 },
  ]);
  assert.equal(result.totalsMustRecalculate, true);
});

test("Rule 12.2(b) preserves each qualifier card outcome and exchanges the discrepant margins", () => {
  const result = adjudicateRule12Fixture("b", [card("a", true, "win", 17, "plus"), card("b", true, "loss", 16, "minus")]);
  assert.deepEqual(values(result), [
    { id: "a", outcome: "win", margin: 16, plusPoints: 16, minusPoints: 0, gamePoints: 2 },
    { id: "b", outcome: "loss", margin: 17, plusPoints: 0, minusPoints: 17, gamePoints: 0 },
  ]);
});

test("Rule 12.2(c) completes one blank card from the marked spread", () => {
  const result = adjudicateRule12Fixture("c", [card("a", false, "win", 21, "plus"), card("b", false, "loss", null, "blank")]);
  assert.deepEqual(values(result), [
    { id: "a", outcome: "win", margin: 21, plusPoints: 21, minusPoints: 0, gamePoints: 2 },
    { id: "b", outcome: "loss", margin: 21, plusPoints: 0, minusPoints: 21, gamePoints: 0 },
  ]);
});

test("Rule 12.2(d), (e), and (f) derive corrected columns and game points", () => {
  const d = adjudicateRule12Fixture("d", [card("a", false, "win", 17, "plus"), card("b", false, "win", 16, "minus")]);
  assert.deepEqual(values(d), [
    { id: "a", outcome: "win", margin: 17, plusPoints: 17, minusPoints: 0, gamePoints: 2 },
    { id: "b", outcome: "loss", margin: 16, plusPoints: 0, minusPoints: 16, gamePoints: 0 },
  ]);
  const e = adjudicateRule12Fixture("e", [card("a", false, "win", 31, "plus"), card("b", false, "win", 16, "plus")]);
  assert.deepEqual(values(e), [
    { id: "a", outcome: "loss", margin: 31, plusPoints: 0, minusPoints: 31, gamePoints: 0 },
    { id: "b", outcome: "loss", margin: 16, plusPoints: 0, minusPoints: 16, gamePoints: 0 },
  ]);
  const f = adjudicateRule12Fixture("f", [card("a", false, "win", 31, "plus"), card("b", false, "loss", 16, "plus")]);
  assert.deepEqual(values(f), [
    { id: "a", outcome: "win", margin: 31, plusPoints: 31, minusPoints: 0, gamePoints: 3 },
    { id: "b", outcome: "loss", margin: 16, plusPoints: 0, minusPoints: 16, gamePoints: 0 },
  ]);
});

test("Rule 12.2(h) preserves an already adverse apparent qualifier", () => {
  const h = adjudicateRule12Fixture("h", [card("a", true, "win", 15, "plus"), card("b", false, "loss", 20, "minus")]);
  assert.deepEqual(values(h), [
    { id: "a", outcome: "win", margin: 15, plusPoints: 15, minusPoints: 0, gamePoints: 2 },
    { id: "b", outcome: "loss", margin: 20, plusPoints: 0, minusPoints: 20, gamePoints: 0 },
  ]);
  assert.equal(h.totalsMustRecalculate, false);
  assert.throws(() => adjudicateRule12Fixture("h", [card("a", true, "win", 21, "plus"), card("b", false, "loss", 16, "minus")]), /already adverse/);
  assert.throws(() => adjudicateRule12Fixture("a", [card("a", true, "win", 15, "plus"), card("b", false, "loss", 20, "minus")]), /favorable/);
});

test("Rule 12.2(i) adds the affected-player notice to the underlying correction", () => {
  const result = adjudicateRule12Fixture("a", [card("a", true, "win", 21, "plus"), card("b", false, "loss", 16, "minus")], { qualificationChanged: true });
  assert.equal(result.qualificationNoticeRequired, true);
  assert.equal(result.totalsMustRecalculate, true);
  assert.throws(() => adjudicateRule12Fixture("h", [card("a", true, "win", 15, "plus"), card("b", false, "loss", 20, "minus")], { qualificationChanged: true }), /cannot itself change qualifying/);
});

test("Rule 12 fixture oracle rejects malformed or non-applicable cases", () => {
  assert.throws(() => adjudicateRule12Fixture("a", [card("a", true, "win", 17, "plus"), card("b", false, "loss", 17, "minus")]), /requires a discrepancy/);
  assert.throws(() => adjudicateRule12Fixture("c", [card("a", false, "win", null, "blank"), card("b", false, "loss", null, "blank")]), /exactly one blank/);
  assert.throws(() => adjudicateRule12Fixture("d", [card("a", false, "win", 122, "plus"), card("b", false, "win", 16, "minus")]), /both recorded spreads/);
});
