import test from 'node:test';import assert from 'node:assert/strict';
import {applyMixedMockWinnerOverrides}from'./synthetic-mixed-18-acceptance.mjs';
const fixture=()=>Array.from({length:108},(_,index)=>({index,winnerSide:index%2?'b':'a',margin:[1,30,31,60,61,90,91,121][index%8],gameId:`fixture-${index}`}));
test('local winner overrides preserve default plan, margins and input; only specified winners change',()=>{
 const raw=fixture(),normal=applyMixedMockWinnerOverrides(raw);assert.deepEqual(normal,raw);assert.notEqual(normal,raw);
 const choices=[11,13,15].map(gameIndex=>({gameIndex,winnerSide:'a'}));
 const changed=applyMixedMockWinnerOverrides(raw,choices);
 assert.deepEqual(changed.filter((g,i)=>g.winnerSide!==raw[i].winnerSide).map(g=>g.index),[11,13,15]);
 assert.deepEqual(changed.map(g=>g.margin),raw.map(g=>g.margin));
 assert.deepEqual([changed[11].margin,changed[13].margin,changed[15].margin],[60,90,121]);
 assert.equal(raw[11].winnerSide,'b');changed[0].margin=999;assert.equal(raw[0].margin,1);
});
test('local winner overrides reject duplicate, missing, extra, invalid and noninteger fields',()=>{
 const raw=fixture();
 for(const choices of [null,{},[{gameIndex:11,winnerSide:'a'},{gameIndex:11,winnerSide:'b'}],[{gameIndex:-1,winnerSide:'a'}],
  [{gameIndex:108,winnerSide:'a'}],[{gameIndex:1.5,winnerSide:'a'}],[{gameIndex:NaN,winnerSide:'a'}],[{gameIndex:11,winnerSide:'player'}],
  [{gameIndex:11}],[{winnerSide:'a'}],[{gameIndex:11,winnerSide:'a',margin:60}],[null]])assert.throws(()=>applyMixedMockWinnerOverrides(raw,choices),TypeError);
 assert.throws(()=>applyMixedMockWinnerOverrides(null,[]),TypeError);
});
