import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const sql=fs.readFileSync('database/migrations/0243_q_pool_membership_v1.sql','utf8');
test('Q Pool proposal is additive and preserves legacy payment and settlement writers',()=>{
 assert.equal(sql.replaceAll('\r\n','\n'),fs.readFileSync('docs/quality/2026-10-28-proposed-q-pool-membership-v1.sql','utf8').replaceAll('\r\n','\n'));
 assert.doesNotMatch(sql,/alter table app\.(?:roster_payment_events|roster_payment_obligation_versions|event_settlement)|update app\.(?:roster_payment|event_settlement|operation_receipts)|delete from|truncate /i);
 assert.doesNotMatch(sql,/create (?:or replace )?function public\.(?:record_manual|void_manual|finalize_event|save_event_settlement)/i);
 for(const name of ['save_q_pool_membership_v1','get_q_pool_membership_workspace_v1','get_q_pool_membership_reconciliation_v1']){
  assert.match(sql,new RegExp(`revoke all on function public\\.${name}\\([^;]+from public,anon,authenticated`));
  assert.match(sql,new RegExp(`grant execute on function public\\.${name}\\([^;]+to service_role`));
 }
 assert.match(sql,/force row level security/);assert.match(sql,/reject_immutable_history/);
});
test('isolated Q Pool runners reject unscoped invocations before touching Docker',()=>{
 for(const file of ['tests/run-q-pool-isolated.mjs','tests/q-pool-concurrency.mjs']){
  for(const args of [[],['--isolated-container'],['--isolated-container','--container-id','bad'],['--isolated-container','--container-id','a'.repeat(64),'extra']]){
   const r=spawnSync(process.execPath,[file,...args],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/Exact --isolated-container --container-id/);assert.doesNotMatch(r.stderr,/Docker|docker.sock|permission denied/i);
  }
  const runner=fs.readFileSync(file,'utf8');for(const guard of ['NetworkMode','Mounts','PortBindings','Privileged','expectedContainerId']){
   if(guard==='expectedContainerId'&&file.endsWith('concurrency.mjs'))continue;
   assert.ok(runner.includes(guard),`${file}: ${guard}`);
  }
 }
});
