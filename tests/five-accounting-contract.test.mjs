import test from 'node:test';
import assert from 'node:assert/strict';
import {isQAccountingFacts} from '../src/lib/api/q-accounting-v6.ts';
import {facts} from './fixtures/q-accounting-v6-workspace.mjs';
import {deriveFiveQualifierPlayoff} from '../src/lib/results/five-qualifier-playoff.ts';
const ids=[1,2,3,4,5].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
const q=ids.map((participantId,i)=>({participantId,qualificationRank:i+1,gamePoints:24-i}));
const s=(a,b)=>({winnerId:ids[a-1],loserId:ids[b-1],evidenceNote:'Local synthetic series'});
function data(){const f=structuredClone(facts);const outcomes=deriveFiveQualifierPlayoff(q,[s(4,5),s(1,4),s(2,3),s(1,2)]);
 f.canonicalMrp.rows=outcomes.map((r,i)=>{const evidence=Object.fromEntries(Object.entries(r).filter(([key])=>key!=="champion"));return{...evidence,displayName:`Local${i+1}`,qualificationRank:i+1,gamePoints:24-i,evidenceNote:'Explicit bye credit, not a played game'};});return f;}
test('canonical unpaid accounting reader verifies actual/bye credit and five-person MRP bands',()=>{
 assert.equal(isQAccountingFacts(data()),true);
 for(const mutate of [f=>f.canonicalMrp.rows[0].playedMatchWins=3,f=>f.canonicalMrp.rows[0].byeWins=0,
  f=>f.canonicalMrp.rows[2].bandEnd=3,f=>f.canonicalMrp.rows[4].eliminatedInRound=2,
  f=>{f.canonicalMrp.rows[0].playoffMrp=42;f.canonicalMrp.rows[0].totalMrp=f.canonicalMrp.rows[0].qualifyingMrp+42;},
  f=>{f.canonicalMrp.rows[2].qualifyingMrp=5;f.canonicalMrp.rows[2].totalMrp=26;}]){
  const f=data();mutate(f);assert.equal(isQAccountingFacts(f),false);
 }
});
