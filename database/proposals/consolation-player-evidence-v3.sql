-- LOCAL/default off. After selected-step-consolation-v3 and player scoring.
-- Player evidence replays the recorded Director's genuine event-specific
-- activation/admission without impersonating a finance-service session.
begin;
create function app.consolation_player_evidence_enabled_v3()returns boolean language sql stable set search_path=''as $$select false$$;
do $construct$declare sig text;body text;old text;target text;begin
 if current_user<>'postgres'then raise exception'postgres owner required';end if;
 foreach target in array array['pin','gate']loop
  sig:=case target when'pin'then'app.consolation_activation_pin_v3(uuid,uuid,uuid)'else'app.consolation_playoff_source_v3(uuid,uuid,uuid)'end;
  if not exists(select 1 from pg_proc where oid=to_regprocedure(sig)and proowner='postgres'::regrole and prosecdef)then raise exception'consolation_player_trusted_source_missing';end if;
  select prosrc into body from pg_proc where oid=to_regprocedure(sig);
  old:='app.selected_step_pool_ownership_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true';
  if length(body)-length(replace(body,old,''))<>length(old)then raise exception'consolation_player_access_anchor_changed';end if;
  body:=replace(body,old,'app.selected_step_pool_ownership_enabled_v3()is distinct from true or app.selected_step_player_scoring_enabled_v3()is distinct from true or app.consolation_player_evidence_enabled_v3()is distinct from true');
  if target='gate'then
   old:='app.selected_step_pool_activation_pin_v3(actor,tid,eid)';
   if length(body)-length(replace(body,old,''))<>length(old)then raise exception'consolation_player_pin_anchor_changed';end if;
   body:=replace(body,old,'app.consolation_player_pin_evidence_v3(actor,tid,eid)');
  end if;
  execute format('create function app.consolation_player_%s_evidence_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''''set timezone=''UTC''as %L',target,body);
 end loop;
end$construct$;
do $preserve$declare d text;begin
 d:=pg_get_functiondef('app.selected_step_player_gate_evidence_v3(uuid,uuid,uuid)'::regprocedure);
 if strpos(d,'FUNCTION app.selected_step_player_gate_evidence_v3(')=0 then raise exception'consolation_player_delegate_anchor_changed';end if;
 execute replace(d,'FUNCTION app.selected_step_player_gate_evidence_v3(','FUNCTION app.selected_step_player_gate_before_consolation_v3(');
end$preserve$;
create or replace function app.selected_step_player_gate_evidence_v3(actor uuid,tid uuid,eid uuid)returns jsonb language plpgsql security definer set search_path=''set timezone='UTC'as $$begin
 if exists(select 1 from app.events where id=eid and tournament_id=tid and event_type='consolation')then return app.consolation_player_gate_evidence_v3(actor,tid,eid);end if;
 return app.selected_step_player_gate_before_consolation_v3(actor,tid,eid);
end$$;
do $secure$declare sig text;begin foreach sig in array array['app.consolation_player_evidence_enabled_v3()','app.consolation_player_pin_evidence_v3(uuid,uuid,uuid)','app.consolation_player_gate_evidence_v3(uuid,uuid,uuid)','app.selected_step_player_gate_before_consolation_v3(uuid,uuid,uuid)','app.selected_step_player_gate_evidence_v3(uuid,uuid,uuid)']loop execute format('alter function %s owner to postgres',sig);execute format('revoke all on function %s from public,anon,authenticated,service_role',sig);end loop;end$secure$;
commit;
