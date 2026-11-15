import test from 'node:test';
import assert from 'node:assert/strict';
import {isEventPrizeDeclarationRequest,isEventPrizeDeclarationWorkspace,isEventPrizeDeclarationSaved,isEventPrizeDeclarationRejected} from '../src/lib/api/event-prize-declaration.ts';
const tid='40000000-0000-4000-8000-000000000001',row='40000000-0000-4000-8000-000000000002',sid='40000000-0000-4000-8000-000000000003';
const schedule={kind:'regular-prize-cohort-5usd-v3',amountBasis:'total_award',expectedQualifierCount:4,sourceReference:'TEST ONLY explicit formula',roundingRule:'automatic-five-dollar-cohort-v3',cohorts:[{bandStart:1,bandEnd:1,weight:4},{bandStart:2,bandEnd:2,weight:3},{bandStart:3,bandEnd:4,weight:2}]};
const request={expectedVersion:0,expectedSettingsFingerprint:'a'.repeat(64),schedule,reason:'TEST ONLY declaration',reviewed:true};
test('new event declaration requires an explicit current settings pin and reviewed five-dollar formula',()=>{
 assert.equal(isEventPrizeDeclarationRequest(request),true);
 for(const v of [{...request,expectedSettingsFingerprint:undefined},{...request,expectedSettingsFingerprint:'latest'},{...request,reviewed:false},{...request,reason:' '},{...request,expectedVersion:257},{...request,eventId:row},{...request,schedule:{...schedule,roundingRule:'floor_each_weighted_share_then_assign_remainder_to_champion'}}])assert.equal(isEventPrizeDeclarationRequest(v),false);
});
test('declaration workspace preserves scope and cannot claim accounting completion',()=>{
 const w={tournamentId:tid,clientRowId:row,currentVersion:0,supported:true,settingsCurrent:false,settings:{eventKind:'consolation'},settingsFingerprint:'a'.repeat(64),schedule:null,scheduleId:null,accountingReady:false,limitation:'Declaration only'};
 assert.equal(isEventPrizeDeclarationWorkspace(w,tid,row),true);
 for(const v of [{...w,tournamentId:row},{...w,accountingReady:true},{...w,settingsCurrent:true},{...w,currentVersion:1},{...w,ledger:[]}])assert.equal(isEventPrizeDeclarationWorkspace(v,tid,row),false);
 assert.equal(isEventPrizeDeclarationWorkspace({...w,currentVersion:1,settingsCurrent:true,schedule,scheduleId:sid},tid,row),true);
});
test('saved response must match exact scope/version; unknown success and rejection states fail closed',()=>{
 const saved={status:'event_prize_declaration_saved_v2',tournamentId:tid,clientRowId:row,scheduleId:sid,version:1,accountingReady:false};
 assert.equal(isEventPrizeDeclarationSaved(saved,tid,row,request),true);
 for(const v of [{...saved,version:2},{...saved,clientRowId:tid},{...saved,accountingReady:true},{...saved,payoutsRecorded:true}])assert.equal(isEventPrizeDeclarationSaved(v,tid,row,request),false);
 assert.equal(isEventPrizeDeclarationRejected({status:'rejected',code:'stale_settings'}),true);
 assert.equal(isEventPrizeDeclarationRejected({status:'rejected',code:'ignored'}),false);
});
