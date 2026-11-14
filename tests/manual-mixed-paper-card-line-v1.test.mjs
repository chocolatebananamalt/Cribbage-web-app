import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {manualMixedPaperCardLineV1 as line} from '../src/lib/games/manual-mixed-paper-card-line-v1.ts';
const gameId='a1110000-0000-4000-8000-000000000001',eventId='a1110000-0000-4000-8000-000000000002';
const item={gameId,eventId,gameNumber:13,digitalSide:'a'};
const mapping={gameId,eventId,schedulingBatchNumber:13,sideACardGameNumber:4,sideBCardGameNumber:9,isMakeup:true};
test('makeup tentative paper row uses opposite side physical card line',()=>{
  assert.equal(line(item,mapping),9);
  assert.equal(line({...item,digitalSide:'b'},mapping),4);
});
test('missing or invalid makeup mapping conceals score instead of inventing game13',()=>{
  assert.equal(line(item),null);
  for(const change of [{gameId:eventId},{eventId:gameId},{schedulingBatchNumber:12},{sideACardGameNumber:5},{sideBCardGameNumber:13},{isMakeup:false,sideACardGameNumber:13,sideBCardGameNumber:13}])assert.equal(line(item,{...mapping,...change}),null);
});
test('ordinary games retain original lines; supplied conflicting context is not ignored',()=>{
  for(let n=1;n<=12;n++)assert.equal(line({...item,gameNumber:n}),n);
  for(const n of [0,14,NaN,1.5])assert.equal(line({...item,gameNumber:n}),null);
  assert.equal(line({...item,gameNumber:3},mapping),null);
});
test('hybrid host passes its existing mapping to tentative partials',()=>{
  const host=fs.readFileSync('src/app/tournament/[tournamentId]/hybrid-games/hybrid-game-client.tsx','utf8');
  assert.match(host,/<ManualMixedPaperPartialsV1[^>]+cardNumberContexts=\{cardNumberContexts\}/);
});
test('actual React tentative partials render mapped lines and conceal missing mapping',()=>{
  const result=spawnSync(process.execPath,['tests/helpers/render-manual-mixed-paper-card-line.mjs'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
});
