-- PRIVATE / DEFAULT OFF. Normal authenticated DIGITAL player entry against the
-- actual modern Start/generation source. No service impersonation or grants.
-- Paper and mixed adjudication evidence remains in its distinct protocol.
begin;
create function app.selected_step_player_scoring_enabled_v3()returns boolean language sql stable set search_path=''as $gate$select false$gate$;
create function app.selected_step_player_actor_v3()returns uuid
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare actor uuid:=auth.uid();j jsonb:=auth.jwt();begin
 if app.selected_step_player_scoring_enabled_v3()is distinct from true or actor is null or j->>'sub'is distinct from actor::text
  or j->>'role'is distinct from'authenticated'or coalesce(j->>'exp','')!~'^[0-9]{1,16}$'or(j->>'exp')::numeric<=extract(epoch from clock_timestamp())
  or coalesce(j->>'session_id','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return null;end if;
 perform 1 from auth.users where id=actor and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from auth.sessions where id=(j->>'session_id')::uuid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then return null;end if;return actor;
end$body$;
create function app.selected_step_player_generation_access_v3(tid uuid,eid uuid,qid uuid,slot_no integer,gid uuid)returns boolean
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare actor uuid:=app.selected_step_player_actor_v3();begin
 if actor is null or current_setting('transaction_isolation')<>'read committed'then return false;end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return false;end if;
 perform 1 from app.playoff_series_generations_v1 g
  join app.event_participants p on p.id in(g.side_a_participant_id,g.side_b_participant_id)and p.tournament_id=g.tournament_id and p.event_id=g.event_id
  join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
  join app.roster_account_links l on l.roster_entry_id=r.id and l.tournament_id=r.tournament_id and l.profile_id=p.profile_id
  where g.id=gid and g.tournament_id=tid and g.event_id=eid and g.qualification_id=qid and g.slot=slot_no
   and p.profile_id=actor and p.status='checked_in'and r.scorecard_type='digital'
   and(actor=g.side_a_profile_id or actor=g.side_b_profile_id)
   and l.id::text=g.source_capture->'rosterLinks'->>(case when actor=g.side_a_profile_id then 0 else 1 end)
   and r.scorecard_preference_version::text=g.source_capture->'preferences'->>(case when actor=g.side_a_profile_id then 0 else 1 end)
   and exists(select 1 from app.playoff_series_match_operations_v1 o where o.actor_id=g.actor_id and o.operation_id=g.operation_id and o.tournament_id=tid and o.event_id=eid
    and o.request_payload->>'kind'='selected-step-series-generation-v3'and o.result->>'generationId'=g.id::text)
  for share of g,p,r,l nowait;
 return found;
end$body$;

-- Constructors below are fully revoked implementation details. They validate
-- the original persisted author's current role and all activation/rule/field
-- evidence, without requiring or pretending that a PLAYER is a service/TD.

do $clone$declare original regprocedure:='app.selected_step_pool_activation_pin_v3(uuid,uuid,uuid)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern player prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["app.selected_step_pool_ownership_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true","app.selected_step_pool_ownership_enabled_v3()is distinct from true or app.selected_step_player_scoring_enabled_v3()is distinct from true",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern player source anchor changed: %: %','app.selected_step_player_pin_evidence_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.selected_step_player_pin_evidence_v3(actor uuid, tid uuid, eid uuid)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.selected_step_player_pin_evidence_v3(actor uuid, tid uuid, eid uuid)owner to postgres';
 execute 'revoke all on function app.selected_step_player_pin_evidence_v3(actor uuid, tid uuid, eid uuid)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.selected_step_pool_playoff_source_v3(uuid,uuid,uuid)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern player prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["app.selected_step_pool_ownership_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true","app.selected_step_pool_ownership_enabled_v3()is distinct from true or app.selected_step_player_scoring_enabled_v3()is distinct from true",1],["app.selected_step_pool_activation_pin_v3(actor,tid,eid)","app.selected_step_player_pin_evidence_v3(actor,tid,eid)",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern player source anchor changed: %: %','app.selected_step_player_gate_evidence_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.selected_step_player_gate_evidence_v3(actor uuid, tid uuid, eid uuid)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.selected_step_player_gate_evidence_v3(actor uuid, tid uuid, eid uuid)owner to postgres';
 execute 'revoke all on function app.selected_step_player_gate_evidence_v3(actor uuid, tid uuid, eid uuid)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.selected_step_series_match_source_v3(uuid,uuid,uuid,uuid,integer)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern player prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["app.selected_step_pool_playoff_source_v3(actor,tid,eid)","app.selected_step_player_gate_evidence_v3(actor,tid,eid)",1],["app.selected_step_series_current_result_v3(actor,tid,eid,qid,","app.selected_step_player_result_evidence_v3(actor,tid,eid,qid,",2]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern player source anchor changed: %: %','app.selected_step_player_match_evidence_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.selected_step_player_match_evidence_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.selected_step_player_match_evidence_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)owner to postgres';
 execute 'revoke all on function app.selected_step_player_match_evidence_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.selected_step_series_current_result_v3(uuid,uuid,uuid,uuid,integer)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern player prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["app.selected_step_series_match_source_v3(actor,tid,eid,qid,slot_no)","app.selected_step_player_match_evidence_v3(actor,tid,eid,qid,slot_no)",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern player source anchor changed: %: %','app.selected_step_player_result_evidence_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.selected_step_player_result_evidence_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.selected_step_player_result_evidence_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)owner to postgres';
 execute 'revoke all on function app.selected_step_player_result_evidence_v3(actor uuid, tid uuid, eid uuid, qid uuid, slot_no integer)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.finish_playoff_series_game_operation_v1(uuid,uuid,uuid,uuid,jsonb)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern player prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["auth.uid() is distinct from p_actor_id","app.selected_step_player_actor_v3() is distinct from p_actor_id",1],["return response;","insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,''selected_step_player_action_v3'',p_operation_id,''action_recorded'',jsonb_build_object(''sessionId'',auth.jwt()->>''session_id'',''outcome'',response));return response;",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern player source anchor changed: %: %','app.finish_selected_step_player_action_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.finish_selected_step_player_action_v3(p_actor_id uuid, p_operation_id uuid, p_tournament_id uuid, p_event_id uuid, p_result jsonb)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.finish_selected_step_player_action_v3(p_actor_id uuid, p_operation_id uuid, p_tournament_id uuid, p_event_id uuid, p_result jsonb)owner to postgres';
 execute 'revoke all on function app.finish_selected_step_player_action_v3(p_actor_id uuid, p_operation_id uuid, p_tournament_id uuid, p_event_id uuid, p_result jsonb)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.submit_playoff_series_game_action_v1(uuid,uuid,uuid,integer,jsonb)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern player prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["a uuid:=auth.uid()","a uuid:=app.selected_step_player_actor_v3()",1],["op:=(p_request->>''operationId'')::uuid;requested_generation_id:=(p_request->>''generationId'')::uuid;","op:=(p_request->>''operationId'')::uuid;requested_generation_id:=(p_request->>''generationId'')::uuid; if app.selected_step_player_generation_access_v3(p_tournament_id,p_event_id,p_qualification_id,p_slot,requested_generation_id)is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''player_identity_required'',''operationAttempted'',false);end if;",1],["app.playoff_series_match_source_v1(p_tournament_id,p_event_id,p_qualification_id,p_slot)","app.selected_step_player_match_source_v3(p_tournament_id,p_event_id,p_qualification_id,p_slot,requested_generation_id)",1],["if src->>''status''<>''source_available'' then","if src is null or src->>''status''is distinct from''source_available'' then",1],["app.finish_playoff_series_game_operation_v1(","app.finish_selected_step_player_action_v3(",21]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern player source anchor changed: %: %','app.submit_selected_step_player_action_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.submit_selected_step_player_action_v3(p_tournament_id uuid, p_event_id uuid, p_qualification_id uuid, p_slot integer, p_request jsonb)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.submit_selected_step_player_action_v3(p_tournament_id uuid, p_event_id uuid, p_qualification_id uuid, p_slot integer, p_request jsonb)owner to postgres';
 execute 'revoke all on function app.submit_selected_step_player_action_v3(p_tournament_id uuid, p_event_id uuid, p_qualification_id uuid, p_slot integer, p_request jsonb)from public,anon,authenticated,service_role';
end$clone$;

do $clone$declare original regprocedure:='app.get_playoff_series_game_action_reconciliation_v1(uuid,uuid)'::regprocedure;body text;patch jsonb;old text;replacement text;expected integer;begin
 if not exists(select 1 from pg_proc where oid=original and proowner='postgres'::regrole and prosecdef)then raise exception 'untrusted modern player prerequisite';end if;
 select replace(prosrc,E'\r\n',E'\n')into body from pg_proc where oid=original;
 for patch in select value from jsonb_array_elements('[["a uuid:=auth.uid()","a uuid:=app.selected_step_player_actor_v3()",1],["select result into r from app.playoff_series_game_operation_outcomes_v1 where actor_id=a and operation_id=p_operation_id;","if app.selected_step_player_generation_access_v3(o.tournament_id,o.event_id,o.qualification_id,o.slot,o.generation_id)is distinct from true then return null;end if; select result into r from app.playoff_series_game_operation_outcomes_v1 where actor_id=a and operation_id=p_operation_id;",1]]'::jsonb)loop
  old:=patch->>0;replacement:=patch->>1;expected:=(patch->>2)::integer;
  if(length(body)-length(replace(body,old,'')))/length(old)<>expected then raise exception 'modern player source anchor changed: %: %','app.get_selected_step_player_action_v3',old;end if;
  body:=replace(body,old,replacement);
 end loop;
 execute format('create function app.get_selected_step_player_action_v3(p_tournament_id uuid, p_operation_id uuid)returns jsonb language plpgsql security definer set search_path='''' set timezone=''UTC'' as %L',body);
 execute 'alter function app.get_selected_step_player_action_v3(p_tournament_id uuid, p_operation_id uuid)owner to postgres';
 execute 'revoke all on function app.get_selected_step_player_action_v3(p_tournament_id uuid, p_operation_id uuid)from public,anon,authenticated,service_role';
end$clone$;

-- INTERNAL ONLY. Full source includes other profiles/parent proof and MUST NOT
-- be returned by a player API. The redacted view below is the read boundary.
create function app.selected_step_player_match_source_v3(tid uuid,eid uuid,qid uuid,slot_no integer,gid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare g app.playoff_series_generations_v1%rowtype;source jsonb;
begin
 if app.selected_step_player_generation_access_v3(tid,eid,qid,slot_no,gid)is distinct from true then return null;end if;
 select*into g from app.playoff_series_generations_v1 where id=gid and tournament_id=tid and event_id=eid and qualification_id=qid and slot=slot_no for share nowait;
 if g.id is null then return null;end if;
 -- Actual persisted author identity; neither a posted author nor a claim edit.
 source:=app.selected_step_player_match_evidence_v3(g.actor_id,tid,eid,qid,slot_no);
 if source->>'status'='retry_exact'then return source;end if;
 if source is null or source->>'status'is distinct from'source_available'or source->>'currentGenerationId'is distinct from g.id::text
  or source->>'sourceDigest'is distinct from g.source_digest or source->'source'is distinct from g.source_capture
 then return jsonb_build_object('status','blocked','code','modern_generation_source_changed');end if;
 if app.selected_step_player_generation_access_v3(tid,eid,qid,slot_no,gid)is distinct from true then return null;end if;
 return source;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$body$;

create function app.get_selected_step_player_view_v3(tid uuid,eid uuid,qid uuid,slot_no integer,gid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $body$
declare actor uuid:=app.selected_step_player_actor_v3();source jsonb;g app.playoff_series_generations_v1%rowtype;game app.playoff_series_games_v1%rowtype;
 own app.playoff_series_game_submissions_v1%rowtype;players jsonb;game_no integer;game_version integer;wins_a integer;wins_b integer;complete boolean;own_confirmed boolean;opponent_submitted boolean;
begin
 if actor is null then return null;end if;
 source:=app.selected_step_player_match_source_v3(tid,eid,qid,slot_no,gid);
 if source is null or source->>'status'is distinct from'source_available'then return source;end if;
 lock table app.playoff_series_games_v1,app.playoff_series_game_actions_v1,app.playoff_series_game_submissions_v1,
  app.playoff_series_game_confirmations_v1,app.playoff_series_verified_games_v1,app.playoff_series_results_v1 in share mode nowait;
 select*into g from app.playoff_series_generations_v1 where id=gid and tournament_id=tid and event_id=eid;
 select count(*)filter(where winner_participant_id=g.side_a_participant_id),count(*)filter(where winner_participant_id=g.side_b_participant_id),count(*)+1
  into wins_a,wins_b,game_no from app.playoff_series_verified_games_v1 where generation_id=gid;
 complete:=exists(select 1 from app.playoff_series_results_v1 r where r.generation_id=gid and app.playoff_series_completed_result_valid_v1(r.id));
 if complete then game_no:=game_no-1;end if;
 select*into game from app.playoff_series_games_v1 where generation_id=gid and game_number=game_no;
 select coalesce(max(a.game_version),0)into game_version from app.playoff_series_game_actions_v1 a where a.game_id=game.id;
 select s.*into own from app.playoff_series_game_submissions_v1 s join app.playoff_series_game_actions_v1 a on a.id=s.action_id
  where s.game_id=game.id and s.actor_profile_id=actor order by a.game_version desc limit 1;
 own_confirmed:=exists(select 1 from app.playoff_series_game_confirmations_v1 where game_id=game.id and actor_profile_id=actor and submission_id=own.id);
 opponent_submitted:=exists(select 1 from app.playoff_series_game_submissions_v1 where game_id=game.id and actor_profile_id<>actor);
 select jsonb_agg(jsonb_build_object('participantId',p.id,'displayName',qr.display_name_snapshot,'tournamentPlayerId',seat.verification_id)order by case when p.id=g.side_a_participant_id then 0 else 1 end)into players
  from app.event_participants p join app.initial_seating_assignments seat on seat.roster_entry_id=p.roster_entry_id and seat.tournament_id=p.tournament_id
  join app.qualification_result_rows qr on qr.result_version_id=qid and qr.participant_id=p.id and qr.tournament_id=tid and qr.event_id=eid and qr.qualification_status='qualified'
  where p.tournament_id=tid and p.event_id=eid and p.id in(g.side_a_participant_id,g.side_b_participant_id)and p.table_seat=seat.verification_id;
 if jsonb_array_length(players)is distinct from 2 then return jsonb_build_object('status','blocked','code','fixed_player_identity_required');end if;
 if app.selected_step_player_generation_access_v3(tid,eid,qid,slot_no,gid)is distinct from true then return null;end if;
 return jsonb_build_object('status','player_game_available','kind','selected-step-player-game-v3','tournamentId',tid,'eventId',eid,'qualificationId',qid,'slot',slot_no,
  'generationId',gid,'generationVersion',g.version,'round',g.round_name,'sourceDigest',g.source_digest,'settingsBindingId',g.settings_binding_id,'reviewId',g.context_review_id,'playoffStartId',g.playoff_start_id,'parentResultPins',source->'parentResultPins',
  'actorParticipantId',case when actor=g.side_a_profile_id then g.side_a_participant_id else g.side_b_participant_id end,'players',players,
  'winsRequired',g.wins_required,'maximumGames',g.maximum_games,'wins',jsonb_build_array(wins_a,wins_b),'seriesComplete',complete,
  'gameNumber',game_no,'gameId',game.id,'gameVersion',game_version,
  'ownSubmission',case when own.id is null then'null'::jsonb else jsonb_build_object('submissionId',own.id,'winnerParticipantId',own.winner_participant_id)end,
  'ownConfirmed',own_confirmed,'opponentSubmitted',opponent_submitted,'paperVerificationClaimed',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$body$;

do $functions$declare signature text;begin foreach signature in array array[
 'app.selected_step_player_scoring_enabled_v3()','app.selected_step_player_actor_v3()',
 'app.selected_step_player_generation_access_v3(uuid,uuid,uuid,integer,uuid)',
 'app.selected_step_player_match_source_v3(uuid,uuid,uuid,integer,uuid)','app.get_selected_step_player_view_v3(uuid,uuid,uuid,integer,uuid)'
 ]loop execute format('alter function %s owner to postgres',signature);execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);end loop;end$functions$;
commit;
