import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {id,operatingSource} from './fixtures/q-operating-source.mjs';
import {customQPolicyVersionV5} from '../src/lib/api/q-custom-policy-v5.ts';
import {customGraduatedAmountsVersionV3} from '../src/lib/results/custom-graduated-amounts-v3.ts';
import {previewCustomQPlanV5} from '../src/lib/results/q-custom-operating-preview-v5.ts';
import {previewCustomQAccountingV1} from '../src/lib/results/custom-q-accounting-preview-v1.ts';

const sql=fs.readFileSync('database/proposals/custom-q-accounting-bridge-v1.sql','utf8');
const runtime=fs.readFileSync('tests/custom-q-accounting-bridge-local-acceptance.mjs','utf8');

test('candidate adds one Q-only V5 policy without changing legacy namespaces or enabling browser roles',()=>{
 for(const token of[
  "'equal-paid-playoff-qualifiers-v2'","'graduated-paid-card-rank-v2'",
  "'acc-weighted-largest-remainder-5usd-v1'","'graduated-acc-weighted-largest-remainder-5usd-v2'",
  "'q-custom-graduated-policy-v5'","'graduated-custom-ratio-largest-remainder-5usd-v3'",
  "jsonb_build_array('q_operating_v5',p_actor_id,p_tournament_id,p_request)",
  "operation_type='q_operating_v5'","app.calculate_q_obligations_pre_custom_v5",
  "if custom_count=0 then return base;end if;","app.project_q_custom_source_v5",
  "q_no_eligible_recipients","refundPolicy','no-pool-refunds-v1'",
 ])assert.match(sql,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 for(const token of[
  "method='acc-weighted-largest-remainder-5usd-v1'and ratio is not null and ratio in(4,6)and schedule_id is not null",
  "method='graduated-acc-weighted-largest-remainder-5usd-v2'and ratio is not null and ratio in(4,6)and schedule_id is not null",
  "method='q-custom-graduated-policy-v5'and ratio is not null and ratio between 1 and 2147483647 and schedule_id is not null",
 ])assert.ok(sql.includes(token),token);
 assert.match(sql,/grant execute on function public\.save_q_custom_policy_v5[\s\S]+to service_role/);
 assert.doesNotMatch(sql,/grant execute[\s\S]{0,300}to (?:anon|authenticated)/);
 assert.doesNotMatch(sql,/q_no_eligible_recipient['"]/);
 assert.match(sql,/Satellite and Side remain unsupported here/);
 assert.doesNotMatch(sql,/insert into app\.(?:roster_payment_events|q_accounting_drafts_v6|q_accounting_finals_v6)/);
});

test('publication binds the exact immutable setup intent instead of trusting a posted ratio',()=>{
 for(const token of[
  "count(*)from jsonb_object_keys(p_request))<>8",
  "array['action','poolVersionId','method','ratio','amountMethod','disclosureReference','disclosed','intent']",
  "count(*)from jsonb_object_keys(intent))<>4",
  "count(*)from jsonb_object_keys(source_value))<>6",
  "i.original_intent=p_request->'intent'",
  "i.setup_revision_id=setup_revision","i.setup_event_version_id=setup_event",
  "i.scope='q'and i.pool_slot=slot_value","e.event_kind in('main','consolation')",
  "custom_intent_required","setup_custom_payout_batches_v2",
 ])assert.ok(sql.includes(token),token);
 assert.match(sql,/current_setting\('transaction_isolation'\)<>'read committed'/);
 assert.match(sql,/qualification-finalization:/);
 assert.match(sql,/locked_c:=app\.q_pool_context_v1\(p_tournament_id\)/);
 assert.match(sql,/setup_event::text is distinct from c->>'setupEventVersionId'then raise exception'source_changed'/);
 assert.match(sql,/q_policy_backdated_receipt|q_operating_policy_guard|q_pool_context_v1/);
});

test('existing paid-only ranking and tie guards surround only the new amount dispatch',()=>{
 const v4=fs.readFileSync('database/migrations/0259_graduated_q_policy_v4.sql','utf8').replaceAll('\r\n','\n');
 assert.match(sql,/pg_get_functiondef\('app\.calculate_q_obligations_with_graduated_v4\(jsonb\)'::regprocedure\)/);
 assert.ok(sql.includes("d:=replace(p,E'\\r\\n',E'\\n')"));
 assert.ok(v4.includes("if pol->>'method'='graduated-acc-weighted-largest-remainder-5usd-v2'then"));
 assert.match(sql,/calculate_custom_graduated_amounts_v3\(jsonb_build_object\('paidCount',n,'feeMinor',fee,'ratio',ratio\)\)/);
 assert.match(sql,/customPolicyBindings/);
 assert.match(sql,/customAlgorithmVersion','graduated-custom-ratio-largest-remainder-5usd-v3'/);
 assert.match(sql,/q-unpaid-dispatch-v5/);
 // Existing immutable review and accounting writers remain the consumers.
 const review=fs.readFileSync('database/migrations/0248_q_obligation_review_v2.sql','utf8');
 const accounting=fs.readFileSync('database/migrations/0249_q_accounting_v6.sql','utf8');
 assert.match(review,/b:=app\.q_obligation_sources_v2\(p_actor_id,p_tournament_id\)/);
 assert.match(review,/insert into app\.q_obligation_reviews_v2/);
 assert.match(accounting,/qs:=app\.q_obligation_sources_v2\(p_actor,p_tid\)/);
 assert.match(accounting,/qr\.obligations is distinct from qs->'obligations'/);
 assert.match(accounting,/q_accounting_finalized_unpaid_v6/);
 assert.match(accounting,/exists\(select 1 from app\.tournament_setup_side_pool_versions/);
});

function currentInput(){
 const workspace=operatingSource(28,1000);workspace.sourceDigest='c'.repeat(64);
 Object.assign(workspace.policies[0],{method:customQPolicyVersionV5,ratio:7,scheduleId:customGraduatedAmountsVersionV3});
 return{workspace,tournamentId:id(1),eventId:id(2),poolVersionId:id(5),expectedSourceDigest:workspace.sourceDigest};
}
test('bounded bridge input remains paid-only, backfilled, tied-source blocked and exactly conserved before review',()=>{
 const input=currentInput(),plan=previewCustomQPlanV5(input);assert.equal(plan.status,'preview');
 assert.equal(plan.awards.length,4);assert.equal(input.workspace.cards[3].qualified,false);
 assert.equal(plan.awards.reduce((n,a)=>n+a.amountMinor,0),plan.fundMinor);
 assert.ok(plan.awards.every(a=>a.amountMinor>0&&a.amountMinor%500===0));
 const preview=previewCustomQAccountingV1({tournamentId:id(1),eventId:id(2),pools:[{retainedPlan:plan,currentInput:input,
  funding:{tournamentId:id(1),eventId:id(2),poolVersionId:id(5),sourceDigest:input.workspace.sourceDigest,allocatedMinor:plan.fundMinor,currency:'USD'}}]});
 assert.equal(preview.status,'unpaid_accounting_preview');assert.equal(preview.reviewRequired,true);assert.equal(preview.paymentsRecorded,false);assert.equal(preview.moneyMoved,false);
 const tie=currentInput();Object.assign(tie.workspace.cards[1],{gamePoints:tie.workspace.cards[0].gamePoints,gamesWon:tie.workspace.cards[0].gamesWon,plusPoints:tie.workspace.cards[0].plusPoints});
 assert.deepEqual(previewCustomQPlanV5(tie),{status:'blocked',code:'cash_tie_policy_unresolved'});
 const unpaid=currentInput(),entry=unpaid.workspace.membership.entries[0];Object.assign(entry,{receivedMinor:3000,obligationMinor:3000});Object.assign(entry.pools[0],{elected:false,amountAllocatedMinor:0,amountOwedMinor:0,paidEntryEligible:false});
 const without=previewCustomQPlanV5(unpaid);assert.equal(without.status,'preview');assert.equal(without.awards.some(a=>a.participantId===entry.participantId),false);
});

test('isolated runtime helper uses the real setup intent writer and existing unpaid accounting chain',()=>{
 for(const token of[
  'app.save_custom_q_setup_draft_v2','public.save_q_custom_policy_v5','public.record_q_obligation_review_v2',
  'public.get_event_prize_declaration_v2','public.save_event_prize_declaration_v2',
  'servicePrivateImplementationDenied','servicePrivateReconciliationDenied',
  'public.finalize_linked_tournament_setup_v1','app.current_event_prize_activation_pins_v1',
  'public.save_q_accounting_draft_v6','public.finalize_q_accounting_v6','q_accounting_finalized_unpaid_v6',
  "app.calculate_q_obligations_pre_custom_v5","app.tournament_setup_side_pool_versions",
 ])assert.ok(runtime.includes(token),token);
 assert.doesNotMatch(runtime,/insert into app\.setup_custom_payout_(?:batches|intents)_v2/);
 assert.doesNotMatch(runtime,/insert into app\.tournament_setup_activations/);
 assert.ok(runtime.match(/public\.save_setup_prize_schedule_v1/g)?.length>=2,'V1 schedule must be saved before activation and bound through a supported reviewed revision after V2 activation');
 assert.match(runtime,/bindingSource,'reviewed_revision'/);
 assert.match(runtime,/`set role \$\{role\};set request\.jwt\.claim\.sub=/);
 assert.match(runtime,/pool2People:\[1\]/);assert.match(runtime,/noPoolRefunds:true/);
 for(const phase of['setup','activation','policy_source_qualification','q_review','v6_preflight','v6_draft_final'])assert.match(runtime,new RegExp(`checkpoint\\('${phase}'`));
 assert.match(runtime,/syntheticFoundations:true,moneyMoved:false,providerVerified:false,combinedQSideSupported:false/);
});

