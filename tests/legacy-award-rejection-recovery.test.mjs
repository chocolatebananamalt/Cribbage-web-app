import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { isQAccountingResult } from '../src/lib/api/q-accounting-v6.ts';
import { isNoQAccountingResult } from '../src/lib/api/no-q-accounting-v7.ts';
import { isRejectedSettlementV5, isSettlementV5Reconciliation } from '../src/lib/api/settlement-v5.ts';
const tid='11111111-1111-4111-8111-111111111111', eid='22222222-2222-4222-8222-222222222222';
const rejected={status:'rejected',eventId:eid,code:'whole_five_awards_required'};
test('real durable denomination rejections are terminal recognized responses',()=>{
 assert.equal(isQAccountingResult(rejected,eid),true);
 assert.equal(isNoQAccountingResult(rejected,eid),true);
 assert.equal(isRejectedSettlementV5(rejected,eid),true);
 assert.equal(isSettlementV5Reconciliation({authorized:true,result:rejected},tid,eid),true);
 for(const check of [isQAccountingResult,isNoQAccountingResult,isRejectedSettlementV5]){
  assert.equal(check({...rejected,eventId:tid},eid),false);
  assert.equal(check({...rejected,code:'unknown'},eid),false);
  assert.equal(check({error:'operation_unavailable'},eid),false);
 }
});
test('migration patches post-replay validation only and keeps authority/history unchanged',()=>{
 const sql=fs.readFileSync('database/migrations/0262_legacy_award_rejection_recovery_v1.sql','utf8');
 assert.match(sql,/write_q_accounting_v6/);assert.match(sql,/write_no_q_accounting_v7/);assert.match(sql,/write_event_settlement_v5/);
 assert.match(sql,/d\.source_manifest/);assert.match(sql,/draft\.request_payload/);
 assert.match(sql,/assert_whole_five_q_awards_v1/);
 assert.doesNotMatch(sql,/\b(drop trigger|disable trigger|grant |delete from|update app\.|request_hash:=)\b/i);
 for(const name of ['0249_q_accounting_v6.sql','0254_no_q_accounting_v7.sql','0240_versioned_settlement_v5.sql']){
  const base=fs.readFileSync(`database/migrations/${name}`,'utf8');
  const start=base.search(/create (?:or replace )?function app.write_/);
  const writer=base.slice(start);
  assert.ok(writer.indexOf('return r.response_payload')>=0 || writer.indexOf('return receipt.response_payload')>=0);
 }
});
