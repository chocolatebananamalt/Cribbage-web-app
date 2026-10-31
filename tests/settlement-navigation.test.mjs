import test from "node:test";
import assert from "node:assert/strict";
import { settlementEntryRoute, boundScheduleReference } from "../src/lib/results/settlement-navigation.ts";

const fresh = {hasVersionedDraft:false,hasCanonicalOutcome:false,currentStructuredSchedule:true,legacyReadAvailable:true,hasLegacyHistory:false};
test("new structured events enter canonical playoffs without reclassifying legacy history",()=>{
  assert.equal(settlementEntryRoute(fresh),"playoff-outcomes");
  for(const change of [{currentStructuredSchedule:false},{legacyReadAvailable:false},{hasLegacyHistory:true}])assert.equal(settlementEntryRoute({...fresh,...change}),"settlement");
  for(const change of [{hasVersionedDraft:true},{hasCanonicalOutcome:true}])assert.equal(settlementEntryRoute({...fresh,...change}),"settlement-v5");
});
test("payback source reference comes from exact draft-bound version",()=>{
  const schedules=[{eventId:"event",versions:[{scheduleId:"new",schedule:{sourceReference:"New rule"}},{scheduleId:"old",schedule:{sourceReference:"Exact saved rule"}}]}];
  assert.equal(boundScheduleReference(schedules,"event","old"),"Exact saved rule");
  assert.equal(boundScheduleReference(schedules,"event","missing"),undefined);
  assert.equal(boundScheduleReference(schedules,"other","old"),undefined);
  assert.equal(boundScheduleReference(null,"event","old"),undefined);
  assert.equal(boundScheduleReference(schedules,"event"),undefined);
});
