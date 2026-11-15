import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateStandardSinglesMrpFromWins,groupEliminationCohorts} from '../src/lib/results/playoff-rounds-won.ts';
test('four qualifiers preserve champion, runner-up and equal semifinal credit',()=>{
 const rows=[{rank:1,points:24,wins:2,total:97},{rank:2,points:24,wins:1,total:76},{rank:3,points:22,wins:0,total:12},{rank:4,points:22,wins:0,total:12}];
 for(const p of rows){const result=calculateStandardSinglesMrpFromWins({eventType:'main',gameCount:12,qualifierCount:4,qualificationRank:p.rank,gamePoints:p.points,roundsWon:p.wins,byesWon:0});assert.equal(result.totalMrp,p.total);assert.equal(result.playoffCreditIndex,p.wins+1);}
});
test('larger bracket and byes credit wins without crediting post-loss backward play',()=>{
 const base={eventType:'main',gameCount:12,qualifierCount:8,qualificationRank:1,gamePoints:24};
 assert.equal(calculateStandardSinglesMrpFromWins({...base,roundsWon:3,byesWon:0}).playoffMrp,70);
 assert.equal(calculateStandardSinglesMrpFromWins({...base,qualifierCount:16,roundsWon:4,byesWon:0}).playoffMrp,105);
 assert.equal(calculateStandardSinglesMrpFromWins({...base,qualifierCount:7,roundsWon:2,byesWon:1}).playoffMrp,70);
 assert.equal(calculateStandardSinglesMrpFromWins({...base,qualifierCount:7,roundsWon:0,byesWon:1}).playoffMrp,21);
 assert.throws(()=>calculateStandardSinglesMrpFromWins({...base,qualifierCount:4,roundsWon:0,byesWon:2}),/wins/);
 assert.throws(()=>calculateStandardSinglesMrpFromWins({...base,roundsWon:0,byesWon:1}),/wins/);
 assert.throws(()=>calculateStandardSinglesMrpFromWins({...base,qualifierCount:7,qualificationRank:2,roundsWon:0,byesWon:1}),/wins/);
 assert.throws(()=>calculateStandardSinglesMrpFromWins({...base,qualifierCount:7,roundsWon:3,byesWon:0}),/wins/);
 assert.equal(calculateStandardSinglesMrpFromWins({...base,qualifierCount:7,qualificationRank:2,roundsWon:0,byesWon:0}).playoffMrp,7);
 assert.throws(()=>calculateStandardSinglesMrpFromWins({...base,qualifierCount:2,roundsWon:0,byesWon:0}),/wins/);
 assert.equal(calculateStandardSinglesMrpFromWins({...base,qualifierCount:2,roundsWon:0,byesWon:1}).playoffMrp,21);
 assert.throws(()=>calculateStandardSinglesMrpFromWins({...base,roundsWon:0,byesWon:0,backwardWins:1}),/fields/);
 for(const value of [-1,0.5,NaN,9])assert.throws(()=>calculateStandardSinglesMrpFromWins({...base,roundsWon:value,byesWon:0}),/wins/);
 assert.equal(calculateStandardSinglesMrpFromWins({...base,qualifierCount:256,roundsWon:8,byesWon:0}).playoffMrp,315);
});
test('same-round cohort representation does not invent semifinal or quarterfinal ordering',()=>{
 const rows=[{participantId:'winner',eliminatedInRound:null}, {participantId:'runner',eliminatedInRound:3},...['s1','s2'].map(participantId=>({participantId,eliminatedInRound:2})),...['q1','q2','q3','q4'].map(participantId=>({participantId,eliminatedInRound:1}))];
 assert.deepEqual(groupEliminationCohorts(rows).map(c=>[c.bandStart,c.bandEnd,c.participantIds.length]),[[1,1,1],[2,2,1],[3,4,2],[5,8,4]]);
 const reversed=groupEliminationCohorts([...rows].reverse());assert.deepEqual(reversed[2].participantIds,['s1','s2']);
 assert.throws(()=>groupEliminationCohorts([...rows,rows[0]]),/unique/i);
 assert.throws(()=>groupEliminationCohorts([...rows,{participantId:' winner',eliminatedInRound:1}]),/unique/i);
 assert.throws(()=>groupEliminationCohorts(rows.filter(p=>p.participantId!=='winner')),/champion/);
});
