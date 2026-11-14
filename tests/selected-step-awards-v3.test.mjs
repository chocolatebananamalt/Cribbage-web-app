import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{selectedStepAwardClonesV3 as specs,selectedStepAwardSchemaV3}from'./helpers/selected-step-award-clones-v3.mjs';
import{applySelectedStepCloneV3 as apply}from'./helpers/selected-step-final-clones-v3.mjs';
const original=fs.readFileSync('database/proposals/modern-prize-awards-v2.sql','utf8').replaceAll('\r\n','\n'),sql=fs.readFileSync('database/proposals/selected-step-awards-v3.sql','utf8').replaceAll('\r\n','\n');
function body(spec){const name=spec.signature.split('(')[0],a=original.indexOf('create function '+name+'('),begin=original.indexOf('as $body$',a)+9,end=original.indexOf('$body$;',begin);assert(a>=0&&end>begin,name);return original.slice(begin,end);}
test('all actual writer/source/read seams exactly match installed candidate and reviewed arithmetic',()=>{
 const arrays=[...sql.matchAll(/jsonb_array_elements\('((?:''|[^'])*)'::jsonb\)/g)].map(m=>JSON.parse(m[1].replaceAll("''","'")));
 assert.equal(arrays.length,specs.length);for(const[i,spec]of specs.entries()){assert.deepEqual(arrays[i],spec.patches);assert.notEqual(apply(body(spec),spec),body(spec));assert.throws(()=>apply('incompatible source',spec));}
 assert(sql.includes(selectedStepAwardSchemaV3()));
});
test('new immutable award schema binds genuine V3 reviews without a legacy alias',()=>{
 const schema=selectedStepAwardSchemaV3();
 for(const s of ['selected_step_award_sets_v3','references app.selected_step_fund_reviews_v3(id,tournament_id,event_id)',
  'references app.playoff_prize_proposal_revisions_v2','selected-step-award-request-v3','reject_immutable_history','force row level security',
  'source_capture','fund_review_id','per_person_minor%rounding_unit_minor=0','recipient_count between 4 and 64'])assert(schema.includes(s),s);
 assert(!schema.includes('references app.native_recorded_fund_reviews_v1'));assert(!schema.includes('references app.native_ledger_allocation_revisions_v1'));
});
test('source consumes actual V3 reviewed funds and sporting evidence, preserving methods/groups and explicit unsupported holds',()=>{
 const s=apply(body(specs[0]),specs[0]);
 for(const token of ['current_selected_step_fund_v3(actor,sid,tid,eid)','current-selected-step-fund-v3','recordedFundComplete',"c->'sportingSource'",'ownershipRevisionId',
  'regularAllocationFundMinor','modern_entry_fee_reference_adapter_required','fund_imbalance','valid_playoff_prize_proposal_history_v2',
  "'equal','winner-takes-all','graduated','winner-multiplier'",'recipient_reconciliation_failed','firstPlace','lastPlace','people','roundingUnitMinor','selected-step-award-source-v3'])assert(s.includes(token),token);
 for(const token of ['get_native_recorded_fund_review_source_v1','get_current_common_entry_fee_source_v1','nativeFinanceSource','get_playoff_prize_proposal_workspace_v2'])assert(!s.includes(token),token);
 // Arithmetic and paid/unpaid groups remain byte-identical outside explicit
 // dependency/domain edits. Tests do not claim a synthetic source is DB proof.
 assert(s.includes("if total<>fund then return jsonb_build_object('status','blocked','code','fund_imbalance')"));
 assert(s.includes("else amount:=0;end if;"));assert(!/insert into|update app\.|delete from/.test(s));
});
test('saved current proposal head is assigned and bound before validating or applying manual group adjustments',()=>{
 const s=apply(body(specs[0]),specs[0]),assign=s.indexOf("head:=w->'head';"),validate=s.indexOf("valid_playoff_prize_proposal_history_v2(input,head->'overrideHistory')"),overrides=s.indexOf("jsonb_array_elements(head->'overrideHistory')");
 assert(assign>=0&&validate>assign&&overrides>validate);
 for(const token of ["jsonb_typeof(head)is distinct from'object'","head->'input'is distinct from input","head->'sourceCapture'is distinct from w->'nativeSource'","amount:=(ov->>'perPersonMinor')::numeric","ov->'voided'='false'::jsonb"])assert(s.includes(token),token);
});
test('writer revalidates actual V3 review and source before saving exact unpaid recipients/history',()=>{
 const s=apply(body(specs[1]),specs[1]);
 for(const token of ['selected_step_final_access_v3(actor,sid,tid,eid)','current_selected_step_award_source_v3(actor,sid,tid,eid)',"s#>'{fundSource,reviewId}'",'source_changed','operation_conflict','selected_step_award_sets_v3',
  'selected_step_award_groups_v3','selected_step_award_recipients_v3','modern_award_postcondition_failed','insert into app.audit_events',"'sessionId',sid",'recordedUnpaid',"'moneyMoved',false"])assert(s.includes(token),token);
 assert(!s.includes('auth.uid()'));assert(!s.includes('fundSource,capture,latestReview'));
 assert(s.indexOf('source_changed')<s.indexOf('insert into app.selected_step_award_operations_v3'));
 assert(s.indexOf('selected_step_final_access_v3',s.indexOf("unit:=(s->>"))<s.indexOf('insert into app.selected_step_award_operations_v3'));
 const r=apply(body(specs[2]),specs[2]);assert(r.includes('selected_step_award_sets_v3'));assert(r.includes("'currentSourceVerified',false"));assert(r.includes('selected_step_final_access_v3'));
});
test('reciprocal liabilities and post-final source guards stay event scoped and do not conflate standalone optional funds',()=>{
 for(const token of ['guard_selected_step_awards_v3','for update nowait','legacy_financial_liability_exists_v1','modern_prize_award_sets_v2','native_optional_final_award_sets_v2',
  'multi_event_joint_finals_v1','selected_step_fund_reviews_v3','selected_step_pool_ownership_revisions_v3','playoff_series_generations_v1','before insert on app.%I',
  "event_id=new.event_id",'select false','from public,anon,authenticated,service_role'])assert(sql.includes(token),token);
 const guard=sql.slice(sql.indexOf('create function app.guard_selected_step_awards_v3'));
 assert(!guard.includes('selected_step_pool_finals_v3'));assert(!guard.includes('selected_step_awards_enabled_v3()is distinct'));
 assert(!/grant execute|set_config|disable trigger|delete from/.test(sql));
});
