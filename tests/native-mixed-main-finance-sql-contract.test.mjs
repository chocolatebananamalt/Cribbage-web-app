import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{calculateEventRegularFinanceV1}from'../src/lib/results/event-regular-finance-v1.ts';
const sql=fs.readFileSync('database/proposals/native-mixed-main-finance-v1.sql','utf8');
test('native Main candidate remains atomic private defaultoff and writes no ordinary or optional-pool rows',()=>{
 assert.match(sql,/^begin;$/m);assert.match(sql,/commit;\s*$/);assert.match(sql,/native_mixed_main_finance_enabled_v1\(\)returns boolean\s+language sql immutable set search_path=''as \$\$select false\$\$/);
 assert.doesNotMatch(sql,/\bgrant\s+(execute|all|usage|select|insert)\b/i);
 const writes=[...sql.matchAll(/\b(?:insert into|update|delete from)\s+app\.([a-z0-9_]+)/gi)].map(x=>x[1]);assert(writes.length>3);assert(writes.every(x=>x.startsWith('native_mixed_main_finance_')||['operation_receipts','audit_events'].includes(x)));
 assert.match(sql,/force row level security/);assert.match(sql,/before update or delete/);assert.match(sql,/before truncate/);assert.match(sql,/status='UNPAID_SIMULATED'/);
});
test('actual completed native provenance is required; no fabricated ordinary V2 identifiers',()=>{
 assert.match(sql,/app\.native_mixed_playoff_source_v1\(tid,eid\)/);assert.match(sql,/app\.native_mixed_playoff_completion_bound_v1\(c\.id\)is distinct from true/);
 assert.match(sql,/c\.source_capture is distinct from p->'capture'/);assert.match(sql,/mainFundingSourceDigest/);assert.match(sql,/historicalSavedDraft/);
 assert.match(sql,/settingsBinding,context,sanctioned}'is distinct from'false'/);
 assert.doesNotMatch(sql,/qualification_result_versions|synthetic_mixed_fixtures_v1|allocationRevisionId|qualificationResultVersionId|prizeSnapshotId/);
});
test('unknown costs require explicit coverage and totals review; corrections and voids retain lineage',()=>{
 assert.match(sql,/costsExplicitlyReviewed',true,'zeroCostsNotInferred',true/);assert.match(sql,/coverage,status}'is distinct from'not_applicable'/);
 for(const field of['expectedBenefitsMinor','expectedExpensesMinor','expectedIncomeMinor','expectedNetMinor'])assert(sql.includes(`d->'${field}'is distinct from costs->`));
 assert.match(sql,/priorRecordId'is distinct from previous\.id::text/);assert.match(sql,/d->>'category'is distinct from previous\.payload->>'category'/);
 assert.match(sql,/voided'='true'::jsonb and d->'amountMinor'is distinct from'0'/);assert.match(sql,/current_cost_review_required/);
 assert.match(sql,/sequence<before_sequence/);assert.match(sql,/costsReviewed',exists/);
});
test('manual policy/unit, actual whole groups, positive equal amounts and exact conservation gate unpaid records',()=>{
 assert.match(sql,/native-mixed-main-manual-whole-group-v1/);assert.match(sql,/roundingUnitMinor'not in\('100'::jsonb,'500'::jsonb,'1000'::jsonb\)/);
 assert.match(sql,/actual:=\(source#>'\{capture,completion,finishingGroups\}'\)->i/);assert.match(sql,/g->'firstPlace'is distinct from actual->'firstPlace'/);
 assert.match(sql,/amount%unit<>0/);assert.match(sql,/total<>\(costs->>'netMinor'\)::bigint/);assert.match(sql,/distributionAutomaticallyApproved',false,'feeComparisonNotEvaluated',true/);
 assert.match(sql,/recipient_mapping_changed/);assert.match(sql,/already_finalized/);assert.doesNotMatch(sql,/calculate.*payout|round\(|largest.remainder/i);
});
test('actual own Director/session/pilot preappend, global namespace, source/head CAS and exact historical recovery',()=>{
 assert.match(sql,/role='director'for share nowait/);assert.match(sql,/actor:=app\.native_mixed_pool_actor_v1\(\)/);
 assert.match(sql,/expectedJournalDigest'<>app\.native_mixed_main_finance_journal_v1/);assert.match(sql,/source_digest<>source->>'sourceDigest'/);
 assert.match(sql,/native_mixed_simulation_operation_reserved_v1\(actor,op\)/);assert.match(sql,/historicalReceipt',true,'currentSourceVerified',false/);
 const insert=sql.indexOf('insert into app.operation_receipts');assert.match(sql.slice(insert-380,insert),/app\.native_mixed_pool_actor_v1\(\)is distinct from actor or app\.native_mixed_pilot_permitted_v1\(actor,tid,eid,true\)is distinct from true/);
 assert.match(sql,/v\.payload is distinct from expected/);assert.match(sql,/v\.response_payload is distinct from response/);assert.match(sql,/a\.after_state=v\.response_payload/);assert.match(sql,/ob\.participant_id::text=x->>'participantId'/);
});
test('independent existing simulation arithmetic proves 540−40−100+20=420; manual amounts conserve at selected5',()=>{
 const id=n=>`aaaa0000-0000-4000-8000-${String(n).padStart(12,'0')}`,source={tournamentId:id(1),eventId:id(2),sourceVersion:1,sourceDigest:'a'.repeat(64)};
 const line=(n,category,amountMinor)=>({recordId:id(n),lineId:id(n),priorRecordId:null,source,mode:'simulation',category,amountMinor,voided:false,reason:'Fictional Director reviewed entry'});
 const input={source,mode:'simulation',grossEntry:{source,mode:'simulation',amountMinor:54000},history:[line(3,'player_benefit',4000),line(4,'operating_expense',10000),line(5,'unrestricted_income',2000),line(6,'q_pool_fund',22000),line(7,'side_pool_fund',10000)]};
 const result=calculateEventRegularFinanceV1(input);assert.equal(result.status,'calculated');assert.equal(result.regularFundMinor,42000);assert.equal(result.excludedQMinor,22000);assert.equal(result.excludedSideMinor,10000);assert.equal(result.finalizationAuthorized,false);
 const manual=[{n:1,a:18000},{n:1,a:10000},{n:2,a:6000},{n:1,a:2000}];assert.equal(manual.reduce((s,g)=>s+g.n*g.a,0),42000);assert(manual.every(g=>g.a%500===0));
 const corrected={...input,history:[...input.history,{...input.history[0],recordId:id(8),priorRecordId:id(3),amountMinor:0,voided:true,reason:'Fictional benefit voided'}]};assert.equal(calculateEventRegularFinanceV1(corrected).regularFundMinor,46000);
 assert.equal(calculateEventRegularFinanceV1({...input,mode:'documented_actual'}).code,'mixed_modes');
});
test('record payload variable cannot shadow stored payload; balanced awards still preserve finishing order',()=>{
 const writer=sql.slice(sql.indexOf('create function app.execute_native_mixed_main_finance_v1'),sql.indexOf('create function app.get_native_mixed_main_finance_v1'));
 assert.match(writer,/record_payload jsonb/);assert.doesNotMatch(writer,/(?<![a-z_])payload jsonb|(?<![a-z_])payload:=/);
 assert.match(writer,/r\.payload->>'lineId'=d->>'lineId'/);
 assert.match(writer,/if i>0 and amount>previous_amount then return jsonb_build_object\('status','rejected','code','award_order_required'\)/);
 assert.match(sql,/if i>0 and\(g->>'perPersonMinor'\)::bigint>previous_amount then return false/);
 const balancedWrong=[{n:1,a:2000},{n:1,a:10000},{n:2,a:6000},{n:1,a:18000}];
 assert.equal(balancedWrong.reduce((s,g)=>s+g.n*g.a,0),42000);assert(balancedWrong.some((g,i)=>i>0&&g.a>balancedWrong[i-1].a));
});
test('reader captures one coherent journal and rechecks current actor/expiry/cohort after assembling its response',()=>{
 const reader=sql.slice(sql.indexOf('create function app.get_native_mixed_main_finance_v1'));
 const lock=reader.indexOf('lock table app.native_mixed_main_finance_records_v1,app.native_mixed_main_finance_obligations_v1 in share mode nowait;');
 assert(lock>0);assert(lock<reader.indexOf('app.native_mixed_main_finance_record_bound_v1(id)'));
 const response=reader.indexOf('response:=jsonb_build_object'),recheck=reader.indexOf('if app.native_mixed_pool_actor_v1()is distinct from actor');
 assert(response>0&&recheck>response);assert.match(reader.slice(recheck),/app\.native_mixed_pilot_permitted_v1\(actor,tid,eid,false\)is distinct from true then return null;end if;\s+return response/);
});
