-- NOT HOSTED INSTALL CLEARANCE; closed local source integration only.
begin;
-- LOCAL DEVELOPMENT PROPOSAL ONLY. Not mature installation/ACL clearance.
-- Install with exact WRITER_GUARDS in ONE transaction; no public grants.
do $$begin if current_user<>'postgres'or exists(select 1 from pg_roles where rolname=current_user and(rolsuper or not rolbypassrls))then raise exception 'terminal_installer_role_mismatch';end if;end$$;
create table app.closeout_terminal_retirements_v17(
 actor_id uuid not null,operation_id uuid not null,session_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,stage text not null,
 request jsonb not null,result jsonb not null,reason text not null,
 database_actor text not null default current_user,database_session_actor text not null default session_user,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 check(stage in('pool','event','closure','regular','regular-closure')));
alter table app.closeout_terminal_retirements_v17 enable row level security;
alter table app.closeout_terminal_retirements_v17 force row level security;
revoke all on app.closeout_terminal_retirements_v17 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.closeout_terminal_retirements_v17 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.closeout_terminal_retirements_v17 for each statement execute function app.reject_immutable_history();
create function app.closeout_retirement_enabled_v17()returns boolean language sql stable set search_path=''as $$select false$$;
create function app.assert_closeout_operation_open_v17(actor uuid,op uuid)returns void language plpgsql security definer set search_path=''as $$begin
 if actor is null or op is null then raise exception 'terminal_operation_identity_required';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception 'terminal_isolation_unsupported';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('closeout-terminal-v17:'||actor||':'||op,0))then raise exception using errcode='55P03',message='terminal_operation_busy';end if;
 -- Enforcement is deliberately independent of the NEW retirement feature gate.
 if exists(select 1 from app.closeout_terminal_retirements_v17 where actor_id=actor and operation_id=op)then raise exception using errcode='PZ017',message='closeout_operation_retired';end if;
end$$;
create function app.retire_closeout_operation_v17(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,stage text,request jsonb,reason text)returns jsonb language plpgsql security definer set search_path=''as $$
declare prior app.closeout_terminal_retirements_v17%rowtype;r jsonb;lookup text;journal text;present boolean;
begin
 if app.closeout_retirement_enabled_v17()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if actor is null or sid is null or tid is null or eid is null or op is null or stage is null or stage not in('pool','event','closure','regular','regular-closure')or jsonb_typeof(request)is distinct from'object'or octet_length(request::text)>150000 or reason is null or length(trim(reason))not between 1 and 1000 then raise exception 'invalid_terminal_request';end if;
 if request->>'kind'is distinct from(case stage when'pool'then'manual-pool-finalize-v1'when'event'then'modern-event-finalize-v1'when'closure'then'modern-event-close-v1'when'regular'then'regular-consolation-finalize-v1'else'regular-consolation-close-v1'end)then raise exception 'terminal_stage_request_mismatch';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception 'terminal_isolation_unsupported';end if;
 -- Session lock privilege must be independently established; no auth grants here.
 perform 1 from auth.sessions where id=sid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then raise exception 'terminal_session_denied';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('closeout-terminal-v17:'||actor||':'||op,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select * into prior from app.closeout_terminal_retirements_v17 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id=tid and prior.event_id=eid and prior.stage=stage and prior.request=request and prior.reason=reason then return prior.result;end if;return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 lookup:=case stage when'pool'then'get_manual_pool_final_operation_v1'when'event'then'get_modern_event_final_operation_v1'when'closure'then'get_modern_event_closure_operation_v1'when'regular'then'get_regular_consolation_final_operation_v1'else'get_regular_consolation_closure_operation_v1'end;
 execute format('select public.%I($1,$2,$3,$4,$5,$6)',lookup)into r using actor,sid,tid,eid,op,request;
 if r->>'status'is distinct from'unknown'or r->>'code'is distinct from'operation_not_found'then return r;end if;
 -- Any other/incomplete known journal is ambiguous, never declared no effect.
 foreach journal in array array['manual_pool_final_authorizations_v1','modern_event_final_operations_v1','regular_consolation_final_operations_v1','modern_event_closures_v1','regular_consolation_closures_v1','selected_step_pool_operations_v3','selected_step_award_operations_v3','modern_prize_award_operations_v2']loop
  execute format('select exists(select 1 from app.%I where actor_id=$1 and operation_id=$2)',journal)into present using actor,op;if present then return jsonb_build_object('status','unknown','code','legacy_operation_history_requires_review');end if;
 end loop;
 if exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)then return jsonb_build_object('status','unknown','code','legacy_operation_history_requires_review');end if;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception 'terminal_authorization_changed';end if;
 r:=jsonb_build_object('kind','closeout-terminal-retirement-v17','status','retired_no_effect','actorId',actor,'sessionId',sid,'tournamentId',tid,'eventId',eid,'operationId',op,'stage',stage,'request',request,'reason',reason,'moneyMoved',false,'payoutAuthorized',false,'officialMrpAwarded',false,'accSubmissionPerformed',false);
 insert into app.closeout_terminal_retirements_v17(actor_id,operation_id,session_id,tournament_id,event_id,stage,request,result,reason)values(actor,op,sid,tid,eid,stage,request,r,reason);
 return r;
end$$;
create function app.get_closeout_terminal_v17(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,stage text,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$declare prior app.closeout_terminal_retirements_v17%rowtype;begin
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 select * into prior from app.closeout_terminal_retirements_v17 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','code','terminal_operation_not_found');end if;
 if prior.tournament_id<>tid or prior.event_id<>eid or prior.stage<>stage or prior.request is distinct from request or tid is null or eid is null or stage is null then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 return prior.result;
end$$;
revoke all on function app.closeout_retirement_enabled_v17(),app.assert_closeout_operation_open_v17(uuid,uuid),app.retire_closeout_operation_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb,text),app.get_closeout_terminal_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb)from public,anon,authenticated,service_role;

-- LOCAL PROPOSAL ONLY; default closed. Not hosted clearance.
do $patch$ declare target regprocedure:='app.record_manual_pool_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'b54cb0b9ce8e672ce1ceee5644879120514ca0bb4c3cf8d9829ef6f2cd817a82' then raise exception 'terminal_writer_preimage_mismatch: app.record_manual_pool_final_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.manual_pool_final_authorizations_v1%rowtype;s jsonb;inner_request jsonb;r jsonb;proof jsonb;result jsonb;h text;begin
 if app.manual_pool_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array[''kind'',''expectedSourceDigest'',''poolProposalRevisionId'',''expectedPoolSourceDigest'',''regularAwardSetId'',''fundReviewId'',''reviewed'',''reason''])is distinct from true
  or request->>''kind''is distinct from''manual-pool-finalize-v1''or request->''reviewed''is distinct from''true''::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->''reason'')is distinct from true
  or jsonb_typeof(request->''expectedSourceDigest'')is distinct from''string''or jsonb_typeof(request->''expectedPoolSourceDigest'')is distinct from''string''or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''or coalesce(request->>''expectedPoolSourceDigest'','''')!~''^[a-f0-9]{64}$''
 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''selected-step-pool-op-v3:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''manual-pool-final-request-v1'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.manual_pool_final_authorizations_v1 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select o.result into result from app.manual_pool_final_outcomes_v1 o where o.actor_id=actor and o.operation_id=op;return coalesce(result,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));
 end if;
 if exists(select 1 from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op)then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 s:=app.current_manual_pool_final_source_v1(actor,sid,tid,eid);if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''current_source_required''));end if;
 if s->>''sourceDigest''is distinct from request->>''expectedSourceDigest''or s->>''poolProposalRevisionId''is distinct from request->>''poolProposalRevisionId''or s#>>''{poolSource,sourceDigest}''is distinct from request->>''expectedPoolSourceDigest''
  or s->>''regularAwardSetId''is distinct from request->>''regularAwardSetId''or s->>''fundReviewId''is distinct from request->>''fundReviewId''then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;
 if exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''pool_final_already_recorded'');end if;
 inner_request:=jsonb_build_object(''kind'',''selected-step-pool-finalize-v3'',''proposalRevisionId'',s->''poolProposalRevisionId'',''expectedSourceDigest'',s#>''{poolSource,sourceDigest}'',''reason'',request->''reason'',''reviewed'',true);
 begin
  insert into app.manual_pool_final_authorizations_v1(actor_id,operation_id,tournament_id,event_id,session_id,request,request_hash,source_digest,source_capture,qualification_id,ownership_revision_id,prize_revision_id,fund_review_id,regular_award_set_id,pool_proposal_id)
   values(actor,op,tid,eid,sid,request,h,s->>''sourceDigest'',s,(s->>''qualificationId'')::uuid,(s->>''ownershipRevisionId'')::uuid,(s->>''prizeRevisionId'')::uuid,(s->>''fundReviewId'')::uuid,(s->>''regularAwardSetId'')::uuid,(s->>''poolProposalRevisionId'')::uuid);
  r:=app.record_selected_step_pool_v3(actor,tid,eid,op,inner_request);
  if r->>''status''is distinct from''awards_recorded_unpaid''then raise exception using errcode=''ZMP01'',message=''inner_not_accepted'';end if;
  proof:=app.current_manual_pool_result_v1(actor,sid,tid,eid);
  if proof->>''status''is distinct from''source_available''or proof->''finalId''is distinct from r->''finalId''or proof->''sourceCapture''is distinct from s->''poolSource'' or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception''manual_pool_postcondition_failed'';end if;
  result:=jsonb_build_object(''kind'',''manual-pool-final-receipt-v1'',''status'',''accepted'',''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''sourceDigest'',s->''sourceDigest'',''poolFinalId'',r->''finalId'',''innerReceipt'',r,''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false);
  insert into app.manual_pool_final_outcomes_v1 values(actor,op,result);
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''manual_pool_final_v1'',(r->>''finalId'')::uuid,''approved_unpaid'',result||jsonb_build_object(''sessionId'',sid));
  set constraints app.manual_pool_operation_fk immediate;
 exception when sqlstate''ZMP01''then return coalesce(r,jsonb_build_object(''status'',''rejected'',''code'',''pool_final_unavailable''));end;
 return result;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_modern_event_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'fea750fb09df6300053b9575633b284a24ef2e57abc9def9a365416f20a85f70' then raise exception 'terminal_writer_preimage_mismatch: app.record_modern_event_final_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.modern_event_final_operations_v1%rowtype;s jsonb;h text;r jsonb;final_id uuid:=extensions.gen_random_uuid();k text;begin
 if app.modern_event_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array[''kind'',''expectedSourceDigest'',''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'',''poolProposalRevisionId'',''poolFinalId'',''approved'',''reason''])is distinct from true
  or request->>''kind''is distinct from''modern-event-finalize-v1''or request->''approved''is distinct from''true''::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->''reason'')is distinct from true
  or jsonb_typeof(request->''expectedSourceDigest'')is distinct from''string''or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''
 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 foreach k in array array[''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'',''poolProposalRevisionId'',''poolFinalId'']loop if jsonb_typeof(request->k)is distinct from''string''or coalesce(request->>k,'''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;end loop;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''modern-event-final:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''modern-event-final-request-v1'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.modern_event_final_operations_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select result into r from app.modern_event_final_outcomes_v1 where actor_id=actor and operation_id=op;return coalesce(r,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));end if;
 if exists(select 1 from app.modern_event_final_snapshots_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''event_finalization_already_recorded'');end if;
 if exists(select 1 from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op)or exists(select 1 from app.selected_step_award_operations_v3 where actor_id=actor and operation_id=op)then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 s:=app.current_modern_event_final_source_v1(actor,sid,tid,eid);if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''current_source_required''));end if;
 if s->>''sourceDigest''is distinct from request->>''expectedSourceDigest''then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;
 foreach k in array array[''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'',''poolProposalRevisionId'',''poolFinalId'']loop if s->k is distinct from request->k then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;end loop;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 insert into app.modern_event_final_operations_v1 values(actor,op,tid,eid,sid,request,h);
 insert into app.modern_event_final_snapshots_v1(id,tournament_id,event_id,actor_id,operation_id,qualification_id,ownership_revision_id,prize_revision_id,fund_review_id,regular_award_set_id,pool_proposal_id,pool_final_id,source_digest,source_capture,reason)
 values(final_id,tid,eid,actor,op,(s->>''qualificationId'')::uuid,(s->>''ownershipRevisionId'')::uuid,(s->>''prizeRevisionId'')::uuid,(s->>''fundReviewId'')::uuid,(s->>''regularAwardSetId'')::uuid,(s->>''poolProposalRevisionId'')::uuid,(s->>''poolFinalId'')::uuid,s->>''sourceDigest'',s,request->>''reason'');
 r:=jsonb_build_object(''kind'',''modern-event-final-receipt-v1'',''status'',''accepted'',''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''snapshotId'',final_id,''sourceDigest'',s->''sourceDigest'',''historicalReceipt'',true,''currentSourceVerified'',false,
  ''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false,''accSubmissionPerformed'',false,''registrationOverridesBlocking'',false);
 insert into app.modern_event_final_outcomes_v1 values(actor,op,r);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''modern_event_final_v1'',final_id,''approved_unpaid_snapshot'',r||jsonb_build_object(''sessionId'',sid));
 return r;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_modern_event_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'0d7aed515cd10a1ba8b45390cf015aaebb1f12a45eaa74ed81067436b4703458' then raise exception 'terminal_writer_preimage_mismatch: app.record_modern_event_closure_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.modern_event_closures_v1%rowtype;w jsonb;r jsonb;inner_result jsonb;close_row app.event_play_closes%rowtype;new_id uuid:=extensions.gen_random_uuid();begin
 if app.modern_event_closure_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array[''kind'',''expectedSourceDigest'',''snapshotId'',''confirmed'',''reason''])is distinct from true or request->>''kind''is distinct from''modern-event-close-v1''or request->''confirmed''is distinct from''true''::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->''reason'')is distinct from true or length(request->>''reason'')>1000 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 -- Same order as existing lifecycle mutation. Try locks never wait through a
 -- different operation''s lock-order inversion. Scope lock also serializes funds.
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||'':''||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended(''event-play-gate:''||eid::text,0))or not pg_try_advisory_xact_lock(hashtextextended(''event-lifecycle:''||eid::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''event_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 select*into prior from app.modern_event_closures_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id=tid and prior.event_id=eid and prior.request=request then return prior.result;end if;return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 if exists(select 1 from app.modern_event_closures_v1 where tournament_id=tid and event_id=eid)or exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 w:=app.current_modern_event_closure_v1(actor,sid,tid,eid);
 if w->>''status''is distinct from''review''or w->''currentSourceVerified''is distinct from''true''::jsonb or w->>''snapshotId''is distinct from request->>''snapshotId''or w#>>''{source,sourceDigest}''is distinct from request->>''expectedSourceDigest''then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;
 begin
  inner_result:=public.close_event_play_v1(actor,tid,eid,request->>''reason'',true,op);
  if inner_result->>''status''not in(''event_play_closed'',''already_closed'')or inner_result->>''status''is null then raise exception using errcode=''ZMC01'',message=''event_close_refused'';end if;
  select*into close_row from app.event_play_closes where tournament_id=tid and event_id=eid order by sequence_number desc limit 1;
  if close_row.id is null or close_row.action<>''closed''or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception''event_close_postcondition_failed'';end if;
  -- Close changes no captured sporting playState; revalidate the exact snapshot
  -- after the real lifecycle writer rather than assuming its result is enough.
  w:=app.current_modern_event_closure_v1(actor,sid,tid,eid);
  if w->>''status''is distinct from''review''or w->>''snapshotId''is distinct from request->>''snapshotId''or w#>>''{source,sourceDigest}''is distinct from request->>''expectedSourceDigest''then raise exception''event_close_source_changed'';end if;
  r:=jsonb_build_object(''kind'',''modern-event-close-receipt-v1'',''status'',''accepted'',''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''closureId'',new_id,''snapshotId'',request->''snapshotId'',''sourceDigest'',request->''expectedSourceDigest'',''closeState'',''closed'',''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false,''accSubmissionPerformed'',false);
  insert into app.modern_event_closures_v1(id,actor_id,session_id,operation_id,tournament_id,event_id,snapshot_id,play_close_id,request,result)values(new_id,actor,sid,op,tid,eid,(request->>''snapshotId'')::uuid,close_row.id,request,r);
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''modern_event_closure_v1'',new_id,''event_closed_against_unpaid_snapshot'',r||jsonb_build_object(''sessionId'',sid,''playCloseId'',close_row.id));
 exception when sqlstate''ZMC01''then return coalesce(inner_result,jsonb_build_object(''status'',''rejected'',''code'',''event_close_refused''));end;
 return r;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_regular_consolation_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'226cd1ee666ca4326a6874c7be5259f63947376ce704f6c2214e29a8ffd04fba' then raise exception 'terminal_writer_preimage_mismatch: app.record_regular_consolation_final_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.regular_consolation_final_operations_v1%rowtype;s jsonb;h text;r jsonb;final_id uuid:=extensions.gen_random_uuid();k text;begin
 if app.regular_consolation_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array[''kind'',''expectedSourceDigest'',''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'',''approved'',''reason''])is distinct from true
  or request->>''kind''is distinct from''regular-consolation-finalize-v1''or request->''approved''is distinct from''true''::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->''reason'')is distinct from true
  or jsonb_typeof(request->''expectedSourceDigest'')is distinct from''string''or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''
 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 foreach k in array array[''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'']loop if jsonb_typeof(request->k)is distinct from''string''or coalesce(request->>k,'''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;end loop;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''regular-consolation-final:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''regular-consolation-final-request-v1'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.regular_consolation_final_operations_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select result into r from app.regular_consolation_final_outcomes_v1 where actor_id=actor and operation_id=op;return coalesce(r,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));end if;
 if exists(select 1 from app.modern_event_final_snapshots_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''other_event_finalization_already_recorded'');end if;
 if exists(select 1 from app.regular_consolation_final_snapshots_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''event_finalization_already_recorded'');end if;
 if exists(select 1 from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op)or exists(select 1 from app.selected_step_award_operations_v3 where actor_id=actor and operation_id=op)then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 s:=app.current_regular_consolation_final_source_v1(actor,sid,tid,eid);if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''current_source_required''));end if;
 if s->>''sourceDigest''is distinct from request->>''expectedSourceDigest''then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;
 foreach k in array array[''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'']loop if s->k is distinct from request->k then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;end loop;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 insert into app.regular_consolation_final_operations_v1 values(actor,op,tid,eid,sid,request,h);
 insert into app.regular_consolation_final_snapshots_v1(id,tournament_id,event_id,actor_id,operation_id,qualification_id,ownership_revision_id,prize_revision_id,fund_review_id,regular_award_set_id,source_digest,source_capture,reason)
 values(final_id,tid,eid,actor,op,(s->>''qualificationId'')::uuid,(s->>''ownershipRevisionId'')::uuid,(s->>''prizeRevisionId'')::uuid,(s->>''fundReviewId'')::uuid,(s->>''regularAwardSetId'')::uuid,s->>''sourceDigest'',s,request->>''reason'');
 r:=jsonb_build_object(''kind'',''regular-consolation-final-receipt-v1'',''status'',''accepted'',''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''snapshotId'',final_id,''sourceDigest'',s->''sourceDigest'',''historicalReceipt'',true,''currentSourceVerified'',false,
  ''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false,''accSubmissionPerformed'',false,''registrationOverridesBlocking'',false);
 insert into app.regular_consolation_final_outcomes_v1 values(actor,op,r);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''regular_consolation_final_v1'',final_id,''approved_unpaid_snapshot'',r||jsonb_build_object(''sessionId'',sid));
 return r;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_regular_consolation_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'dde55f6c984b65239c5bdb7a9149489b2d122529d4145fc2e6928c722e64228b' then raise exception 'terminal_writer_preimage_mismatch: app.record_regular_consolation_closure_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.regular_consolation_closures_v1%rowtype;w jsonb;r jsonb;inner_result jsonb;close_row app.event_play_closes%rowtype;new_id uuid:=extensions.gen_random_uuid();begin
 if app.regular_consolation_closure_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array[''kind'',''expectedSourceDigest'',''snapshotId'',''confirmed'',''reason''])is distinct from true or request->>''kind''is distinct from''regular-consolation-close-v1''or request->''confirmed''is distinct from''true''::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->''reason'')is distinct from true or length(request->>''reason'')>1000 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 -- Same order as existing lifecycle mutation. Try locks never wait through a
 -- different operation''s lock-order inversion. Scope lock also serializes funds.
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||'':''||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended(''event-play-gate:''||eid::text,0))or not pg_try_advisory_xact_lock(hashtextextended(''event-lifecycle:''||eid::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''event_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 select*into prior from app.regular_consolation_closures_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id=tid and prior.event_id=eid and prior.request=request then return prior.result;end if;return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 if exists(select 1 from app.regular_consolation_closures_v1 where tournament_id=tid and event_id=eid)or exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 w:=app.current_regular_consolation_closure_v1(actor,sid,tid,eid);
 if w->>''status''is distinct from''review''or w->''currentSourceVerified''is distinct from''true''::jsonb or w->>''snapshotId''is distinct from request->>''snapshotId''or w#>>''{source,sourceDigest}''is distinct from request->>''expectedSourceDigest''then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;
 begin
  inner_result:=public.close_event_play_v1(actor,tid,eid,request->>''reason'',true,op);
  if inner_result->>''status''not in(''event_play_closed'',''already_closed'')or inner_result->>''status''is null then raise exception using errcode=''ZMC01'',message=''event_close_refused'';end if;
  select*into close_row from app.event_play_closes where tournament_id=tid and event_id=eid order by sequence_number desc limit 1;
  if close_row.id is null or close_row.action<>''closed''or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception''event_close_postcondition_failed'';end if;
  -- Close changes no captured sporting playState; revalidate the exact snapshot
  -- after the real lifecycle writer rather than assuming its result is enough.
  w:=app.current_regular_consolation_closure_v1(actor,sid,tid,eid);
  if w->>''status''is distinct from''review''or w->>''snapshotId''is distinct from request->>''snapshotId''or w#>>''{source,sourceDigest}''is distinct from request->>''expectedSourceDigest''then raise exception''event_close_source_changed'';end if;
  r:=jsonb_build_object(''kind'',''regular-consolation-close-receipt-v1'',''status'',''accepted'',''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''closureId'',new_id,''snapshotId'',request->''snapshotId'',''sourceDigest'',request->''expectedSourceDigest'',''closeState'',''closed'',''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false,''accSubmissionPerformed'',false);
  insert into app.regular_consolation_closures_v1(id,actor_id,session_id,operation_id,tournament_id,event_id,snapshot_id,play_close_id,request,result)values(new_id,actor,sid,op,tid,eid,(request->>''snapshotId'')::uuid,close_row.id,request,r);
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''regular_consolation_closure_v1'',new_id,''event_closed_against_unpaid_snapshot'',r||jsonb_build_object(''sessionId'',sid,''playCloseId'',close_row.id));
 exception when sqlstate''ZMC01''then return coalesce(inner_result,jsonb_build_object(''status'',''rejected'',''code'',''event_close_refused''));end;
 return r;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_selected_step_pool_v3(uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'c11e54f960473c06f6e4f19569233378d0564f45dd07345a57264c8a952e891a' then raise exception 'terminal_writer_preimage_mismatch: app.record_selected_step_pool_v3';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.selected_step_pool_operations_v3%rowtype;head app.selected_step_pool_revisions_v3%rowtype;s jsonb;h text;result jsonb;revision_id uuid;v_final_id uuid;pool jsonb;r jsonb;action text;ver integer;
begin
 if app.selected_step_pool_journal_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_not_supported'');end if;
 if op is null or jsonb_typeof(request)is distinct from''object''then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 action:=request->>''kind'';
 if action=''selected-step-pool-save-v3''and(jsonb_typeof(request->''expectedVersion'')is distinct from''number''or coalesce(request->>''expectedVersion'','''')!~''^(0|[1-9][0-9]{0,9})$'')then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 if op is null or jsonb_typeof(request)is distinct from''object''or(select count(*)from jsonb_object_keys(request))<>5 or request->''reviewed''is distinct from''true''::jsonb
  or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''or jsonb_typeof(request->''reason'')is distinct from''string''
  or request->>''reason''is distinct from app.custom_payout_classification_text_v2(request->>''reason'')or app.event_settings_js_text_length_v3(request->>''reason'')not between 1 and 2000
  or action not in(''selected-step-pool-save-v3'',''selected-step-pool-finalize-v3'')or action is null
  or(action=''selected-step-pool-save-v3''and(not(request?&array[''kind'',''expectedVersion'',''expectedSourceDigest'',''reason'',''reviewed''])or coalesce(request->>''expectedVersion'','''')!~''^(0|[1-9][0-9]{0,9})$''or(request->>''expectedVersion'')::numeric>=2147483647))
  or(action=''selected-step-pool-finalize-v3''and(not(request?&array[''kind'',''proposalRevisionId'',''expectedSourceDigest'',''reason'',''reviewed''])or coalesce(request->>''proposalRevisionId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''))then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''selected-step-pool-op-v3:''||actor::text||'':''||op::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role=''director''for key share nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''selected-step-pool-operation-v3'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select x.result into result from app.selected_step_pool_outcomes_v3 x where x.actor_id=actor and x.operation_id=op;
  if result is null then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete'');end if;return result;end if;
 if exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''pool_awards_already_recorded'');end if;
 if app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''competing_financial_liability'');end if;
 s:=app.get_selected_step_pool_source_v3(actor,tid,eid);
 if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''current_source_required''));end if;
 if s->''sourceDigest''is distinct from request->''expectedSourceDigest''then return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;
 select*into head from app.selected_step_pool_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if action=''selected-step-pool-save-v3''and coalesce(head.version,0)<>(request->>''expectedVersion'')::integer then return jsonb_build_object(''status'',''rejected'',''code'',''stale_version'');end if;
 if action=''selected-step-pool-finalize-v3''and(head.id is null or head.id::text is distinct from request->>''proposalRevisionId''or head.source_digest is distinct from s->>''sourceDigest''or head.source_capture is distinct from s)then return jsonb_build_object(''status'',''rejected'',''code'',''proposal_or_source_changed'');end if;
 insert into app.selected_step_pool_operations_v3 values(actor,op,tid,eid,request,h);
 if action=''selected-step-pool-save-v3''then
  revision_id:=extensions.gen_random_uuid();ver:=coalesce(head.version,0)+1;
  insert into app.selected_step_pool_revisions_v3(id,tournament_id,event_id,version,prior_revision_id,actor_id,operation_id,ownership_revision_id,prize_snapshot_id,qualification_id,source_digest,source_capture,reason)
   values(revision_id,tid,eid,ver,head.id,actor,op,(s->>''ownershipRevisionId'')::uuid,(s->>''prizeSnapshotId'')::uuid,(s->>''qualificationResultVersionId'')::uuid,s->>''sourceDigest'',s,request->>''reason'');
 else
  revision_id:=head.id;ver:=head.version;v_final_id:=extensions.gen_random_uuid();
  insert into app.selected_step_pool_finals_v3(id,tournament_id,event_id,proposal_revision_id,actor_id,operation_id,source_digest,source_capture,q_minor,side_minor,total_minor,reason)
   values(v_final_id,tid,eid,head.id,actor,op,s->>''sourceDigest'',s,(s->>''qMinor'')::bigint,(s->>''sideMinor'')::bigint,(s->>''totalMinor'')::bigint,request->>''reason'');
  for pool in select value from jsonb_array_elements(s->''pools'')loop
   for r in select value from jsonb_array_elements(pool->''recipients'')loop
    insert into app.selected_step_pool_recipients_v3 values(v_final_id,tid,eid,(pool->>''poolId'')::uuid,pool->>''kind'',(r->>''participantId'')::uuid,r->>''name'',r->>''tournamentPlayerId'',(pool#>>''{policy,roundingUnitMinor}'')::integer,(r->>''amountMinor'')::bigint);
   end loop;
   if(select sum(amount_minor)from app.selected_step_pool_recipients_v3 where final_id=v_final_id and pool_id=(pool->>''poolId'')::uuid)<>(pool#>>''{calculation,fundMinor}'')::bigint then raise exception''selected_pool_fund_postcondition_failed'';end if;
  end loop;
  if(select sum(amount_minor)from app.selected_step_pool_recipients_v3 where final_id=v_final_id)<>(s->>''totalMinor'')::bigint then raise exception''selected_pool_total_postcondition_failed'';end if;
 end if;
 result:=jsonb_build_object(''kind'',''selected-step-pool-receipt-v3'',''status'',case when action=''selected-step-pool-save-v3''then''proposal_saved''else''awards_recorded_unpaid''end,
  ''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''revisionId'',revision_id,''version'',ver,''finalId'',v_final_id,''sourceDigest'',s->>''sourceDigest'',
  ''qMinor'',s->''qMinor'',''sideMinor'',s->''sideMinor'',''totalMinor'',s->''totalMinor'',''liabilityScope'',''optional_pools_only'',''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false);
 insert into app.selected_step_pool_outcomes_v3 values(actor,op,result);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''selected_step_pool_v3'',coalesce(v_final_id,revision_id),case when v_final_id is null then''proposal_saved''else''awards_recorded_unpaid''end,result);
 return result;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_modern_prize_awards_v2(uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'816efa66a1123d53036f5882ac81ea68f8e3adf501f65cf255c92a657a13b35a' then raise exception 'terminal_writer_preimage_mismatch: app.record_modern_prize_awards_v2';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare actor uuid:=auth.uid();h text;prior app.modern_prize_award_operations_v2%rowtype;s jsonb;award uuid;g jsonb;r jsonb;unit integer;response jsonb;begin
 if actor is null then return jsonb_build_object(''status'',''rejected'',''code'',''authentication_required'');end if;
 if app.modern_prize_awards_enabled_v2()is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''feature_unavailable'');end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if tid is null or eid is null or op is null or (case when jsonb_typeof(request)=''object''then(select count(*)from jsonb_object_keys(request))<>5 or not(request?&array[''expectedSourceDigest'',''expectedPrizeRevisionId'',''expectedFundReviewId'',''reason'',''reviewed''])else true end)or request->''reviewed''is distinct from''true''::jsonb
  or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''or coalesce(request->>''expectedPrizeRevisionId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''or coalesce(request->>''expectedFundReviewId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''
  or jsonb_typeof(request->''reason'')is distinct from''string''or request->>''reason''is distinct from app.custom_payout_classification_text_v2(request->>''reason'')or app.event_settings_js_text_length_v3(request->>''reason'')not between 1 and 2000 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''modern-prize-v2:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''tournament_unavailable'');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in(''director'',''co_director'')order by role for key share nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''not_director'');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''modern-prize-award-request-v2'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.modern_prize_award_operations_v2 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id<>tid or prior.event_id<>eid or prior.request<>request or prior.request_hash<>h then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select result into response from app.modern_prize_award_outcomes_v2 where actor_id=actor and operation_id=op;return coalesce(response,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));end if;
 if exists(select 1 from app.modern_prize_award_sets_v2 where tournament_id=tid and event_id=eid)or app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''existing_awards'');end if;
 s:=app.current_modern_prize_award_source_v2(tid,eid);if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''source_unavailable''));end if;
 if s->''sourceDigest''is distinct from request->''expectedSourceDigest''or s#>''{prizeWorkspace,head,revisionId}''is distinct from request->''expectedPrizeRevisionId''or s#>''{fundSource,capture,latestReview,reviewId}''is distinct from request->''expectedFundReviewId''then return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;
 unit:=(s->>''roundingUnitMinor'')::integer;
 insert into app.modern_prize_award_operations_v2 values(actor,op,tid,eid,request,h);
 insert into app.modern_prize_award_sets_v2(tournament_id,event_id,actor_id,operation_id,prize_revision_id,fund_review_id,source_digest,source_capture,plan,rounding_unit_minor,total_minor,recipient_count,reason)
 values(tid,eid,actor,op,(request->>''expectedPrizeRevisionId'')::uuid,(request->>''expectedFundReviewId'')::uuid,s->>''sourceDigest'',s,s->''plan'',unit,(s->>''totalMinor'')::bigint,jsonb_array_length(s->''recipients''),request->>''reason'')returning id into award;
 for g in select value from jsonb_array_elements(s->''groups'')loop insert into app.modern_prize_award_groups_v2 values(award,tid,eid,(g->>''firstPlace'')::integer,(g->>''lastPlace'')::integer,(g->>''people'')::integer,(g->>''included'')::boolean,(g->>''perPersonMinor'')::bigint,(g->>''groupTotalMinor'')::bigint,unit);end loop;
 for r in select value from jsonb_array_elements(s->''recipients'')loop insert into app.modern_prize_award_recipients_v2 values(award,tid,eid,(r->>''participantId'')::uuid,(r->>''profileId'')::uuid,r->>''displayName'',r->>''tournamentPlayerId'',(r->>''firstPlace'')::integer,(r->>''lastPlace'')::integer,(r->>''included'')::boolean,(r->>''amountMinor'')::bigint,unit);end loop;
 if(select count(*)from app.modern_prize_award_groups_v2 where award_set_id=award)<>jsonb_array_length(s->''groups'')or exists(select 1 from jsonb_array_elements(s->''recipients'')x where not exists(select 1 from app.modern_prize_award_recipients_v2 y where y.award_set_id=award and y.participant_id::text=x->>''participantId''and y.profile_id::text=x->>''profileId''and y.display_name=x->>''displayName''and y.tournament_player_id=x->>''tournamentPlayerId''and y.first_place=(x->>''firstPlace'')::integer and y.last_place=(x->>''lastPlace'')::integer and y.included=(x->>''included'')::boolean and y.amount_minor=(x->>''amountMinor'')::bigint and y.rounding_unit_minor=unit))or exists(select 1 from jsonb_array_elements(s->''groups'')x where not exists(select 1 from app.modern_prize_award_groups_v2 y where y.award_set_id=award and y.first_place=(x->>''firstPlace'')::integer and y.last_place=(x->>''lastPlace'')::integer and y.people=(x->>''people'')::integer and y.included=(x->>''included'')::boolean and y.per_person_minor=(x->>''perPersonMinor'')::bigint and y.group_total_minor=(x->>''groupTotalMinor'')::bigint and y.rounding_unit_minor=unit))or(select sum(amount_minor)from app.modern_prize_award_recipients_v2 where award_set_id=award)<>(s->>''totalMinor'')::bigint or(select count(*)from app.modern_prize_award_recipients_v2 where award_set_id=award)<>jsonb_array_length(s->''recipients'')or(select sum(group_total_minor)from app.modern_prize_award_groups_v2 where award_set_id=award)<>(s->>''totalMinor'')::bigint then raise exception''modern_award_postcondition_failed'';end if;
 response:=jsonb_build_object(''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''status'',''accepted'',''kind'',''modern-prize-award-receipt-v2'',''awardSetId'',award,''sourceDigest'',s->>''sourceDigest'',''prizeRevisionId'',request->>''expectedPrizeRevisionId'',''fundReviewId'',request->>''expectedFundReviewId'',''totalMinor'',s->''totalMinor'',''recordedUnpaid'',true,''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false);
 insert into app.modern_prize_award_outcomes_v2 values(actor,op,tid,eid,response);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''modern_prize_awards_v2'',award,''recorded_unpaid'',response);
 return response;
 exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_selected_step_awards_v3(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'ef2a843d5e7dcc6e2ff541078b33912b1dc8b86ffc63491105d0e582cea8020b' then raise exception 'terminal_writer_preimage_mismatch: app.record_selected_step_awards_v3';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare h text;prior app.selected_step_award_operations_v3%rowtype;s jsonb;award uuid;g jsonb;r jsonb;unit integer;response jsonb;begin
 if app.selected_step_awards_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if actor is null then return jsonb_build_object(''status'',''rejected'',''code'',''authentication_required'');end if;
 if app.selected_step_awards_enabled_v3()is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''feature_unavailable'');end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if tid is null or eid is null or op is null or (case when jsonb_typeof(request)=''object''then(select count(*)from jsonb_object_keys(request))<>5 or not(request?&array[''expectedSourceDigest'',''expectedPrizeRevisionId'',''expectedFundReviewId'',''reason'',''reviewed''])else true end)or request->''reviewed''is distinct from''true''::jsonb
  or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''or coalesce(request->>''expectedPrizeRevisionId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''or coalesce(request->>''expectedFundReviewId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''
  or jsonb_typeof(request->''reason'')is distinct from''string''or request->>''reason''is distinct from app.custom_payout_classification_text_v2(request->>''reason'')or app.event_settings_js_text_length_v3(request->>''reason'')not between 1 and 2000 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''modern-prize-v2:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''tournament_unavailable'');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in(''director'',''co_director'')order by role for key share nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''not_director'');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''selected-step-award-request-v3'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.selected_step_award_operations_v3 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id<>tid or prior.event_id<>eid or prior.request<>request or prior.request_hash<>h then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select result into response from app.selected_step_award_outcomes_v3 where actor_id=actor and operation_id=op;return coalesce(response,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));end if;
 if exists(select 1 from app.selected_step_award_sets_v3 where tournament_id=tid and event_id=eid)or app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''existing_awards'');end if;
 s:=app.current_selected_step_award_source_v3(actor,sid,tid,eid);if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''source_unavailable''));end if;
 if s->''sourceDigest''is distinct from request->''expectedSourceDigest''or s#>''{prizeWorkspace,head,revisionId}''is distinct from request->''expectedPrizeRevisionId''or s#>''{fundSource,reviewId}''is distinct from request->''expectedFundReviewId''then return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;
 unit:=(s->>''roundingUnitMinor'')::integer; if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 insert into app.selected_step_award_operations_v3 values(actor,op,tid,eid,request,h);
 insert into app.selected_step_award_sets_v3(tournament_id,event_id,actor_id,operation_id,prize_revision_id,fund_review_id,source_digest,source_capture,plan,rounding_unit_minor,total_minor,recipient_count,reason)
 values(tid,eid,actor,op,(request->>''expectedPrizeRevisionId'')::uuid,(request->>''expectedFundReviewId'')::uuid,s->>''sourceDigest'',s,s->''plan'',unit,(s->>''totalMinor'')::bigint,jsonb_array_length(s->''recipients''),request->>''reason'')returning id into award;
 for g in select value from jsonb_array_elements(s->''groups'')loop insert into app.selected_step_award_groups_v3 values(award,tid,eid,(g->>''firstPlace'')::integer,(g->>''lastPlace'')::integer,(g->>''people'')::integer,(g->>''included'')::boolean,(g->>''perPersonMinor'')::bigint,(g->>''groupTotalMinor'')::bigint,unit);end loop;
 for r in select value from jsonb_array_elements(s->''recipients'')loop insert into app.selected_step_award_recipients_v3 values(award,tid,eid,(r->>''participantId'')::uuid,(r->>''profileId'')::uuid,r->>''displayName'',r->>''tournamentPlayerId'',(r->>''firstPlace'')::integer,(r->>''lastPlace'')::integer,(r->>''included'')::boolean,(r->>''amountMinor'')::bigint,unit);end loop;
 if(select count(*)from app.selected_step_award_groups_v3 where award_set_id=award)<>jsonb_array_length(s->''groups'')or exists(select 1 from jsonb_array_elements(s->''recipients'')x where not exists(select 1 from app.selected_step_award_recipients_v3 y where y.award_set_id=award and y.participant_id::text=x->>''participantId''and y.profile_id::text=x->>''profileId''and y.display_name=x->>''displayName''and y.tournament_player_id=x->>''tournamentPlayerId''and y.first_place=(x->>''firstPlace'')::integer and y.last_place=(x->>''lastPlace'')::integer and y.included=(x->>''included'')::boolean and y.amount_minor=(x->>''amountMinor'')::bigint and y.rounding_unit_minor=unit))or exists(select 1 from jsonb_array_elements(s->''groups'')x where not exists(select 1 from app.selected_step_award_groups_v3 y where y.award_set_id=award and y.first_place=(x->>''firstPlace'')::integer and y.last_place=(x->>''lastPlace'')::integer and y.people=(x->>''people'')::integer and y.included=(x->>''included'')::boolean and y.per_person_minor=(x->>''perPersonMinor'')::bigint and y.group_total_minor=(x->>''groupTotalMinor'')::bigint and y.rounding_unit_minor=unit))or(select sum(amount_minor)from app.selected_step_award_recipients_v3 where award_set_id=award)<>(s->>''totalMinor'')::bigint or(select count(*)from app.selected_step_award_recipients_v3 where award_set_id=award)<>jsonb_array_length(s->''recipients'')or(select sum(group_total_minor)from app.selected_step_award_groups_v3 where award_set_id=award)<>(s->>''totalMinor'')::bigint then raise exception''modern_award_postcondition_failed'';end if;
 response:=jsonb_build_object(''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''status'',''accepted'',''kind'',''selected-step-award-receipt-v3'',''awardSetId'',award,''sourceDigest'',s->>''sourceDigest'',''prizeRevisionId'',request->>''expectedPrizeRevisionId'',''fundReviewId'',request->>''expectedFundReviewId'',''totalMinor'',s->''totalMinor'',''recordedUnpaid'',true,''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false);
 insert into app.selected_step_award_outcomes_v3 values(actor,op,tid,eid,response);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''selected_step_awards_v3'',award,''recorded_unpaid'',response||jsonb_build_object(''sessionId'',sid));
 return response;
 exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='public.close_event_play_v1(uuid,uuid,uuid,text,boolean,uuid)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'3de6386b7fb12429fffc86fbed3d507828b218193201be5304573454a82731d9' then raise exception 'terminal_writer_preimage_mismatch: public.close_event_play_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare
  v_reason text := trim(coalesce(p_reason, ''''));
  v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
  v_readiness jsonb; v_scheduled integer; v_resolved integer; v_unresolved integer; v_response jsonb;
begin
  if coalesce((select auth.jwt()->>''role''), '''') <> ''service_role'' then
    raise exception using errcode=''P0001'', message=''server-only close event'';
  end if;
  -- start_event_play_v1 requires the same explicit confirmation server side. A
  -- tick that exists only in the browser is not a gate, it is a decoration, and
  -- this operation ends scoring for a whole event.
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null
     or p_confirmed is distinct from true or length(v_reason) not between 1 and 1000 then
    return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    ''close_event_play_v1'', p_actor_id::text, p_tournament_id::text, p_event_id::text,
    v_reason, p_confirmed, p_operation_id::text)::text,''utf8''),''sha256''),''hex'');
 perform app.assert_closeout_operation_open_v17(p_actor_id,p_operation_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||'':''||p_operation_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(''event-play-gate:''||p_event_id::text,0));

  select * into v_existing from app.operation_receipts
    where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type=''close_event_play_v1'' and v_existing.request_hash=v_hash then
      return v_existing.response_payload;
    end if;
    return jsonb_build_object(''status'',''rejected'',''code'',''idempotency_conflict'');
  end if;

  perform 1 from app.tournaments tournament
    where tournament.id=p_tournament_id and tournament.status=''open'' for update;
  if not found then return jsonb_build_object(''status'',''rejected'',''code'',''tournament_unavailable''); end if;
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
      and role_row.profile_id=p_actor_id and role_row.role in(''director'',''co_director'')) then
    return jsonb_build_object(''status'',''rejected'',''code'',''not_director'');
  end if;
  if not exists(select 1 from app.events event_row
      where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id) then
    return jsonb_build_object(''status'',''rejected'',''code'',''event_unavailable'');
  end if;
  if not exists(select 1 from app.event_play_starts started where started.event_id=p_event_id) then
    if exists(select 1 from app.event_team_starts team_started where team_started.event_id=p_event_id) then
      return jsonb_build_object(''status'',''rejected'',''code'',''team_event_unsupported'');
    end if;
    return jsonb_build_object(''status'',''rejected'',''code'',''event_not_started'');
  end if;
  if app.event_play_close_state_v1(p_event_id)=''closed'' then
    return jsonb_build_object(''status'',''already_closed'',''eventId'',p_event_id);
  end if;

  v_readiness := app.event_play_close_readiness_v1(p_event_id);
  v_scheduled := (v_readiness->>''scheduledGames'')::integer;
  v_resolved := (v_readiness->>''resolvedGames'')::integer;
  v_unresolved := (v_readiness->>''unresolvedGames'')::integer;
  if v_scheduled=0 then
    return jsonb_build_object(''status'',''rejected'',''code'',''no_scheduled_games'');
  end if;
  -- The counts travel with the refusal. A director told only "not ready" has to
  -- go and count forty games by eye to find the two that are still open.
  if v_unresolved>0 then
    return jsonb_build_object(''status'',''rejected'',''code'',''games_unresolved'',
      ''scheduledGames'',v_scheduled,''resolvedGames'',v_resolved,''unresolvedGames'',v_unresolved);
  end if;

  v_response := jsonb_build_object(''status'',''event_play_closed'',''eventId'',p_event_id,
    ''closeState'',''closed'',''scheduledGames'',v_scheduled,''resolvedGames'',v_resolved,''unresolvedGames'',0);

  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,
    request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament_id,p_actor_id,''close_event_play_v1'',p_event_id,
    v_hash,p_operation_id,''accepted'',v_response,clock_timestamp())
  returning id into v_receipt;

  insert into app.event_play_closes(tournament_id,event_id,action,reason,scheduled_game_count,
    resolved_game_count,actor_profile_id,operation_receipt_id)
  values(p_tournament_id,p_event_id,''closed'',v_reason,v_scheduled,v_resolved,p_actor_id,v_receipt);

  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,
    entity_id,action,before_state,after_state)
  values(p_tournament_id,p_actor_id,v_receipt,''event_play_close'',p_event_id,''event_play_closed'',
    jsonb_build_object(''closeState'',''open'',''pauseState'',app.event_play_pause_state_v1(p_event_id)),
    v_response || jsonb_build_object(''reason'',v_reason));

  return v_response;
end;
');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;

commit;
