import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountingEntryForSchedule, getAccountingEntry} from '../src/lib/api/accounting-entry.ts';
import {membership, tid, eid, id} from './fixtures/no-q-accounting-v7-workspace.mjs';
import {qSide, sideOnly, makePendingSideReviewFixture} from './fixtures/prize-accounting-v9-workspace.mjs';
import {makePrizeAccountingV8Fixture} from './fixtures/prize-accounting-v8-workspace.mjs';
const noSide={...makePrizeAccountingV8Fixture({fresh:true}).workspace,sideReviews:[],blockers:['unsupported_side_scope']};
noSide.facts={...noSide.facts,sideIncomeMinor:0};
const current={tournamentId:tid,clientRowId:id(71),currentVersion:1,activated:true,eventId:eid,settingsCurrent:true,
 versions:[{scheduleId:qSide.regularRule.scheduleVersionId,version:1,recordedAt:'2026-10-30T00:00:00Z',reason:'TEST ONLY current declaration',schedule:qSide.regularRule.rule}]};
const choose=(workspace,schedules=[current],m=membership)=>accountingEntryForSchedule(m,schedules,tid,eid,workspace);
test('current accounting selects canonical Side V9 including Side-only and pending/retired history',()=>{
 for(const w of[qSide,sideOnly,makePendingSideReviewFixture()])assert.equal(choose(w),'prize-accounting-v9');
 // Canonical reviews preserve retired definitions, unlike the active Side workspace.
 const retired=makePendingSideReviewFixture();retired.blockers.push('side_source_blocked');
 assert.equal(choose(retired),'prize-accounting-v9');
 assert.equal(choose(noSide),'prize-accounting-v8');
});
test('current navigation fails closed on unavailable, foreign, stale or ambiguous sources',()=>{
 for(const w of[null,{}, {...qSide,eventId:id(99)}, {...qSide,tournamentId:id(99)}, {...qSide,sideReviews:[...qSide.sideReviews,...qSide.sideReviews]}, {...qSide,regularRule:null}, {...qSide,regularRule:{...qSide.regularRule,scheduleVersionId:id(99)}}])assert.equal(choose(w),null);
 for(const s of[null,[current,current],[{...current,settingsCurrent:false}],[{...current,tournamentId:id(99)}]])assert.equal(choose(qSide,s),null);
 assert.equal(choose(qSide,[current],null),null);
});
test('missing declarations preserve historical routes without invented current adoption',()=>{
 for(const schedules of[[],[{...current,currentVersion:0,versions:[]}],[{...current,eventId:id(99)}]])assert.equal(choose(null,schedules),'no-q-accounting-v7');
 const q={...membership,supported:true,blockedReason:null,pools:[{poolVersionId:id(70),slot:1,name:'TEST Q',feeMinor:500}]};
 assert.equal(choose(null,[],q),'q-accounting-v6');
});
test('scoped read uses server canonical history and never treats failed reads as no Side',async()=>{
 const calls=[];const rpc={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='get_q_pool_membership_workspace_v1'?membership:qSide,error:null};}};
 assert.equal(await getAccountingEntry(rpc,id(1),tid,eid,[current]),'prize-accounting-v9');
 assert.deepEqual(calls,[{name:'get_q_pool_membership_workspace_v1',args:{p_actor_id:id(1),p_tournament_id:tid}},{name:'get_prize_accounting_workspace_v9',args:{p_actor_id:id(1),p_tournament_id:tid,p_event_id:eid}}]);
 for(const result of[{data:null,error:Error('unavailable')},{data:null,error:null}])assert.equal(await getAccountingEntry({rpc:async n=>n==='get_q_pool_membership_workspace_v1'?{data:membership,error:null}:result},id(1),tid,eid,[current]),null);
});
test('shared playoff and settlement entrypoints consume selector; Q review retains wrapper and Side retains V9',()=>{
 const root='src/app/tournament/[tournamentId]/events/[eventId]/';
 const settlement=readFileSync(root+'settlement/page.tsx','utf8');
 assert.match(settlement,/accountingEntry === "prize-accounting-v8" \|\| accountingEntry === "prize-accounting-v9"/);
 assert.match(settlement,/if \(accountingEntry\) redirect/);
 assert.match(readFileSync(root+'playoff-v4/page.tsx','utf8'),/await getAccountingEntry/);
});
