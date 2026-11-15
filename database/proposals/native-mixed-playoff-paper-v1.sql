-- PRIVATE DEFAULT-OFF Paper Playoff form and exact-operation recovery.
-- Requires frozen2c6 Playoff reopen + closed proof-v2. No role revocation:
-- authorized administrative readers intentionally retain existing visibility.
-- This endpoint withholds another actor's reading and guessable answer hashes.
-- All evidence is fictional; no physical-original, official result or money claim.
begin;
-- BEGIN PAPER DEPENDENCIES
do $paper_dependencies$declare x record;p record;begin
 for x in select*from(values ('app.native_mixed_playoff_leaf_row_bound_v2(uuid,text)','9dcbd5da74bfd64eae9139af4f95d61c8f9eb3688798abfe3d7e97cef2dcfc60',true,'s',array['search_path=""','TimeZone=UTC']::text[]),('app.native_mixed_playoff_game_v1(jsonb,jsonb,jsonb)','9484271cee32f032ca3d119d1a31720cdd0236c2d8b7ee65fcf313f5863d3c6a',false,'i',array['search_path=""','TimeZone=UTC']::text[]),('app.execute_native_mixed_playoff_v1(uuid,uuid,uuid,jsonb)','f6a2714ac582e123b6a91ec452a081891f2ff07c3aa999561e7bf2a2c6109123',true,'v',array['search_path=""','lock_timeout=250ms','TimeZone=UTC']::text[]),('app.get_native_mixed_playoff_own_v1(uuid,uuid)','f205584a487ba8fce203e7273838e7ed7d546abdaff2db42e95a563a100b2898',true,'v',array['search_path=""','TimeZone=UTC','lock_timeout=250ms']::text[]))v(signature,body_sha,definer,volatility,configs)loop
  select*into p from pg_proc where oid=to_regprocedure(x.signature);
  if p.oid is null or encode(extensions.digest(replace(p.prosrc,E'\r\n',E'\n'),'sha256'),'hex')<>x.body_sha
   or pg_get_userbyid(p.proowner)<>'postgres'or p.prosecdef is distinct from x.definer or p.provolatile::text<>x.volatility or p.proconfig is distinct from x.configs
   or has_function_privilege('anon',p.oid,'execute')or has_function_privilege('authenticated',p.oid,'execute')or has_function_privilege('service_role',p.oid,'execute')
  then raise exception 'playoff_paper_dependency_changed: %',x.signature;end if;
 end loop;end$paper_dependencies$;
-- END PAPER DEPENDENCIES
create function app.native_mixed_playoff_paper_enabled_v1()returns boolean
language sql immutable set search_path=''set timezone='UTC'as $$select false$$;

create function app.native_mixed_playoff_paper_blind_entry_v1(e jsonb)returns boolean
language sql immutable set search_path=''set timezone='UTC'as $$select coalesce(
 e->>'type'='paper-capture'and e->>'statement'='fictional-playoff-blind-paper-capture-v1'
 or e->>'type'='paper-review'and e->>'statement'='fictional-playoff-blind-paper-review-v1',false)$$;

-- The independently generated context receipt UUID is private and is never
-- returned by any Paper endpoint, nested receipt, recovery or closure object.
create function app.native_mixed_playoff_paper_head_token_v1(actor uuid,sid uuid,ctx uuid,s integer,g integer,digest text,md text,revision integer,real_head text)returns text
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare c app.native_mixed_playoff_contexts_v1%rowtype;begin
 if actor is null or sid is null or ctx is null or s is null or g is null or revision is null or s not between 1 and 4 or g not between 1 and 2500 or revision not between 0 and 6
 or coalesce(digest,'')!~'^[a-f0-9]{64}$'or coalesce(md,'')!~'^[a-f0-9]{64}$'or coalesce(real_head,'')!~'^[a-f0-9]{64}$'then return null;end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=ctx;
 if c.id is null or c.source_digest<>digest or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true then return null;end if;
 return encode(extensions.hmac(convert_to(jsonb_build_array('native-mixed-playoff-paper-head-v1',actor,sid,ctx,s,g,digest,md,revision,real_head)::text,'UTF8'),convert_to(c.receipt_id::text,'UTF8'),'sha256'),'hex');
end$$;

-- Structure only: never compares a proposed reading with the capture. A
-- prospective equality/disagreement result is not a no-write preview API.
create function app.native_mixed_playoff_paper_request_valid_v1(q jsonb,capture jsonb,m jsonb)returns boolean
language plpgsql immutable set search_path=''set timezone='UTC'as $$declare d jsonb;e jsonb;cs jsonb;item jsonb;papers jsonb;begin
 if app.native_mixed_pool_exact_v1(q,array['version','action','expectedSourceDigest','data','reason'])is distinct from true
 or q->>'version'is distinct from'native-mixed-playoff-request-v1'or q->>'action'is distinct from'game-action'
 or jsonb_typeof(q->'reason')is distinct from'string'or length(q->>'reason')not between 1 and 500 or q->>'reason'<>btrim(q->>'reason')or q->>'reason'~'[[:cntrl:]]'
 or jsonb_typeof(q->'expectedSourceDigest')is distinct from'string'or coalesce(q->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'then return false;end if;
 d:=q->'data';e:=d->'entry';
 if app.native_mixed_pool_exact_v1(d,array['contextId','slot','gameNumber','expectedMatchDigest','expectedRevision','expectedHistoryDigest','entry'])is distinct from true
 or app.native_mixed_simulation_uuid_v1(d->>'contextId')is distinct from true or d->'contextId'is distinct from m->'contextId'or d->'slot'is distinct from m->'slot'
 or jsonb_typeof(d->'gameNumber')is distinct from'number'or coalesce(d->>'gameNumber','')!~'^[1-9][0-9]{0,3}$'or(d->>'gameNumber')::integer>(m#>>'{format,maximumGames}')::integer
 or jsonb_typeof(d->'expectedRevision')is distinct from'number'or coalesce(d->>'expectedRevision','')!~'^[0-5]$'
 or jsonb_typeof(d->'expectedMatchDigest')is distinct from'string'or d->'expectedMatchDigest'is distinct from m->'matchDigest'
 or jsonb_typeof(d->'expectedHistoryDigest')is distinct from'string'or coalesce(d->>'expectedHistoryDigest','')!~'^[a-f0-9]{64}$'
 or app.native_mixed_playoff_paper_blind_entry_v1(e)is distinct from true then return false;end if;
 select coalesce(jsonb_agg(x->'participantId'),'[]')into papers from jsonb_array_elements(capture->'roster')x where x->>'mode'='paper'and m->'participants'?(x->>'participantId');
 if jsonb_array_length(papers)not between 1 and 2 then return false;end if;
 if e->>'type'='paper-capture'then
  if app.native_mixed_pool_exact_v1(e,array['type','artifactId','claims','statement'])is distinct from true or app.native_mixed_simulation_uuid_v1(e->>'artifactId')is distinct from true then return false;end if;cs:=e->'claims';
 else
  if app.native_mixed_pool_exact_v1(e,array['type','captureId','artifactId','artifactDigest','reenteredClaims','statement'])is distinct from true or app.native_mixed_simulation_uuid_v1(e->>'captureId')is distinct from true or app.native_mixed_simulation_uuid_v1(e->>'artifactId')is distinct from true
  or e->'artifactDigest'is distinct from d->'expectedHistoryDigest'then return false;end if;cs:=e->'reenteredClaims';
 end if;
 if jsonb_typeof(cs)is distinct from'array'then return false;end if;
 if jsonb_array_length(cs)<>jsonb_array_length(papers)or(select count(distinct x->>'participantId')from jsonb_array_elements(cs)x)<>jsonb_array_length(papers)then return false;end if;
 for item in select value from jsonb_array_elements(cs)loop
  if app.native_mixed_pool_exact_v1(item,array['participantId','winnerParticipantId'])is distinct from true or app.native_mixed_simulation_uuid_v1(item->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(item->>'winnerParticipantId')is distinct from true
  or not(papers?(item->>'participantId'))or not(m->'participants'?(item->>'winnerParticipantId'))then return false;end if;
 end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;end$$;

create function app.native_mixed_playoff_paper_subject_v1(tid uuid,eid uuid,ctx uuid,s integer,g integer,action text,writing boolean)returns uuid
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;c app.native_mixed_playoff_contexts_v1%rowtype;m jsonb;roles jsonb;b app.paper_official_identity_bindings%rowtype;begin
 if app.native_mixed_playoff_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null or auth.jwt()->>'sub'is distinct from actor::text or app.native_mixed_pilot_permitted_v1(actor,tid,eid,writing)is distinct from true then return null;end if;
 if ctx is null or s is null or g is null or action is null or writing is null or s not between 1 and 4 or g not between 1 and 2500 or action not in('read','paper-capture','paper-review')then return null;end if;
 lock table app.tournament_roles,app.paper_official_identity_bindings,app.event_participants,app.roster_account_links,app.tournament_roster_entries in share mode nowait;
 select coalesce(jsonb_agg(role),'[]')into roles from app.tournament_roles where tournament_id=tid and profile_id=actor;
 if(action='paper-capture'and not(roles?'cross_checker'))or(action in('read','paper-review')and not(roles?|array['director','co_director','cross_checker']))
 or app.paper_official_identity_is_current_valid(actor,tid)is distinct from true then return null;end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=ctx and tournament_id=tid and event_id=eid;
 if c.id is null or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true then return null;end if;
 m:=app.native_mixed_playoff_match_v1(ctx,s);
 if m is null or g>(m#>>'{format,maximumGames}')::integer or not exists(select 1 from jsonb_array_elements(c.source_capture->'roster')x where x->>'mode'='paper'and m->'participants'?(x->>'participantId'))then return null;end if;
 select*into b from app.paper_official_identity_bindings where tournament_id=tid and official_profile_id=actor order by binding_version desc limit 1;
 if b.id is null or exists(select 1 from jsonb_array_elements(c.source_capture->'roster')x where m->'participants'?(x->>'participantId')and(x->>'profileId'=actor::text or x->>'rosterEntryId'=b.roster_entry_id::text))
 or exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=eid and m->'participants'?p.id::text and(p.profile_id=actor or p.roster_entry_id=b.roster_entry_id))then return null;end if;
 return actor;end$$;

-- recovery=true permits historical outcomes while append modes are closed.
-- The public normal workspace additionally checks the new mode below.
create function app.native_mixed_playoff_paper_workspace_current_v1(tid uuid,eid uuid,ctx uuid,s integer,g integer,recovery boolean)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;c app.native_mixed_playoff_contexts_v1%rowtype;source jsonb;p jsonb;m jsonb;x jsonb;h jsonb;own_entry jsonb;cap jsonb;people jsonb;roles jsonb;hd text;token text;revision integer;phase text;blocked text;cap_meta jsonb;own_display jsonb;mode_on boolean;begin
 if not recovery and app.native_mixed_playoff_paper_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_playoff_paper_subject_v1(tid,eid,ctx,s,g,'read',false);if actor is null then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 lock table app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share mode nowait;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=ctx;source:=app.native_mixed_playoff_source_v1(tid,eid);
 if source is null then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 if c.source_capture is distinct from source->'capture'or c.source_digest<>source->>'sourceDigest'then return jsonb_build_object('status','blocked','code','source_changed');end if;
 p:=app.native_mixed_playoff_progress_v1(ctx,s);if p is null then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;m:=p->'match';
 select value into x from jsonb_array_elements(p->'games')v where(v->>'gameNumber')::integer=g;
 if x is null and(p->>'nextGameNumber')::integer is distinct from g then return jsonb_build_object('status','blocked','code','match_or_game_changed');end if;
 select coalesce(jsonb_agg(entry order by sequence),'[]'),count(*)into h,revision from app.native_mixed_playoff_active_evidence_v1(ctx,s,g);
 hd:=app.native_mixed_playoff_attempt_digest_v1(ctx,s,g,m->>'matchDigest',h,app.native_mixed_playoff_active_attempt_v1(ctx,s,g));
 token:=app.native_mixed_playoff_paper_head_token_v1(actor,(auth.jwt()->>'session_id')::uuid,ctx,s,g,c.source_digest,m->>'matchDigest',revision,hd);
 if token is null then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 select entry into cap from app.native_mixed_playoff_active_evidence_v1(ctx,s,g)where entry->>'type'='paper-capture';
 select entry into own_entry from app.native_mixed_playoff_active_evidence_v1(ctx,s,g)where actor_id=actor and entry->>'type'in('paper-capture','paper-review')order by sequence desc limit 1;
 select coalesce(jsonb_agg(role),'[]')into roles from app.tournament_roles where tournament_id=tid and profile_id=actor;
 mode_on:=app.native_mixed_playoff_paper_enabled_v1()is true and app.native_mixed_playoff_disagreement_enabled_v1()is true;
 if x->'complete'='true'::jsonb then phase:='complete';
 elsif x->'reviewRequired'='true'::jsonb then phase:='disputed';blocked:='independent_director_review_required';
 elsif cap is not null and cap->>'statement'is distinct from'fictional-playoff-blind-paper-capture-v1'then phase:='waiting';blocked:='legacy_capture_unsupported';
 elsif own_entry is not null then phase:='waiting';blocked:='own_reading_recorded';
 elsif exists(select 1 from jsonb_array_elements(h)v where v->>'type'='paper-review')then phase:='waiting';blocked:='independent_review_recorded';
 elsif not mode_on then phase:='waiting';blocked:='playoff_paper_unavailable';
 elsif cap is null and roles?'cross_checker'then phase:='capture';
 elsif cap is not null and cap->>'actorId'<>actor::text and roles?|array['director','co_director','cross_checker']then phase:='review';
 else phase:='waiting';blocked:='paper_role_unavailable';end if;
 select jsonb_agg(jsonb_build_object('participantId',r->'participantId','tournamentIdNumber',r->'fixedTournamentId','displayName',tr.claimed_display_name,'mode',r->'mode')order by sides.n)into people
 from jsonb_array_elements(m->'participants')with ordinality sides(pid,n)join jsonb_array_elements(c.source_capture->'roster')r on r->'participantId'=sides.pid
 join app.tournament_roster_entries tr on tr.id=(r->>'rosterEntryId')::uuid and tr.tournament_id=tid;
 if jsonb_array_length(people)is distinct from 2 or exists(select 1 from jsonb_array_elements(people)v where coalesce(v->>'displayName','')='')then return null;end if;
 own_display:=case when own_entry is null then null else app.native_mixed_playoff_display_entry_v1(own_entry)-'decision'end;
 cap_meta:=case when cap is null then null else jsonb_build_object('id',cap->'id','artifactId',cap->'artifactId','artifactDigest',case when own_entry is null then to_jsonb(token)else own_entry->'artifactDigest'end)end;
 if app.native_mixed_playoff_paper_subject_v1(tid,eid,ctx,s,g,'read',false)is distinct from actor then return null;end if;
 return jsonb_build_object('kind','native-mixed-playoff-paper-workspace-v1','actorId',actor,'sessionId',auth.jwt()->>'session_id','tournamentId',tid,'eventId',eid,'contextId',ctx,'slot',s,'gameNumber',g,
 'sourceDigest',c.source_digest,'matchDigest',m->'matchDigest','revision',revision,'historyDigest',token,'sideA',people->0,'sideB',people->1,'phase',phase,'capture',cap_meta,'ownEvidence',own_display,'blockedCode',blocked,
 'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.get_native_mixed_playoff_paper_workspace_v1(tid uuid,eid uuid,ctx uuid,s integer,g integer)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$begin return app.native_mixed_playoff_paper_workspace_current_v1(tid,eid,ctx,s,g,false);end$$;

create function app.native_mixed_playoff_paper_request_subject_v1(tid uuid,eid uuid,q jsonb,writing boolean)returns uuid
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare d jsonb:=q->'data';actor uuid;c app.native_mixed_playoff_contexts_v1%rowtype;m jsonb;begin
 if app.native_mixed_playoff_paper_blind_entry_v1(d->'entry')is distinct from true or app.native_mixed_simulation_uuid_v1(d->>'contextId')is distinct from true
 or jsonb_typeof(d->'slot')is distinct from'number'or coalesce(d->>'slot','')!~'^[1-4]$'
 or jsonb_typeof(d->'gameNumber')is distinct from'number'or coalesce(d->>'gameNumber','')!~'^[1-9][0-9]{0,3}$'or(d->>'gameNumber')::integer>2500 then return null;end if;
 actor:=app.native_mixed_playoff_paper_subject_v1(tid,eid,(d->>'contextId')::uuid,(d->>'slot')::integer,(d->>'gameNumber')::integer,d#>>'{entry,type}',writing);if actor is null then return null;end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=(d->>'contextId')::uuid;m:=app.native_mixed_playoff_match_v1(c.id,(d->>'slot')::integer);
 if c.source_digest is distinct from q->>'expectedSourceDigest'or app.native_mixed_playoff_paper_request_valid_v1(q,c.source_capture,m)is distinct from true then return null;end if;return actor;
exception when invalid_text_representation or numeric_value_out_of_range then return null;end$$;

-- Establish an actual signed original lease before a never-recorded operation
-- can be closed. Prefixes come only from the validated current ancestry. No
-- proposed winner/equality test is performed here, and no raw proof is returned.
create function app.native_mixed_playoff_paper_origin_v1(actor uuid,sid uuid,q jsonb)returns jsonb
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$declare d jsonb:=q->'data';ctx uuid:=(d->>'contextId')::uuid;s integer:=(d->>'slot')::integer;g integer:=(d->>'gameNumber')::integer;
 c app.native_mixed_playoff_contexts_v1%rowtype;m jsonb;p jsonb;attempt uuid;h jsonb;cap jsonb;hd text;token text;n integer;matches integer:=0;result jsonb;begin
 select*into c from app.native_mixed_playoff_contexts_v1 where id=ctx;m:=app.native_mixed_playoff_match_v1(ctx,s);
 if c.id is null or app.native_mixed_playoff_paper_request_valid_v1(q,c.source_capture,m)is distinct from true then return null;end if;
 p:=app.native_mixed_playoff_progress_v1(ctx,s);if p is null then return null;end if;
 -- Progress proved active rows and the proof-v2 ancestry; every historical
 -- prefix below belongs to this chain, never an unbound side branch.
 attempt:=app.native_mixed_playoff_active_attempt_v1(ctx,s,g);
 loop
  select coalesce(jsonb_agg(entry order by sequence),'[]'),count(*)into h,n from app.native_mixed_playoff_attempt_history_v1(ctx,s,g,attempt)where sequence<=(d->>'expectedRevision')::integer;
  if n=(d->>'expectedRevision')::integer then
   hd:=app.native_mixed_playoff_attempt_digest_v1(ctx,s,g,m->>'matchDigest',h,attempt);
   token:=app.native_mixed_playoff_paper_head_token_v1(actor,sid,ctx,s,g,c.source_digest,m->>'matchDigest',n,hd);
   select value into cap from jsonb_array_elements(h)x where x->>'type'='paper-capture';
   if token=d->>'expectedHistoryDigest'and(case when d#>>'{entry,type}'='paper-capture'then cap is null
    else cap->>'statement'='fictional-playoff-blind-paper-capture-v1'and cap->>'actorId'<>actor::text
     and not exists(select 1 from jsonb_array_elements(h)v where v->>'type'='paper-review')
     and cap->'id'=d#>'{entry,captureId}'and cap->'artifactId'=d#>'{entry,artifactId}'and d#>'{entry,artifactDigest}'=d->'expectedHistoryDigest'end)then
    matches:=matches+1;result:=jsonb_build_object('attemptId',attempt,'revision',n,'historyDigest',hd);
   end if;
  end if;
  exit when attempt is null;
  select prior_attempt_id into attempt from app.native_mixed_playoff_reopens_v1 where id=attempt;
 end loop;
 if matches<>1 then return null;end if;return result;end$$;

create function app.get_native_mixed_playoff_paper_operation_v1(tid uuid,eid uuid,op uuid,q jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;sid uuid;d jsonb:=q->'data';r app.operation_receipts%rowtype;e app.native_mixed_playoff_evidence_v1%rowtype;c app.native_mixed_playoff_own_closures_v1%rowtype;
 w jsonb;base jsonb;origin jsonb;attempt uuid;old_attempt uuid;begin
 if op is null then return null;end if;actor:=app.native_mixed_playoff_paper_request_subject_v1(tid,eid,q,false);if actor is null then return null;end if;sid:=(auth.jwt()->>'session_id')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 lock table app.native_mixed_playoff_own_closures_v1,app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share mode nowait;
 base:=jsonb_build_object('kind','native-mixed-playoff-paper-operation-v1','actorId',actor,'sessionId',sid,'tournamentId',tid,'eventId',eid,'operationId',op,'request',q,'writeAuthorized',false,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
 select*into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if r.id is not null then
  select*into c from app.native_mixed_playoff_own_closures_v1 where receipt_id=r.id;
  if c.id is not null and c.actor_session_id=sid and app.native_mixed_playoff_own_closure_bound_v1(r,actor,tid,eid,op,q)is true then return base||jsonb_build_object('status','closed','closureReceipt',r.response_payload||jsonb_build_object('historicalReceipt',true),'currentSourceVerified',false);end if;
  if r.operation_type<>'native_mixed_playoff_v1'or r.request_hash<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-request-v1',actor,tid,eid,q))then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  select*into e from app.native_mixed_playoff_all_evidence_v1()where receipt_id=r.id and actor_id=actor and actor_session_id=sid and operation_id=op and request_payload=q;
  if e.id is null or app.native_mixed_playoff_row_bound_v1(e.id,'evidence')is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 elsif app.native_mixed_simulation_operation_reserved_v1(actor,op)is true or exists(select 1 from app.native_mixed_playoff_all_evidence_v1()where actor_id=actor and operation_id=op)then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 w:=app.native_mixed_playoff_paper_workspace_current_v1(tid,eid,(d->>'contextId')::uuid,(d->>'slot')::integer,(d->>'gameNumber')::integer,true);
 if w->>'kind'is distinct from'native-mixed-playoff-paper-workspace-v1'then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 if app.native_mixed_playoff_paper_request_subject_v1(tid,eid,q,false)is distinct from actor then return null;end if;
 if e.id is not null then
  attempt:=app.native_mixed_playoff_active_attempt_v1(e.context_id,e.slot,e.game_number);old_attempt:=app.native_mixed_playoff_entry_attempt_v1(e.id);
  if attempt is not distinct from old_attempt then
   if w#>>'{ownEvidence,id}'is distinct from e.id::text then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
   return base||jsonb_build_object('status','accepted','receipt',r.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false),'currentWorkspace',w,'currentSourceVerified',true);
  end if;
  if attempt is not null and coalesce((select version from app.native_mixed_playoff_reopens_v1 where id=old_attempt),0)<(select version from app.native_mixed_playoff_reopens_v1 where id=attempt)and app.native_mixed_playoff_reopen_bound_v1(attempt)is true then
   return base||jsonb_build_object('status','superseded','receipt',r.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false),'reopenId',attempt,'currentWorkspace',w,'currentSourceVerified',true);end if;
  return jsonb_build_object('status','blocked','code','operation_history_unavailable');
 end if;
 if app.native_mixed_playoff_paper_enabled_v1()is distinct from true or app.native_mixed_playoff_disagreement_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','playoff_paper_unavailable');end if;
 -- Uniform across every structurally valid reading. Never classify a candidate
 -- against the other reading before an immutable write records this actor's own.
 if w->>'phase'is distinct from(case d#>>'{entry,type}'when'paper-capture'then'capture'else'review'end)or w->>'historyDigest'is distinct from d->>'expectedHistoryDigest'or w->'revision'is distinct from d->'expectedRevision'then return jsonb_build_object('status','not_found');end if;
 origin:=app.native_mixed_playoff_paper_origin_v1(actor,sid,q);if origin is null then return jsonb_build_object('status','not_found');end if;
 return base||jsonb_build_object('status','retry-original','currentWorkspace',w,'currentSourceVerified',true);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.close_native_mixed_playoff_paper_operation_v1(tid uuid,eid uuid,op uuid,q jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$declare actor uuid;sid uuid;d jsonb:=q->'data';r app.operation_receipts%rowtype;c app.native_mixed_playoff_contexts_v1%rowtype;closed app.native_mixed_playoff_own_closures_v1%rowtype;
 origin jsonb;source jsonb;p jsonb;h jsonb;hd text;token text;rev integer;code text;rid uuid;idv uuid;proof jsonb;response jsonb;begin
 if op is null then return null;end if;actor:=app.native_mixed_playoff_paper_request_subject_v1(tid,eid,q,true);if actor is null then return null;end if;sid:=(auth.jwt()->>'session_id')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 select*into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if r.id is not null then
  select*into closed from app.native_mixed_playoff_own_closures_v1 where receipt_id=r.id;
  if closed.id is not null and closed.actor_session_id=sid and app.native_mixed_playoff_own_closure_bound_v1(r,actor,tid,eid,op,q)is true then return r.response_payload||jsonb_build_object('historicalReceipt',true);end if;
  return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 lock table app.native_mixed_playoff_own_closures_v1,app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share row exclusive mode nowait;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true or exists(select 1 from app.native_mixed_playoff_all_evidence_v1()where actor_id=actor and operation_id=op)then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 origin:=app.native_mixed_playoff_paper_origin_v1(actor,sid,q);if origin is null then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 select*into c from app.native_mixed_playoff_contexts_v1 where id=(d->>'contextId')::uuid;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 p:=app.native_mixed_playoff_progress_v1(c.id,(d->>'slot')::integer);if p is null then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 if c.source_capture is distinct from source->'capture'or c.source_digest<>source->>'sourceDigest'then code:='source_changed';
 elsif p->'complete'='true'::jsonb or p->'nextGameNumber'<>d->'gameNumber'or p#>'{match,matchDigest}'<>d->'expectedMatchDigest'then code:='match_or_game_changed';
 else
  select coalesce(jsonb_agg(entry order by sequence),'[]'),count(*)into h,rev from app.native_mixed_playoff_active_evidence_v1(c.id,(d->>'slot')::integer,(d->>'gameNumber')::integer);
  hd:=app.native_mixed_playoff_attempt_digest_v1(c.id,(d->>'slot')::integer,(d->>'gameNumber')::integer,d->>'expectedMatchDigest',h,app.native_mixed_playoff_active_attempt_v1(c.id,(d->>'slot')::integer,(d->>'gameNumber')::integer));
  token:=app.native_mixed_playoff_paper_head_token_v1(actor,sid,c.id,(d->>'slot')::integer,(d->>'gameNumber')::integer,c.source_digest,d->>'expectedMatchDigest',rev,hd);
  if rev<>(d->>'expectedRevision')::integer or token is distinct from d->>'expectedHistoryDigest'then code:='history_changed';end if;
 end if;
 if code is null then return jsonb_build_object('status','blocked','code','request_still_current');end if;
 if app.native_mixed_playoff_paper_request_subject_v1(tid,eid,q,true)is distinct from actor then raise exception 'Paper Playoff closure authorization changed';end if;
 rid:=extensions.gen_random_uuid();idv:=extensions.gen_random_uuid();proof:=jsonb_build_object('paperOrigin',origin,'sourceDigest',source->'sourceDigest','progress',p,'revision',rev,'historyDigest',hd,'code',code);
 response:=jsonb_build_object('kind','native-mixed-playoff-own-closure-receipt-v1','status','closed','actorId',actor,'sessionId',sid,'tournamentId',tid,'eventId',eid,'operationId',op,'request',q,'code',code,
 'historicalReceipt',false,'currentSourceVerified',false,'writeAuthorized',false,'noWriteCommitted',true,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,tid,actor,'native_mixed_playoff_own_closure_v1',idv,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-request-v1',actor,tid,eid,q)),op,'rejected',response,clock_timestamp());
 insert into app.native_mixed_playoff_own_closures_v1(id,tournament_id,event_id,context_id,actor_id,actor_session_id,operation_id,receipt_id,request_payload,proof_capture,response_payload,record_digest)
 values(idv,tid,eid,c.id,actor,sid,op,rid,q,proof,response,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-own-closure-record-v1',idv,tid,eid,c.id,actor,sid,op,rid,q,proof,response)));
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,rid,'native_mixed_playoff_own_closure',idv,'uncommitted_closed',response);
 select*into r from app.operation_receipts where id=rid;if app.native_mixed_playoff_own_closure_bound_v1(r,actor,tid,eid,op,q)is distinct from true then raise exception 'Paper Playoff closure postcondition failed';end if;return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function public.get_native_mixed_playoff_paper_workspace_v1(p_tournament_id uuid,p_event_id uuid,p_context_id uuid,p_slot integer,p_game_number integer)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$begin if auth.role()is distinct from'authenticated'then return null;end if;return app.get_native_mixed_playoff_paper_workspace_v1(p_tournament_id,p_event_id,p_context_id,p_slot,p_game_number);end$$;
create function public.get_native_mixed_playoff_paper_operation_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$begin if auth.role()is distinct from'authenticated'or octet_length(convert_to(p_request::text,'UTF8'))>32768 then return null;end if;return app.get_native_mixed_playoff_paper_operation_v1(p_tournament_id,p_event_id,p_operation_id,p_request);end$$;
create function public.close_native_mixed_playoff_paper_operation_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'as $$begin if auth.role()is distinct from'authenticated'or octet_length(convert_to(p_request::text,'UTF8'))>32768 then return null;end if;return app.close_native_mixed_playoff_paper_operation_v1(p_tournament_id,p_event_id,p_operation_id,p_request);end$$;

-- BEGIN DERIVED FUNCTIONS: build-native-mixed-playoff-paper-v1.mjs
create or replace function app.native_mixed_playoff_leaf_row_bound_v2(row_id uuid,kind text)returns boolean
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare v jsonb;r app.operation_receipts%rowtype;q jsonb;d jsonb;expected_entry jsonb;artifact jsonb;prior_history jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;begin
 if kind='context'then select to_jsonb(x)into v from app.native_mixed_playoff_contexts_v1 x where id=row_id;
 elsif kind='evidence'then select to_jsonb(x)into v from app.native_mixed_playoff_all_evidence_v1() x where id=row_id;else return false;end if;
 if v is null then return false;end if;
 q:=v->'request_payload';d:=q->'data';
 if not app.native_mixed_pool_exact_v1(q,array['version','action','expectedSourceDigest','data','reason'])
  or q->>'version'is distinct from'native-mixed-playoff-request-v1'then return false;end if;
 if kind='context'then
  if q->>'action'is distinct from'create-context'or not app.native_mixed_pool_exact_v1(d,array[]::text[])
   or q->>'expectedSourceDigest'is distinct from v->>'source_digest'
   or v#>>'{source_capture,tournamentId}'is distinct from v->>'tournament_id'
   or v#>>'{source_capture,eventId}'is distinct from v->>'event_id'
   or v#>>'{source_capture,startId}'is distinct from v->>'start_id'
   or v->>'source_digest'is distinct from app.native_mixed_simulation_hash_v1(v->'source_capture')
   or v->>'context_digest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-context-v1',row_id,(v->>'tournament_id')::uuid,(v->>'event_id')::uuid,(v->>'start_id')::uuid,v->>'source_digest'))then return false;end if;
 else
  select*into c from app.native_mixed_playoff_contexts_v1 where id=(v->>'context_id')::uuid;
  if c.id is null or c.tournament_id::text is distinct from v->>'tournament_id'or c.event_id::text is distinct from v->>'event_id'
   or q->>'action'is distinct from'game-action'or q->>'expectedSourceDigest'is distinct from c.source_digest
   or not app.native_mixed_pool_exact_v1(d,array['contextId','slot','gameNumber','expectedMatchDigest','expectedRevision','expectedHistoryDigest','entry'])
   or d->>'contextId'is distinct from v->>'context_id'or d->'slot'is distinct from v->'slot'or d->'gameNumber'is distinct from v->'game_number'
   or d->>'expectedMatchDigest'is distinct from v->>'match_digest'or d->'expectedRevision'is distinct from to_jsonb((v->>'sequence')::integer-1)
   or jsonb_typeof(d->'entry')is distinct from'object'or(d->'entry')?|array['id','actorId']
   or(d#>>'{entry,type}'='paper-capture'and(d->'entry')?'artifactDigest')
   or not app.native_mixed_pool_exact_v1(v->'authority_capture',array['actorId','sessionId','roles','paperIdentityBinding','simulationOnly'])
   or v#>>'{authority_capture,actorId}'is distinct from v->>'actor_id'or v#>>'{authority_capture,sessionId}'is distinct from v->>'actor_session_id'
   or v#>'{authority_capture,simulationOnly}'is distinct from'true'::jsonb then return false;end if;
  select coalesce(jsonb_agg(entry order by sequence),'[]')into prior_history from app.native_mixed_playoff_all_evidence_v1()
   where context_id=c.id and slot=(v->>'slot')::integer and game_number=(v->>'game_number')::integer and sequence<(v->>'sequence')::integer and app.native_mixed_playoff_entry_attempt_v1(id)is not distinct from app.native_mixed_playoff_entry_attempt_v1(row_id);
  if jsonb_array_length(prior_history)<>(v->>'sequence')::integer-1 or d->>'expectedHistoryDigest'is distinct from(case when app.native_mixed_playoff_paper_blind_entry_v1(d->'entry')then app.native_mixed_playoff_paper_head_token_v1((v->>'actor_id')::uuid,(v->>'actor_session_id')::uuid,c.id,(v->>'slot')::integer,(v->>'game_number')::integer,c.source_digest,v->>'match_digest',(v->>'sequence')::integer-1,app.native_mixed_playoff_attempt_digest_v1(c.id,(v->>'slot')::integer,(v->>'game_number')::integer,v->>'match_digest',prior_history,app.native_mixed_playoff_entry_attempt_v1(row_id)))else app.native_mixed_playoff_attempt_digest_v1(c.id,(v->>'slot')::integer,(v->>'game_number')::integer,v->>'match_digest',prior_history,app.native_mixed_playoff_entry_attempt_v1(row_id))end)then return false;end if;
  if d#>>'{entry,statement}'='fictional-playoff-blind-paper-review-v1'and d#>'{entry,artifactDigest}'is distinct from d->'expectedHistoryDigest'then return false;end if;
  expected_entry:=jsonb_build_object('id',row_id,'actorId',(v->>'actor_id')::uuid)||(d->'entry');
  if d#>>'{entry,type}'='paper-capture'then
   artifact:=jsonb_build_object('kind','native-mixed-playoff-fictional-paper-v1','contextId',c.id,'slot',(v->>'slot')::integer,'gameNumber',(v->>'game_number')::integer,'claims',d#>'{entry,claims}','physicalOriginal',false,'actualPlayClaimed',false);
   expected_entry:=expected_entry||jsonb_build_object('artifactDigest',app.native_mixed_simulation_hash_v1(artifact));
  end if;
  if v->'entry'is distinct from expected_entry
   or v->>'entry_digest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',row_id,(v->>'context_id')::uuid,(v->>'slot')::integer,(v->>'game_number')::integer,(v->>'sequence')::integer,(v->>'actor_id')::uuid,(v->>'actor_session_id')::uuid,(v->>'operation_id')::uuid,v->'request_payload',v->>'match_digest',v->'entry',v->'authority_capture'))then return false;end if;
 end if;
 select*into r from app.operation_receipts where id=(v->>'receipt_id')::uuid;
 return r.id is not null and r.actor_profile_id=(v->>'actor_id')::uuid and r.client_operation_id=(v->>'operation_id')::uuid
  and r.tournament_id=(v->>'tournament_id')::uuid and r.target_id=row_id and r.operation_type='native_mixed_playoff_v1'
  and r.request_hash=v->>'request_hash'and r.request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-request-v1',r.actor_profile_id,r.tournament_id,(v->>'event_id')::uuid,v->'request_payload'))
  and r.outcome='accepted'and r.response_payload=v->'response_payload'
  and exists(select 1 from app.audit_events a where a.tournament_id=r.tournament_id and a.actor_profile_id=r.actor_profile_id and a.operation_receipt_id=r.id
   and a.entity_type='native_mixed_playoff_simulation'and a.entity_id=row_id and a.action=kind and a.after_state=r.response_payload);
end$$;

create or replace function app.native_mixed_playoff_game_v1(capture jsonb,participants jsonb,history jsonb)returns jsonb
language plpgsql immutable set search_path=''set timezone='UTC'as $$
declare e jsonb;p jsonb;item jsonb;submissions jsonb:='[]';confirmed jsonb:='[]';digital jsonb;paper jsonb;capture_entry jsonb;review_entry jsonb;
 disputed boolean:=false;winner text;refs jsonb;own_pid text;action text;actor text;roles jsonb;begin
 if jsonb_typeof(history)is distinct from'array'then return null;end if;
 if jsonb_array_length(history)>6 then return null;end if;
 if jsonb_typeof(participants)is distinct from'array'then return null;end if;
 if jsonb_array_length(participants)<>2 then return null;end if;
 if exists(select 1 from jsonb_array_elements(history)x where jsonb_typeof(x)is distinct from'object'
  or app.native_mixed_simulation_uuid_v1(x->>'id')is distinct from true or app.native_mixed_simulation_uuid_v1(x->>'actorId')is distinct from true)
  or(select count(distinct x->>'id')from jsonb_array_elements(history)x)<>jsonb_array_length(history)then return null;end if;
 select coalesce(jsonb_agg(x->'participantId'),'[]')into digital from jsonb_array_elements(capture->'seeds')x where participants? (x->>'participantId')and x->>'mode'='digital';
 select coalesce(jsonb_agg(x->'participantId'),'[]')into paper from jsonb_array_elements(capture->'seeds')x where participants? (x->>'participantId')and x->>'mode'='paper';
 if jsonb_array_length(digital)+jsonb_array_length(paper)<>2 then return null;end if;
 for e in select value from jsonb_array_elements(history)loop
  if disputed then return null;end if;
  action:=e->>'type';actor:=e->>'actorId';p:=e-'id'-'type'-'actorId';
  select x->>'participantId'into own_pid from jsonb_array_elements(capture->'roster')x where x->>'profileId'=actor and x->>'mode'='digital'and participants?(x->>'participantId');
  if action='digital-submit'then
   if not app.native_mixed_pool_exact_v1(p,array['participantId','winnerParticipantId','statement'])or p->>'statement'is distinct from'simulation-own-playoff-result-v1'
    or app.native_mixed_simulation_uuid_v1(p->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(p->>'winnerParticipantId')is distinct from true
    or own_pid is null or own_pid is distinct from p->>'participantId'or exists(select 1 from jsonb_array_elements(submissions)x where x->>'participantId'=own_pid)
    or not(participants?(p->>'winnerParticipantId'))or jsonb_array_length(confirmed)>0 then return null;end if;
   if winner is not null and winner<>p->>'winnerParticipantId'then disputed:=true;end if;
   winner:=p->>'winnerParticipantId';submissions:=submissions||jsonb_build_array(e);
  elsif action='digital-confirm'then
   select coalesce(jsonb_agg(x->'id'order by x->>'id'),'[]')into refs from jsonb_array_elements(history)x where x->>'type'in('digital-submit','paper-capture','paper-review')and(x->>'id')<>(e->>'id');
   -- The current prefix must be complete before a confirmation is admitted.
   if not app.native_mixed_pool_exact_v1(p,array['participantId','submissionId','winnerParticipantId','evidenceIds','statement'])or p->>'statement'is distinct from'simulation-own-playoff-confirmation-v1'
    or app.native_mixed_simulation_uuid_v1(p->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(p->>'submissionId')is distinct from true or app.native_mixed_simulation_uuid_v1(p->>'winnerParticipantId')is distinct from true
    or own_pid is null or own_pid is distinct from p->>'participantId'or jsonb_array_length(submissions)<>jsonb_array_length(digital)
    or(jsonb_array_length(paper)>0 and review_entry is null)or winner is null or winner is distinct from p->>'winnerParticipantId'
    or not exists(select 1 from jsonb_array_elements(submissions)x where x->>'participantId'=own_pid and x->>'id'=p->>'submissionId')
    or confirmed?own_pid or p->'evidenceIds'is distinct from refs then return null;end if;
   confirmed:=confirmed||jsonb_build_array(own_pid);
  elsif action='paper-capture'then
   if jsonb_typeof(p->'claims')is distinct from'array'then return null;end if;
   if not app.native_mixed_pool_exact_v1(p,array['artifactId','artifactDigest','claims','statement'])or coalesce(p->>'statement','')not in('fictional-playoff-paper-capture-v1','fictional-playoff-blind-paper-capture-v1')
    or app.native_mixed_simulation_uuid_v1(p->>'artifactId')is distinct from true or coalesce(p->>'artifactDigest','')!~'^[a-f0-9]{64}$'
    or jsonb_array_length(paper)=0 or own_pid is not null or capture_entry is not null or jsonb_typeof(p->'claims')is distinct from'array'
    or jsonb_array_length(p->'claims')<>jsonb_array_length(paper)then return null;end if;
   if(select count(distinct x->>'participantId')from jsonb_array_elements(p->'claims')x)<>jsonb_array_length(paper)then return null;end if;
   for item in select value from jsonb_array_elements(p->'claims')loop
    if not app.native_mixed_pool_exact_v1(item,array['participantId','winnerParticipantId'])or app.native_mixed_simulation_uuid_v1(item->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(item->>'winnerParticipantId')is distinct from true or not(paper?(item->>'participantId'))or not(participants?(item->>'winnerParticipantId'))then return null;end if;if winner is not null and winner<>item->>'winnerParticipantId'then disputed:=true;end if;winner:=item->>'winnerParticipantId';end loop;
   capture_entry:=e;
  elsif action='paper-review'then
   if not(app.native_mixed_pool_exact_v1(p,array['captureId','artifactId','artifactDigest','reenteredClaims','statement'])or app.native_mixed_pool_exact_v1(p,array['captureId','artifactId','artifactDigest','reenteredClaims','decision','statement']))or coalesce(p->>'statement','')not in('fictional-playoff-paper-review-v1','fictional-playoff-blind-paper-review-v1')
    or capture_entry is null or review_entry is not null or actor=capture_entry->>'actorId'or own_pid is not null
    or p->'captureId'is distinct from capture_entry->'id'or p->'artifactId'is distinct from capture_entry->'artifactId'or(case when p->>'statement'='fictional-playoff-blind-paper-review-v1'then
     capture_entry->>'statement'is distinct from'fictional-playoff-blind-paper-capture-v1'or p?'decision'or coalesce(p->>'artifactDigest','')!~'^[a-f0-9]{64}$'
    else capture_entry->>'statement'='fictional-playoff-blind-paper-capture-v1'or p->'artifactDigest'is distinct from capture_entry->'artifactDigest'end)
    or jsonb_typeof(p->'reenteredClaims')is distinct from'array'then return null;end if;
   if jsonb_array_length(p->'reenteredClaims')<>jsonb_array_length(paper)or(select count(distinct x->>'participantId')from jsonb_array_elements(p->'reenteredClaims')x)<>jsonb_array_length(paper)then return null;end if;
   for item in select value from jsonb_array_elements(p->'reenteredClaims')loop
    if not app.native_mixed_pool_exact_v1(item,array['participantId','winnerParticipantId'])or app.native_mixed_simulation_uuid_v1(item->>'participantId')is distinct from true or app.native_mixed_simulation_uuid_v1(item->>'winnerParticipantId')is distinct from true or not(paper?(item->>'participantId'))or not(participants?(item->>'winnerParticipantId'))then return null;end if;
   end loop;
   if p->>'statement'='fictional-playoff-blind-paper-review-v1'then
    if(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(p->'reenteredClaims')x)is distinct from(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(capture_entry->'claims')x)then
     if jsonb_array_length(confirmed)>0 then return null;end if;disputed:=true;
    end if;
   elsif not(p?'decision')then if p->'reenteredClaims'is distinct from capture_entry->'claims'then return null;end if;
   elsif p->>'decision'='accepted-simulation-only'then
    if(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(p->'reenteredClaims')x)is distinct from(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(capture_entry->'claims')x)then return null;end if;
   elsif p->>'decision'='disputed-simulation-only'then
    if jsonb_array_length(confirmed)>0 or(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(p->'reenteredClaims')x)is not distinct from(select jsonb_agg(x order by x->>'participantId')from jsonb_array_elements(capture_entry->'claims')x)then return null;end if;disputed:=true;
   else return null;end if;review_entry:=e;
  else return null;end if;
 end loop;
 if disputed then return jsonb_build_object('complete',false,'winnerId',null,'reviewRequired',true);end if;
 return jsonb_build_object('complete',winner is not null and jsonb_array_length(submissions)=jsonb_array_length(digital)
  and jsonb_array_length(confirmed)=jsonb_array_length(digital)and(jsonb_array_length(paper)=0 or review_entry is not null),'winnerId',winner);
end$$;

create or replace function app.execute_native_mixed_playoff_v1(tid uuid,eid uuid,op uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'set timezone='UTC'as $$
declare actor uuid;action text;data jsonb;source jsonb;old app.operation_receipts%rowtype;c app.native_mixed_playoff_contexts_v1%rowtype;
 e app.native_mixed_playoff_evidence_v1%rowtype;m jsonb;progress jsonb;history jsonb;revision integer;hd text;request_hash text;
 entry_value jsonb;payload jsonb;authority jsonb;roles jsonb;binding app.paper_official_identity_bindings%rowtype;
 rid uuid:=extensions.gen_random_uuid();idv uuid:=extensions.gen_random_uuid();ctxid uuid;slot_no integer;game_no integer;
 typ text;own_pid uuid;response jsonb;kind text;artifact jsonb;result_id uuid;winner uuid;loser uuid;cohorts jsonb;result_capture jsonb;is_director boolean;paper_blind boolean:=false;paper_token text;
begin
 if app.native_mixed_playoff_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 actor:=app.native_mixed_pool_actor_v1();if actor is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 lock table app.native_mixed_pilot_scopes_v1,app.native_mixed_pilot_deployment_v1 in share mode nowait;
 if app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 if tid is null or eid is null or op is null or not app.native_mixed_pool_exact_v1(request,array['version','action','expectedSourceDigest','data','reason'])
  or request->>'version'is distinct from'native-mixed-playoff-request-v1'or coalesce(request->>'expectedSourceDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(request->'reason')is distinct from'string'or length(request->>'reason')not between 1 and 500 or request->>'reason'<>trim(request->>'reason')or request->>'reason'~'[[:cntrl:]]'
 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 action:=request->>'action';data:=request->'data';if action is null or action not in('create-context','game-action')then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 lock table app.tournament_roles,app.paper_official_identity_bindings,app.roster_account_links,app.event_participants in share mode nowait;
 select coalesce(jsonb_agg(role order by role),'[]')into roles from app.tournament_roles where tournament_id=tid and profile_id=actor;
 is_director:=roles?'director';
 if action='create-context'and not is_director then return null;end if;
 if action='game-action'then
  if not app.native_mixed_pool_exact_v1(data,array['contextId','slot','gameNumber','expectedMatchDigest','expectedRevision','expectedHistoryDigest','entry'])
   or app.native_mixed_simulation_uuid_v1(data->>'contextId')is distinct from true
   or jsonb_typeof(data->'slot')is distinct from'number'or coalesce(data->>'slot','')!~'^[1-4]$'
   or jsonb_typeof(data->'gameNumber')is distinct from'number'or coalesce(data->>'gameNumber','')!~'^[1-9][0-9]{0,3}$'
   or(data->>'gameNumber')::integer>2500 or coalesce(data->>'expectedMatchDigest','')!~'^[a-f0-9]{64}$'
   or jsonb_typeof(data->'expectedRevision')is distinct from'number'or coalesce(data->>'expectedRevision','')!~'^[0-5]$'
   or coalesce(data->>'expectedHistoryDigest','')!~'^[a-f0-9]{64}$'or jsonb_typeof(data->'entry')is distinct from'object'
  then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  ctxid:=(data->>'contextId')::uuid;slot_no:=(data->>'slot')::integer;game_no:=(data->>'gameNumber')::integer;typ:=data#>>'{entry,type}';
  select*into c from app.native_mixed_playoff_contexts_v1 where id=ctxid and tournament_id=tid and event_id=eid;
  m:=app.native_mixed_playoff_match_v1(ctxid,slot_no);if c.id is null or m is null then return jsonb_build_object('status','rejected','code','parent_or_context_unavailable');end if;
  if typ is null or typ not in('digital-submit','digital-confirm','paper-capture','paper-review')then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  select(p->>'participantId')::uuid into own_pid from jsonb_array_elements(c.source_capture->'roster')p
   where p->>'mode'='digital'and p->>'profileId'=actor::text and m->'participants'?(p->>'participantId')
   and exists(select 1 from app.event_participants ep join app.roster_account_links l on l.tournament_id=ep.tournament_id and l.roster_entry_id=ep.roster_entry_id and l.profile_id=ep.profile_id where ep.id=(p->>'participantId')::uuid and ep.tournament_id=tid and ep.event_id=eid and ep.profile_id=actor);
  if typ in('digital-submit','digital-confirm')then if own_pid is null then return null;end if;
  else
   if own_pid is not null or app.paper_official_identity_is_current_valid(actor,tid)is distinct from true
    or(typ='paper-capture'and not(roles?'cross_checker'))or(typ='paper-review'and not(roles?|array['director','co_director','cross_checker']))then return null;end if;
   select*into binding from app.paper_official_identity_bindings where tournament_id=tid and official_profile_id=actor order by binding_version desc limit 1;
   if binding.id is null or exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=eid and m->'participants'?p.id::text and(p.profile_id=actor or p.roster_entry_id=binding.roster_entry_id))then return null;end if;
  end if;
 end if;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 request_hash:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-request-v1',actor,tid,eid,request));
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if old.id is not null then
  if old.tournament_id<>tid or old.operation_type<>'native_mixed_playoff_v1'or old.request_hash<>request_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  kind:=case action when'create-context'then'context'else'evidence'end;
  if app.native_mixed_playoff_row_bound_v1(old.target_id,kind)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null or source->>'sourceDigest'<>request->>'expectedSourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 lock table app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_own_closures_v1,app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share row exclusive mode nowait;
 if action='create-context'then
  if not app.native_mixed_pool_exact_v1(data,array[]::text[])then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if exists(select 1 from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','context_already_exists');end if;
  response:=jsonb_build_object('status','simulated_playoff_context_created','contextId',idv,'sourceDigest',source->>'sourceDigest',
   'contextDigest',app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-context-v1',idv,tid,eid,(source#>>'{capture,startId}')::uuid,source->>'sourceDigest')),
   'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
  if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true
  then raise exception using errcode='P0001',message='native_playoff_authorization_changed';end if;
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,tid,actor,'native_mixed_playoff_v1',idv,request_hash,op,'accepted',response,clock_timestamp());
  insert into app.native_mixed_playoff_contexts_v1(id,tournament_id,event_id,start_id,actor_id,operation_id,receipt_id,request_payload,request_hash,source_capture,source_digest,context_digest,response_payload)
   values(idv,tid,eid,(source#>>'{capture,startId}')::uuid,actor,op,rid,request,request_hash,source->'capture',source->>'sourceDigest',response->>'contextDigest',response);kind:='context';
 else
  if c.source_capture is distinct from source->'capture'or c.source_digest<>source->>'sourceDigest'or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true then return jsonb_build_object('status','rejected','code','source_changed');end if;
  progress:=app.native_mixed_playoff_progress_v1(c.id,slot_no);
  if progress is null or progress->'complete'='true'::jsonb or(progress->>'nextGameNumber')::integer<>game_no or m->>'matchDigest'<>data->>'expectedMatchDigest'then return jsonb_build_object('status','rejected','code','match_or_game_changed');end if;
  select coalesce(jsonb_agg(entry order by sequence),'[]'),count(*)into history,revision from app.native_mixed_playoff_active_evidence_v1(c.id,slot_no,game_no) where context_id=c.id and slot=slot_no and game_number=game_no;
  hd:=app.native_mixed_playoff_attempt_digest_v1(c.id,slot_no,game_no,m->>'matchDigest',history,app.native_mixed_playoff_active_attempt_v1(c.id,slot_no,game_no));
  paper_blind:=app.native_mixed_playoff_paper_blind_entry_v1(data->'entry');
  -- A new capture is the durable opt-in marker. No fresh legacy/unknown Paper
  -- statement may turn raw CAS into an answer-guessing oracle. Replay is above.
  if typ in('paper-capture','paper-review')and not paper_blind and exists(select 1 from jsonb_array_elements(history)x where x->>'type'='paper-capture'and x->>'statement'='fictional-playoff-blind-paper-capture-v1')then return jsonb_build_object('status','blocked','code','blind_review_required');end if;
  if paper_blind and exists(select 1 from jsonb_array_elements(history)x where x->>'type'='paper-capture'and x->>'statement'is distinct from'fictional-playoff-blind-paper-capture-v1')then return jsonb_build_object('status','blocked','code','legacy_capture_unsupported');end if;
  if paper_blind and app.native_mixed_playoff_paper_request_valid_v1(request,c.source_capture,m)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if paper_blind and app.native_mixed_playoff_paper_request_subject_v1(tid,eid,request,true)is distinct from actor then return null;end if;
  if paper_blind then paper_token:=app.native_mixed_playoff_paper_head_token_v1(actor,(auth.jwt()->>'session_id')::uuid,c.id,slot_no,game_no,c.source_digest,m->>'matchDigest',revision,hd);end if;
  if revision<>(data->>'expectedRevision')::integer or(case when paper_blind then paper_token else hd end)is distinct from data->>'expectedHistoryDigest'then return jsonb_build_object('status','rejected','code','history_changed');end if;
  if paper_blind and typ='paper-review'and data#>'{entry,artifactDigest}'is distinct from data->'expectedHistoryDigest'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if paper_blind and(app.native_mixed_playoff_paper_enabled_v1()is distinct from true or app.native_mixed_playoff_disagreement_enabled_v1()is distinct from true)then return jsonb_build_object('status','retry_exact','code','playoff_paper_unavailable');end if;
  if exists(select 1 from app.native_mixed_playoff_completions_v1 where context_id=c.id)then return jsonb_build_object('status','rejected','code','playoffs_complete');end if;
  if exists(select 1 from jsonb_array_elements(progress->'games')g where g->'gameNumber'=data->'gameNumber'and g->'reviewRequired'='true'::jsonb)then return jsonb_build_object('status','rejected','code','evidence_mismatch');end if;
  payload:=(data->'entry')-'type';
  if payload?'id'or payload?'actorId'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  if typ='paper-capture'then
   if not app.native_mixed_pool_exact_v1(payload,array['artifactId','claims','statement'])or app.native_mixed_simulation_uuid_v1(payload->>'artifactId')is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
   artifact:=jsonb_build_object('kind','native-mixed-playoff-fictional-paper-v1','contextId',c.id,'slot',slot_no,'gameNumber',game_no,'claims',payload->'claims','physicalOriginal',false,'actualPlayClaimed',false);
   payload:=payload||jsonb_build_object('artifactDigest',app.native_mixed_simulation_hash_v1(artifact));
   if exists(select 1 from app.native_mixed_playoff_all_evidence_v1() where entry->>'artifactId'=payload->>'artifactId'and entry->>'type'='paper-capture')then return jsonb_build_object('status','rejected','code','artifact_already_used');end if;
  end if;
  authority:=jsonb_build_object('actorId',actor,'sessionId',auth.jwt()->>'session_id','roles',roles,'paperIdentityBinding',case when typ in('paper-capture','paper-review')then to_jsonb(binding)else null end,'simulationOnly',true);
  entry_value:=jsonb_build_object('id',idv,'type',typ,'actorId',actor)||payload;
  progress:=app.native_mixed_playoff_progress_v1(c.id,slot_no,jsonb_build_object('gameNumber',game_no,'entry',entry_value));if progress is null then return jsonb_build_object('status','rejected','code','evidence_mismatch');end if;
  if not paper_blind and(progress->'games'->-1)->'reviewRequired'='true'::jsonb and app.native_mixed_playoff_disagreement_enabled_v1()is distinct from true then return jsonb_build_object('status','retry_exact','code','playoff_disagreement_unavailable');end if;
  history:=history||jsonb_build_array(entry_value);hd:=app.native_mixed_playoff_attempt_digest_v1(c.id,slot_no,game_no,m->>'matchDigest',history,app.native_mixed_playoff_active_attempt_v1(c.id,slot_no,game_no));
  response:=jsonb_build_object('status','simulated_playoff_evidence_recorded','contextId',c.id,'slot',slot_no,'gameNumber',game_no,'entryId',idv,'revision',revision+1,'historyDigest',hd,'sourceDigest',c.source_digest,'matchDigest',m->>'matchDigest','gameComplete',(progress->'games'->-1)->'complete','matchComplete',progress->'complete','winnerId',progress->'winnerId','simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
  if paper_blind and(app.native_mixed_playoff_paper_enabled_v1()is distinct from true or app.native_mixed_playoff_disagreement_enabled_v1()is distinct from true)then return jsonb_build_object('status','retry_exact','code','playoff_paper_unavailable');end if;
  if paper_blind and app.native_mixed_playoff_paper_request_subject_v1(tid,eid,request,true)is distinct from actor then raise exception 'Paper Playoff authorization changed';end if;
  if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true
  then raise exception using errcode='P0001',message='native_playoff_authorization_changed';end if;
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,tid,actor,'native_mixed_playoff_v1',idv,request_hash,op,'accepted',response,clock_timestamp());
  if app.native_mixed_playoff_active_attempt_v1(c.id,slot_no,game_no)is null then
  insert into app.native_mixed_playoff_evidence_v1(id,context_id,tournament_id,event_id,slot,game_number,sequence,actor_id,actor_session_id,operation_id,receipt_id,request_payload,request_hash,match_digest,entry,authority_capture,entry_digest,response_payload)
   values(idv,c.id,tid,eid,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,rid,request,request_hash,m->>'matchDigest',entry_value,authority,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',idv,c.id,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,request,m->>'matchDigest',entry_value,authority)),response);
  else insert into app.native_mixed_playoff_attempt_evidence_v1(attempt_id,id,context_id,tournament_id,event_id,slot,game_number,sequence,actor_id,actor_session_id,operation_id,receipt_id,request_payload,request_hash,match_digest,entry,authority_capture,entry_digest,response_payload)
   values(app.native_mixed_playoff_active_attempt_v1(c.id,slot_no,game_no),idv,c.id,tid,eid,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,rid,request,request_hash,m->>'matchDigest',entry_value,authority,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-playoff-evidence-v1',idv,c.id,slot_no,game_no,revision+1,actor,(auth.jwt()->>'session_id')::uuid,op,request,m->>'matchDigest',entry_value,authority)),response);end if;kind:='evidence';
  if progress->'complete'='true'::jsonb then
   winner:=(progress->>'winnerId')::uuid;loser:=case when winner=(m#>>'{participants,0}')::uuid then(m#>>'{participants,1}')::uuid else(m#>>'{participants,0}')::uuid end;
   result_capture:=jsonb_build_object('contextId',c.id,'contextDigest',c.context_digest,'sourceDigest',c.source_digest,'slot',slot_no,'match',m,'progress',progress,'winnerId',winner,'loserId',loser,'simulationOnly',true);
   result_id:=extensions.gen_random_uuid();insert into app.native_mixed_playoff_results_v1(id,context_id,tournament_id,event_id,slot,receipt_id,match_digest,source_capture,result_digest,winner_id,loser_id)
    values(result_id,c.id,tid,eid,slot_no,rid,m->>'matchDigest',result_capture,app.native_mixed_simulation_hash_v1(result_capture),winner,loser);
   if slot_no=4 then
    select jsonb_build_array(jsonb_build_object('firstPlace',1,'lastPlace',1,'participantIds',jsonb_build_array(winner)),jsonb_build_object('firstPlace',2,'lastPlace',2,'participantIds',jsonb_build_array(loser)),
     jsonb_build_object('firstPlace',3,'lastPlace',4,'participantIds',(select jsonb_agg(loser_id order by slot)from app.native_mixed_playoff_results_v1 where context_id=c.id and slot in(2,3))),
     jsonb_build_object('firstPlace',5,'lastPlace',5,'participantIds',(select jsonb_agg(loser_id)from app.native_mixed_playoff_results_v1 where context_id=c.id and slot=1)))into cohorts;
    result_capture:=jsonb_build_object('contextId',c.id,'sourceDigest',c.source_digest,'finishingGroups',cohorts,'resultPins',(select jsonb_agg(jsonb_build_object('id',id,'slot',slot,'digest',result_digest)order by slot)from app.native_mixed_playoff_results_v1 where context_id=c.id),'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
    insert into app.native_mixed_playoff_completions_v1(context_id,tournament_id,event_id,receipt_id,source_capture,source_digest)values(c.id,tid,eid,rid,result_capture,app.native_mixed_simulation_hash_v1(result_capture));
   end if;
  end if;
 end if;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,rid,'native_mixed_playoff_simulation',idv,kind,response);
 if app.native_mixed_playoff_row_bound_v1(idv,kind)is distinct from true then raise exception 'mixed playoff receipt postcondition failed';end if;
 if result_id is not null and app.native_mixed_playoff_result_bound_v1(result_id)is distinct from true then raise exception 'mixed playoff result postcondition failed';end if;
 if slot_no=4 and result_id is not null and app.native_mixed_playoff_completion_bound_v1(c.id)is distinct from true then raise exception 'mixed playoff completion postcondition failed';end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create or replace function app.get_native_mixed_playoff_own_v1(tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;source jsonb;c app.native_mixed_playoff_contexts_v1%rowtype;
 own_person jsonb;own_id uuid;mine jsonb;other_person jsonb;other_id uuid;
 m jsonb;p jsonb;g jsonb;e jsonb;item jsonb;entries jsonb;games jsonb;next_game jsonb;matches jsonb:='[]';
 slot_no integer;own_place jsonb;own_submitted boolean;finished boolean:=false;eliminated boolean:=false;open_match boolean:=false;answer jsonb;
begin
 if app.native_mixed_playoff_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_pool_actor_v1();
 if actor is null or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 source:=app.native_mixed_playoff_source_v1(tid,eid);if source is null then return jsonb_build_object('status','blocked','code','source_unavailable');end if;
 select value into own_person from jsonb_array_elements(source#>'{capture,roster}')x
 where x->>'mode'='digital'and x->>'profileId'=actor::text;
 if own_person is null then return null;end if;own_id:=(own_person->>'participantId')::uuid;
 mine:=jsonb_build_object('participantId',own_id,'tournamentIdNumber',own_person->'fixedTournamentId');
 lock table app.native_mixed_playoff_reopens_v1,app.native_mixed_playoff_attempt_evidence_v1,app.native_mixed_playoff_own_closures_v1,app.native_mixed_playoff_contexts_v1,app.native_mixed_playoff_evidence_v1,
  app.native_mixed_playoff_results_v1,app.native_mixed_playoff_completions_v1 in share mode nowait;
 select*into c from app.native_mixed_playoff_contexts_v1 where tournament_id=tid and event_id=eid;
 if c.id is null then answer:=jsonb_build_object('status','awaiting_playoff_preparation','own',mine);
 else
  if c.source_digest is distinct from source->>'sourceDigest'or c.source_capture is distinct from source->'capture'
   or app.native_mixed_playoff_row_bound_v1(c.id,'context')is distinct from true
  then return jsonb_build_object('status','blocked','code','source_changed');end if;
  if not exists(select 1 from jsonb_array_elements(c.source_capture->'seeds')x where x->>'participantId'=own_id::text)
  then answer:=jsonb_build_object('status','not_in_simulated_playoffs','own',mine);
  else
   for slot_no in 1..4 loop
    m:=app.native_mixed_playoff_match_v1(c.id,slot_no);
    if m is null or not(m->'participants'?own_id::text)then continue;end if;
    p:=app.native_mixed_playoff_progress_v1(c.id,slot_no);if p is null then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
    select value into other_person from jsonb_array_elements(c.source_capture->'roster')x
     where m->'participants'?(x->>'participantId')and x->>'participantId'<>own_id::text;
    if other_person is null then return jsonb_build_object('status','blocked','code','opponent_unavailable');end if;
    other_id:=(other_person->>'participantId')::uuid;
    games:='[]';
    for g in select value from jsonb_array_elements(p->'games')loop
     entries:='[]';
     select exists(select 1 from app.native_mixed_playoff_active_evidence_v1(c.id,slot_no,(g->>'gameNumber')::integer)where context_id=c.id and slot=slot_no
      and game_number=(g->>'gameNumber')::integer and entry->>'type'='digital-submit'
      and entry->>'participantId'=own_id::text and actor_id=actor)into own_submitted;
     for e in select entry from app.native_mixed_playoff_active_evidence_v1(c.id,slot_no,(g->>'gameNumber')::integer)where context_id=c.id and slot=slot_no
       and game_number=(g->>'gameNumber')::integer and own_submitted order by sequence loop
      -- Explicit projection: never return actor/session/profile, authority capture,
      -- request payload, roster contact/ACC fields, or unrelated game evidence.
      item:=jsonb_build_object('id',e->'id','type',e->'type');
      if e->>'type'='digital-submit'then item:=item||jsonb_build_object('participantId',e->'participantId','winnerParticipantId',e->'winnerParticipantId');
      elsif e->>'type'='digital-confirm'then item:=item||jsonb_build_object('participantId',e->'participantId','submissionId',e->'submissionId','winnerParticipantId',e->'winnerParticipantId','evidenceIds',e->'evidenceIds');
      elsif e->>'type'='paper-capture'then item:=item||jsonb_build_object('artifactId',e->'artifactId','artifactDigest',e->'artifactDigest','claims',e->'claims');
      elsif e->>'type'='paper-review'then item:=item||jsonb_build_object('captureId',e->'captureId','artifactId',e->'artifactId','artifactDigest',case when e->>'statement'='fictional-playoff-blind-paper-review-v1'then(select x.entry->'artifactDigest'from app.native_mixed_playoff_active_evidence_v1(c.id,slot_no,(g->>'gameNumber')::integer)x where x.id=(e->>'captureId')::uuid and x.entry->>'type'='paper-capture')else e->'artifactDigest'end,'reenteredClaims',e->'reenteredClaims')||case when e?'decision'then jsonb_build_object('decision',e->'decision')else'{}'::jsonb end;
      else return jsonb_build_object('status','blocked','code','history_unavailable');end if;
      entries:=entries||jsonb_build_array(item);
     end loop;
     games:=games||jsonb_build_array(jsonb_build_object('gameNumber',g->'gameNumber','complete',case when own_submitted then g->'complete'else'false'::jsonb end,
      'winnerParticipantId',case when own_submitted then g->'winnerId'else'null'::jsonb end,
      'revision',g->'revision','historyDigest',g->'historyDigest','counterEvidenceAvailable',own_submitted,'entries',entries,'reviewRequired',coalesce(g->'reviewRequired','false'::jsonb)));
    end loop;
    if p->'complete'='true'::jsonb and p->>'winnerId'<>own_id::text then eliminated:=true;end if;
    if p->'complete'='false'::jsonb then open_match:=true;end if;
    next_game:=null;
    if p->'complete'='false'::jsonb then
     select value into g from jsonb_array_elements(p->'games')x where x->'gameNumber'=p->'nextGameNumber';
     next_game:=jsonb_build_object('gameNumber',p->'nextGameNumber','expectedRevision',coalesce(g->'revision','0'::jsonb),
      'expectedHistoryDigest',coalesce(g->'historyDigest',to_jsonb(app.native_mixed_simulation_hash_v1(jsonb_build_array(
       'native-mixed-playoff-game-history-v1',c.id,slot_no,(p->>'nextGameNumber')::integer,m->>'matchDigest','[]'::jsonb)))));
    end if;
    matches:=matches||jsonb_build_array(jsonb_build_object('slot',slot_no,'matchDigest',m->'matchDigest','format',m->'format',
     'own',mine,'opponent',jsonb_build_object('participantId',other_id,'tournamentIdNumber',other_person->'fixedTournamentId',
      'mode',other_person->'mode',
      'displayName',(select claimed_display_name from app.tournament_roster_entries where id=(other_person->>'rosterEntryId')::uuid and tournament_id=tid)),
     'complete',p->'complete','winnerParticipantId',p->'winnerId','nextGame',next_game,'games',games,
     'ownWins',case when m#>>'{participants,0}'=own_id::text then p->'winsA'else p->'winsB'end,
     'opponentWins',case when m#>>'{participants,0}'=own_id::text then p->'winsB'else p->'winsA'end));
   end loop;
   if exists(select 1 from app.native_mixed_playoff_completions_v1 where context_id=c.id)then
    if app.native_mixed_playoff_completion_bound_v1(c.id)is distinct from true then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
    finished:=true;
    select jsonb_build_object('firstPlace',x->'firstPlace','lastPlace',x->'lastPlace')into own_place
     from app.native_mixed_playoff_completions_v1 completion_row cross join lateral jsonb_array_elements(completion_row.source_capture->'finishingGroups')x
     where completion_row.context_id=c.id and x->'participantIds'?own_id::text;
    if own_place is null then return jsonb_build_object('status','blocked','code','history_unavailable');end if;
   end if;
   answer:=jsonb_build_object('status','simulated_playoff_own_available','contextId',c.id,'sourceDigest',source->'sourceDigest',
    'own',mine,'matches',matches,'complete',finished,'eliminated',eliminated,'awaitingOpponent',not finished and not eliminated and not open_match,'ownFinishingGroup',own_place);
  end if;
 end if;
 if app.native_mixed_pool_actor_v1()is distinct from actor or app.native_mixed_pilot_permitted_v1(actor,tid,eid,true)is distinct from true then return null;end if;
 return answer||jsonb_build_object('tournamentId',tid,'eventId',eid,'simulationOnly',true,'ordinaryQualificationRecorded',false,'mrpAwarded',false,'moneyMoved',false);
exception when lock_not_available then return jsonb_build_object('status','blocked','code','source_busy');end$$;
alter function app.native_mixed_playoff_paper_enabled_v1()owner to postgres;
revoke all on function app.native_mixed_playoff_paper_enabled_v1()from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_paper_blind_entry_v1(jsonb)owner to postgres;
revoke all on function app.native_mixed_playoff_paper_blind_entry_v1(jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_paper_head_token_v1(uuid,uuid,uuid,integer,integer,text,text,integer,text)owner to postgres;
revoke all on function app.native_mixed_playoff_paper_head_token_v1(uuid,uuid,uuid,integer,integer,text,text,integer,text)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_paper_request_valid_v1(jsonb,jsonb,jsonb)owner to postgres;
revoke all on function app.native_mixed_playoff_paper_request_valid_v1(jsonb,jsonb,jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_paper_subject_v1(uuid,uuid,uuid,integer,integer,text,boolean)owner to postgres;
revoke all on function app.native_mixed_playoff_paper_subject_v1(uuid,uuid,uuid,integer,integer,text,boolean)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_paper_workspace_current_v1(uuid,uuid,uuid,integer,integer,boolean)owner to postgres;
revoke all on function app.native_mixed_playoff_paper_workspace_current_v1(uuid,uuid,uuid,integer,integer,boolean)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_playoff_paper_workspace_v1(uuid,uuid,uuid,integer,integer)owner to postgres;
revoke all on function app.get_native_mixed_playoff_paper_workspace_v1(uuid,uuid,uuid,integer,integer)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_paper_request_subject_v1(uuid,uuid,jsonb,boolean)owner to postgres;
revoke all on function app.native_mixed_playoff_paper_request_subject_v1(uuid,uuid,jsonb,boolean)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_paper_origin_v1(uuid,uuid,jsonb)owner to postgres;
revoke all on function app.native_mixed_playoff_paper_origin_v1(uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_playoff_paper_operation_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.get_native_mixed_playoff_paper_operation_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.close_native_mixed_playoff_paper_operation_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.close_native_mixed_playoff_paper_operation_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function public.get_native_mixed_playoff_paper_workspace_v1(uuid,uuid,uuid,integer,integer)owner to postgres;
revoke all on function public.get_native_mixed_playoff_paper_workspace_v1(uuid,uuid,uuid,integer,integer)from public,anon,authenticated,service_role;
alter function public.get_native_mixed_playoff_paper_operation_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function public.get_native_mixed_playoff_paper_operation_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function public.close_native_mixed_playoff_paper_operation_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function public.close_native_mixed_playoff_paper_operation_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_leaf_row_bound_v2(uuid,text)owner to postgres;
revoke all on function app.native_mixed_playoff_leaf_row_bound_v2(uuid,text)from public,anon,authenticated,service_role;
alter function app.native_mixed_playoff_game_v1(jsonb,jsonb,jsonb)owner to postgres;
revoke all on function app.native_mixed_playoff_game_v1(jsonb,jsonb,jsonb)from public,anon,authenticated,service_role;
alter function app.execute_native_mixed_playoff_v1(uuid,uuid,uuid,jsonb)owner to postgres;
revoke all on function app.execute_native_mixed_playoff_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
alter function app.get_native_mixed_playoff_own_v1(uuid,uuid)owner to postgres;
revoke all on function app.get_native_mixed_playoff_own_v1(uuid,uuid)from public,anon,authenticated,service_role;
commit;
