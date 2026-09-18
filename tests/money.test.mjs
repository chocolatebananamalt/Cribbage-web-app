import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatUsdInput, parseUsdMinor } from "../src/lib/money.ts";
import { calculateSanctioningFeeRunningTotalCents, requiresSanctioningFeeOverrideEvidence } from "../src/lib/sanctioning-fee.ts";

test("parses exact USD cents without floating-point rounding", () => {
  assert.equal(parseUsdMinor("10"), 1_000);
  assert.equal(parseUsdMinor("10.5"), 1_050);
  assert.equal(parseUsdMinor("10.05"), 1_005);
  assert.equal(parseUsdMinor(" 0.01 "), 1);
  assert.equal(parseUsdMinor("0", { allowZero: true }), 0);
});

test("rejects ambiguous, over-precise, negative, and excessive money", () => {
  for (const value of ["", ".5", "01.00", "1.001", "-1", "1e3", "NaN"]) {
    assert.equal(parseUsdMinor(value), null, value);
  }
  assert.equal(parseUsdMinor("1000000.01", { allowZero: true, maxMinor: 100_000_000 }), null);
});

test("formats stored minor units for editable setup fields", () => {
  assert.equal(formatUsdInput(null), "");
  assert.equal(formatUsdInput(0), "0.00");
  assert.equal(formatUsdInput(1_005), "10.05");
});

test("calculates Main and Consolation sanctioning fees without using receipts", () => {
  assert.equal(calculateSanctioningFeeRunningTotalCents({ mainEligibleParticipantCount: 12, consolationEligibleParticipantCount: 7 }, { mainRateCents: 300, consolationRateCents: 100 }), 4_300);
  assert.equal(requiresSanctioningFeeOverrideEvidence("main", 300), false);
  assert.equal(requiresSanctioningFeeOverrideEvidence("consolation", 100), false);
  assert.equal(requiresSanctioningFeeOverrideEvidence("main", 350), true);
});

test("tournament setup keeps ordinary money drafts precise and rate changes explicitly gated", () => {
  const client = readFileSync("src/app/tournament/[tournamentId]/setup/setup-client.tsx", "utf8");
  assert.match(client, /setDraft\(event\.target\.value\)/);
  assert.match(client, /onBlur=/);
  assert.match(client, /aria-invalid=\{invalid\}/);
  assert.match(client, /key={`pool-fee-\$\{pool\.entryFeeCents\}`}/);
  assert.match(client, /key={`event-fee-\$\{event\.entryFeeCents\}`}/);
  assert.match(client, /ACC Sanctioning Fee Running Total/);
  assert.match(client, /Main rate per person/);
  assert.match(client, /Consolation rate per person/);
  assert.match(client, /Adjust Main rate/);
  assert.match(client, /Save Adjusted Main Rate/);
  assert.match(client, /Reason \(<span className="required-field"/);
  assert.doesNotMatch(client, /sanctioningFeeCents/);
  assert.doesNotMatch(client, /Math\.round\(amount \* 100\)/);
});
