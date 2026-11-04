import assert from 'node:assert/strict';
import test from 'node:test';
import {scorecardPresentationRows,scorecardPlayerName,currentScorecardAssignment} from '../src/lib/games/scorecard-presentation.ts';

const eventId='30000000-0000-4000-8000-000000000003';
const card=()=>({tournamentId:'10000000-0000-4000-8000-000000000001',eventId,tournamentName:'Fictional Test',eventName:'Main',player:{displayName:'Sample Self',verificationId:'A-1'},lines:[{roundNumber:1,matchInstance:1,gamePoints:2,plusPoints:20,minusPoints:0,opponentName:'Original Opponent',opponentVerificationId:'A-2'}],totals:{gamePoints:2,plusPoints:20,minusPoints:0,gamesWon:1,netSpreadPoints:20},pendingGames:[{roundNumber:2,matchInstance:1,state:'submitted'}]});
const game=(overrides={})=>({gameId:'20000000-0000-4000-8000-000000000002',eventId,eventName:'Main',gameNumber:2,matchInstance:1,state:'submitted',playerSide:'a',playerTableSeat:'B-1',playerVerificationId:'A-1',opponentName:'Pending Opponent',opponentTableSeat:'B-2',opponentVerificationId:'C-2',ownSubmitted:true,ownConfirmed:false,canConfirm:false,progressionStatus:'current',nextAction:'wait_opponent_entry',...overrides});

test('scheduled and pending rows never acquire game points or spread points before scorecard authority',()=>{
  const source=card();source.pendingGames.push({roundNumber:3,matchInstance:1,state:'pending'});const before=structuredClone(source);
  const rows=scorecardPresentationRows(source,[game(),game({gameNumber:3,progressionStatus:'upcoming',state:'pending',nextAction:'upcoming_locked'})]);
  assert.equal(rows.length,3);assert.equal(rows[0].gamePoints,2);assert.equal(rows[0].plusPoints,20);
  assert.equal(rows[1].opponentName,'Pending Opponent');assert.equal(rows[1].gamePoints,null);assert.equal(rows[1].plusPoints,null);assert.equal(rows[1].minusPoints,null);
  assert.equal(rows[1].resultStatus,'Waiting for the other entry');assert.equal(rows[2].resultStatus,'No verified result');
  assert.deepEqual(source,before);
});

test('authoritative corrected opponent and score values win over a stale assignment without duplication',()=>{
  const source=card();
  const rows=scorecardPresentationRows(source,[game({gameNumber:1,opponentName:'Different current name',opponentVerificationId:'B-4',state:'corrected',progressionStatus:'completed',nextAction:'view_scorecard'})]);
  assert.equal(rows.length,2);assert.equal(rows[0].opponentName,'Original Opponent');assert.equal(rows[0].opponentVerificationId,'A-2');assert.equal(rows[0].gamePoints,2);
  assert.deepEqual(source.totals,{gamePoints:2,plusPoints:20,minusPoints:0,gamesWon:1,netSpreadPoints:20});
});

test('only this event and fixed player ID enrich rows; missing schedule retains truthful pending placeholder',()=>{
  const source=card();
  for(const assignment of [game({eventId:'40000000-0000-4000-8000-000000000004'}),game({playerVerificationId:'D-1'})]){
    const rows=scorecardPresentationRows(source,[assignment]);assert.equal(rows.length,2);assert.equal(rows[1].opponentName,null);assert.equal(rows[1].gamePoints,null);
  }
  assert.equal(scorecardPresentationRows(source)[1].resultStatus,'Waiting for the other entry');
});

test('makeup scheduling batch 13 maps to each player own card number, not the first actual played-game assumption',()=>{
  const source={...card(),lines:[],pendingGames:[{roundNumber:2,matchInstance:1,state:'submitted'},{roundNumber:11,matchInstance:1,state:'pending'}]};
  const numbers={gameId:game().gameId,eventId,schedulingBatchNumber:13,sideACardGameNumber:2,sideBCardGameNumber:11,isMakeup:true};
  const sideA=scorecardPresentationRows(source,[game({gameNumber:13,playerSide:'a',cardNumbers:numbers})]);
  const sideB=scorecardPresentationRows(source,[game({gameNumber:13,playerSide:'b',cardNumbers:numbers})]);
  assert.equal(sideA.find(row=>row.roundNumber===2).opponentName,'Pending Opponent');
  assert.equal(sideB.find(row=>row.roundNumber===11).opponentName,'Pending Opponent');
  assert.equal(sideA.length,2);assert.equal(sideB.length,2);
});

test('assignment absent from card reader invents neither row nor result; historical repeated match rows stay separate',()=>{
  const source={...card(),pendingGames:[]};
  source.lines.push({...source.lines[0],matchInstance:2,gamePoints:0,plusPoints:0,minusPoints:15});
  const rows=scorecardPresentationRows(source,[game({state:'verified',progressionStatus:'completed',nextAction:'view_scorecard'})]);
  assert.equal(rows.length,2);assert.equal(rows[1].matchInstance,2);assert.equal(rows[1].minusPoints,15);
});

test('legacy makeup payload lacking card numbers adds no Game13 and ambiguous enrichment stays blank',()=>{
  const source={...card(),lines:[],pendingGames:[{roundNumber:2,matchInstance:1,state:'pending'},{roundNumber:2,matchInstance:1,state:'pending'}]};
  const rows=scorecardPresentationRows(source,[game({gameNumber:13})]);
  assert.equal(rows.length,1);assert.equal(rows[0].roundNumber,2);assert.equal(rows[0].opponentName,null);
  const ambiguous=scorecardPresentationRows(source,[game(),game({opponentName:'Different pending opponent'})]);
  assert.equal(ambiguous.length,1);assert.equal(ambiguous[0].opponentName,null);
});

test('ACC number is displayed only if real optional metadata is provided and valid; no placeholder or inferred number',()=>{
  assert.equal(scorecardPlayerName(card().player),'Sample Self');
  assert.equal(scorecardPlayerName({...card().player,accNumber:'HI296Y'}),'Sample Self (HI296Y)');
  for(const accNumber of[null,'','DEMO-001','hi296','HI 296',53])assert.equal(scorecardPlayerName({...card().player,accNumber}),'Sample Self');
});

test('current action is actor/event specific and not manufactured after completion, before start or from ambiguous results',()=>{
  assert.equal(currentScorecardAssignment(card(),[game()]).gameId,game().gameId);
  for(const assignment of [game({progressionStatus:'completed',nextAction:'view_scorecard'}),game({progressionStatus:'upcoming',nextAction:'upcoming_locked'}),game({progressionStatus:'not_started',nextAction:'event_not_started'}),game({eventId:'40000000-0000-4000-8000-000000000004'}),game({playerVerificationId:'A-2'})])assert.equal(currentScorecardAssignment(card(),[assignment]),null);
  assert.equal(currentScorecardAssignment(card(),[game(),game({gameId:'20000000-0000-4000-8000-000000000009'})]),null);
  assert.equal(currentScorecardAssignment(card(),[]),null);
});
