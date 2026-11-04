import test from "node:test";
import assert from "node:assert/strict";
import { isMultiEventSimulationAction as valid, isAcceptedSimulationResult as accepted } from "../src/lib/api/multi-event-simulation-action.ts";

const ids = ["10000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000002", "10000000-0000-0000-0000-000000000003", "10000000-0000-0000-0000-000000000004"];
const reason = "TEST ONLY SYNTHETIC: fixture";
const disclose = { action: "disclose", operationId: ids[0], eventId: ids[1], request: { kind: "side", poolDefinitionId: ids[2], method: "graduated-acc-weighted-largest-remainder-5usd-v2", ratio: 4, disclosureReference: reason, disclosed: true } };
const election = { action: "election", operationId: ids[0], eventId: ids[1], request: { policyId: ids[2], participantId: ids[3], expectedVersion: 0, elected: true, reason, reviewed: true } };
const receipt = { action: "receipt", operationId: ids[0], request: { rosterEntryId: ids[1], amountMinor: 6000, events: [{ eventId: ids[2], baseMinor: 5000, q: [{ policyId: ids[0], electionId: ids[3], amountMinor: 1000 }], side: [] }], reason, reviewed: true } };
const expense = { action: "expense", operationId: ids[0], request: { kind: "expense", rosterEntryId: null, amountMinor: 1000, allocations: [{ eventId: ids[1], amountMinor: 1000 }], reason, reviewed: true } };
const classify = { action: "classify", operationId: ids[0], eventId: ids[1], request: { expectedVersion: 0, sourceDigest: "a".repeat(64), classifications: [{ sourceId: ids[2], category: "sanctioning", amountMinor: 1000 }], reason, reviewed: true } };

test("bounded synthetic actions accept supported policy, election, conserved receipt and expense paths", () => {
  for (const value of [disclose, election, receipt, expense, classify]) assert.equal(valid(value), true);
});
test("actor injection, unsupported Side method, absent attestations and altered money fail closed", () => {
  assert.equal(valid({ ...disclose, actor: ids[3] }), false);
  assert.equal(valid({ ...disclose, request: { ...disclose.request, method: "equal-paid-playoff-qualifiers-v2", ratio: null } }), false);
  assert.equal(valid({ ...election, request: { ...election.request, reviewed: false } }), false);
  assert.equal(valid({ ...expense, request: { ...expense.request, reason: "real funds" } }), false);
  assert.equal(valid({ ...receipt, request: { ...receipt.request, amountMinor: 6100 } }), false);
  assert.equal(valid({ ...classify, request: { ...classify.request, sourceDigest: "stale" } }), false);
});
test("duplicate event or policy lines and unsupported actions cannot be sent", () => {
  assert.equal(valid({ ...receipt, request: { ...receipt.request, events: [...receipt.request.events, receipt.request.events[0]], amountMinor: 12000 } }), false);
  assert.equal(valid({ ...expense, action: "reverse" }), false);
  assert.equal(valid({ ...classify, request: { ...classify.request, classifications: [...classify.request.classifications, ...classify.request.classifications] } }), false);
});
test("only an exact accepted response permits the retained action to clear",()=>{
 const response={status:"synthetic_pool_policy_disclosed",eventId:ids[1],kind:"side",poolDefinitionId:ids[2],policyId:ids[3],moneyMoved:false,humanConsentClaimed:false};
 assert.equal(accepted(response,disclose),true);
 assert.equal(accepted({...response,poolDefinitionId:ids[0]},disclose),false);
 assert.equal(accepted({...response,moneyMoved:true},disclose),false);
 assert.equal(accepted({status:"anything"},disclose),false);
});
