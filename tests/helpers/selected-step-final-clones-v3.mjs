// Exact, auditable source substitutions for private versioned readers. Existing
// functions are never replaced. Shared by installer generation and parity tests.
export const selectedStepFinalClonesV3 = [
 {signature:'app.playoff_series_match_source_v1(uuid,uuid,uuid,integer)',name:'app.selected_step_series_match_source_v3',args:'actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer',patches:[
  ['app.event_settings_playoff_source_v1(tid,eid)','app.selected_step_pool_playoff_source_v3(actor,tid,eid)',1],
  ['app.playoff_series_current_result_v1(tid,eid,qid,','app.selected_step_series_current_result_v3(actor,tid,eid,qid,',2],
 ]},
 {signature:'app.playoff_series_current_result_v1(uuid,uuid,uuid,integer)',name:'app.selected_step_series_current_result_v3',args:'actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer',patches:[
  ['app.playoff_series_match_source_v1(tid,eid,qid,slot_no)','app.selected_step_series_match_source_v3(actor,tid,eid,qid,slot_no)',1],
 ]},
 {signature:'public.get_native_playoff_mrp_source_v1(uuid,uuid)',name:'app.selected_step_sporting_source_v3',args:'actor uuid, sid uuid, p_tournament_id uuid, p_event_id uuid',patches:[
  ['declare actor uuid;','declare ',1],
  ['app.native_playoff_mrp_source_enabled_v1()','app.selected_step_final_review_enabled_v3()',2],
  ['actor:=app.native_playoff_mrp_actor_v1(p_tournament_id);if actor is null then return null;end if;',
   'if app.selected_step_final_access_v3(actor,sid,p_tournament_id,p_event_id)is distinct from true then return null;end if;',1],
  ['app.native_playoff_mrp_actor_v1(p_tournament_id)is distinct from actor','app.selected_step_final_access_v3(actor,sid,p_tournament_id,p_event_id)is distinct from true',1],
  ['app.event_settings_playoff_source_v1(p_tournament_id,p_event_id)','app.selected_step_pool_playoff_source_v3(actor,p_tournament_id,p_event_id)',1],
  ['app.playoff_series_match_source_v1(\n   p_tournament_id','app.selected_step_series_match_source_v3(\n   actor,p_tournament_id',1],
  ['app.playoff_series_current_result_v1(\n   p_tournament_id','app.selected_step_series_current_result_v3(\n   actor,p_tournament_id',1],
  ["'sessionId',auth.jwt()->>'session_id',",'',1],
  ['native-playoff-sporting-source-v1','selected-step-sporting-source-v3',2],
 ]},
 ...[
  ['get_playoff_prize_proposal_workspace_v2','get_selected_step_prize_workspace_v3',''],
  ['save_playoff_prize_proposal_v2','save_selected_step_prize_proposal_v3',', request_text text'],
  ['get_playoff_prize_proposal_operation_v2','get_selected_step_prize_operation_v3',', request_text text'],
 ].map(([old,name,tail])=>({signature:`app.${old}(uuid,uuid${tail?',text':''})`,name:`app.${name}`,args:`actor uuid, sid uuid, tid uuid, eid uuid${tail}`,patches:[
  ['declare actor uuid:=auth.uid();','declare ',1],
  ['begin\n if','begin\n if app.selected_step_final_review_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if',1],
  ...(old==='get_playoff_prize_proposal_operation_v2'?[]:[['app.get_playoff_prize_native_source_v2(tid,eid)','app.get_selected_step_prize_source_v3(actor,tid,eid)',1]]),
 ]})),
];

export function applySelectedStepCloneV3(body, spec) {
 let result=body.replaceAll('\r\n','\n');
 for(const [old,replacement,count]of spec.patches){
  if(result.split(old).length-1!==count)throw new Error(`incompatible clone ${spec.name}: ${old}`);
  result=result.replaceAll(old,()=>replacement);
 }
 return result;
}
