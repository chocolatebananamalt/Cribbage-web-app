// Fictional browser states only. No receipt here asserts actual money received.
import assert from 'node:assert/strict';
import {makePrizeAccountingV8Fixture,tid,eid,actor,id,digest}from'./prize-accounting-v8-workspace.mjs';
import{isPrizeAccountingWorkspaceV8}from'../../src/lib/api/prize-accounting-v8.ts';
import{isPrizeScheduleWorkspace}from'../../src/lib/api/prize-schedule.ts';
import{rule as historicalRule}from'./no-q-accounting-v7-workspace.mjs';
export{tid,eid,actor,id,digest};
export const up=makePrizeAccountingV8Fixture(),down=makePrizeAccountingV8Fixture({down:true});
export const row=id(90);
export const setupEmpty={tournamentId:tid,clientRowId:row,currentVersion:0,activated:false,eventId:null,settingsCurrent:true,versions:[]};
const version=schedule=>({scheduleId:id(91),version:1,schedule,reason:'TEST ONLY previously saved schedule',recordedAt:'2026-10-30T07:00:00.000Z'});
export const setupV3={...setupEmpty,currentVersion:1,activated:true,eventId:eid,versions:[version(up.workspace.regularRule.rule)]};
export const setupHistorical={...setupV3,versions:[version(historicalRule)]};
export function fundingRecord({version,amountMinor,eventType='received',voidsId=null,recordId=id(60+version)}){
 return{id:recordId,version,eventType,amountMinor,receivedAt:eventType==='received'?'2026-10-30T07:00:00.000Z':null,evidenceReference:eventType==='received'?`TEST ONLY fictional cover evidence${version}`:'',reason:'TEST ONLY synthetic audit record; no transfer/refund',voidsId,sourceDigest:digest,recordedAt:`2026-10-30T07:0${version}:00.000Z`};
}
export function addFunding(current,amountMinor){
 const next=structuredClone(current),version=next.funding.version+1;
 next.funding.records.push(fundingRecord({version,amountMinor}));next.funding.version=version;
 next.funding.receivedMinor+=amountMinor;next.funding.shortfallMinor=Math.max(0,next.funding.requiredMinor-next.funding.receivedMinor);next.funding.unallocatedMinor=Math.max(0,next.funding.receivedMinor-next.funding.requiredMinor);
 assert.ok(isPrizeAccountingWorkspaceV8(next,tid,eid));return next;
}
export function voidFunding(current,voidsId){
 const next=structuredClone(current),original=next.funding.records.find(r=>r.id===voidsId&&r.eventType==='received');assert.ok(original);
 const version=next.funding.version+1;next.funding.records.push(fundingRecord({version,amountMinor:original.amountMinor,eventType:'voided',voidsId}));next.funding.version=version;
 next.funding.receivedMinor-=original.amountMinor;next.funding.shortfallMinor=Math.max(0,next.funding.requiredMinor-next.funding.receivedMinor);next.funding.unallocatedMinor=Math.max(0,next.funding.receivedMinor-next.funding.requiredMinor);
 assert.ok(isPrizeAccountingWorkspaceV8(next,tid,eid));return next;
}
export function finalize(current){
 const next=structuredClone(current);next.currentFinalVersion=1;next.finalization={id:id(52),version:1,draftId:next.draft.id,draftVersion:next.draft.version,sourceDigest:digest,current:true,status:'unpaid',fundingVersion:next.funding.version,restrictedBalanceMinor:next.draft.rounding.restrictedBalanceMinor,fundingReceivedMinor:next.funding.receivedMinor};
 assert.ok(isPrizeAccountingWorkspaceV8(next,tid,eid));return next;
}
export function validateBrowserFixtures(){
 for(const f of[up,down])for(const w of[f.workspace,f.withDraft,f.funded,f.finalized])assert.ok(isPrizeAccountingWorkspaceV8(w,tid,eid));
 for(const w of[setupEmpty,setupV3,setupHistorical])assert.ok(isPrizeScheduleWorkspace(w,tid,row));
 const partial=addFunding(up.withDraft,200),funded=addFunding(partial,250),voided=voidFunding(funded,funded.funding.records[0].id);
 assert.equal(partial.funding.shortfallMinor,250);assert.equal(funded.funding.shortfallMinor,0);assert.equal(voided.funding.shortfallMinor,200);finalize(funded);finalize(down.withDraft);
 return{upOriginal:up.withDraft.draft.rounding.originalBudgetMinor,upRounded:up.withDraft.draft.rounding.roundedBudgetMinor,upCover:450,downHold:50};
}
