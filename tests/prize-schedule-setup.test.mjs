import assert from 'node:assert/strict';
import test from 'node:test';
import { supportsSetupPrizeSchedule } from '../src/lib/results/prize-schedule-setup.ts';
const main = {eventKind:'main',gameCount:12,styleCode:'Standard',formatCode:'standard_singles',entryFeeCents:3000,sidePools:[],qPools:[]};
test('base-prize setup supports optional Q fees without consuming Q funds',()=>{
  assert.equal(supportsSetupPrizeSchedule([main]),true);
  assert.equal(supportsSetupPrizeSchedule([{...main,qPools:[{entryFeeCents:1000},{entryFeeCents:1000}]}]),true);
  assert.equal(main.entryFeeCents,3000);
});
test('unsupported hidden editors cannot participate in setup blocking',()=>{
  for(const events of [[],[main,main],[{...main,sidePools:[{}]}],[{...main,eventKind:'consolation'}],[{...main,gameCount:9}],[{...main,styleCode:'Double Elimination'}],[{...main,formatCode:'doubles'}],[{...main,entryFeeCents:0}],[{...main,entryFeeCents:0.1}]]) assert.equal(supportsSetupPrizeSchedule(events),false);
});
