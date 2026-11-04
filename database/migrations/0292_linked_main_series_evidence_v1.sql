-- LOCAL proposal; apply after setup-event-links-activation-v1.sql. App-owner policy,
-- not a claim of an ACC rule. Director review is not independent game verification.
-- Contract: slots 1..3 (four qualifiers), 1..4 (five qualifiers), in existing
-- V3/V4 series order. Only actual matches can be entered; byes are derived.
begin;
do $$begin if current_user<>'postgres' then raise exception 'postgres owner required';end if;end$$;
create table app.linked_main_series_v1(
 id uuid primary key default extensions.gen_random_uuid(), tournament_id uuid not null,
 event_id uuid not null, qualification_id uuid not null, slot smallint not null check(slot between 1 and 4),
 version integer not null check(version between 1 and 256), supersedes_id uuid,
 winner_id uuid not null, loser_id uuid not null check(winner_id<>loser_id),
 result_type text not null check(result_type in('played','forfeit')),
 source_note text not null check(length(source_note) between 1 and 200 and source_note=trim(source_note) and source_note!~'[[:cntrl:]]'),
 synthetic boolean not null, ancestor_ids uuid[] not null, reviewed_by uuid not null references app.profiles(id),
 operation_receipt_id uuid not null, recorded_at timestamptz not null default clock_timestamp(),
 foreign key(qualification_id,tournament_id,event_id) references app.qualification_result_versions(id,tournament_id,event_id),
 foreign key(winner_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id),
 foreign key(loser_id,event_id,tournament_id) references app.event_participants(id,event_id,tournament_id),
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id),
 unique(event_id,qualification_id,slot,version), unique(id,event_id,qualification_id,slot),
 foreign key(supersedes_id,event_id,qualification_id,slot) references app.linked_main_series_v1(id,event_id,qualification_id,slot)
);
create index linked_main_series_lookup_v1 on app.linked_main_series_v1(event_id,qualification_id,slot,version desc);
alter table app.linked_main_series_v1 enable row level security;
alter table app.linked_main_series_v1 force row level security;
revoke all on app.linked_main_series_v1 from public,anon,authenticated,service_role;
create trigger linked_main_series_immutable_v1 before update or delete on app.linked_main_series_v1 for each row execute function app.reject_immutable_history();

create table app.linked_consy_start_eligibility_v1(
 start_id uuid not null, tournament_id uuid not null, event_id uuid not null,
 roster_entry_id uuid not null, main_event_id uuid not null, qualification_id uuid not null,
 source_kind text not null check(source_kind in('nonqualifier','played_loss')),
 director_declared_synthetic boolean,
 witness_ids uuid[] not null, primary key(start_id,roster_entry_id),
 foreign key(start_id,tournament_id,event_id) references app.event_play_starts(id,tournament_id,event_id),
 foreign key(qualification_id,tournament_id,main_event_id) references app.qualification_result_versions(id,tournament_id,event_id)
);
alter table app.linked_consy_start_eligibility_v1 enable row level security;
alter table app.linked_consy_start_eligibility_v1 force row level security;
revoke all on app.linked_consy_start_eligibility_v1 from public,anon,authenticated,service_role;
create trigger linked_consy_start_eligibility_immutable_v1 before update or delete on app.linked_consy_start_eligibility_v1 for each row execute function app.reject_immutable_history();

-- Null means unsupported or stale, never an eligible decision.
create function app.linked_main_series_domain_v1(tid uuid,eid uuid,qid uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare q app.qualification_result_versions%rowtype; ids uuid[]; capability jsonb;
begin
 select * into q from app.qualification_result_versions where id=qid and tournament_id=tid and event_id=eid;
 if not found or not app.qualification_resolution_snapshot_current_v1(qid) or q.qualifier_count not in(4,5)
  or not exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=tid and main_event_id=eid) then return false;end if;
 if q.qualifier_count=5 then return app.five_qualifier_playoff_source_v4(tid,eid,qid) is not null;end if;
 if not exists(select 1 from app.tournament_setup_activations a join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id join app.events e on e.id=a.event_id where a.tournament_id=tid and a.event_id=eid and s.event_kind='main' and s.format_code='standard_singles' and s.game_count=12 and e.operational_state='active' and e.format='standard_singles') then return false;end if;
 select array_agg(participant_id order by ranking_ordinal) into ids from app.qualification_result_rows where result_version_id=qid and qualification_status='qualified';
 capability:=jsonb_build_array(jsonb_build_object('winnerId',ids[1],'loserId',ids[4],'evidenceNote','capability'),jsonb_build_object('winnerId',ids[2],'loserId',ids[3],'evidenceNote','capability'),jsonb_build_object('winnerId',ids[1],'loserId',ids[2],'evidenceNote','capability'));
 return app.derive_four_player_playoff_v3(qid,capability) is not null;
end$$;

-- Returns exact slot participants and recursively pinned ancestor version IDs.
create function app.linked_main_slot_v1(qid uuid, slot_no integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q app.qualification_result_versions%rowtype; ids uuid[]; a app.linked_main_series_v1%rowtype; b app.linked_main_series_v1%rowtype; x uuid; y uuid; ancestors uuid[]:='{}'; round_no integer;
begin
 select * into q from app.qualification_result_versions where id=qid;
 if not found or not app.linked_main_series_domain_v1(q.tournament_id,q.event_id,qid) then return null;end if;
 select array_agg(participant_id order by ranking_ordinal) into ids from app.qualification_result_rows where result_version_id=qid and qualification_status='qualified';
 if q.qualifier_count=4 then
  if slot_no=1 then x:=ids[1];y:=ids[4];round_no:=1;
  elsif slot_no=2 then x:=ids[2];y:=ids[3];round_no:=1;
  elsif slot_no=3 then
   select * into a from app.linked_main_series_v1 where event_id=q.event_id and qualification_id=qid and slot=1 order by version desc limit 1;
   select * into b from app.linked_main_series_v1 where event_id=q.event_id and qualification_id=qid and slot=2 order by version desc limit 1;
   if a.id is null or b.id is null then return null;end if;x:=a.winner_id;y:=b.winner_id;ancestors:=array[a.id,b.id];round_no:=2;
  else return null;end if;
 else
  if slot_no=1 then x:=ids[4];y:=ids[5];round_no:=1;
  elsif slot_no=2 then
   select * into a from app.linked_main_series_v1 where event_id=q.event_id and qualification_id=qid and slot=1 order by version desc limit 1;
   if a.id is null then return null;end if;x:=ids[1];y:=a.winner_id;ancestors:=array[a.id];round_no:=2;
  elsif slot_no=3 then x:=ids[3];y:=ids[2];round_no:=2;
  elsif slot_no=4 then
   select * into a from app.linked_main_series_v1 where event_id=q.event_id and qualification_id=qid and slot=2 order by version desc limit 1;
   select * into b from app.linked_main_series_v1 where event_id=q.event_id and qualification_id=qid and slot=3 order by version desc limit 1;
   if a.id is null or b.id is null then return null;end if;x:=a.winner_id;y:=b.winner_id;ancestors:=a.ancestor_ids||array[a.id]||b.ancestor_ids||array[b.id];round_no:=3;
  else return null;end if;
 end if;
 return jsonb_build_object('a',x,'b',y,'round',round_no,'ancestors',to_jsonb(ancestors));
end$$;

-- The roster ID is stable across Main and Consolation. No fallback by name.
-- status=no_route only if no explicit active link; pending permits registration.
create function app.linked_consy_eligibility_v1(tid uuid,consy uuid,roster uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare main_id uuid; q app.qualification_result_versions%rowtype; r app.qualification_result_rows%rowtype; v app.linked_main_series_v1%rowtype; cutoff timestamptz; round_no integer;
begin
 main_id:=app.linked_consolation_main_event_v1(tid,consy);
 if main_id is null then return jsonb_build_object('status','no_route');end if;
 select * into q from app.qualification_result_versions where tournament_id=tid and event_id=main_id order by version desc limit 1;
 if q.id is null or not app.qualification_resolution_snapshot_current_v1(q.id) then return jsonb_build_object('status','pending','mainEventId',main_id);end if;
 select qr.* into r from app.qualification_result_rows qr join app.event_participants p on p.id=qr.participant_id and p.event_id=main_id and p.tournament_id=tid where qr.result_version_id=q.id and p.roster_entry_id=roster;
 if r.participant_id is null then return jsonb_build_object('status','pending','mainEventId',main_id,'qualificationId',q.id);end if;
 if r.qualification_status<>'qualified' then return jsonb_build_object('status','eligible','source','nonqualifier','mainEventId',main_id,'qualificationId',q.id,'witnessIds','[]'::jsonb);end if;
 if not app.linked_main_series_domain_v1(tid,main_id,q.id) then return jsonb_build_object('status','pending','mainEventId',main_id,'qualificationId',q.id);end if;
 select started_at into cutoff from app.event_play_starts where event_id=consy and tournament_id=tid;
 select s.* into v from app.linked_main_series_v1 s where s.event_id=main_id and s.qualification_id=q.id and s.loser_id=r.participant_id and s.result_type='played' and (cutoff is null or s.recorded_at<cutoff)
  and not exists(select 1 from app.linked_main_series_v1 n where n.event_id=s.event_id and n.qualification_id=s.qualification_id and n.slot=s.slot and n.version>s.version)
  and (case when q.qualifier_count=4 then s.slot in(1,2,3) else s.slot in(1,2,3) end) order by s.slot limit 1;
 if v.id is null then return jsonb_build_object('status','pending','mainEventId',main_id,'qualificationId',q.id);end if;
 return jsonb_build_object('status','eligible','source','played_loss','directorDeclaredSynthetic',coalesce((select bool_or(synthetic) from app.linked_main_series_v1 where id=any(v.ancestor_ids||array[v.id])),false),'provenance',case when coalesce((select bool_or(synthetic) from app.linked_main_series_v1 where id=any(v.ancestor_ids||array[v.id])),false) then 'director_declared_synthetic' else 'director_reviewed_unverified' end,'mainEventId',main_id,'qualificationId',q.id,'witnessIds',to_jsonb(v.ancestor_ids||array[v.id]));
end$$;

-- Whole-bracket V3/V4 has no forfeit type and counts every pair as played.
-- Compare both directions; typed forfeits block projection until reviewed support exists.
create function app.linked_main_final_guard_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare s app.linked_main_series_v1%rowtype; item jsonb;
begin
 if not exists(select 1 from app.consolation_main_event_bindings_v1 where main_event_id=new.event_id and tournament_id=new.tournament_id) then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:'||new.event_id::text,0));
 for s in select x.* from app.linked_main_series_v1 x where x.event_id=new.event_id and x.qualification_id=new.qualification_result_version_id and not exists(select 1 from app.linked_main_series_v1 n where n.event_id=x.event_id and n.qualification_id=x.qualification_id and n.slot=x.slot and n.version>x.version) loop
  item:=new.series->(s.slot-1);
  if s.qualification_id<>new.qualification_result_version_id or s.result_type<>'played' or item->>'winnerId' is distinct from s.winner_id::text or item->>'loserId' is distinct from s.loser_id::text then raise exception 'linked_series_correction_conflict';end if;
 end loop;
 return new;
end$$;
create trigger linked_main_final_guard_v3 before insert on app.playoff_outcome_versions_v3 for each row execute function app.linked_main_final_guard_v1();
create trigger linked_main_final_guard_v4 before insert on app.playoff_outcome_versions_v4 for each row execute function app.linked_main_final_guard_v1();

-- The legacy placement writer has no series witness. Existing rows and exact
-- receipt replay remain historical; new placements on an explicitly linked
-- Main would create an independent contradictory authority and are refused.
create function app.linked_main_legacy_placement_guard_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=new.tournament_id and main_event_id=new.event_id) then raise exception 'linked_series_correction_conflict';end if;
 return new;
end$$;
create trigger linked_main_legacy_placement_guard_v1 before insert on app.standard_singles_playoff_result_versions for each row execute function app.linked_main_legacy_placement_guard_v1();
revoke all on function app.linked_main_legacy_placement_guard_v1() from public,anon,authenticated,service_role;
-- Exact operation receipts bind actor, operation, request and target. No client
-- supplied opponents or loss proof: only winner is supplied and loser is derived.
create function public.record_linked_main_series_v1(actor uuid,tid uuid,eid uuid,request jsonb,operation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h text; old app.operation_receipts%rowtype; prior app.linked_main_series_v1%rowtype; slot_data jsonb; qid uuid; slot_no integer; winner uuid; loser uuid; typ text; ancestors uuid[]; response jsonb; receipt uuid:=extensions.gen_random_uuid(); sid uuid:=extensions.gen_random_uuid(); stamp timestamptz; whole record; item jsonb; code text; tournament_status text;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' then return null;end if;
 if actor is null or tid is null or eid is null or operation is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||operation::text,0));
 perform pg_advisory_xact_lock(hashtextextended('qualification-finalization:'||eid::text,0));
 perform pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:'||eid::text,0));
 select status into tournament_status from app.tournaments where id=tid for update;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 perform 1 from app.events where id=eid and tournament_id=tid for update;if not found then return jsonb_build_object('status','rejected','code','event_unavailable');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('linked_main_series_v1',actor,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 select * into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=operation;
 if found then if old.tournament_id=tid and old.target_id=eid and old.operation_type='linked_main_series_v1' and old.request_hash=h then return old.response_payload;else return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;end if;
 begin
  if tournament_status<>'open' then raise exception 'tournament_unavailable';end if;
  if jsonb_typeof(request) is distinct from 'object' then raise exception 'invalid_request';end if;
  if (select count(*) from jsonb_object_keys(request))<>8 or not(request ?& array['qualificationId','slot','expectedVersion','winnerId','resultType','sourceNote','synthetic','reviewed'])
   or jsonb_typeof(request->'slot') is distinct from 'number' or (request->>'slot')!~'^[1-4]$' or jsonb_typeof(request->'expectedVersion') is distinct from 'number' or (request->>'expectedVersion')!~'^(0|[1-9][0-9]{0,2})$'
   or jsonb_typeof(request->'qualificationId') is distinct from 'string' or jsonb_typeof(request->'winnerId') is distinct from 'string' or jsonb_typeof(request->'resultType') is distinct from 'string' or request->>'resultType' not in('played','forfeit')
   or jsonb_typeof(request->'sourceNote') is distinct from 'string' or length(request->>'sourceNote') not between 1 and 200 or request->>'sourceNote'<>trim(request->>'sourceNote') or request->>'sourceNote'~'[[:cntrl:]]' or jsonb_typeof(request->'synthetic') is distinct from 'boolean' or request->'reviewed' is distinct from 'true'::jsonb then raise exception 'invalid_request';end if;
  qid:=(request->>'qualificationId')::uuid;slot_no:=(request->>'slot')::integer;winner:=(request->>'winnerId')::uuid;typ:=request->>'resultType';
  if not app.linked_main_series_domain_v1(tid,eid,qid) then raise exception 'qualification_unavailable';end if;
  if exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=tid and event_id=eid) and (request->>'synthetic')::boolean is not true then raise exception 'synthetic_declaration_required';end if;
  slot_data:=app.linked_main_slot_v1(qid,slot_no);if slot_data is null then raise exception 'slot_unavailable';end if;
  if winner=(slot_data->>'a')::uuid then loser:=(slot_data->>'b')::uuid;elsif winner=(slot_data->>'b')::uuid then loser:=(slot_data->>'a')::uuid;else raise exception 'invalid_winner';end if;
  select coalesce(array_agg(value::uuid),'{}'::uuid[]) into ancestors from jsonb_array_elements_text(slot_data->'ancestors');
  select * into prior from app.linked_main_series_v1 where event_id=eid and qualification_id=qid and slot=slot_no order by version desc limit 1;
  if coalesce(prior.version,0)<>(request->>'expectedVersion')::integer or coalesce(prior.version,0)>=256 then raise exception 'stale_version';end if;
  if prior.id is not null and (exists(select 1 from app.linked_main_series_v1 d where d.event_id=eid and d.qualification_id=qid and prior.id=any(d.ancestor_ids)) or exists(select 1 from app.linked_consy_start_eligibility_v1 s where s.main_event_id=eid and prior.id=any(s.witness_ids))) then raise exception 'dependent_evidence_conflict';end if;
  for whole in select qualification_result_version_id,series from app.playoff_outcome_versions_v3 where event_id=eid and version=(select max(version) from app.playoff_outcome_versions_v3 where event_id=eid) union all select qualification_result_version_id,series from app.playoff_outcome_versions_v4 where event_id=eid and version=(select max(version) from app.playoff_outcome_versions_v4 where event_id=eid) loop
   item:=whole.series->(slot_no-1);
   if typ<>'played' or whole.qualification_result_version_id<>qid or item->>'winnerId' is distinct from winner::text or item->>'loserId' is distinct from loser::text then raise exception 'linked_series_correction_conflict';end if;
  end loop;
  stamp:=clock_timestamp();response:=jsonb_build_object('status','recorded','actorId',actor,'tournamentId',tid,'eventId',eid,'qualificationId',qid,'slot',slot_no,'operationId',operation,'resultType',typ,'synthetic',(request->>'synthetic')::boolean,'provenance',case when (request->>'synthetic')::boolean or coalesce((select bool_or(synthetic) from app.linked_main_series_v1 where id=any(ancestors)),false) then 'director_declared_synthetic' else 'director_reviewed_unverified' end,'seriesId',sid,'version',coalesce(prior.version,0)+1,'winnerId',winner,'loserId',loser,'round',slot_data->'round','witnessIds',to_jsonb(ancestors||array[sid]),'recordedAt',stamp);
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm in('invalid_request','tournament_unavailable','qualification_unavailable','slot_unavailable','invalid_winner','stale_version','dependent_evidence_conflict','linked_series_correction_conflict','synthetic_declaration_required') then sqlerrm else 'invalid_request' end;
  stamp:=clock_timestamp();response:=jsonb_build_object('status','rejected','eventId',eid,'operationId',operation,'code',code);
 end;
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(receipt,tid,actor,'linked_main_series_v1',eid,h,operation,case when code is null then 'accepted' else 'rejected' end,response,stamp);
 if code is null then
  insert into app.linked_main_series_v1(id,tournament_id,event_id,qualification_id,slot,version,supersedes_id,winner_id,loser_id,result_type,source_note,synthetic,ancestor_ids,reviewed_by,operation_receipt_id,recorded_at)
  values(sid,tid,eid,qid,slot_no,coalesce(prior.version,0)+1,prior.id,winner,loser,typ,request->>'sourceNote',(request->>'synthetic')::boolean,ancestors,actor,receipt,stamp);
 end if;
 return response;
end$$;

-- AFTER insertion means the actual recorded start timestamp is the cutoff;
-- exception rolls back the start and all snapshots atomically. The lock is the
-- same one used for qualification and series writes. Snapshot pins ancestors.
create function app.linked_consy_start_guard_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare main_id uuid; p record; decision jsonb;
begin
 if not exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=new.tournament_id and consolation_event_id=new.event_id) then return new;end if;
 main_id:=app.linked_consolation_main_event_v1(new.tournament_id,new.event_id);
 if main_id is null then raise exception 'linked_consy_eligibility_pending';end if;
 perform pg_advisory_xact_lock(hashtextextended('qualification-finalization:'||main_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:'||main_id::text,0));
 for p in select roster_entry_id from app.event_participants where tournament_id=new.tournament_id and event_id=new.event_id loop
  decision:=app.linked_consy_eligibility_v1(new.tournament_id,new.event_id,p.roster_entry_id);
  if decision->>'status'<>'eligible' then raise exception 'linked_consy_eligibility_pending';end if;
  insert into app.linked_consy_start_eligibility_v1(start_id,tournament_id,event_id,roster_entry_id,main_event_id,qualification_id,source_kind,director_declared_synthetic,witness_ids)
  values(new.id,new.tournament_id,new.event_id,p.roster_entry_id,main_id,(decision->>'qualificationId')::uuid,decision->>'source',(decision->>'directorDeclaredSynthetic')::boolean,array(select value::uuid from jsonb_array_elements_text(decision->'witnessIds')));
 end loop;
 return new;
end$$;
create trigger linked_consy_start_guard_v1 after insert on app.event_play_starts for each row execute function app.linked_consy_start_guard_v1();
revoke all on function app.linked_main_series_domain_v1(uuid,uuid,uuid),app.linked_main_slot_v1(uuid,integer),app.linked_consy_eligibility_v1(uuid,uuid,uuid),app.linked_main_final_guard_v1(),app.linked_consy_start_guard_v1() from public,anon,authenticated,service_role;
revoke all on function public.record_linked_main_series_v1(uuid,uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.record_linked_main_series_v1(uuid,uuid,uuid,jsonb,uuid) to service_role;
-- No linked-team identity/eligibility adapter exists. Reject new team Starts;
-- unlinked team histories and receipt replay are unaffected.
create function app.linked_consy_team_start_guard_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=new.tournament_id and consolation_event_id=new.event_id) then raise exception 'linked_consy_team_eligibility_unsupported';end if;
 return new;
end$$;
create trigger a0_linked_consy_team_start_guard_v1 before insert on app.event_team_starts for each row execute function app.linked_consy_team_start_guard_v1();
revoke all on function app.linked_consy_team_start_guard_v1() from public,anon,authenticated,service_role;
-- Acquire the actor operation, Main qualification, and post-event locks before
-- the existing Start path takes the tournament row. The direct insert trigger
-- remains a backstop; old internal Start delegates are not service executable.
alter function public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) rename to start_event_play_v1_before_linked_evidence;
revoke all on function public.start_event_play_v1_before_linked_evidence(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) from public,anon,authenticated,service_role;
create function public.start_event_play_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_schedule_publication_id uuid,p_participant_snapshot_digest text,p_expected_participant_count integer,p_expected_game_count integer,p_confirmed boolean,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare main_id uuid; entrant record;
begin
 if p_actor_id is not null and p_idempotency_key is not null then perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));end if;
 select main_event_id into main_id from app.consolation_main_event_bindings_v1 where tournament_id=p_tournament_id and consolation_event_id=p_event_id;
 if main_id is not null then
  perform pg_advisory_xact_lock(hashtextextended('qualification-finalization:'||main_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('standard-singles-post-event:'||main_id::text,0));
 end if;
 if main_id is not null and p_actor_id is not null and p_idempotency_key is not null and p_schedule_publication_id is not null and p_confirmed is true and p_participant_snapshot_digest ~ '^[0-9a-f]{64}$' and p_expected_participant_count between 2 and 10000 and p_expected_game_count between 1 and 99 and exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) and not exists(select 1 from app.event_play_starts where tournament_id=p_tournament_id and event_id=p_event_id) and not exists(select 1 from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key) then
  if app.linked_consolation_main_event_v1(p_tournament_id,p_event_id) is null then return jsonb_build_object('status','rejected','code','linked_consy_eligibility_pending');end if;
  for entrant in select roster_entry_id from app.event_participants where tournament_id=p_tournament_id and event_id=p_event_id loop
   if app.linked_consy_eligibility_v1(p_tournament_id,p_event_id,entrant.roster_entry_id)->>'status' is distinct from 'eligible' then return jsonb_build_object('status','rejected','code','linked_consy_eligibility_pending');end if;
  end loop;
 end if;
 return public.start_event_play_v1_before_linked_evidence(p_actor_id,p_tournament_id,p_event_id,p_schedule_publication_id,p_participant_snapshot_digest,p_expected_participant_count,p_expected_game_count,p_confirmed,p_idempotency_key);
end$$;
revoke all on function public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) to service_role;
-- A separate tagged source, never a reinterpretation of V1. It pins the exact
-- Main qualification and admitted Start witnesses; later Main matches are not
-- part of this digest. No accounting or playoff writer dispatch is installed
-- here: consumers must explicitly opt into the V2 source domain.
create function app.linked_consolation_four_qualifier_source_v2(t uuid,e uuid,qid uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare q app.qualification_result_versions%rowtype; main_id uuid; main_q uuid; v_start_id uuid; games integer; threshold integer;
begin
 main_id:=app.linked_consolation_main_event_v1(t,e);
 if main_id is null then return null;end if;
 select * into q from app.qualification_result_versions where id=qid and tournament_id=t and event_id=e;
 if not found or q.qualifier_count<>4 or q.participant_count not between 13 and 16 or not app.qualification_resolution_snapshot_current_v1(qid) then return null;end if;
 select s.game_count into games from app.tournament_setup_activations a join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id join app.events ev on ev.id=a.event_id and ev.tournament_id=a.tournament_id where a.tournament_id=t and a.event_id=e and s.event_kind='consolation' and s.format_code='standard_singles' and s.style_code='Standard' and ev.event_type='consolation' and ev.operational_state='active' and ev.format='standard_singles';
 threshold:=case games when 7 then 9 when 8 then 11 when 9 then 12 when 10 then 13 end;
 if threshold is null then return null;end if;
 select id into v_start_id from app.event_play_starts where tournament_id=t and event_id=e;
 select id into main_q from app.qualification_result_versions where tournament_id=t and event_id=main_id order by version desc limit 1;
 if v_start_id is null or main_q is null or not app.qualification_resolution_snapshot_current_v1(main_q) then return null;end if;
 if (select count(*) from app.qualification_result_rows where result_version_id=qid and qualification_status='qualified')<>4 or exists(select 1 from app.qualification_result_rows r where r.result_version_id=qid and r.qualification_status='qualified' and(r.tied or r.verified_games<>games or r.ranking_ordinal not between 1 and 4 or(r.ranking_ordinal<=2 and r.game_points<threshold))) then return null;end if;
 if exists(select 1 from app.event_participants cp where cp.tournament_id=t and cp.event_id=e and (cp.roster_entry_id is null or not exists(select 1 from app.linked_consy_start_eligibility_v1 s where s.start_id=v_start_id and s.tournament_id=t and s.event_id=e and s.roster_entry_id=cp.roster_entry_id and s.main_event_id=main_id and s.qualification_id=main_q))) or (select count(*) from app.linked_consy_start_eligibility_v1 where start_id=v_start_id)<>(select count(*) from app.event_participants where tournament_id=t and event_id=e) then return null;end if;
 return encode(extensions.digest(convert_to(jsonb_build_object('kind','linked-consolation-four-qualifier-v2','consolationQualification',to_jsonb(q),'mainQualificationId',main_q,'mainEventId',main_id,'startId',v_start_id,'mainSource',app.qualification_tie_source_v1(t,main_id),'consolationSource',app.qualification_tie_source_v1(t,e),'consolationRows',(select jsonb_agg(to_jsonb(r) order by ranking_ordinal) from app.qualification_result_rows r where result_version_id=qid),'admissions',(select jsonb_agg(to_jsonb(s) order by s.roster_entry_id) from app.linked_consy_start_eligibility_v1 s where s.start_id=v_start_id))::text,'utf8'),'sha256'),'hex');
end$$;
revoke all on function app.linked_consolation_four_qualifier_source_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;
-- Fail closed until a version-tagged linked V2 playoff writer/settlement
-- dispatcher is installed. Existing V1 records and receipt replays remain.
create function app.linked_consy_v1_outcome_guard_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=new.tournament_id and consolation_event_id=new.event_id) and (app.linked_consolation_four_qualifier_source_v2(new.tournament_id,new.event_id,new.qualification_result_version_id) is null or new.source_digest is distinct from app.linked_consolation_four_qualifier_source_v2(new.tournament_id,new.event_id,new.qualification_result_version_id)) then raise exception 'linked_consy_v2_source_required';end if;
 return new;
end$$;
create trigger a0_linked_consy_v1_outcome_guard_v1 before insert on app.consolation_playoff_outcome_versions_v1 for each row execute function app.linked_consy_v1_outcome_guard_v1();
revoke all on function app.linked_consy_v1_outcome_guard_v1() from public,anon,authenticated,service_role;
-- Explicit sidecar tags distinguish newly linked V2 outcomes from all V1
-- history. The underlying immutable outcome row and legacy hash stay intact.
create table app.linked_consy_playoff_source_tags_v2(
 result_id uuid primary key,tournament_id uuid not null,event_id uuid not null,
 source_kind text not null check(source_kind='linked-consolation-four-qualifier-v2'),
 foreign key(result_id,tournament_id,event_id) references app.consolation_playoff_outcome_versions_v1(id,tournament_id,event_id)
);
alter table app.linked_consy_playoff_source_tags_v2 enable row level security;
alter table app.linked_consy_playoff_source_tags_v2 force row level security;
revoke all on app.linked_consy_playoff_source_tags_v2 from public,anon,authenticated,service_role;
create trigger linked_consy_playoff_tags_immutable_v2 before update or delete on app.linked_consy_playoff_source_tags_v2 for each row execute function app.reject_immutable_history();
create function app.tag_linked_consy_playoff_v2()returns trigger language plpgsql security definer set search_path=''as $$
begin
 if exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=new.tournament_id and consolation_event_id=new.event_id) then
  insert into app.linked_consy_playoff_source_tags_v2 values(new.id,new.tournament_id,new.event_id,'linked-consolation-four-qualifier-v2');
 end if;return new;
end$$;
revoke all on function app.tag_linked_consy_playoff_v2()from public,anon,authenticated,service_role;
create trigger linked_consy_playoff_tag_v2 after insert on app.consolation_playoff_outcome_versions_v1 for each row execute function app.tag_linked_consy_playoff_v2();

-- Clone reviewed derivation and ordinary writer, changing only the source
-- selector and function names. Existing operation hashes deliberately remain
-- identical so an old exact receipt replay is preserved across dispatch.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('app.derive_consolation_four_qualifier_v1(uuid,jsonb)'::regprocedure);
 p:=replace(replace(d,'FUNCTION app.derive_consolation_four_qualifier_v1(','FUNCTION app.derive_linked_consolation_four_qualifier_v2('),'app.consolation_four_qualifier_source_v1(','app.linked_consolation_four_qualifier_source_v2(');
 if p=d or position('app.linked_consolation_four_qualifier_source_v2(' in p)=0 then raise exception 'linked derivation clone anchor changed';end if;execute p;
 d:=pg_get_functiondef('public.record_consolation_playoff_outcomes_v1(uuid,uuid,uuid,jsonb,uuid)'::regprocedure);
 p:=replace(replace(replace(d,'FUNCTION public.record_consolation_playoff_outcomes_v1(','FUNCTION app.record_linked_consolation_playoff_v2('),'app.consolation_four_qualifier_source_v1(','app.linked_consolation_four_qualifier_source_v2('),'app.derive_consolation_four_qualifier_v1(','app.derive_linked_consolation_four_qualifier_v2(');
 if p=d or position('app.linked_consolation_four_qualifier_source_v2(' in p)=0 then raise exception 'linked writer clone anchor changed';end if;execute p;
 d:=pg_get_functiondef('app.prepare_synthetic_consolation_playoff_v1(uuid,uuid,uuid,uuid,integer,jsonb)'::regprocedure);
 p:=replace(replace(replace(d,'FUNCTION app.prepare_synthetic_consolation_playoff_v1(','FUNCTION app.prepare_synthetic_linked_consolation_playoff_v2('),'app.consolation_four_qualifier_source_v1(','app.linked_consolation_four_qualifier_source_v2('),'app.derive_consolation_four_qualifier_v1(','app.derive_linked_consolation_four_qualifier_v2(');
 if p=d or position('app.linked_consolation_four_qualifier_source_v2(' in p)=0 then raise exception 'linked synthetic clone anchor changed';end if;execute p;
 -- Evidence trigger is insert-only. Select the matching source for new rows;
 -- unlinked V1 rows and artifacts use precisely their original function.
 d:=pg_get_functiondef('app.guard_consolation_playoff_evidence_v1()'::regprocedure);
 p:=replace(d,'app.consolation_four_qualifier_source_v1(new.tournament_id,new.event_id,new.qualification_result_version_id)', '(case when exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=new.tournament_id and consolation_event_id=new.event_id) then app.linked_consolation_four_qualifier_source_v2(new.tournament_id,new.event_id,new.qualification_result_version_id) else app.consolation_four_qualifier_source_v1(new.tournament_id,new.event_id,new.qualification_result_version_id) end)');
 if p=d then raise exception 'linked evidence trigger anchor changed';end if;execute p;
end$$;
revoke all on function app.derive_linked_consolation_four_qualifier_v2(uuid,jsonb),app.record_linked_consolation_playoff_v2(uuid,uuid,uuid,jsonb,uuid),app.prepare_synthetic_linked_consolation_playoff_v2(uuid,uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
alter function public.record_consolation_playoff_outcomes_v1(uuid,uuid,uuid,jsonb,uuid) rename to record_consolation_playoff_outcomes_v1_before_linked_v2;
revoke all on function public.record_consolation_playoff_outcomes_v1_before_linked_v2(uuid,uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
create function public.record_consolation_playoff_outcomes_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=tid and consolation_event_id=eid) then return app.record_linked_consolation_playoff_v2(actor,tid,eid,req,op);end if;
 return public.record_consolation_playoff_outcomes_v1_before_linked_v2(actor,tid,eid,req,op);
end$$;
revoke all on function public.record_consolation_playoff_outcomes_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.record_consolation_playoff_outcomes_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;
-- Current result interpretation is keyed by the immutable per-result tag;
-- historical untagged results continue to use the exact V1 source/derivation.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('public.get_consolation_playoff_workspace_v1(uuid,uuid,uuid)'::regprocedure);
 p:=replace(replace(replace(d,'FUNCTION public.get_consolation_playoff_workspace_v1(','FUNCTION app.get_linked_consolation_playoff_workspace_v2('),'app.consolation_four_qualifier_source_v1(','app.linked_consolation_four_qualifier_source_v2('),'app.derive_consolation_four_qualifier_v1(','app.derive_linked_consolation_four_qualifier_v2(');
 if p=d then raise exception 'linked workspace clone anchor changed';end if;
 d:=p;
 p:=replace(d,'v.source_digest=source and v.outcomes=app.derive_linked_consolation_four_qualifier_v2(v.qualification_result_version_id,v.series)', '(case when exists(select 1 from app.linked_consy_playoff_source_tags_v2 tag where tag.result_id=v.id) then v.source_digest=source and v.outcomes=app.derive_linked_consolation_four_qualifier_v2(v.qualification_result_version_id,v.series) else v.source_digest=app.consolation_four_qualifier_source_v1(tid,eid,v.qualification_result_version_id) and v.outcomes=app.derive_consolation_four_qualifier_v1(v.qualification_result_version_id,v.series) end)');
 if p=d then raise exception 'linked workspace current anchor changed';end if;execute p;
end$$;
revoke all on function app.get_linked_consolation_playoff_workspace_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;
alter function public.get_consolation_playoff_workspace_v1(uuid,uuid,uuid) rename to get_consolation_playoff_workspace_v1_before_linked_v2;
revoke all on function public.get_consolation_playoff_workspace_v1_before_linked_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function public.get_consolation_playoff_workspace_v1(actor uuid,tid uuid,eid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=tid and consolation_event_id=eid) then return app.get_linked_consolation_playoff_workspace_v2(actor,tid,eid);end if;
 return public.get_consolation_playoff_workspace_v1_before_linked_v2(actor,tid,eid);
end$$;
revoke all on function public.get_consolation_playoff_workspace_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_consolation_playoff_workspace_v1(uuid,uuid,uuid) to service_role;

-- Award preview dispatches per immutable tag; the existing classified-source
-- and exactly-two-event financial guards remain the outer gate.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('public.get_multi_event_award_preview_v1(uuid,uuid,uuid)'::regprocedure);
 p:=replace(d,'cv.source_digest is distinct from app.consolation_four_qualifier_source_v1(tid,eid,q.id) or cv.outcomes is distinct from app.derive_consolation_four_qualifier_v1(q.id,cv.series)', '(case when exists(select 1 from app.linked_consy_playoff_source_tags_v2 tag where tag.result_id=cv.id) then cv.source_digest is distinct from app.linked_consolation_four_qualifier_source_v2(tid,eid,q.id) or cv.outcomes is distinct from app.derive_linked_consolation_four_qualifier_v2(q.id,cv.series) else cv.source_digest is distinct from app.consolation_four_qualifier_source_v1(tid,eid,q.id) or cv.outcomes is distinct from app.derive_consolation_four_qualifier_v1(q.id,cv.series) end)');
 if p=d then raise exception 'linked award source anchor changed';end if;d:=p;
 p:=replace(d,'''kind'',''consolation_playoff_outcome_v1'',''resultId'',cv.id', '''kind'',case when exists(select 1 from app.linked_consy_playoff_source_tags_v2 tag where tag.result_id=cv.id) then ''linked_consolation_playoff_outcome_v2'' else ''consolation_playoff_outcome_v1'' end,''resultId'',cv.id');
 if p=d then raise exception 'linked award kind anchor changed';end if;execute p;
end$$;
-- Structured, receipted preflight for ordinary whole-bracket and legacy
-- placement RPCs. Exact receipt replay occurs before these checks.
create function app.linked_main_whole_agrees_v1(tid uuid,eid uuid,qid uuid,series jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=tid and main_event_id=eid) or not exists(
  select 1 from app.linked_main_series_v1 s where s.tournament_id=tid and s.event_id=eid and s.qualification_id=qid and not exists(select 1 from app.linked_main_series_v1 n where n.event_id=s.event_id and n.qualification_id=s.qualification_id and n.slot=s.slot and n.version>s.version)
   and (s.result_type<>'played' or (series->(s.slot-1)->>'winnerId') is distinct from s.winner_id::text or (series->(s.slot-1)->>'loserId') is distinct from s.loser_id::text))
$$;
revoke all on function app.linked_main_whole_agrees_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
do $$declare d text;p text;sig text;begin
 d:=pg_get_functiondef('public.record_standard_singles_playoff_outcomes_v3(uuid,uuid,uuid,uuid,integer,jsonb,uuid)'::regprocedure);
 p:=replace(d,'if code is not null then response:=jsonb_build_object(''status'',''rejected''', 'if code is null and not app.linked_main_whole_agrees_v1(p_tournament_id,p_event_id,p_qualification_result_version_id,p_series) then code:=''linked_series_correction_conflict'';end if; if code is not null then response:=jsonb_build_object(''status'',''rejected''');
 if p=d then raise exception 'V3 linked preflight anchor changed';end if;execute p;
 d:=pg_get_functiondef('public.record_standard_singles_playoff_outcomes_v4(uuid,uuid,uuid,jsonb,uuid)'::regprocedure);
 p:=replace(d,'stamp:=clock_timestamp();response:=jsonb_build_object(''status'',''playoff_outcomes_recorded_v4''', 'if not app.linked_main_whole_agrees_v1(p_tournament_id,p_event_id,(p_request->>''qualificationResultVersionId'')::uuid,p_request->''series'') then raise exception ''linked_series_correction_conflict'';end if; stamp:=clock_timestamp();response:=jsonb_build_object(''status'',''playoff_outcomes_recorded_v4''');
 if p=d then raise exception 'V4 linked preflight anchor changed';end if;d:=p;
 p:=replace(d,'''already_recorded'',''invalid_series'')then sqlerrm', '''already_recorded'',''invalid_series'',''linked_series_correction_conflict'')then sqlerrm');
 if p=d then raise exception 'V4 linked rejection mapping anchor changed';end if;execute p;
 foreach sig in array array['public.record_standard_singles_playoff_placements_v1(uuid,uuid,uuid,uuid,integer,jsonb,uuid)','public.record_standard_singles_playoff_placements_v2(uuid,uuid,uuid,uuid,integer,jsonb,uuid)'] loop
  d:=pg_get_functiondef(sig::regprocedure);
  p:=replace(d,'select * into v_qualification from app.qualification_result_versions', 'if exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=p_tournament_id and main_event_id=p_event_id) then raise exception ''linked_series_correction_conflict'';end if; select * into v_qualification from app.qualification_result_versions');
  if p=d then raise exception 'legacy linked preflight anchor changed %',sig;end if;d:=p;
  p:=replace(d,'''invalid playoff placement request'') then', '''invalid playoff placement request'',''linked_series_correction_conflict'') then');
  if p=d then raise exception 'legacy linked catch anchor changed %',sig;end if;d:=p;
  p:=replace(d,'when ''tournament unavailable'' then ''tournament_unavailable''', 'when ''linked_series_correction_conflict'' then ''linked_series_correction_conflict'' when ''tournament unavailable'' then ''tournament_unavailable''');
  if p=d then raise exception 'legacy linked mapping anchor changed %',sig;end if;execute p;
 end loop;
end$$;
-- Unsupported linked team Starts return an exact, receipted rejection after the
-- existing operation replay branch; the row trigger remains a backstop.
do $$declare d text;p text;begin
 d:=pg_get_functiondef('public.start_event_team_play_v1(uuid,uuid,uuid,uuid,uuid,uuid)'::regprocedure);
 p:=replace(d,'if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in(''director'',''co_director''))', 'if p_start_id is not null and p_operation_id is not null and exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in(''director'',''co_director'')) and exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=p_tournament_id and consolation_event_id=p_event_id) then response:=jsonb_build_object(''status'',''rejected'',''code'',''linked_consy_team_eligibility_unsupported'');insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,''start_event_team_play_v1'',p_start_id,h,p_operation_id,''rejected'',response,clock_timestamp());return response;end if; if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in(''director'',''co_director''))');
 if p=d then raise exception 'linked team RPC anchor changed';end if;execute p;
end$$;
-- Linked check-in may open while qualification/eligibility is pending; the
-- immutable Start gate remains decisive. Preserve the legacy unlinked branch.
do $$declare d text; p text; begin
 d:=pg_get_functiondef('public.open_event_check_in_window_v1_before_start_guard(uuid,uuid,uuid,uuid)'::regprocedure);
 p:=replace(d,$anchor$if exists(select 1 from app.events e where e.id=p_event_id and e.event_type='consolation') and not exists(select 1 from app.qualification_result_versions q join app.events main on main.id=q.event_id where q.tournament_id=p_tournament_id and main.event_type='main') then$anchor$, $replacement$if exists(select 1 from app.events e where e.id=p_event_id and e.event_type='consolation') and not exists(select 1 from app.consolation_main_event_bindings_v1 b where b.tournament_id=p_tournament_id and b.consolation_event_id=p_event_id) and not exists(select 1 from app.qualification_result_versions q join app.events main on main.id=q.event_id where q.tournament_id=p_tournament_id and main.event_type='main') then$replacement$);
 if p=d then raise exception 'linked check-in reviewed anchor changed';end if;
 execute p;
end$$;
-- Actor-scoped workspace; absent/unsupported/stale qualification remains pending.
create function public.get_linked_main_series_workspace_v1(actor uuid,tid uuid,eid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q app.qualification_result_versions%rowtype; n integer; d jsonb; slots jsonb:='[]'; s app.linked_main_series_v1%rowtype;
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role' then return null;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director')) or not exists(select 1 from app.events where id=eid and tournament_id=tid) then return null;end if;
 if not exists(select 1 from app.consolation_main_event_bindings_v1 where tournament_id=tid and main_event_id=eid) then return jsonb_build_object('status','not_linked','eventId',eid);end if;
 select * into q from app.qualification_result_versions where tournament_id=tid and event_id=eid order by version desc limit 1;
 if q.id is null or not app.linked_main_series_domain_v1(tid,eid,q.id) then return jsonb_build_object('status','pending','eventId',eid);end if;
 for n in 1..case when q.qualifier_count=4 then 3 else 4 end loop
  d:=app.linked_main_slot_v1(q.id,n);
  select * into s from app.linked_main_series_v1 where event_id=eid and qualification_id=q.id and slot=n order by version desc limit 1;
  slots:=slots||jsonb_build_array(jsonb_build_object('slot',n,'round',d->'round','a',d->'a','b',d->'b','expectedVersion',coalesce(s.version,0),'current',case when s.id is null then null else jsonb_build_object('seriesId',s.id,'winnerId',s.winner_id,'loserId',s.loser_id,'resultType',s.result_type,'sourceNote',s.source_note,'synthetic',s.synthetic,'provenance',case when s.synthetic or coalesce((select bool_or(synthetic) from app.linked_main_series_v1 where id=any(s.ancestor_ids)),false) then 'director_declared_synthetic' else 'director_reviewed_unverified' end,'witnessIds',to_jsonb(s.ancestor_ids||array[s.id])) end));
 end loop;
 return jsonb_build_object('status','ready','eventId',eid,'qualificationId',q.id,'qualifiers',(select jsonb_agg(jsonb_build_object('participantId',r.participant_id,'rosterEntryId',p.roster_entry_id,'displayName',r.display_name_snapshot,'rank',r.ranking_ordinal) order by r.ranking_ordinal) from app.qualification_result_rows r join app.event_participants p on p.id=r.participant_id and p.event_id=eid and p.tournament_id=tid where r.result_version_id=q.id and r.qualification_status='qualified'),'slots',slots);
end$$;
revoke all on function public.get_linked_main_series_workspace_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_linked_main_series_workspace_v1(uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;































