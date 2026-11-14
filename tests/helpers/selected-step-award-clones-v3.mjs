import fs from'node:fs';import{createHash}from'node:crypto';
const text=fs.readFileSync(new URL('../../database/proposals/modern-prize-awards-v2.sql',import.meta.url),'utf8').replaceAll('\r\n','\n');
const at=text.indexOf('create function app.current_modern_prize_award_source_v2('),a=text.indexOf(' f:=',at),b=text.indexOf(' q:=(n',a),prefix=text.slice(a,b),fa=text.indexOf(' if first_round_paid then',b),fb=text.indexOf(" if method in('graduated','winner-multiplier')then",fa),fee=text.slice(fa,fb);
for(const[value,hash]of[[prefix,'f0f6c2119216d135ec8ffc81dba32e275385ce2bfdf4988299200aa683961c0b'],[fee,'adbb8943e68e719fb8c2e5fe8f25ac1e6f50bb18d860c069ad75f77e3f139879']])
 if(createHash('sha256').update(value).digest('hex')!==hash)throw Error('Reviewed modern award integration seam changed');
const admission="begin\n if app.selected_step_awards_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if";
export const selectedStepAwardTableMapV3=[['modern_prize_award_operations_v2','selected_step_award_operations_v3'],['modern_prize_award_sets_v2','selected_step_award_sets_v3'],['modern_prize_award_groups_v2','selected_step_award_groups_v3'],['modern_prize_award_recipients_v2','selected_step_award_recipients_v3'],['modern_prize_award_outcomes_v2','selected_step_award_outcomes_v3']];
export const selectedStepAwardClonesV3=[
 {signature:'app.current_modern_prize_award_source_v2(uuid,uuid)',name:'app.current_selected_step_award_source_v3',args:'actor uuid, sid uuid, tid uuid, eid uuid',patches:[
  [prefix,` if app.selected_step_awards_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 f:=app.current_selected_step_fund_v3(actor,sid,tid,eid);if f->>'status'='retry_exact'then return f;end if;
 if f is null or f->>'status'is distinct from'source_available'or f->>'kind'is distinct from'current-selected-step-fund-v3'or f->'recordedFundComplete'is distinct from'true'::jsonb then return jsonb_build_object('status','blocked','code','current_modern_fund_required');end if;
 c:=f->'capture';w:=c->'prizeWorkspace';n:=c->'sportingSource';input:=w#>'{nativeSource,capture,input}';head:=w->'head';
 if c->>'kind'is distinct from'selected-step-final-review-source-v3'or c->>'actorId'is distinct from actor::text or c->>'tournamentId'is distinct from tid::text or c->>'eventId'is distinct from eid::text
  or input#>'{ledger,current}'is distinct from c#>'{ownershipLedger,ledger}'or input#>'{ledger,allocationRevisionId}'is distinct from c#>'{ownershipLedger,ownershipRevisionId}'
  or input#>'{qualification,currentResultVersionId}'is distinct from n#>'{qualification,resultVersionId}'or w->'stale'is distinct from'false'::jsonb
  or jsonb_typeof(head)is distinct from'object'or head->'input'is distinct from input or head->'sourceCapture'is distinct from w->'nativeSource'
  or c#>'{income,activeMinor}'is distinct from'0'::jsonb or c#>'{income,records}'is distinct from'[]'::jsonb
 then return jsonb_build_object('status','blocked','code','modern_award_source_binding_changed');end if;
`,1],
  [fee," if first_round_paid then return jsonb_build_object('status','blocked','code','modern_entry_fee_reference_adapter_required');end if;\n",1],
  ["(c#>>'{totals,recordedFundMinor}')","(c#>>'{totals,regularAllocationFundMinor}')",1],
  ["'actorId',auth.uid()","'actorId',actor",1],['modern-prize-award-source-v2','selected-step-award-source-v3',2],
 ]},
 {signature:'app.record_modern_prize_awards_v2(uuid,uuid,uuid,jsonb)',name:'app.record_selected_step_awards_v3',args:'actor uuid, sid uuid, tid uuid, eid uuid, op uuid, request jsonb',patches:[
  ['declare actor uuid:=auth.uid();','declare ',1],['begin\n if',admission,1],['app.modern_prize_awards_enabled_v2()','app.selected_step_awards_enabled_v3()',1],
  ['app.current_modern_prize_award_source_v2(tid,eid)','app.current_selected_step_award_source_v3(actor,sid,tid,eid)',1],
  ["s#>'{fundSource,capture,latestReview,reviewId}'","s#>'{fundSource,reviewId}'",1],
  ["unit:=(s->>'roundingUnitMinor')::integer;","unit:=(s->>'roundingUnitMinor')::integer; if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;",1],
  ...selectedStepAwardTableMapV3.map(([old,name],i)=>[old,name,[3,2,4,4,2][i]]),
  ['modern-prize-award-request-v2','selected-step-award-request-v3',1],['modern-prize-award-receipt-v2','selected-step-award-receipt-v3',1],['modern_prize_awards_v2','selected_step_awards_v3',1],
  ["'recorded_unpaid',response);","'recorded_unpaid',response||jsonb_build_object('sessionId',sid));",1],
 ]},
 {signature:'app.get_modern_prize_award_record_v2(uuid,uuid)',name:'app.get_selected_step_award_record_v3',args:'actor uuid, sid uuid, tid uuid, eid uuid',patches:[
  ['declare a uuid:=auth.uid();','declare a uuid:=actor;',1],['begin\n if',admission,1],['app.modern_prize_awards_enabled_v2()','app.selected_step_awards_enabled_v3()',1],
  ...selectedStepAwardTableMapV3.slice(1,4).map(([old,name],i)=>[old,name,[2,1,1][i]]),['modern-prize-award-record-v2','selected-step-award-record-v3',1],
 ]},
];
export function selectedStepAwardSchemaV3(){
 let schema=text.slice(text.indexOf('create table app.modern_prize_award_operations_v2('),text.indexOf('-- Reciprocal insert guards'));
 for(const[old,name]of selectedStepAwardTableMapV3)schema=schema.replaceAll(old,name);
 return schema.replaceAll('references app.native_recorded_fund_reviews_v1','references app.selected_step_fund_reviews_v3').replaceAll('modern-prize-award-request-v2','selected-step-award-request-v3');
}
