-- PRIVATE, DEFAULT-CLOSED proposal. Ordinary confirmed DIGITAL Main5 only.
-- Not native_mixed_* evidence, physical-play verification, prize math or grants.
-- Install after0292 + event-settings-playoff-gate + playoff-series matches/games.
begin;
create function app.linked_consy_native_losses_enabled_v1()returns boolean language sql immutable set search_path=''set timezone='UTC'as $$select false$$;
-- Clone names, not OIDs: preserve old behavior through explicit delegates.
do $$declare n text;d text;p text;begin
 foreach n in array array['linked_consy_eligibility_v1','linked_consolation_four_qualifier_source_v2','event_settings_playoff_source_v1']loop
  d:=pg_get_functiondef(to_regprocedure('app.'||n||'(uuid,uuid'||case when n='event_settings_playoff_source_v1'then')'else',uuid)'end));
  p:=replace(d,'FUNCTION app.'||n||'(','FUNCTION app.'||n||'_before_native_loss(');
  if p=d then raise exception'native_consy_clone_anchor_changed';end if;execute p;
  execute format('alter function app.%I(%s)owner to postgres',n||'_before_native_loss',case when n='event_settings_playoff_source_v1'then'uuid,uuid'else'uuid,uuid,uuid'end);
  execute format('revoke all on function app.%I(%s)from public,anon,authenticated,service_role',n||'_before_native_loss',case when n='event_settings_playoff_source_v1'then'uuid,uuid'else'uuid,uuid,uuid'end);
 end loop;
end$$;
create table app.linked_consy_native_admissions_v1(
 start_id uuid not null,roster_entry_id uuid not null,tournament_id uuid not null,event_id uuid not null,main_event_id uuid not null,qualification_id uuid not null,
 terminal_result_id uuid not null references app.playoff_series_results_v1(id),capture jsonb not null,capture_digest text not null check(capture_digest~'^[a-f0-9]{64}$'),
 primary key(start_id,roster_entry_id),foreign key(start_id,roster_entry_id)references app.linked_consy_start_eligibility_v1(start_id,roster_entry_id),
 foreign key(start_id,tournament_id,event_id)references app.event_play_starts(id,tournament_id,event_id),
 foreign key(qualification_id,tournament_id,main_event_id)references app.qualification_result_versions(id,tournament_id,event_id)
);
create table app.linked_consy_native_admission_witnesses_v1(
 start_id uuid not null,roster_entry_id uuid not null,result_id uuid not null,generation_id uuid not null,
 primary key(start_id,roster_entry_id,result_id),foreign key(start_id,roster_entry_id)references app.linked_consy_native_admissions_v1(start_id,roster_entry_id),
 foreign key(result_id,generation_id)references app.playoff_series_results_v1(id,generation_id)
);
create index linked_consy_native_consumed_result_v1 on app.linked_consy_native_admission_witnesses_v1(result_id);
do $$declare n text;begin foreach n in array array['linked_consy_native_admissions_v1','linked_consy_native_admission_witnesses_v1']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;
-- VOLATILE is required: current-result proof takes current source locks.
create function app.linked_consy_native_loss_source_v1(tid uuid,consy uuid,roster uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare main_id uuid;q app.qualification_result_versions%rowtype;person uuid;cutoff timestamptz;slot_no integer;now_result jsonb;match_source jsonb;
 terminal app.playoff_series_results_v1%rowtype;r record;ids uuid[];entries jsonb;capture_value jsonb;
begin
 if app.linked_consy_native_losses_enabled_v1()is distinct from true then return null;end if;
 if current_setting('transaction_isolation')<>'read committed'then raise lock_not_available;end if;
 -- Caller retains the existing Main qualification/post-event advisory ordering.
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 main_id:=app.linked_consolation_main_event_v1(tid,consy);if main_id is null or not exists(select 1 from app.events where id=main_id and tournament_id=tid and event_type='main'and format='standard_singles'and operational_state='active')then return null;end if;
 select*into q from app.qualification_result_versions where tournament_id=tid and event_id=main_id order by version desc limit 1;
 if q.id is null or q.qualifier_count<>5 or not app.qualification_resolution_snapshot_current_v1(q.id)then return null;end if;
 select p.id into person from app.event_participants p join app.qualification_result_rows qr on qr.participant_id=p.id and qr.result_version_id=q.id
 where p.tournament_id=tid and p.event_id=main_id and p.roster_entry_id=roster and qr.qualification_status='qualified';if person is null then return null;end if;
 select started_at into cutoff from app.event_play_starts where tournament_id=tid and event_id=consy;
 for slot_no in 1..3 loop
  now_result:=app.playoff_series_current_result_v1(tid,main_id,q.id,slot_no);
  if now_result is null or now_result->>'loserId'is distinct from person::text then continue;end if;
  select*into terminal from app.playoff_series_results_v1 where id=(now_result->>'resultId')::uuid and tournament_id=tid and event_id=main_id;
  if terminal.id is null or(cutoff is not null and terminal.created_at>=cutoff)then continue;end if;
  with recursive ancestors(id)as(
   select terminal.id union select(p->>'resultId')::uuid from ancestors a join app.playoff_series_results_v1 ar on ar.id=a.id
   join app.playoff_series_generations_v1 ag on ag.id=ar.generation_id cross join lateral jsonb_array_elements(ag.source_capture->'parentResultPins')p where jsonb_typeof(p)='object'
  )select array_agg(id order by id)into ids from ancestors;
  if cardinality(ids)not between 1 and 3 then return null;end if;entries:='[]'::jsonb;
  for r in select ar.*,g.qualification_id,g.source_capture,g.slot,g.round_name,m.qualification_id match_qualification from app.playoff_series_results_v1 ar
   join app.playoff_series_generations_v1 g on g.id=ar.generation_id join app.playoff_series_matches_v1 m on m.id=ar.match_id where ar.id=any(ids)order by ar.id loop
   if r.tournament_id<>tid or r.event_id<>main_id or r.qualification_id<>q.id or r.match_qualification<>q.id or r.slot not between 1 and 3 or r.round_name not in('regular','semifinal')
    or(cutoff is not null and r.created_at>=cutoff)or app.playoff_series_completed_result_valid_v1(r.id)is distinct from true then return null;end if;
   now_result:=app.playoff_series_current_result_v1(tid,main_id,q.id,r.slot);match_source:=app.playoff_series_match_source_v1(tid,main_id,q.id,r.slot);
   if match_source->>'status'='retry_exact'then raise lock_not_available;end if;
   if now_result->>'resultId'is distinct from r.id::text or match_source->>'status'is distinct from'source_available'or match_source->>'currentGenerationId'is distinct from r.generation_id::text
    or match_source->>'sourceDigest'is distinct from r.source_digest or match_source->'source'is distinct from r.source_capture then return null;end if;
   entries:=entries||jsonb_build_array(jsonb_build_object('resultId',r.id,'generationId',r.generation_id,'matchId',r.match_id,'slot',r.slot,'sourceDigest',r.source_digest,'gamesDigest',r.games_digest,'createdAt',r.created_at,'parentResultPins',r.source_capture->'parentResultPins'));
  end loop;
  if jsonb_array_length(entries)<>cardinality(ids)then return null;end if;
  capture_value:=jsonb_build_object('kind','linked-consy-native-digital-loss-v1','tournamentId',tid,'eventId',consy,'rosterEntryId',roster,'mainEventId',main_id,'qualificationId',q.id,'mainParticipantId',person,
   'terminalResultId',terminal.id,'witnessIds',to_jsonb(ids),'entries',entries,'physicalPlayVerified',false,'independentHumansVerified',false,'directorDeclaredSynthetic',null);
  return jsonb_build_object('status','eligible','source','played_loss','mainEventId',main_id,'qualificationId',q.id,'witnessIds',to_jsonb(ids),'directorDeclaredSynthetic',null,
   'provenance','native_digital_protocol_origin_unverified','nativeCapture',capture_value);
 end loop;
 return null;
end$$;
create or replace function app.linked_consy_eligibility_v1(tid uuid,consy uuid,roster uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$declare legacy jsonb;native jsonb;begin
 legacy:=app.linked_consy_eligibility_v1_before_native_loss(tid,consy,roster);
 if legacy->>'status'is distinct from'pending'then return legacy;end if;
 native:=app.linked_consy_native_loss_source_v1(tid,consy,roster);return coalesce(native,legacy);
end$$;-- Every native witness namespace must have an atomic typed companion.
create function app.snapshot_linked_consy_native_admission_v1()returns trigger
language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$declare decision jsonb;c jsonb;item jsonb;cutoff timestamptz;native_count integer;begin
 select count(*)into native_count from app.playoff_series_results_v1 where id=any(new.witness_ids);
 if native_count=0 then return new;end if;
 if native_count<>cardinality(new.witness_ids)or new.source_kind<>'played_loss'or new.director_declared_synthetic is not null
  or exists(select 1 from app.linked_main_series_v1 where id=any(new.witness_ids))then raise exception'native_consy_ambiguous_witness';end if;
 select started_at into cutoff from app.event_play_starts where id=new.start_id and tournament_id=new.tournament_id and event_id=new.event_id and start_source='official';
 if cutoff is null then raise exception'native_consy_official_start_required';end if;
 decision:=app.linked_consy_native_loss_source_v1(new.tournament_id,new.event_id,new.roster_entry_id);c:=decision->'nativeCapture';
 if decision->>'status'is distinct from'eligible'or c->>'mainEventId'is distinct from new.main_event_id::text or c->>'qualificationId'is distinct from new.qualification_id::text
  or c->'witnessIds'is distinct from to_jsonb(new.witness_ids)then raise exception'native_consy_source_changed';end if;
 c:=c||jsonb_build_object('startId',new.start_id,'startCutoff',cutoff);
 insert into app.linked_consy_native_admissions_v1(start_id,roster_entry_id,tournament_id,event_id,main_event_id,qualification_id,terminal_result_id,capture,capture_digest)
 values(new.start_id,new.roster_entry_id,new.tournament_id,new.event_id,new.main_event_id,new.qualification_id,(c->>'terminalResultId')::uuid,c,encode(extensions.digest(convert_to(c::text,'utf8'),'sha256'),'hex'));
 for item in select value from jsonb_array_elements(c->'entries')loop
  insert into app.linked_consy_native_admission_witnesses_v1 values(new.start_id,new.roster_entry_id,(item->>'resultId')::uuid,(item->>'generationId')::uuid);
 end loop;
 return new;
end$$;
create trigger linked_consy_native_admission_v1 after insert on app.linked_consy_start_eligibility_v1 for each row execute function app.snapshot_linked_consy_native_admission_v1();

-- Frozen-at-Start evidence: later ordinary Main lifecycle closure is not a loss
-- correction. Current generation replacement remains barred below.
create function app.linked_consy_native_admission_proof_v1(tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare base record;n app.linked_consy_native_admissions_v1%rowtype;start_row app.event_play_starts%rowtype;c jsonb;item jsonb;r record;count_native integer;count_used integer;captured uuid[];proof jsonb:='[]'::jsonb;
begin
 select*into start_row from app.event_play_starts where tournament_id=tid and event_id=eid;
 if start_row.id is null then return jsonb_build_object('status','not_applicable');end if;
 for base in select*from app.linked_consy_start_eligibility_v1 where start_id=start_row.id order by roster_entry_id loop
  select count(*)into count_native from app.playoff_series_results_v1 where id=any(base.witness_ids);
  select*into n from app.linked_consy_native_admissions_v1 where start_id=base.start_id and roster_entry_id=base.roster_entry_id;
  if count_native=0 then if n.start_id is not null then return null;end if;continue;end if;
  if n.start_id is null or app.qualification_resolution_snapshot_current_v1(base.qualification_id)is distinct from true or base.qualification_id is distinct from(select id from app.qualification_result_versions where tournament_id=tid and event_id=base.main_event_id order by version desc limit 1)or start_row.start_source<>'official'or count_native<>cardinality(base.witness_ids)or base.source_kind<>'played_loss'or base.director_declared_synthetic is not null
   or n.tournament_id<>tid or n.event_id<>eid or n.main_event_id<>base.main_event_id or n.qualification_id<>base.qualification_id
   or app.linked_consolation_main_event_v1(tid,eid)is distinct from n.main_event_id
   or exists(select 1 from app.linked_main_series_v1 where id=any(base.witness_ids))then return null;end if;
  c:=n.capture;
  if c->>'kind'is distinct from'linked-consy-native-digital-loss-v1'or c->>'tournamentId'is distinct from tid::text or c->>'eventId'is distinct from eid::text
   or c->>'rosterEntryId'is distinct from base.roster_entry_id::text or c->>'startId'is distinct from start_row.id::text
   or c->'startCutoff'is distinct from to_jsonb(start_row.started_at)or c->>'mainEventId'is distinct from base.main_event_id::text
   or c->>'qualificationId'is distinct from base.qualification_id::text or c->>'terminalResultId'is distinct from n.terminal_result_id::text
   or c->'witnessIds'is distinct from to_jsonb(base.witness_ids)or c->'physicalPlayVerified'is distinct from'false'::jsonb
   or c->'independentHumansVerified'is distinct from'false'::jsonb or c->'directorDeclaredSynthetic'is distinct from'null'::jsonb
   or jsonb_typeof(c->'entries')is distinct from'array'or jsonb_array_length(c->'entries')<>count_native
   or n.capture_digest is distinct from encode(extensions.digest(convert_to(c::text,'utf8'),'sha256'),'hex')then return null;end if;
  select array_agg(result_id order by result_id),count(*)into captured,count_used from app.linked_consy_native_admission_witnesses_v1 where start_id=n.start_id and roster_entry_id=n.roster_entry_id;
  if count_used<>count_native or captured is distinct from base.witness_ids then return null;end if;
  if array(select(value->>'resultId')::uuid from jsonb_array_elements(c->'entries')order by(value->>'resultId')::uuid)is distinct from base.witness_ids then return null;end if;
  for item in select value from jsonb_array_elements(c->'entries')loop
   select ar.*,g.qualification_id,g.source_capture,g.slot,g.round_name into r from app.playoff_series_results_v1 ar join app.playoff_series_generations_v1 g on g.id=ar.generation_id
    join app.linked_consy_native_admission_witnesses_v1 w on w.result_id=ar.id and w.generation_id=g.id and w.start_id=n.start_id and w.roster_entry_id=n.roster_entry_id where ar.id=(item->>'resultId')::uuid;
   if not found or r.tournament_id<>tid or r.event_id<>n.main_event_id or r.qualification_id<>n.qualification_id or r.slot not between 1 and 3 or r.round_name not in('regular','semifinal')
    or r.created_at>=start_row.started_at or item->>'generationId'is distinct from r.generation_id::text or item->>'matchId'is distinct from r.match_id::text
    or item->>'sourceDigest'is distinct from r.source_digest or item->>'gamesDigest'is distinct from r.games_digest or item->'createdAt'is distinct from to_jsonb(r.created_at)
    or item->'parentResultPins'is distinct from r.source_capture->'parentResultPins'or app.playoff_series_completed_result_valid_v1(r.id)is distinct from true
    or(r.id=n.terminal_result_id and(r.loser_participant_id::text is distinct from c->>'mainParticipantId'or not exists(select 1 from app.event_participants p where p.id=r.loser_participant_id and p.tournament_id=tid and p.event_id=n.main_event_id and p.roster_entry_id=n.roster_entry_id)))then return null;end if;
   if exists(select 1 from jsonb_array_elements(r.source_capture->'parentResultPins')p where jsonb_typeof(p)='object'and(
    not((p->>'resultId')::uuid=any(base.witness_ids))or not exists(select 1 from app.playoff_series_results_v1 parent join app.playoff_series_generations_v1 pg on pg.id=parent.generation_id
     where parent.id=(p->>'resultId')::uuid and parent.match_id=(p->>'matchId')::uuid and parent.version=(p->>'version')::integer and parent.tournament_id=tid and parent.event_id=n.main_event_id and pg.qualification_id=n.qualification_id and pg.slot<r.slot)))then return null;end if;
  end loop;
  proof:=proof||jsonb_build_array(jsonb_build_object('startId',n.start_id,'rosterEntryId',n.roster_entry_id,'captureDigest',n.capture_digest,'capture',c));
 end loop;
 if exists(select 1 from app.linked_consy_native_admissions_v1 n2 where n2.tournament_id=tid and n2.event_id=eid and n2.start_id<>start_row.id)then return null;end if;
 return case when jsonb_array_length(proof)=0 then jsonb_build_object('status','not_applicable')else jsonb_build_object('status','validated_native_admissions','kind','linked-consy-native-admission-proof-v1','admissions',proof,'physicalPlayVerified',false,'moneyMoved',false)end;
end$$;
-- Canonicalize only the new native path; legacy returns keep caller semantics.
create function app.native_consy_legacy_four_source_utc_v1(t uuid,e uuid,q uuid)returns text language sql stable security definer set search_path=''set timezone='UTC'as $$select app.linked_consolation_four_qualifier_source_v2_before_native_loss(t,e,q)$$;
create function app.native_consy_legacy_playoff_source_utc_v1(t uuid,e uuid)returns jsonb language sql volatile security definer set search_path=''set timezone='UTC'as $$select app.event_settings_playoff_source_v1_before_native_loss(t,e)$$;
create or replace function app.linked_consolation_four_qualifier_source_v2(t uuid,e uuid,qid uuid)returns text
language plpgsql stable security definer set search_path=''as $$declare legacy text;proof jsonb;begin
 legacy:=app.linked_consolation_four_qualifier_source_v2_before_native_loss(t,e,qid);if legacy is null then return null;end if;
 proof:=app.linked_consy_native_admission_proof_v1(t,e);if proof is null then return null;end if;if proof->>'status'='not_applicable'then return legacy;end if;
 if app.linked_consy_native_losses_enabled_v1()is distinct from true then return null;end if;
 legacy:=app.native_consy_legacy_four_source_utc_v1(t,e,qid);if legacy is null then return null;end if;
 return encode(extensions.digest(convert_to(jsonb_build_array('linked-consy-native-four-qualifier-source-v1',legacy,proof)::text,'utf8'),'sha256'),'hex');
end$$;
create or replace function app.event_settings_playoff_source_v1(tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$declare legacy jsonb;proof jsonb;c jsonb;begin
 legacy:=app.event_settings_playoff_source_v1_before_native_loss(tid,eid);if legacy->>'status'is distinct from'source_available'or app.linked_consolation_main_event_v1(tid,eid)is null then return legacy;end if;
 proof:=app.linked_consy_native_admission_proof_v1(tid,eid);if proof is null then return jsonb_build_object('status','blocked','code','consolation_native_admission_unverified');end if;
 if proof->>'status'='not_applicable'then return legacy;end if;if app.linked_consy_native_losses_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','consolation_native_admission_disabled');end if;
 if app.linked_consolation_four_qualifier_source_v2(tid,eid,(legacy->>'qualificationId')::uuid)is null then return jsonb_build_object('status','blocked','code','consolation_native_qualification_unverified');end if;
 legacy:=app.native_consy_legacy_playoff_source_utc_v1(tid,eid);if legacy->>'status'is distinct from'source_available'then return legacy;end if;
 c:=legacy->'source'||jsonb_build_object('nativeConsolationAdmissionProof',proof);
 return legacy||jsonb_build_object('source',c,'sourceDigest',encode(extensions.digest(convert_to(jsonb_build_array('event-settings-playoff-native-consy-source-v1',tid,eid,c)::text,'utf8'),'sha256'),'hex'));
end$$;
create function app.freeze_consumed_native_consy_generation_v1()returns trigger language plpgsql security definer set search_path=''set timezone='UTC'as $$begin
 perform 1 from app.tournaments where id=new.tournament_id for update nowait;
 if exists(select 1 from app.playoff_series_results_v1 r join app.linked_consy_native_admission_witnesses_v1 w on w.result_id=r.id and w.generation_id=r.generation_id where r.match_id=new.match_id and r.tournament_id=new.tournament_id and r.event_id=new.event_id)then raise exception'native_consy_consumed_result_frozen';end if;
 return new;
end$$;
create trigger linked_consy_consumed_generation_v1 before insert on app.playoff_series_generations_v1 for each row execute function app.freeze_consumed_native_consy_generation_v1();
do $$declare p regprocedure;begin foreach p in array array[
 'app.native_consy_legacy_four_source_utc_v1(uuid,uuid,uuid)'::regprocedure,'app.native_consy_legacy_playoff_source_utc_v1(uuid,uuid)'::regprocedure,
 'app.linked_consy_native_losses_enabled_v1()'::regprocedure,'app.linked_consy_native_loss_source_v1(uuid,uuid,uuid)'::regprocedure,
 'app.snapshot_linked_consy_native_admission_v1()'::regprocedure,'app.linked_consy_native_admission_proof_v1(uuid,uuid)'::regprocedure,
 'app.freeze_consumed_native_consy_generation_v1()'::regprocedure,'app.linked_consy_eligibility_v1(uuid,uuid,uuid)'::regprocedure,
 'app.linked_consolation_four_qualifier_source_v2(uuid,uuid,uuid)'::regprocedure,'app.event_settings_playoff_source_v1(uuid,uuid)'::regprocedure]loop
 execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);
end loop;end$$;
commit;
