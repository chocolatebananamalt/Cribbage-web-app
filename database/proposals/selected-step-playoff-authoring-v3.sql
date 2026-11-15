-- PRIVATE / DEFAULT OFF. Compatible modern-rule review, playoff Start and
-- match-generation authoring. Requires selected-step-final-review-v3 and its
-- genuine V3 activation/gate/series readers. No scores, results or money written.
-- Existing journals/requests stay immutable; only new V3 requests are authored.
begin;
create function app.selected_step_playoff_authoring_enabled_v3()returns boolean
language sql stable set search_path=''set timezone='UTC'as $gate$select false$gate$;

-- Exact-count clones preserve all original validation, source pins, retry,
-- expected-head, no-rebase-after-work and parent-result checks. Table hash
-- namespaces remain unchanged; V3 request kinds distinguish new operations.

do $clone$declare original regprocedure:='app.finish_event_settings_playoff_review_v1(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern authoring prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare a uuid:=auth.uid();","declare a uuid:=actor;",1],["begin\n h:=","begin\n if app.selected_step_playoff_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception''selected_step_authoring_access_changed'';end if;\n h:=",1],["return response;","insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''selected_step_playoff_v3'',op,''authoring_attempt_recorded'',jsonb_build_object(''sessionId'',sid,''request'',v,''outcome'',response));return response;",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern authoring clone anchor changed: %: %','app.finish_selected_step_playoff_review_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.finish_selected_step_playoff_review_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid, v jsonb, outcome jsonb)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.finish_selected_step_playoff_review_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid, v jsonb, outcome jsonb)owner to postgres';
 execute 'revoke all on function app.finish_selected_step_playoff_review_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid, v jsonb, outcome jsonb)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.review_event_settings_playoffs_v1(uuid,uuid,jsonb)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern authoring prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare a uuid:=auth.uid();","declare a uuid:=actor;",1],["begin\n if","begin\n if app.selected_step_playoff_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if",1],["v->>''kind''is distinct from''event-settings-playoff-gate-v1''","v->>''kind''is distinct from''selected-step-playoff-review-v3''",1],["app.event_settings_playoff_source_v1(tid,eid)","app.selected_step_pool_playoff_source_v3(actor,tid,eid)",1],["app.finish_event_settings_playoff_review_v1(tid,eid,op,v,","app.finish_selected_step_playoff_review_v3(actor,sid,tid,eid,op,v,",4]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern authoring clone anchor changed: %: %','app.review_selected_step_playoffs_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.review_selected_step_playoffs_v3(actor uuid, sid uuid, tid uuid, eid uuid, v jsonb)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.review_selected_step_playoffs_v3(actor uuid, sid uuid, tid uuid, eid uuid, v jsonb)owner to postgres';
 execute 'revoke all on function app.review_selected_step_playoffs_v3(actor uuid, sid uuid, tid uuid, eid uuid, v jsonb)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.start_event_settings_playoffs_v1(uuid,uuid,jsonb)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern authoring prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare a uuid:=auth.uid();","declare a uuid:=actor;",1],["begin\n if","begin\n if app.selected_step_playoff_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if",1],["v->>''kind''is distinct from''event-settings-playoff-start-v1''","v->>''kind''is distinct from''selected-step-playoff-start-v3''",1],["app.event_settings_playoff_source_v1(tid,eid)","app.selected_step_pool_playoff_source_v3(actor,tid,eid)",1],["app.finish_event_settings_playoff_review_v1(tid,eid,op,v,","app.finish_selected_step_playoff_review_v3(actor,sid,tid,eid,op,v,",6]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern authoring clone anchor changed: %: %','app.start_selected_step_playoffs_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.start_selected_step_playoffs_v3(actor uuid, sid uuid, tid uuid, eid uuid, v jsonb)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.start_selected_step_playoffs_v3(actor uuid, sid uuid, tid uuid, eid uuid, v jsonb)owner to postgres';
 execute 'revoke all on function app.start_selected_step_playoffs_v3(actor uuid, sid uuid, tid uuid, eid uuid, v jsonb)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.get_event_settings_playoff_operation_v1(uuid,uuid,uuid)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern authoring prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare a uuid:=auth.uid();","declare a uuid:=actor;",1],["begin\n if","begin\n if app.selected_step_playoff_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern authoring clone anchor changed: %: %','app.get_selected_step_playoff_operation_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.get_selected_step_playoff_operation_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.get_selected_step_playoff_operation_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid)owner to postgres';
 execute 'revoke all on function app.get_selected_step_playoff_operation_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.finish_playoff_series_generation_v1(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern authoring prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare a uuid:=auth.uid();","declare a uuid:=actor;",1],["begin\n h:=","begin\n if app.selected_step_playoff_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception''selected_step_authoring_access_changed'';end if;\n h:=",1],["return response;","insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''selected_step_generation_v3'',op,''authoring_attempt_recorded'',jsonb_build_object(''sessionId'',sid,''request'',v,''outcome'',response));return response;",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern authoring clone anchor changed: %: %','app.finish_selected_step_generation_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.finish_selected_step_generation_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid, v jsonb, outcome jsonb)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.finish_selected_step_generation_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid, v jsonb, outcome jsonb)owner to postgres';
 execute 'revoke all on function app.finish_selected_step_generation_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid, v jsonb, outcome jsonb)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.create_playoff_series_generation_v1(uuid,uuid,jsonb)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern authoring prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare a uuid:=auth.uid();","declare a uuid:=actor;",1],["begin\n if","begin\n if app.selected_step_playoff_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if",1],["v->>''kind''is distinct from''playoff-series-generation-v1''","v->>''kind''is distinct from''selected-step-series-generation-v3''",1],["app.playoff_series_match_source_v1(tid,eid,qid,slot_no)","app.selected_step_series_match_source_v3(actor,tid,eid,qid,slot_no)",1],["app.finish_playoff_series_generation_v1(tid,eid,op,v,","app.finish_selected_step_generation_v3(actor,sid,tid,eid,op,v,",8]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern authoring clone anchor changed: %: %','app.create_selected_step_generation_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.create_selected_step_generation_v3(actor uuid, sid uuid, tid uuid, eid uuid, v jsonb)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.create_selected_step_generation_v3(actor uuid, sid uuid, tid uuid, eid uuid, v jsonb)owner to postgres';
 execute 'revoke all on function app.create_selected_step_generation_v3(actor uuid, sid uuid, tid uuid, eid uuid, v jsonb)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.get_playoff_series_generation_operation_v1(uuid,uuid,uuid)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern authoring prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["declare a uuid:=auth.uid();","declare a uuid:=actor;",1],["begin\n if","begin\n if app.selected_step_playoff_authoring_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;\n if",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern authoring clone anchor changed: %: %','app.get_selected_step_generation_operation_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.get_selected_step_generation_operation_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.get_selected_step_generation_operation_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid)owner to postgres';
 execute 'revoke all on function app.get_selected_step_generation_operation_v3(actor uuid, sid uuid, tid uuid, eid uuid, op uuid)from public,anon,authenticated,service_role';
end$clone$;

-- Existing table trigger must validate the SAME modern source as the new
-- authoring function. Dispatch is based on the operational binding's real pin,
-- never the request kind. Failed modern admission never falls back to legacy.
-- Tables remain revoked: live session admission is in every private authoring
-- entry and finish helper; trigger additionally requires the existing service
-- primary-director scope. Old functions and nonmodern source behavior remain.
do $start_guard$declare target regprocedure:='app.require_event_settings_playoff_start_v1()'::regprocedure;definition text;old text;replacement text;begin
 if not exists(select 1 from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef)then raise exception'untrusted modern Start guard prerequisite';end if;
 definition:=replace(pg_get_functiondef(target),E'\r\n',E'\n');
 old:='src:=app.event_settings_playoff_source_v1(new.tournament_id,new.event_id);';
 replacement:=$modern$
 if exists(select 1 from app.event_settings_operational_bindings_v1 b join app.event_prize_policy_activation_pins_v1 p
  on p.actor_id=b.intent_actor_id and p.operation_id=b.intent_operation_id and p.tournament_id=b.tournament_id
  where b.tournament_id=new.tournament_id and b.event_id=new.event_id)then
  if app.selected_step_playoff_authoring_enabled_v3()is distinct from true
   or app.native_optional_finance_service_access_v2(new.actor_id,new.tournament_id,new.event_id)is distinct from true
  then raise exception'modern_playoff_authoring_required';end if;
  src:=app.selected_step_pool_playoff_source_v3(new.actor_id,new.tournament_id,new.event_id);
 else
  src:=app.event_settings_playoff_source_v1(new.tournament_id,new.event_id);
 end if;$modern$;
 if(length(definition)-length(replace(definition,old,'')))/length(old)<>1 then raise exception'modern Start guard source seam changed';end if;
 -- Keep the trigger's existing OID, all other checks and its original grants.
 definition:=replace(definition,old,replacement);
 execute replace(definition,'CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
end$start_guard$;

alter function app.selected_step_playoff_authoring_enabled_v3()owner to postgres;
revoke all on function app.selected_step_playoff_authoring_enabled_v3()from public,anon,authenticated,service_role;
commit;
