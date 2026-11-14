// Explicit versioned authoring seams; old immutable journal domains are retained.
const access=['begin\n if','begin\n if app.selected_step_playoff_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if',1];
const finishAccess=['begin\n h:=','begin\n if app.selected_step_playoff_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception\'selected_step_authoring_access_changed\';end if;\n h:=',1];
const actor=['declare a uuid:=auth.uid();','declare a uuid:=actor;',1];
const audit=domain=>['return response;',`insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,'${domain}',op,'authoring_attempt_recorded',jsonb_build_object('sessionId',sid,'request',v,'outcome',response));return response;`,1];
export const selectedStepPlayoffAuthoringClonesV3=[
 {signature:'app.finish_event_settings_playoff_review_v1(uuid,uuid,uuid,jsonb,jsonb)',name:'app.finish_selected_step_playoff_review_v3',args:'actor uuid, sid uuid, tid uuid, eid uuid, op uuid, v jsonb, outcome jsonb',patches:[actor,finishAccess,audit('selected_step_playoff_v3')]},
 ...[
  ['review_event_settings_playoffs_v1','review_selected_step_playoffs_v3','event-settings-playoff-gate-v1','selected-step-playoff-review-v3',4],
  ['start_event_settings_playoffs_v1','start_selected_step_playoffs_v3','event-settings-playoff-start-v1','selected-step-playoff-start-v3',6],
 ].map(([old,name,kind,newKind,count])=>({signature:`app.${old}(uuid,uuid,jsonb)`,name:`app.${name}`,args:'actor uuid, sid uuid, tid uuid, eid uuid, v jsonb',patches:[actor,access,
  [`v->>'kind'is distinct from'${kind}'`,`v->>'kind'is distinct from'${newKind}'`,1],
  ['app.event_settings_playoff_source_v1(tid,eid)','app.selected_step_pool_playoff_source_v3(actor,tid,eid)',1],
  ['app.finish_event_settings_playoff_review_v1(tid,eid,op,v,','app.finish_selected_step_playoff_review_v3(actor,sid,tid,eid,op,v,',count],
 ]})),
 {signature:'app.get_event_settings_playoff_operation_v1(uuid,uuid,uuid)',name:'app.get_selected_step_playoff_operation_v3',args:'actor uuid, sid uuid, tid uuid, eid uuid, op uuid',patches:[actor,access]},
 {signature:'app.finish_playoff_series_generation_v1(uuid,uuid,uuid,jsonb,jsonb)',name:'app.finish_selected_step_generation_v3',args:'actor uuid, sid uuid, tid uuid, eid uuid, op uuid, v jsonb, outcome jsonb',patches:[actor,finishAccess,audit('selected_step_generation_v3')]},
 {signature:'app.create_playoff_series_generation_v1(uuid,uuid,jsonb)',name:'app.create_selected_step_generation_v3',args:'actor uuid, sid uuid, tid uuid, eid uuid, v jsonb',patches:[actor,access,
  ["v->>'kind'is distinct from'playoff-series-generation-v1'","v->>'kind'is distinct from'selected-step-series-generation-v3'",1],
  ['app.playoff_series_match_source_v1(tid,eid,qid,slot_no)','app.selected_step_series_match_source_v3(actor,tid,eid,qid,slot_no)',1],
  ['app.finish_playoff_series_generation_v1(tid,eid,op,v,','app.finish_selected_step_generation_v3(actor,sid,tid,eid,op,v,',8],
 ]},
 {signature:'app.get_playoff_series_generation_operation_v1(uuid,uuid,uuid)',name:'app.get_selected_step_generation_operation_v3',args:'actor uuid, sid uuid, tid uuid, eid uuid, op uuid',patches:[actor,access]},
];
