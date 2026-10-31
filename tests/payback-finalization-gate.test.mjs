import assert from "node:assert/strict";
import test from "node:test";
import { canStartPaybackFinalization } from "../src/lib/results/payback-finalization-gate.ts";
import { countAppSessionStorageRecords } from "../src/lib/client-session-storage.ts";

const draft = { draftId: "10000000-0000-4000-8000-000000000001", version: 3 };
const workspace = { required: true, scope: { status: "supported" }, review: { current: true, draftId: draft.draftId, draftVersion: 3 } };
test("new final readiness requires the exact reviewed draft under supported server facts", () => {
  assert.equal(canStartPaybackFinalization(null, draft), false);
  assert.equal(canStartPaybackFinalization(workspace, null), false);
  assert.equal(canStartPaybackFinalization({ ...workspace, review: null }, draft), false);
  assert.equal(canStartPaybackFinalization({ ...workspace, review: { ...workspace.review, current: false } }, draft), false);
  assert.equal(canStartPaybackFinalization({ ...workspace, scope: { status: "blocked" } }, draft), false);
  assert.equal(canStartPaybackFinalization(workspace, { ...draft, version: 4 }), false);
  assert.equal(canStartPaybackFinalization(workspace, { ...draft, draftId: "20000000-0000-4000-8000-000000000001" }), false);
  assert.equal(canStartPaybackFinalization(workspace, draft), true);
});
test("historical domain readiness does not manufacture a compliant review", () => {
  const historical = { required: false, scope: { status: "blocked" }, review: null };
  assert.equal(canStartPaybackFinalization(historical, draft), true);
  assert.equal(historical.review, null);
});
test("a retained payback review prevents shared-device empty-queue claims", () => {
  const keys = ["unrelated-user-key", "payback-review:actor:tournament:event"];
  const storage = { length: keys.length, key: index => keys[index] };
  assert.equal(countAppSessionStorageRecords(storage), 1);
});
