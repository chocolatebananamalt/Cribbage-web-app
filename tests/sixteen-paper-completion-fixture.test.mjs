import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewQualification} from '../src/lib/qualification.ts';
const fixture=JSON.parse(readFileSync(new URL('../docs/quality/2026-10-27-sixteen-paper-completion-fixture.json',import.meta.url),'utf8'));
test('proposed synthetic 16-player completion preserves saved round and valid schedule',()=>{
 assert.equal(fixture.games.length,96);assert.equal(new Set(fixture.games.map(g=>g.id)).size,96);
 const pairs=new Set();const counts=new Map();
 for(let round=1;round<=12;round++){
  const games=fixture.games.filter(g=>g.round_number===round);assert.equal(games.length,8);
  assert.equal(new Set(games.flatMap(g=>[g.a,g.b])).size,16);
  for(const g of games){const key=[g.a,g.b].sort().join('|');assert.ok(!pairs.has(key));pairs.add(key);
   for(const n of [g.a,g.b])counts.set(n,(counts.get(n)??0)+1);
   assert.ok(g.proposedMargin>=1&&g.proposedMargin<31);
   const number=name=>Number(name.match(/Paper(\d+)$/)[1]);
   if(round===1){assert.equal(g.state,'verified');assert.equal(g.proposedWinner,g.winner_side);assert.equal(g.proposedMargin,g.margin);assert.equal(g.margin,15);assert.ok(number(g.proposedWinner==='a'?g.a:g.b)<=8);}
   else {assert.equal(g.state,'pending');assert.equal(g.proposedWinner,number(g.a)<number(g.b)?'a':'b');assert.equal(g.proposedMargin,10+Math.min(number(g.a),number(g.b)));}
  }
 }
 assert.equal(counts.size,16);assert.ok([...counts.values()].every(n=>n===12));
});
test('independent winner/loser accumulation matches fixed expected totals and four untied qualifiers',()=>{
 const stats=new Map();for(const g of fixture.games){for(const n of [g.a,g.b])if(!stats.has(n))stats.set(n,{id:n,displayName:n,gamePoints:0,gamesWon:0,netSpreadPoints:0,positiveSpreadPoints:0});
  const winner=stats.get(g.proposedWinner==='a'?g.a:g.b),loser=stats.get(g.proposedWinner==='a'?g.b:g.a);
  winner.gamePoints+=g.proposedMargin>=31?3:2;winner.gamesWon++;winner.netSpreadPoints+=g.proposedMargin;winner.positiveSpreadPoints+=g.proposedMargin;loser.netSpreadPoints-=g.proposedMargin;
 }
 assert.equal(fixture.expected.length,16);assert.equal(new Set(fixture.expected.map(p=>p.name)).size,16);
 for(const expected of fixture.expected){const actual=stats.get(expected.name);assert.equal(actual.gamePoints,expected.points);assert.equal(actual.gamesWon,expected.wins);assert.equal(actual.netSpreadPoints,expected.net);assert.equal(actual.positiveSpreadPoints,expected.plus);}
 assert.equal([...stats.values()].reduce((n,s)=>n+s.netSpreadPoints,0),0);
 assert.equal([...stats.values()].reduce((n,s)=>n+s.gamePoints,0),192);
 const result=previewQualification([...stats.values()]);assert.equal(result.finalizable,true);assert.equal(result.qualifierCount,4);assert.equal(result.firstRoundByes,0);
 assert.deepEqual(result.ranked.slice(0,4).map(p=>p.displayName),['TEST ONLY Paper02','TEST ONLY Paper01','TEST ONLY Paper04','TEST ONLY Paper03']);
});
