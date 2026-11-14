import test from 'node:test';
import assert from 'node:assert/strict';
import { bracketSections } from '../src/lib/results/playoff-bracket-layout.ts';

test('regional geometry partitions every match once and always ends in one championship', () => {
  for (const size of [4,8,16,32,64,128,256]) {
    const sections=bracketSections(size), ids=sections.flatMap(s=>s.columns.flatMap(c=>c.matchNumbers.map(n=>`r${c.round}-m${n}`)));
    assert.equal(ids.length,size-1); assert.equal(new Set(ids).size,size-1);
    for(let round=1;round<=Math.log2(size);round++) for(let n=1;n<=size/2**round;n++) assert(ids.includes(`r${round}-m${n}`));
    assert.equal(ids.filter(id=>id===`r${Math.log2(size)}-m1`).length,1);
    for(const region of sections.filter(s=>s.id!=='finals')) {
      assert(region.columns[0].matchNumbers.length<=32);
      if(region.advancesTo) assert(ids.includes(region.advancesTo));
    }
  }
});
test('256 positions use four connected 64-position regions, then two semifinals and a final',()=>{
  const s=bracketSections(256); assert.deepEqual(s.map(s=>s.label),['Region 1','Region 2','Region 3','Region 4','Final rounds']);
  assert.deepEqual(s.slice(0,4).map(s=>s.advancesTo),['r7-m1','r7-m1','r7-m2','r7-m2']);
  assert.deepEqual(s[4].columns,[{round:7,matchNumbers:[1,2]},{round:8,matchNumbers:[1]}]);
  assert.deepEqual(s[3].columns[0].matchNumbers,Array.from({length:32},(_,i)=>i+97));
});
test('layout rejects unsupported sizes and contains no player, seeding, or result authority',()=>{
 for(const size of [0,1,2,3,5,63,65,257,512,NaN,Infinity,'64']) assert.throws(()=>bracketSections(size),RangeError);
 const text=JSON.stringify(bracketSections(256)); assert.doesNotMatch(text,/participantId|winner|seed|provenance|resultId/);
});
