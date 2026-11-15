import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {selectedStepPlayoffAuthoringClonesV3 as specs}from'./helpers/selected-step-playoff-authoring-clones-v3.mjs';
import {applySelectedStepCloneV3 as apply}from'./helpers/selected-step-final-clones-v3.mjs';
const read=n=>fs.readFileSync('database/proposals/'+n+'.sql','utf8').replaceAll('\r\n','\n');
const sql=read('selected-step-playoff-authoring-v3');
function source(spec){
 const name=spec.signature.split('(')[0],file=name.includes('generation')?'playoff-series-matches-v1':'event-settings-playoff-gate-v1',text=read(file);
 const start=text.indexOf('create function '+name+'('),begin=text.indexOf('as $$',start)+5,end=text.indexOf('$$;',begin);assert(start>=0&&begin>=5&&end>begin,name);
 let body=text.slice(begin,end);
 if(name==='app.create_playoff_series_generation_v1'){
  const large=read('playoff-series-large-fields-v2'),marker="oidv oid:=to_regprocedure('app.create_playoff_series_generation_v1",at=large.indexOf(marker),block=large.slice(at,large.indexOf('end$patch$;',at));
  for(const m of block.matchAll(/old:='((?:''|[^'])*)';new:='((?:''|[^'])*)';/g)){
   const old=m[1].replaceAll("''","'"),replacement=m[2].replaceAll("''","'");assert.equal(body.split(old).length-1,1);body=body.replace(old,()=>replacement);
  }
 }
 return body;
}
test('all modern authoring clones exactly match existing sources and current large-field patch',()=>{
 const arrays=[...sql.matchAll(/jsonb_array_elements\('((?:''|[^'])*)'::jsonb\)/g)].map(m=>JSON.parse(m[1].replaceAll("''","'")));
 assert.equal(arrays.length,specs.length);
 for(const[i,spec]of specs.entries()){
  assert.deepEqual(arrays[i],spec.patches);const body=source(spec),result=apply(body,spec);assert.notEqual(result,body);
  assert(result.includes('selected_step_final_access_v3(actor,sid,tid,eid)'));assert(result.includes('selected_step_playoff_authoring_enabled_v3()'));
  assert(!result.includes('auth.uid()'));assert.throws(()=>apply('changed source',spec));
 }
});
test('review and Start preserve source, independent rule review, expected head and exact history',()=>{
 const review=specs.find(s=>s.name==='app.review_selected_step_playoffs_v3'),r=apply(source(review),review);
 for(const token of ['selected_step_pool_playoff_source_v3(actor,tid,eid)','source_changed','operation_conflict','insert into app.event_settings_playoff_reviews_v1',
  "'selected-step-playoff-review-v3'","'event-settings-playoff-gate-v1'",'historicalReceipt','currentSourceVerified'])assert(r.includes(token),token);
 const start=specs.find(s=>s.name==='app.start_selected_step_playoffs_v3'),s=apply(source(start),start);
 for(const token of ['current_playoff_review_required','playoff_start_changed','already_started','source_digest=src','expectedStartId',"'selected-step-playoff-start-v3'",'insert into app.event_settings_playoff_starts_v1'])assert(s.includes(token),token);
 assert(!s.includes('app.event_settings_playoff_source_v1(tid,eid)'));
});
test('generation preserves parent/current-source and all no-rebase-after-play safeguards',()=>{
 const spec=specs.find(s=>s.name==='app.create_selected_step_generation_v3'),body=apply(source(spec),spec);
 for(const token of ['selected_step_series_match_source_v3(actor,tid,eid,qid,slot_no)','expectedGenerationId','generation_changed',
  'bracket_recovery_review_required','generation_recovery_review_required','generation_already_current','app.playoff_series_game_actions_v1',
  "'selected-step-series-generation-v3'","'playoff-series-generation-v1'",'source_capture','prior_generation_id','^([1-9]|[1-5][0-9]|6[0-3])$'])assert(body.includes(token),token);
 assert(!/insert into app\.(?:playoff_series_games_v1|playoff_series_results_v1|.*award|.*fund)/.test(body));
});
test('finish helpers add separate session audit without changing original journal hash domains or receipts',()=>{
 for(const spec of specs.filter(s=>s.name.includes('.finish_'))){
  const original=source(spec),body=apply(original,spec);
  assert(body.includes('insert into app.audit_events'));assert(body.includes("'sessionId',sid"));assert(body.includes('authoring_attempt_recorded'));
  assert(body.indexOf('selected_step_final_access_v3')<body.indexOf('insert into app.'));
  const oldHash=original.match(/jsonb_build_array\('([^']+)'/)[1],newHash=body.match(/jsonb_build_array\('([^']+)'/)[1];assert.equal(newHash,oldHash);
  assert(body.includes('return response;'));
 }
});
test('Start trigger dispatches only authoritative modern pins and retains every existing backstop',()=>{
 const original=read('event-settings-playoff-gate-v1'),a=original.indexOf('create function app.require_event_settings_playoff_start_v1()'),b=original.indexOf('end$$;',a),body=original.slice(a,b);
 const old=sql.match(/old:='((?:''|[^'])*)';/)[1].replaceAll("''","'"),replacement=sql.match(/replacement:=\$modern\$([\s\S]*?)\$modern\$/)[1];
 assert.equal(body.split(old).length-1,1);const result=body.replace(old,()=>replacement);
 for(const token of ['event_prize_policy_activation_pins_v1','p.actor_id=b.intent_actor_id','p.operation_id=b.intent_operation_id','b.event_id=new.event_id',
  'modern_playoff_authoring_required','native_optional_finance_service_access_v2','selected_step_pool_playoff_source_v3',
  'event_settings_playoff_source_v1(new.tournament_id,new.event_id)','event_settings_playoff_review_required','event_settings_playoff_start_changed',
  'new.version<>coalesce(head.version,0)+1','new.prior_start_id is distinct from head.id'])assert(result.includes(token),token);
 assert.equal(result.replace(replacement,old),body);assert(!replacement.includes('v->'));assert(sql.includes('select false'));
 assert(!/grant execute|set_config|disable trigger|delete from/i.test(sql));
});
