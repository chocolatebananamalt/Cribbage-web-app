import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveOddFieldMakeupPlan } from '../src/lib/results/odd-field-makeup.ts';

// Local fictional circle schedule; ghost18 creates one distinct sit-out per
// regular round. The helper does not prescribe this rotation to directors.
import { oddFieldFixture } from './fixtures/odd-field-makeup.mjs';
import {isOddFieldMakeupRequest,isOddFieldMakeupResult,isOddFieldMakeupWorkspace,isGameScorecardNumbers}from'../src/lib/api/odd-field-makeup.ts';
import {makeSeventeenMainFixture}from'./fixtures/seventeen-main-foundation.mjs';
import {isMyGamesWorkspace}from'../src/lib/games/my-games-decision.ts';
import {decideAssignedGameContextRead}from'../src/lib/games/assigned-game-context-decision.ts';
test('odd seventeen-player makeup pairs twelve distinct sit-outs and preserves original card lines',()=>{
  const f=oddFieldFixture(), before=JSON.stringify(f);
  const p=deriveOddFieldMakeupPlan(f.regularMatches,f.verificationIds,f.makeupSeats,5,4);
  assert.equal(JSON.stringify(f),before); assert.equal(p.makeupMatches.length,6);
  assert.deepEqual(p.makeupMatches.map(m=>[m.sideACardGameNumber,m.sideBCardGameNumber]),[[1,12],[2,11],[3,10],[4,9],[5,8],[6,7]]);
  const counts=new Map(f.verificationIds.map(id=>[id,0]));
  for(const m of [...f.regularMatches,...p.makeupMatches])for(const id of[m.sideAVerificationId,m.sideBVerificationId])counts.set(id,counts.get(id)+1);
  assert.equal([...f.regularMatches,...p.makeupMatches].length,102);
  assert.deepEqual([...counts.values()],Array(17).fill(12));
  assert.ok(p.makeupMatches.every(m=>m.gameNumber===13));
  assert.equal(p.qualifyingGameCount,12);
  for(const id of f.verificationIds){
    const positions=new Set(f.regularMatches.flatMap(m=>m.sideAVerificationId===id?[m.sideATableSeat]:m.sideBVerificationId===id?[m.sideBTableSeat]:[]));
    assert.ok(positions.size>1,`${id} must not be a stationary anchor`);
  }
});
test('incomplete, repeated sit-outs and conflicting/out-of-plan makeup seats block',()=>{
  const f=oddFieldFixture(), derive=(r=f.regularMatches,s=f.makeupSeats,ids=f.verificationIds)=>deriveOddFieldMakeupPlan(r,ids,s,5,4);
  assert.throws(()=>derive(f.regularMatches.slice(1)));
  assert.throws(()=>derive([...f.regularMatches.filter(m=>m.gameNumber!==2),...f.regularMatches.filter(m=>m.gameNumber===1).map(m=>({...m,gameNumber:2}))]));
  assert.throws(()=>derive(f.regularMatches,[...f.makeupSeats.slice(0,5),f.makeupSeats[0]]));
  assert.throws(()=>derive(f.regularMatches,f.makeupSeats.map((s,i)=>i? s:{...s,sideBTableSeat:'B-2'})));
  assert.throws(()=>derive(f.regularMatches,f.makeupSeats.map((s,i)=>i? s:{...s,sideBTableSeat:'A-5'})));
  assert.throws(()=>derive(f.regularMatches,f.makeupSeats,f.verificationIds.slice(1)));
  assert.throws(()=>derive(f.regularMatches.map((m,i)=>i?m:{...m,unexpected:true})));
  const anchored=f.regularMatches.map((m,i)=>{const seat=(i%8)*2,table=String.fromCharCode(65+Math.floor(seat/4));
    return{...m,sideATableSeat:`${table}-${seat%4+1}`,sideBTableSeat:`${table}-${seat%4+2}`};});
  assert.throws(()=>derive(anchored),/zero-anchor/);
});
test('strict makeup API binds exact shapes and unique original card lines',()=>{
 const f=makeSeventeenMainFixture(),id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 assert.equal(isOddFieldMakeupRequest(f.request),true);
 for(const request of[{...f.request,anchorCount:1},{...f.request,reviewed:false},{...f.request,unexpected:true},
   {...f.request,regularMatches:f.request.regularMatches.slice(1)},{...f.request,reason:'\nunsafe'}])assert.equal(isOddFieldMakeupRequest(request),false);
 const result={status:'odd_field_schedule_published',eventId:f.eid,publicationId:id(1),gameCount:12,participantCount:17,regularMatchCount:96,makeupMatchCount:6,matchCount:102};
 assert.equal(isOddFieldMakeupResult(result,f.eid),true);assert.equal(isOddFieldMakeupResult({...result,gameCount:13},f.eid),false);
 assert.equal(isOddFieldMakeupResult(result,id(999)),false);
 const workspace={tournamentId:f.tid,eventId:f.eid,current:true,policyVersion:'acc-director-manual-2019-12b-even-game-makeup-v1',qualifyingGameCount:12,makeupBatchNumber:13,
  makeups:Array.from({length:6},(_,i)=>({canonicalGameId:id(i+10),publicationId:id(1),sideACardGameNumber:i+1,sideBCardGameNumber:12-i,reason:'Reviewed local fiction',recordedAt:'2026-10-30T00:00:00Z',actorId:f.actor}))};
 assert.equal(isOddFieldMakeupWorkspace(workspace,f.tid,f.eid),true);
 assert.equal(isOddFieldMakeupWorkspace({...workspace,makeups:Array(6).fill(workspace.makeups[0])},f.tid,f.eid),false);
 assert.equal(isOddFieldMakeupWorkspace({...workspace,makeups:[]},f.tid,f.eid),false);
 assert.equal(isOddFieldMakeupWorkspace({...workspace,current:false,makeups:[]},f.tid,f.eid),true);
 const numbers={gameId:id(10),eventId:f.eid,schedulingBatchNumber:13,sideACardGameNumber:1,sideBCardGameNumber:12,isMakeup:true};
 assert.equal(isGameScorecardNumbers(numbers,id(10)),true);assert.equal(isGameScorecardNumbers({...numbers,sideBCardGameNumber:13},id(10)),false);
 assert.equal(isGameScorecardNumbers({...numbers,isMakeup:false,sideACardGameNumber:13,sideBCardGameNumber:13},id(10)),true);
});
test('separate no-Q fixture has no policy/election/allocation writers and preserves actual 102-game scoring',()=>{
 const q=makeSeventeenMainFixture(),noQ=makeSeventeenMainFixture({withQ:false});
 assert.notEqual(q.tid,noQ.tid);assert.notEqual(q.uid(1),noQ.uid(1));
 assert.doesNotMatch(noQ.setupSql,/insert into app\.tournament_setup_q_pool_versions|save_q_operating_policy_v2/);
 assert.doesNotMatch(noQ.financeSql,/save_q_pool_membership_v1|q_pool_membership_versions_v1|q_pool_payment/);
 assert.equal((noQ.financeSql.match(/public.record_manual_roster_payment\(/g)||[]).length,17);
 assert.equal((noQ.scoreSql.match(/public.submit_game_score\(/g)||[]).length,204);
 assert.equal((noQ.scoreSql.match(/public.confirm_game_score\(/g)||[]).length,204);
 assert.doesNotMatch(noQ.scoreSql,/insert into app\.(?:canonical_games|card_scorelines|score_submissions|score_confirmations)/);
 assert.deepEqual(noQ.expected.slice(0,5).map(r=>r.number),[2,1,3,4,5]);assert.ok(noQ.expected.every(r=>r.verifiedGames===12));
 assert.ok(noQ.expected.slice(0,3).every(r=>r.gamePoints>=14));
});
test('new assigned makeup context is exact-source bound while ordinary game thirteen remains a legacy shape',()=>{
 const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,tid=id(1),gid=id(2),eid=id(3);
 const numbers={gameId:gid,eventId:eid,schedulingBatchNumber:13,sideACardGameNumber:1,sideBCardGameNumber:12,isMakeup:true};
 const summary={gameId:gid,eventId:eid,eventName:'Main',gameNumber:13,matchInstance:1,state:'pending',playerSide:'a',
  playerTableSeat:'A-1',playerVerificationId:'B-1',opponentName:'Opponent',opponentTableSeat:'A-2',opponentVerificationId:'D-1',
  ownSubmitted:false,ownConfirmed:false,canConfirm:false,progressionStatus:'current',nextAction:'enter_result'};
 const ws={tournamentId:tid,tournamentName:'Fictional',tournamentDate:'10-30-2026',games:[summary]};
 assert.equal(isMyGamesWorkspace(ws,tid),true);
 assert.equal(isMyGamesWorkspace({...ws,games:[{...summary,cardNumbers:numbers}]},tid),true);
 for(const n of[null,{...numbers,gameId:id(9)},{...numbers,eventId:id(9)},{...numbers,schedulingBatchNumber:12},{...numbers,extra:true}])
  assert.equal(isMyGamesWorkspace({...ws,games:[{...summary,cardNumbers:n}]},tid),false);
 const context={actorId:id(4),gameId:gid,tournamentId:tid,eventId:eid,roundNumber:13,matchInstance:1,state:'pending',eventName:'Main',ownSubmission:null,
  ownConfirmed:false,canConfirm:false,progressionStatus:'current',canEnter:true,
  player:{displayName:'Player',side:'a',tableSeat:'A-1',verificationId:'B-1'},opponent:{displayName:'Opponent',side:'b',tableSeat:'A-2',verificationId:'D-1'}};
 assert.equal(decideAssignedGameContextRead({data:context,error:null,tournamentId:tid}),'available');
 assert.equal(decideAssignedGameContextRead({data:{...context,cardNumbers:numbers},error:null,tournamentId:tid}),'available');
 assert.equal(decideAssignedGameContextRead({data:{...context,cardNumbers:null},error:null,tournamentId:tid}),'unavailable');
 assert.equal(decideAssignedGameContextRead({data:{...context,cardNumbers:{...numbers,eventId:id(9)}},error:null,tournamentId:tid}),'unavailable');
});
test('five-qualifier residual tie fixture changes only actual winning margins and leaves exactly one two-card group',()=>{
 const base=makeSeventeenMainFixture({withQ:false}),tie=makeSeventeenMainFixture({withQ:false,topSeedTie:true});
 assert.notEqual(base.tid,tie.tid);assert.notEqual(base.uid(1),tie.uid(1));
 assert.equal(tie.tid,'b5610000-0000-4000-8000-000000000001');
 assert.equal(tie.matches.length,102);
 for(let i=0;i<102;i++){const a=base.matches[i],b=tie.matches[i];assert.equal(a.a,b.a);assert.equal(a.b,b.b);assert.equal(a.winner,b.winner);
  assert.equal(b.margin,[1,2].includes(b.winner)?10:a.margin);}
 const groups=new Map();for(const r of tie.expected){const key=[r.gamePoints,r.gamesWon,r.plusPoints-r.minusPoints,r.plusPoints].join(':');groups.set(key,[...(groups.get(key)||[]),r.number]);}
 assert.deepEqual([...groups.values()].filter(g=>g.length>1),[[1,2]]);
 assert.deepEqual(tie.expected.filter(r=>[1,2].includes(r.number)).map(r=>[r.gamePoints,r.gamesWon,r.plusPoints,r.minusPoints]),[[24,12,120,0],[24,12,120,0]]);
 assert.ok(tie.expected.every(r=>r.verifiedGames===12));
 assert.doesNotMatch(tie.setupSql,/save_q_operating_policy_v2|insert into app\.tournament_setup_q_pool_versions/);
 assert.throws(()=>makeSeventeenMainFixture({topSeedTie:true}),/no-Q only/);
});
