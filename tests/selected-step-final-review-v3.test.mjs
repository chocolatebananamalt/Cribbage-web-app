import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {selectedStepFinalClonesV3,applySelectedStepCloneV3} from './helpers/selected-step-final-clones-v3.mjs';
const read=name=>fs.readFileSync('database/proposals/'+name+'.sql','utf8').replaceAll('\r\n','\n');
const sql=read('selected-step-final-review-v3');
function source(spec){
 const name=spec.signature.slice(0,spec.signature.indexOf('('));
 const file=name.includes('mrp')?'native-playoff-mrp-source-v1':name.includes('proposal')?'playoff-prize-proposal-store-v2':'playoff-series-matches-v1';
 const text=read(file),start=text.indexOf('create function '+name+'(');assert(start>=0,name);
 const begin=text.indexOf('as $$',start)+5,end=text.indexOf('$$;',begin);assert(begin>=5&&end>begin);
 let body=text.slice(begin,end);
 if(name==='app.playoff_series_match_source_v1'){
  const large=read('playoff-series-large-fields-v2'),block=large.slice(large.indexOf('do $patch$'),large.indexOf('end$patch$;'));
  for(const m of block.matchAll(/old:='((?:''|[^'])*)';new:='((?:''|[^'])*)';/g)){
   const old=m[1].replaceAll("''","'"),replacement=m[2].replaceAll("''","'");assert.equal(body.split(old).length-1,1);body=body.replace(old,()=>replacement);
  }
 }
 return body;
}
test('every source-clone seam matches actual existing source; deployed installer has identical exact-count patches',()=>{
 const arrays=[...sql.matchAll(/jsonb_array_elements\('((?:''|[^'])*)'::jsonb\)/g)].map(m=>JSON.parse(m[1].replaceAll("''","'")));
 assert.equal(arrays.length,selectedStepFinalClonesV3.length);
 for(const [i,spec]of selectedStepFinalClonesV3.entries()){
  assert.deepEqual(arrays[i],spec.patches);const body=source(spec),result=applySelectedStepCloneV3(body,spec);assert.notEqual(result,body);
  assert.throws(()=>applySelectedStepCloneV3('incompatible source',spec),/incompatible clone/);
  assert(sql.includes('create function '+spec.name+'('+spec.args+')'));
 }
});
test('sporting reader retains all actual result, parent and independent confirmation proof',()=>{
 const spec=selectedStepFinalClonesV3.find(x=>x.name==='app.selected_step_sporting_source_v3'),body=applySelectedStepCloneV3(source(spec),spec);
 for(const token of ['qualification_resolution_snapshot_current_v1','generation.source_capture is distinct from match_source',
  'playoff_series_completed_result_valid_v1(result_row.id)','side_a_submission','side_b_submission','side_a_confirmation','side_b_confirmation',
  'parentResultPins','actionHistoryDigest','playoff_series_set_changed','playoff_series_large_fields_enabled_v2','qualifier_count>64',
  'selected_step_series_match_source_v3','selected_step_series_current_result_v3','selected_step_pool_playoff_source_v3'])assert(body.includes(token),token);
 assert(!body.includes('app.event_settings_playoff_source_v1('));assert(!body.includes('auth.jwt()'));
 const match=selectedStepFinalClonesV3[0],m=applySelectedStepCloneV3(source(match),match);
 assert(m.includes('playoff_series_chart_slots_v2'));assert(m.includes('selected_step_series_current_result_v3(actor,tid,eid,qid,'));
 assert(m.includes('start_row.source_digest is distinct from native'));assert(m.includes('distinct_linked_digital_players_required'));
});
test('proposal authoring keeps original history/adoption/concurrency/exact-recovery rules and uses actual V3 source',()=>{
 for(const spec of selectedStepFinalClonesV3.filter(x=>x.name.includes('prize_'))){
  const body=applySelectedStepCloneV3(source(spec),spec);assert(body.includes('selected_step_final_access_v3(actor,sid,tid,eid)'));
  assert(!body.includes('auth.uid()'));assert(!body.includes('app.get_playoff_prize_native_source_v2('));
  if(spec.name.includes('save_'))for(const token of ['get_selected_step_prize_source_v3','immutable_history_prefix_required','explicit_source_adoption_required',
   'valid_playoff_prize_proposal_history_v2','playoff_prize_proposal_range_safe_v2','request_text is distinct from request_text','for update of ptr nowait','operation_conflict'])assert(body.includes(token),token);
 }
});
test('fund collector uses genuine current proposal, sporting and separate pool evidence, not old Finance source',()=>{
 for(const token of ['get_selected_step_prize_workspace_v3(actor,sid,tid,eid)','selected_step_sporting_source_v3(actor,sid,tid,eid)',
  'get_selected_step_pool_source_v3(actor,tid,eid)','sporting_prize_source_changed','current_separate_pool_proof_required',
  'native_unrestricted_income_sources_v1','native_unrestricted_income_records_v1','native_optional_income_records_v2',
  'modern_income_lineage_adapter_required','sanctioning_coverage_unverified',"'deductAgain',false",'source is distinct from head.source_capture',
  'request->>\'incomeStatus\'','selected_step_fund_outcomes_v3','app.audit_events'])assert(sql.includes(token),token);
 assert(!sql.includes('app.operational_event_finance_source_v1('));assert(!sql.includes('app.get_native_recorded_fund_review_source_v1('));
 assert(sql.includes('references app.selected_step_pool_ownership_revisions_v3'));assert(sql.includes('references app.playoff_prize_proposal_revisions_v2'));
 assert(!sql.includes('references app.native_ledger_allocation_revisions_v1'));assert(!sql.includes('references app.operational_event_finance_revisions_v1'));
});
test('source gates and access stay closed; session/user/primary-role and atomic audit are required',()=>{
 for(const token of ['select false','sid is null','auth.users','deleted_at is null','auth.sessions','user_id=actor',"role='director'",'native_optional_finance_service_access_v2',
  'force row level security','reject_immutable_history','no_truncate','for update nowait','pg_try_advisory_xact_lock',
  "'incomeStatus','reviewed_zero'",'source_changed','stale_version','modern_fund_review_stale','existing_regular_liability'])assert(sql.includes(token),token);
 assert(!/grant execute|set_config|create or replace function app\.(?:event_settings|operational|current_modern)/i.test(sql));
 const writer=sql.slice(sql.indexOf('create function app.review_selected_step_fund_v3'),sql.indexOf('create function app.current_selected_step_fund_v3'));
 assert(writer.indexOf('sourceDigest\'is distinct from request')<writer.indexOf('insert into app.selected_step_fund_operations_v3'));
 assert(writer.includes('insert into app.audit_events'));assert(!writer.includes('when others'));
});
test('fee-coverage guard protects both write directions and old settlement finalization',()=>{
 const begin=sql.indexOf('create function app.guard_selected_step_sanction_reuse_v3'),end=sql.indexOf('create function app.selected_step_sanctioning_coverage_v3');
 const body=sql.slice(begin,end);
 for(const token of ['for update nowait','event_settlement_finals_v2','new.draft_id','selected_step_fund_reviews_v3','native_recorded_fund_reviews_v1',
  'native_optional_fund_reviews_v2','event_id<>new.event_id','before insert on app.%I','selected_step_sanctioning_expense_reused'])assert(body.includes(token),token);
 assert(!body.includes('select false')); // Integrity protection cannot vanish when feature gate closes.
});
