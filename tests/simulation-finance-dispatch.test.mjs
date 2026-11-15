import test from 'node:test';
import assert from 'node:assert/strict';
import { simulationFinanceDispatch as route } from '../src/lib/api/simulation-finance-dispatch.ts';
test('ordinary ledger requires verified non-enrollment; simulation never falls back', () => {
  assert.equal(route({status:'not_enabled'}, false), 'legacy');
  const enabled = {status:'available',evidenceKind:'simulation',moneyMoved:false,accountingAvailable:false,sources:[]};
  assert.equal(route(enabled, false), 'simulation');
  for (const value of [null, {}, {status:'blocked'}, {status:'not_enabled',sources:[]}, {...enabled,evidenceKind:'real'}, {...enabled,moneyMoved:true}, {...enabled,sources:null}]) assert.equal(route(value,false),'blocked');
  assert.equal(route({status:'not_enabled'},true),'blocked');
  assert.equal(route(enabled,true),'blocked');
});
