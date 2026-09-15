import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAddSidePoolRequest, isSidePoolWorkspace } from "../src/lib/api/side-pools.ts";

const sql = readFileSync("database/migrations/0175_six_configurable_side_pools.sql", "utf8");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("six Side Pool migration permits arbitrary names/fees and rejects normalized duplicates", () => {
  assert.match(sql, /count\(\*\)[\s\S]*>=6/);
  assert.match(sql, /lower\(trim\(display_name\)\)/);
  assert.match(sql, /duplicate_pool_name/);
  assert.doesNotMatch(sql, /category_code not in\('10','20','50','100'\)/);
});

test("Side Pool contracts accept custom names and up to six pools", () => {
  assert.equal(isAddSidePoolRequest({ action: "add_pool", eventId: id(1), poolId: id(2), categoryCode: "Holiday Jackpot", displayName: "Holiday Jackpot", entryFeeMinor: 2750, idempotencyKey: id(3) }), true);
  const pool = (n) => ({ poolId: id(n), version: 1, categoryCode: `custom-${n}`, displayName: `Pool ${n}`, entryFeeMinor: n * 100, policy: null, elections: [], payouts: [], collectedMinor: 0, paidMinor: 0, finalized: false });
  assert.equal(isSidePoolWorkspace({ tournamentName: "Sample", events: [{ eventId: id(1), name: "Main", eventType: "main", participants: [], teamBeneficiaries: [], pools: [1,2,3,4,5,6].map(pool) }] }), true);
});
