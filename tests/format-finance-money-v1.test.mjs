import test from 'node:test';
import assert from 'node:assert/strict';
import {formatFinanceMoneyV1 as money} from '../src/lib/finance/format-finance-money-v1.ts';
test('finance review formats exact signed cents without floating point rounding',()=>{
 assert.equal(money(9007199254730001),'$90,071,992,547,300.01');
 assert.equal(money(-9007199254730001),'-$90,071,992,547,300.01');
 assert.equal(money(0),'$0.00');assert.equal(money(501),'$5.01');
 assert.equal(money(Number.MAX_SAFE_INTEGER+1),'Not available');
});
