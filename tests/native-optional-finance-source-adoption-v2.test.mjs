import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../database/proposals/native-optional-finance-source-adoption-v2.sql',import.meta.url),'utf8');

test('adoption uses a separate immutable action domain and preserves proposal FK provenance',()=>{
 assert.match(sql,/create table app\.native_optional_finance_adoption_operations_v2/);
 assert.match(sql,/native-optional-finance-source-adoption-v2',actor_id,operation_id,tournament_id,event_id,request_payload/);
 assert.match(sql,/revision_operation_id uuid not null/);
 assert.match(sql,/references app\.native_optional_finance_operations_v2\(actor_id,operation_id,tournament_id,event_id\)/);
 assert.match(sql,/create trigger native_optional_finance_operations_v2_cross_action before insert/);
 assert.match(sql,/create trigger native_optional_finance_adoption_operations_v2_cross_action before insert/);
 assert.match(sql,/revision_request:=jsonb_build_object\('kind','native-optional-finance-proposal-v2'/);
 assert.match(sql,/native-optional-finance-proposal-v2',actor,revision_op,tid,eid,revision_request/);
});

test('exact request CAS and semantic frame exclude only reviewed cost facts',()=>{
 assert.match(sql,/count\(\*\)from jsonb_object_keys\(request\)\)<>14/);
 for(const key of['expectedPriorRevisionId','expectedPriorOwnershipRevisionId','expectedCurrentOwnershipRevisionId','expectedPriorSourceDigest','expectedPriorBasisDigest','expectedCurrentSourceDigest','expectedCurrentBasisDigest','expectedUnchangedFrameDigest'])assert.match(sql,new RegExp(key));
 for(const pin of['nativePlayoffSource','membership','qSource','qReview','sideBasis','rosterReceiptPartitions','sideRecordedSources','refundPolicy','receiptEvents','receiptHistoryIds','participantFacts'])assert.match(sql,new RegExp(`'${pin}'`));
 assert.match(sql,/same_actor_review_required/);
 assert.match(sql,/source_digest_invalid/);
 assert.match(sql,/non_cost_source_changed/);
 assert.match(sql,/current_source:=app\.native_optional_finance_source_v2\(actor,tid,eid\)/);
});

test('manual history is source-only rebound and overrides require a fresh valid plan',()=>{
 assert.match(sql,/rebound:=jsonb_set\(r,'\{line,source\}',current_basis#>'\{workspace,source\}'\)/);
 assert.match(sql,/manual_capture:=manual_capture\|\|jsonb_build_array\(jsonb_build_object\('prior',r,'rebound',rebound\)\)/);
 assert.match(sql,/edited_native_cost_adoption_unsupported/);
 assert.match(sql,/jsonb_array_length\(editor->'overrideHistory'\)<old_override_count/);
 assert.match(sql,/app\.valid_native_optional_finance_editor_v2\(editor,current_basis,null\)is distinct from true/);
 assert.match(sql,/fresh_override_review_required/);
 assert.match(sql,/override_plan->'history'is distinct from editor->'history'/);
 assert.match(sql,/editor->'lineForm'<>'null'::jsonb or editor->'bandForm'<>'null'::jsonb/);
});

test('candidate is private, default-off, proposal-only and reconciles exact historical requests',()=>{
 assert.match(sql,/native_optional_finance_source_adoption_enabled_v2\(\)returns boolean[\s\S]*select false/);
 assert.doesNotMatch(sql,/grant execute/);
 assert.match(sql,/revoke all on function %s from public,anon,authenticated,service_role/);
 assert.match(sql,/alter table app\.%I force row level security/);
 assert.match(sql,/currentFundAuthority',false,'proposalOnly',true,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false/);
 assert.match(sql,/status','historical_operation','result',result_value,'currentFundAuthority',false,'moneyMoved',false,'payoutAuthorized',false,'finalizationAuthorized',false/);
 assert.doesNotMatch(sql,/disburs|payment.*insert|final_award.*insert/i);
});

test('exact replay is serialized and current Director authorization precedes journal lookup',()=>{
 const save=sql.slice(sql.indexOf('create function app.save_native_optional_finance_source_adoption_v2'),sql.indexOf('create function app.reconcile_native_optional_finance_source_adoption_v2'));
 const reservation=save.indexOf("pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))"),role=save.indexOf("role='director'for key share nowait"),lookup=save.indexOf('select*into prior from app.native_optional_finance_adoption_operations_v2'),gate=save.indexOf('app.native_optional_finance_source_adoption_enabled_v2()is distinct from true');
 assert.ok(reservation>0&&role>reservation&&lookup>role&&gate>lookup);
 assert.match(save,/Re-read only after the actor\/operation reservation and current role lock/);
});

test('pure source-only rebind preserves every manual byte except source and keeps override prefix',()=>{
 const oldSource={tournamentId:'t',eventId:'e',sourceVersion:1,sourceDigest:'old'},currentSource={tournamentId:'t',eventId:'e',sourceVersion:2,sourceDigest:'new'};
 const priorBase=[{label:'Cost',line:{recordId:'base',lineId:'base',source:oldSource}}];
 const manual=[{label:'Director note',line:{recordId:'manual',lineId:'manual',priorRecordId:null,source:oldSource,mode:'estimate',category:'unrestricted_income',amountMinor:0,voided:false,reason:'Reviewed zero'}}];
 const currentBase=[{label:'New cost',line:{recordId:'newbase',lineId:'newbase',source:currentSource}}];
 const rebound=manual.map(row=>({...structuredClone(row),line:{...structuredClone(row.line),source:structuredClone(currentSource)}}));
 assert.deepEqual([...currentBase,...rebound].slice(1).map(row=>({...row,line:{...row.line,source:oldSource}})),manual);
 assert.deepEqual(priorBase.map(x=>x.line.lineId),['base']);assert.deepEqual(rebound.map(x=>x.line.lineId),['manual']);
 const priorOverrides=[{recordId:'o1',firstPlace:1,lastPlace:1,priorRecordId:null,perPersonMinor:500,voided:false,reason:'Initial'}];
 const appended=[...priorOverrides,{recordId:'o2',firstPlace:1,lastPlace:1,priorRecordId:'o1',perPersonMinor:1000,voided:false,reason:'Reviewed new fund'}];
 assert.deepEqual(appended.slice(0,priorOverrides.length),priorOverrides);
});
