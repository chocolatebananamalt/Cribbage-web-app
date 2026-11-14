import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildAnswerKey,validateDraw,reconcileFunds,csvCell,inputTemplate,oracleVersion,rankKnownCards} from '../scripts/mock-trial-oracle.mjs';
// Anonymous in-memory manual seat mapping only; no tournament/DB records.
function anonymousInput(){
 const roster=Array.from({length:18},(_,i)=>({participantId:`p${i+1}`,tournamentId:`A-${i+1}`,displayName:`Anonymous ${i+1}`,mode:i<6?'digital':'paper',fictional:i>=6}));
 const next=[0,1,3,5,2,7,4,9,6,11,8,13,10,15,12,17,14,18,16],games=[];let positions=Array.from({length:18},(_,i)=>i+1);
 for(let round=1;round<=12;round++){for(let n=1;n<=17;n+=2)games.push({gameId:`g-${round}-${n}`,round,sides:[{participantId:`p${positions.indexOf(n)+1}`,currentSeat:`A-${n}`},{participantId:`p${positions.indexOf(n+1)+1}`,currentSeat:`A-${n+1}`}]});positions=positions.map(n=>next[n]);}
 return {version:'mock-trial-oracle-input-v1',seed:'anonymous-in-memory-test-seed',draw:{anchor:{participantId:'p1',seatId:'A-1'},roster,games},digitalResults:[],funds:[]};
}
const copy=v=>JSON.parse(JSON.stringify(v));
test('blank template contains no roster, draw, prescribed winners or financial records',()=>{assert.equal(inputTemplate.draw,null);assert.deepEqual(inputTemplate.digitalResults,[]);assert.deepEqual(inputTemplate.funds,[]);assert(Object.isFrozen(inputTemplate));assert.throws(()=>buildAnswerKey(inputTemplate),/invalid_draw_shape/);});
test('independent actual-draw validation checks full physical schedule and rejects altered occupancy/IDs',()=>{
 const input=anonymousInput(),before=JSON.stringify(input);assert.equal(validateDraw(input.draw).games.length,108);assert.equal(JSON.stringify(input),before);
 for(const mutate of [i=>i.draw.games.pop(),i=>i.draw.games[1].gameId=i.draw.games[0].gameId,i=>i.draw.roster[0].fictional=true,i=>i.draw.anchor.seatId='A-2',i=>i.draw.roster[3].tournamentId='A-20',i=>i.draw.games[9].sides.reverse()&&([i.draw.games[9].sides[0].participantId,i.draw.games[9].sides[1].participantId]=[i.draw.games[9].sides[1].participantId,i.draw.games[9].sides[0].participantId])]){const bad=copy(input);mutate(bad);assert.throws(()=>validateDraw(bad.draw));}
});
test('PP/PD scripts deterministic; missing DD remains blank and cannot finalize qualification',()=>{
 const input=anonymousInput(),key=buildAnswerKey(input);assert.equal(key.paperCards.length,12);assert(key.digitalDigitalLog.length>0);assert(key.digitalDigitalLog.every(g=>g.winnerId===null&&g.status==='pending'));
 assert(key.syntheticGamePlan.every(g=>!key.digitalDigitalLog.some(d=>d.gameId===g.gameId)));
 assert(key.paperCards.every(c=>c.rows.length===12&&c.rows.every(r=>r.synthetic)&&c.totals.pendingGames===0));assert.equal(key.paperCards.flatMap(c=>c.rows).length,144);
 assert.equal(key.completion.all108ResultsKnown,false);assert.equal(key.standings.qualification.qualifierIds,null);assert.equal(key.standings.qualification.status,'pending-digital-results');assert.equal(key.reconciliation.netSpreadPoints,0);assert.equal(key.funds.status,'not-configured');assert.equal(key.appComparison.status,'not-compared');
 const x=key.digitalDigitalLog.length,pd=key.syntheticGamePlan.filter(g=>input.draw.games.find(d=>d.gameId===g.gameId).sides.some(s=>input.draw.roster.find(p=>p.participantId===s.participantId).mode==='digital')).length;assert.equal(pd,72-2*x);assert.equal(key.syntheticGamePlan.length-pd,36+x);
});
test('caller-supplied DD boundaries independently produce2/3 game points, loss0 and signed spread totals',()=>{
 const input=anonymousInput(),partial=buildAnswerKey(input),g=partial.digitalDigitalLog[0],winner=g.sides[0].participantId,loser=g.sides[1].participantId;
 for(const spreadPoints of [1,30,31,60,61,90,91,121]){
  const next=buildAnswerKey({...input,digitalResults:[{gameId:g.gameId,winnerId:winner,spreadPoints}]}),w=next.cards.find(c=>c.participantId===winner),l=next.cards.find(c=>c.participantId===loser),wr=w.rows.find(r=>r.gameId===g.gameId),lr=l.rows.find(r=>r.gameId===g.gameId);
  assert.equal(wr.gamePoints,spreadPoints>=31?3:2);assert.equal(lr.gamePoints,0);assert.equal(wr.plusPoints,spreadPoints);assert.equal(lr.minusPoints,spreadPoints);assert.equal(wr.signedSpreadPoints,spreadPoints);assert.equal(lr.signedSpreadPoints,-spreadPoints);assert.equal(next.reconciliation.netSpreadPoints,0);assert.equal(wr.humanPlayVerified,false);
  assert.equal(next.planHash,partial.planHash);assert.notEqual(next.resultHash,partial.resultHash);assert.deepEqual(next.syntheticGamePlan,partial.syntheticGamePlan);assert.deepEqual(next.paperCards.map(c=>c.cardHash),partial.paperCards.map(c=>c.cardHash));
 }
 for(const bad of [{gameId:g.gameId,winnerId:'unknown',spreadPoints:10},{gameId:g.gameId,winnerId:winner,spreadPoints:0},{gameId:g.gameId,winnerId:winner,spreadPoints:122},{gameId:g.gameId,winnerId:winner,spreadPoints:1.5},{gameId:partial.syntheticGamePlan[0].gameId,winnerId:winner,spreadPoints:10}])assert.throws(()=>buildAnswerKey({...input,digitalResults:[bad]}));
});
test('canonical source and script hashes ignore array ordering/names/DD/funds/export, but not seed/draw',()=>{
 const input=anonymousInput(),a=buildAnswerKey(input),changed=copy(input);changed.draw.roster.reverse();changed.draw.games.reverse();changed.draw.games.forEach(g=>g.sides.reverse());changed.draw.roster.forEach(p=>p.displayName='Different display');changed.appExport={games:[],totals:[]};
 const b=buildAnswerKey(changed);assert.equal(a.planHash,b.planHash);assert.equal(a.drawHash,b.drawHash);assert.deepEqual(a.paperCards.map(c=>c.cardHash),b.paperCards.map(c=>c.cardHash));assert.notEqual(a.inputHash,b.inputHash);
 assert.notEqual(a.planHash,buildAnswerKey({...input,seed:'a different explicit seed'}).planHash);
 const renamed=copy(input);renamed.draw.games[0].gameId='changed-game-identity';assert.notEqual(a.planHash,buildAnswerKey(renamed).planHash);
});
test('full caller-supplied DD completion conserves independent totals without claiming physical play or final approval',()=>{
 const input=anonymousInput(),partial=buildAnswerKey(input);input.digitalResults=partial.digitalDigitalLog.map((g,i)=>({gameId:g.gameId,winnerId:g.sides[i%2].participantId,spreadPoints:i%2?31:30}));const key=buildAnswerKey(input);
 assert.equal(key.completion.knownGameCount,108);assert.equal(key.completion.all108ResultsKnown,true);assert(key.cards.every(c=>c.totals.knownGames===12&&c.totals.pendingGames===0));assert.equal(key.reconciliation.expectedGamePoints,key.reconciliation.totalCardGamePoints);assert.equal(key.reconciliation.netSpreadPoints,0);assert.equal(key.standings.qualification.qualifierCount,5);assert.equal(key.claims.humanPlayVerified,false);assert.equal(key.claims.officialResultsApproved,false);assert(key.standings.groups.every(g=>!g.tied||g.resolutionRequired));
 assert.throws(()=>buildAnswerKey({...input,digitalResults:[...input.digitalResults,input.digitalResults[0]]}));
});
test('simulated fund reconciliation separates arithmetic/$5/method and never selects unresolved policy',()=>{
 const ids=new Set(['p1','p2']),fund={fundId:'q1',currency:'USD',method:'unspecified',incomes:[{id:'i1',fundId:'q1',kind:'simulated-contribution',contributorId:'p1',amountMinor:1000}],expenses:[],awards:[{id:'a1',fundId:'q1',recipientId:'p2',amountMinor:1000}],retainedMinor:0};
 const x=reconcileFunds([fund],ids).reports[0];assert.equal(x.balance,'balanced');assert.equal(x.policyStatus,'unresolved-not-approved');assert.equal(x.methodCompliance,null);assert.equal(x.actualPaid,false);
 const unequal={...fund,method:'equal',incomes:[{...fund.incomes[0],amountMinor:2000}],awards:[{...fund.awards[0],amountMinor:1500},{id:'a2',fundId:'q1',recipientId:'p1',amountMinor:500}]};const r=reconcileFunds([unequal],ids).reports[0];assert.equal(r.balance,'balanced');assert.equal(r.fiveDollarAwards,true);assert.equal(r.methodCompliance,false);
 for(const bad of [{...fund,incomes:[fund.incomes[0],fund.incomes[0]]},{...fund,incomes:[fund.incomes[0],{...fund.incomes[0],id:'different-line-same-contributor'}]},{...fund,awards:[{...fund.awards[0],fundId:'other'}]},{...fund,retainedMinor:-1},{...fund,incomes:[{...fund.incomes[0],amountMinor:Number.MAX_SAFE_INTEGER},{id:'extra',fundId:'q1',kind:'explicit-external',amountMinor:1}]}])assert.throws(()=>reconcileFunds([bad],ids));
 const input=anonymousInput(),a=buildAnswerKey(input),b=buildAnswerKey({...input,funds:[fund]});assert.equal(a.planHash,b.planHash);assert.deepEqual(a.paperCards.map(c=>c.cardHash),b.paperCards.map(c=>c.cardHash));
});
test('optional export comparison requires exact source identity then detectsmissing/duplicate/mismatch',()=>{
 const input=anonymousInput(),key=buildAnswerKey(input);const exported={oracleVersion,drawHash:key.drawHash,planHash:key.planHash,games:key.syntheticGamePlan.map(g=>({gameId:g.gameId,winnerId:g.winnerId,spreadPoints:g.spreadPoints})),totals:key.cards.map(c=>({participantId:c.participantId,...c.totals}))};
 assert.equal(buildAnswerKey({...input,appExport:exported}).appComparison.status,'matched-known-results');
 assert.equal(buildAnswerKey({...input,appExport:{...exported,drawHash:'wrong'}}).appComparison.status,'source-mismatch');
 for(const field of ['netSpreadPoints','knownGames','pendingGames']){const bad=copy(exported);bad.totals[0][field]++;const result=buildAnswerKey({...input,appExport:bad}).appComparison;assert.equal(result.status,'differences');assert(result.issues.some(i=>i.kind==='total-mismatch'));}
 const broken=copy(exported);broken.games.pop();broken.games.push({...broken.games[0],spreadPoints:999});broken.totals[0].gamePoints++;const r=buildAnswerKey({...input,appExport:broken}).appComparison;assert.equal(r.status,'differences');assert(r.issues.some(i=>i.kind==='duplicate-game'));assert(r.issues.some(i=>i.kind==='missing-game'));assert(r.issues.some(i=>i.kind==='total-mismatch'));
});
test('CSV cells neutralize spreadsheet formulas, quotes and control characters; script imports no app engine',()=>{
 for(const value of ['=SUM(1,2)',' +cmd','@function','-10'])assert(csvCell(value).startsWith('"\''));assert.equal(csvCell('a"b\nc'),'"a""b c"');
 const source=fs.readFileSync(new URL('../scripts/mock-trial-oracle.mjs',import.meta.url),'utf8');assert.equal(/from ['"](?:\.\.|@\/|src\/)/.test(source),false);assert(source.includes("flag:'wx'"));assert(source.includes('fs.mkdirSync(out)'));
});

test('four descending scorecard keys decide order; names/IDs cannot resolve a tie',()=>{
 const card=(participantId,displayName,gamePoints,wins,netSpreadPoints,plusPoints)=>({participantId,displayName,tournamentId:'A-1',totals:{gamePoints,wins,netSpreadPoints,plusPoints}});
 const rows=[card('low','A',10,5,20,200),card('wins','Z',10,6,-20,100),card('net','Z',10,6,10,100),card('positive','Z',10,6,10,101),card('points','Z',11,1,-100,1)];
 assert.deepEqual(rankKnownCards(rows,[],new Map()).rows.map(r=>r.participantId),['points','positive','net','wins','low']);
 const a=card('z','Z',10,5,10,100),b=card('a','A',10,5,10,100);
 const tied=rankKnownCards([a,b],[],new Map());assert.equal(tied.groups.length,1);assert.equal(tied.groups[0].placeStart,1);assert.equal(tied.groups[0].placeEnd,2);assert.equal(tied.groups[0].resolutionRequired,'deciding-game-required');assert.equal(tied.displayOrderWithinTies,'noncompetitive-not-a-tiebreak');
 const match={gameId:'h2h',sides:[{participantId:'a'},{participantId:'z'}]};const review=rankKnownCards([a,b],[match],new Map([['h2h',{winnerId:'a',source:'caller-supplied-dd-result'}]]));assert.equal(review.groups.length,1);assert.equal(review.groups[0].headToHeadEvidence.winnerId,'a');assert.equal(review.groups[0].resolutionRequired,'review-head-to-head');
});
