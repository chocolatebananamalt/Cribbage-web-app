// Source contracts only. These do NOT execute PostgreSQL or prove transactions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('database/proposals/custom-payout-q-setup-save-v2.sql','utf8');
test('unexecuted Q draft proposal has no public entry point or execution grants',()=>{
 assert.equal(/^\s*grant\s/im.test(sql),false);assert.equal(/create(?: or replace)? function public\./i.test(sql),false);
 for(const table of['setup_custom_q_save_reservations_v2','setup_custom_q_save_outcomes_v2'])assert.ok(sql.includes(`'${table}'`));
 assert.ok(sql.includes('force row level security'));assert.ok(sql.includes('from public,anon,authenticated,service_role'));
 assert.ok(sql.includes('app.reject_immutable_history()'));assert.ok(sql.includes("'capability',false"));
});
test('full request and global rejected-operation identity are preserved before outcome replay',()=>{
 assert.ok(sql.includes('prior.request_payload is distinct from p_envelope'));
 const core=sql.indexOf('linked:=public.save_linked_tournament_setup_v1'),journal=sql.indexOf('insert into app.setup_custom_payout_batches_v2');
 assert.ok(core>0&&journal>core);assert.ok(sql.includes('app.tournament_setup_q_pool_versions q'));
 const rejection=sql.indexOf("if response->>'status'='rejected' then"),global=sql.indexOf('insert into app.operation_receipts',rejection),outcome=sql.indexOf('insert into app.setup_custom_q_save_outcomes_v2',rejection);
 assert.ok(global>rejection&&outcome>global);assert.ok(sql.includes("'save_custom_q_setup_draft_v2',p_tournament_id,h,op,'rejected'"));
 assert.ok(sql.includes('reconcile_custom_q_setup_draft_v2'));assert.ok(sql.includes('if not found then return null;end if;'));
});
test('SQL classification character set matches JS trim without rewriting retained bytes',()=>{
 const encoded=sql.match(/regexp_replace\(p_text,U&'([^']+)'/)[1];
 const decoded=encoded.replace(/\\([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
 const pattern=new RegExp(decoded,'g');
 for(const point of[9,10,11,12,13,32,160,0x1680,0x2000,0x2001,0x2002,0x2003,0x2004,0x2005,0x2006,0x2007,0x2008,0x2009,0x200a,0x2028,0x2029,0x202f,0x205f,0x3000,0xfeff]){
  const raw=String.fromCharCode(point)+'Graduated (1-in-7)'+String.fromCharCode(point),before=raw;
  assert.equal(raw.replace(pattern,''),raw.trim());assert.equal(raw,before);
 }
 assert.equal(sql.includes('btrim('),false);
});
test('busy locks use nonterminal exact-retry path, pending actual race and rollback proof',()=>{
 assert.ok(sql.includes('pg_try_advisory_xact_lock'));assert.equal(/(?<!try_)pg_advisory_xact_lock/.test(sql),false);
 assert.ok(sql.includes('for update nowait'));assert.ok(sql.includes('for key share nowait'));
 const busy=sql.indexOf("exception when lock_not_available then\n -- Outer subtransaction");assert.ok(busy>sql.indexOf('insert into app.setup_custom_q_save_outcomes_v2'));
 assert.ok(sql.slice(busy).includes("'status','retry_exact'"));
});
