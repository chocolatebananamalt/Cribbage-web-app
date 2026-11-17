-- LOCAL V20 INCREMENTAL PROPOSAL. Requires exact V18 + V19, no grants.
-- NOT HOSTED CLEARANCE. bootstrap_fenced remains false. No activation here.
begin;
do $$begin if current_user<>'postgres' or session_user<>'postgres' or exists(select 1 from pg_roles where rolname=current_user and(rolsuper or not rolbypassrls))then raise exception 'closeout_installer_role_mismatch';end if;end$$;
lock table app.closeout_terminal_retirements_v17 in share row exclusive mode nowait;
lock table app.manual_final_authorizations_v1 in share row exclusive mode nowait;
lock table app.manual_pool_final_authorizations_v1 in share row exclusive mode nowait;
lock table app.modern_event_closures_v1 in share row exclusive mode nowait;
lock table app.modern_event_final_operations_v1 in share row exclusive mode nowait;
lock table app.modern_prize_award_operations_v2 in share row exclusive mode nowait;
lock table app.native_optional_final_operations_v2 in share row exclusive mode nowait;
lock table app.native_optional_income_operations_v2 in share row exclusive mode nowait;
lock table app.native_playoff_finance_write_operations_v1 in share row exclusive mode nowait;
lock table app.native_unrestricted_income_sources_v1 in share row exclusive mode nowait;
lock table app.operation_receipts in share row exclusive mode nowait;
lock table app.regular_consolation_closures_v1 in share row exclusive mode nowait;
lock table app.regular_consolation_final_operations_v1 in share row exclusive mode nowait;
lock table app.selected_step_award_operations_v3 in share row exclusive mode nowait;
lock table app.selected_step_pool_operations_v3 in share row exclusive mode nowait;
do $patch$declare target regprocedure:='app.assert_closeout_operation_open_v17(uuid,uuid)'::regprocedure; old text;definition text;acl aclitem[];owner_id oid;config text[];begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and prosecdef and proowner='postgres'::regrole;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'3cf011c2dcb20901aa8c9d67de27077dcc8a8000f419f4c64c6efb9202de8bae'then raise exception 'closeout_v20_preimage_mismatch';end if;
 definition:=replace(pg_get_functiondef(target),E'\r\n',E'\n');if position(old in definition)=0 then raise exception 'closeout_v20_definition_mismatch';end if;
 execute replace(definition,old,'begin
 perform app.require_closeout_write_admission_v19();
 if actor is null or op is null then raise exception ''terminal_operation_identity_required'';end if;
 if current_setting(''transaction_isolation'')<>''read committed''then raise exception ''terminal_isolation_unsupported'';end if;
 if not pg_try_advisory_xact_lock(hashtextextended(''closeout-terminal-v17:''||actor||'':''||op,0))then raise exception using errcode=''55P03'',message=''terminal_operation_busy'';end if;
 -- Enforcement is deliberately independent of the NEW retirement feature gate.
 if exists(select 1 from app.closeout_terminal_retirements_v17 where actor_id=actor and operation_id=op)then raise exception using errcode=''PZ017'',message=''closeout_operation_retired'';end if;
end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef))then raise exception 'closeout_v20_security_changed';end if;
 end$patch$;
do $patch$declare target regprocedure:='app.retire_closeout_operation_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)'::regprocedure; old text;definition text;acl aclitem[];owner_id oid;config text[];begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and prosecdef and proowner='postgres'::regrole;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'190d2df44e96e942dbece3b8d650360714c4ac7416964c988321e77676e267c3'then raise exception 'closeout_v20_preimage_mismatch';end if;
 definition:=replace(pg_get_functiondef(target),E'\r\n',E'\n');if position(old in definition)=0 then raise exception 'closeout_v20_definition_mismatch';end if;
 execute replace(definition,old,'
declare prior app.closeout_terminal_retirements_v17%rowtype;r jsonb;lookup text;journal text;present boolean;
begin
 perform app.require_closeout_write_admission_v19();
 if app.closeout_retirement_enabled_v17()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if actor is null or sid is null or tid is null or eid is null or op is null or stage is null or stage not in(''pool'',''event'',''closure'',''regular'',''regular-closure'')or jsonb_typeof(request)is distinct from''object''or octet_length(request::text)>150000 or reason is null or length(trim(reason))not between 1 and 1000 then raise exception ''invalid_terminal_request'';end if;
 if request->>''kind''is distinct from(case stage when''pool''then''manual-pool-finalize-v1''when''event''then''modern-event-finalize-v1''when''closure''then''modern-event-close-v1''when''regular''then''regular-consolation-finalize-v1''else''regular-consolation-close-v1''end)then raise exception ''terminal_stage_request_mismatch'';end if;
 if current_setting(''transaction_isolation'')<>''read committed''then raise exception ''terminal_isolation_unsupported'';end if;
 -- Session lock privilege must be independently established; no auth grants here.
 perform 1 from auth.sessions where id=sid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then raise exception ''terminal_session_denied'';end if;
 if not pg_try_advisory_xact_lock(hashtextextended(''closeout-terminal-v17:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 select * into prior from app.closeout_terminal_retirements_v17 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id=tid and prior.event_id=eid and prior.stage=stage and prior.request=request and prior.reason=reason then return prior.result;end if;return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 lookup:=case stage when''pool''then''get_manual_pool_final_operation_v1''when''event''then''get_modern_event_final_operation_v1''when''closure''then''get_modern_event_closure_operation_v1''when''regular''then''get_regular_consolation_final_operation_v1''else''get_regular_consolation_closure_operation_v1''end;
 execute format(''select public.%I($1,$2,$3,$4,$5,$6)'',lookup)into r using actor,sid,tid,eid,op,request;
 if r->>''status''is distinct from''unknown''or r->>''code''is distinct from''operation_not_found''then return r;end if;
 -- Any other/incomplete known journal is ambiguous, never declared no effect.
 foreach journal in array array[''manual_pool_final_authorizations_v1'',''modern_event_final_operations_v1'',''regular_consolation_final_operations_v1'',''modern_event_closures_v1'',''regular_consolation_closures_v1'',''selected_step_pool_operations_v3'',''selected_step_award_operations_v3'',''modern_prize_award_operations_v2'',''manual_final_authorizations_v1'',''native_optional_final_operations_v2'',''native_playoff_finance_write_operations_v1'',''native_optional_income_operations_v2'']loop
  execute format(''select exists(select 1 from app.%I where actor_id=$1 and operation_id=$2)'',journal)into present using actor,op;if present then return jsonb_build_object(''status'',''unknown'',''code'',''legacy_operation_history_requires_review'');end if;
 end loop;
 if exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)then return jsonb_build_object(''status'',''unknown'',''code'',''legacy_operation_history_requires_review'');end if;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception ''terminal_authorization_changed'';end if;
 r:=jsonb_build_object(''kind'',''closeout-terminal-retirement-v17'',''status'',''retired_no_effect'',''actorId'',actor,''sessionId'',sid,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''stage'',stage,''request'',request,''reason'',reason,''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false,''accSubmissionPerformed'',false);
 insert into app.closeout_terminal_retirements_v17(actor_id,operation_id,session_id,tournament_id,event_id,stage,request,result,reason)values(actor,op,sid,tid,eid,stage,request,r,reason);
 return r;
end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef))then raise exception 'closeout_v20_security_changed';end if;
 end$patch$;

create function app.closeout_first_effect_fence_v20()returns trigger language plpgsql security definer set search_path=''as $$
declare actor uuid;op uuid;
begin
 -- Generic operation receipts serve many unrelated workflows: preserve them.
 if tg_table_name='operation_receipts' then
  if new.operation_type is null then raise exception 'closeout_receipt_kind_required';end if;
  if new.operation_type not in('close_event_play_v1','reopen_event_play_v1')then return new;end if;
  actor:=new.actor_profile_id;op:=new.client_operation_id;
 elsif tg_table_name='native_playoff_finance_write_operations_v1'then
  if new.request_payload->>'kind'='native-recorded-fund-review-v1'then return new;end if;
  if coalesce(new.request_payload->>'kind','')not in('native-playoff-final-awards-v1','native-unrestricted-income-record-v1')then raise exception 'closeout_journal_kind_unreviewed';end if;
  actor:=new.actor_id;op:=new.operation_id;
 elsif tg_table_name='native_unrestricted_income_sources_v1'then
  -- Both native income writers touch this shared source before their journal.
  -- No operation exists on this row: admission here, tombstone at next journal.
  perform app.require_closeout_write_admission_v19();return new;
 else actor:=new.actor_id;op:=new.operation_id;
 end if;
 if actor is null or op is null then raise exception 'closeout_fence_identity_required';end if;
 perform app.assert_closeout_operation_open_v17(actor,op);return new;
end$$;
revoke all on function app.closeout_first_effect_fence_v20()from public,anon,authenticated,service_role;
create trigger closeout_first_effect_v20 before insert on app.closeout_terminal_retirements_v17 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.manual_final_authorizations_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.manual_pool_final_authorizations_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.modern_event_closures_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.modern_event_final_operations_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.modern_prize_award_operations_v2 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.native_optional_final_operations_v2 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.native_optional_income_operations_v2 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.native_playoff_finance_write_operations_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.native_unrestricted_income_sources_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.operation_receipts for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.regular_consolation_closures_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.regular_consolation_final_operations_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.selected_step_award_operations_v3 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.selected_step_pool_operations_v3 for each row execute function app.closeout_first_effect_fence_v20();
commit;
