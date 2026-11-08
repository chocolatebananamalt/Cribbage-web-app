-- SOURCE ONLY / UNEXECUTED / DEFAULT-OFF. No application grant or migration.
-- Depends on simulated Start and reviewed native publication predecessors.
-- Every action uses its own authenticated subject; ordinary scores untouched.
begin;
create function app.native_mixed_game_writer_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;
create function app.native_mixed_game_transport_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;
create function app.native_mixed_game_recovery_enabled_v1()returns boolean language sql immutable set search_path=''as $$select false$$;

create function app.native_mixed_game_exact_v1(v jsonb,keys text[])returns boolean
language plpgsql immutable set search_path=''as $$begin
 if jsonb_typeof(v)is distinct from'object'then return false;end if;
 return v?&keys and v-keys='{}'::jsonb;end$$;
create function app.native_mixed_game_result_valid_v1(v jsonb)returns boolean
language plpgsql immutable set search_path=''as $$begin
 if app.native_mixed_game_exact_v1(v,array['winnerSide','margin'])is distinct from true
  or coalesce(v->>'winnerSide','')not in('a','b')or jsonb_typeof(v->'margin')is distinct from'number'then return false;end if;
 if(v->>'margin')!~'^[1-9][0-9]{0,2}$'then return false;end if;
 return(v->>'margin')::integer between 1 and 121;end$$;
create function app.native_mixed_game_request_valid_v1(v jsonb)returns boolean
language plpgsql immutable set search_path=''as $$declare p jsonb;item_value jsonb;begin
 if app.native_mixed_game_exact_v1(v,array['kind','operationId','startId','gameId','expectedStartSourceDigest','expectedRevision','expectedHistoryDigest','action','payload'])is distinct from true
  or v->>'kind'is distinct from'native-mixed-simulation-game-write-v1'
  or app.native_mixed_simulation_uuid_v1(v->>'operationId')is distinct from true
  or app.native_mixed_simulation_uuid_v1(v->>'startId')is distinct from true
  or app.native_mixed_simulation_uuid_v1(v->>'gameId')is distinct from true
  or jsonb_typeof(v->'expectedStartSourceDigest')is distinct from'string'
  or coalesce(v->>'expectedStartSourceDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(v->'expectedHistoryDigest')is distinct from'string'
  or coalesce(v->>'expectedHistoryDigest','')!~'^[a-f0-9]{64}$'
  or jsonb_typeof(v->'expectedRevision')is distinct from'number'
  or coalesce(v->>'expectedRevision','')!~'^[0-3]$'then return false;end if;
 p:=v->'payload';
 case v->>'action'
 when'digital-submit'then
  return app.native_mixed_game_exact_v1(p,array['participantId','result','statement'])is true
   and app.native_mixed_simulation_uuid_v1(p->>'participantId')is true
   and app.native_mixed_game_result_valid_v1(p->'result')is true and p->>'statement'is not distinct from'simulation-own-result-v1';
 when'digital-confirm'then
  if app.native_mixed_game_exact_v1(p,array['participantId','result','references','statement'])is distinct from true
   or app.native_mixed_simulation_uuid_v1(p->>'participantId')is distinct from true
   or app.native_mixed_game_result_valid_v1(p->'result')is distinct from true
   or p->>'statement'is distinct from'simulation-own-confirmation-v1'
   or jsonb_typeof(p->'references')is distinct from'array'then return false;end if;
  if jsonb_array_length(p->'references')not between 2 and 3 then return false;end if;
  for item_value in select value from jsonb_array_elements(p->'references')loop
   if jsonb_typeof(item_value)is distinct from'string'or app.native_mixed_simulation_uuid_v1(item_value#>>'{}')is distinct from true then return false;end if;
  end loop;
  return(select count(distinct x#>>'{}')from jsonb_array_elements(p->'references')x)=jsonb_array_length(p->'references');
 when'paper-capture'then
  if app.native_mixed_game_exact_v1(p,array['artifactId','claims','physicalOriginal','fictionalOpponentPlayed','independentHumanPlayClaimed','statement'])is distinct from true
   or app.native_mixed_simulation_uuid_v1(p->>'artifactId')is distinct from true
   or p->'physicalOriginal'is distinct from'false'::jsonb or p->'fictionalOpponentPlayed'is distinct from'false'::jsonb
   or p->'independentHumanPlayClaimed'is distinct from'false'::jsonb
   or p->>'statement'is distinct from'fictional-paper-capture-v1'or jsonb_typeof(p->'claims')is distinct from'array'then return false;end if;
  if jsonb_array_length(p->'claims')not between 1 and 2 then return false;end if;
  for item_value in select value from jsonb_array_elements(p->'claims')loop
   if app.native_mixed_game_exact_v1(item_value,array['side','result'])is distinct from true or coalesce(item_value->>'side','')not in('a','b')
    or app.native_mixed_game_result_valid_v1(item_value->'result')is distinct from true then return false;end if;
  end loop;
  return(select count(distinct x->>'side')from jsonb_array_elements(p->'claims')x)=jsonb_array_length(p->'claims');
 when'paper-review'then
  if(app.native_mixed_game_exact_v1(p,array['captureId','artifactId','artifactDigest','reenteredClaims','decision','statement'])is true
   and app.native_mixed_simulation_uuid_v1(p->>'captureId')is true and app.native_mixed_simulation_uuid_v1(p->>'artifactId')is true
   and jsonb_typeof(p->'artifactDigest')='string'and coalesce(p->>'artifactDigest','')~'^[a-f0-9]{64}$'
   and p->>'decision'is not distinct from'accepted-simulation-only'and p->>'statement'is not distinct from'fictional-paper-review-v1')is distinct from true then return false;end if;
  if jsonb_typeof(p->'reenteredClaims')is distinct from'array'then return false;end if;
  if jsonb_array_length(p->'reenteredClaims')not between 1 and 2 then return false;end if;
  for item_value in select value from jsonb_array_elements(p->'reenteredClaims')loop
   if app.native_mixed_game_exact_v1(item_value,array['side','result'])is distinct from true or coalesce(item_value->>'side','')not in('a','b')
    or app.native_mixed_game_result_valid_v1(item_value->'result')is distinct from true then return false;end if;
  end loop;
  return(select count(distinct x->>'side')from jsonb_array_elements(p->'reenteredClaims')x)=jsonb_array_length(p->'reenteredClaims');
 else return false;end case;end$$;

create table app.native_mixed_game_artifacts_v1(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,start_id uuid not null references app.native_mixed_simulation_starts_v1(id),
 game_id uuid not null,creator_id uuid not null references app.profiles(id),operation_receipt_id uuid not null unique references app.operation_receipts(id),
 body jsonb not null,sha256 text not null check(sha256=app.native_mixed_simulation_hash_v1(body)),created_at timestamptz not null default clock_timestamp(),
 foreign key(game_id,tournament_id,event_id)references app.canonical_games(id,tournament_id,event_id),
 unique(start_id,game_id),check((body->>'kind'='native-mixed-fictional-paper-v1')is true),
 check((body->>'startId'=start_id::text and body->>'gameId'=game_id::text)is true),
 check((body->'physicalOriginal'='false'::jsonb and body->'fictionalOpponentPlayed'='false'::jsonb and body->'independentHumanPlayClaimed'='false'::jsonb)is true));
create table app.native_mixed_game_evidence_v1(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,start_id uuid not null references app.native_mixed_simulation_starts_v1(id),
 game_id uuid not null,sequence integer not null check(sequence between 1 and 4),actor_id uuid not null references app.profiles(id),
 operation_id uuid not null,operation_receipt_id uuid not null unique references app.operation_receipts(id),
 request_payload jsonb not null,entry jsonb not null,authority_capture jsonb not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(game_id,tournament_id,event_id)references app.canonical_games(id,tournament_id,event_id),
 unique(start_id,game_id,sequence),unique(actor_id,operation_id),
 check(app.native_mixed_game_request_valid_v1(request_payload)is true),
 check((request_payload->>'operationId'=operation_id::text and request_payload->>'startId'=start_id::text and request_payload->>'gameId'=game_id::text)is true),
 check((entry->>'id'=id::text and entry->>'actorId'=actor_id::text and entry->>'receiptId'=operation_receipt_id::text)is true),
 check((entry->>'payloadDigest'=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-evidence-v1',entry-'payloadDigest',authority_capture)))is true));
do $$declare n text;begin foreach n in array array['native_mixed_game_artifacts_v1','native_mixed_game_evidence_v1']loop
 execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);
 execute format('alter table app.%I force row level security',n);execute format('revoke all on table app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);end loop;end$$;

-- Internal only: rebuilds the exact actor-specific source captured by Start.
-- It never changes JWT GUCs or mistakes a historical bound receipt for currentness.
create function app.native_mixed_game_root_current_v1(sid uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare s app.native_mixed_simulation_starts_v1%rowtype;c app.native_mixed_simulation_publication_contexts_v1%rowtype;
 p app.native_mixed_simulation_plans_v1%rowtype;d app.native_mixed_simulation_draws_v1%rowtype;rv app.native_mixed_simulation_reviews_v1%rowtype;
 a jsonb;seal app.native_mixed_attendance_seals_v1%rowtype;attendance jsonb;plan jsonb;draw jsonb;review jsonb;publication jsonb;assignments jsonb;games jsonb;source jsonb;digest text;begin
 if app.native_mixed_simulation_start_enabled_v1()is distinct from true or app.native_mixed_simulation_publication_enabled_v1()is distinct from true then return null;end if;
 perform app.lock_native_mixed_simulation_sources_v1();
 select*into s from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid for share nowait;
 if s.id is null or app.native_mixed_simulation_start_bound_v1(s.id)is distinct from true then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=s.actor_id and role='director'for share nowait;if not found then return null;end if;
 perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'and status='open'and registration_status='closed'for share nowait;if not found then return null;end if;
 if(select count(*)from app.event_participants where tournament_id=tid and event_id=eid)<>18
  or exists(select 1 from app.event_participants where tournament_id=tid and event_id=eid and status<>'registered')
  or exists(select 1 from app.event_play_starts where event_id=eid)
  or exists(select 1 from app.roster_check_in_events where tournament_id=tid)
  or exists(select 1 from app.event_participant_status_events where event_id=eid)
  or exists(select 1 from app.event_check_in_windows where event_id=eid)
  or exists(select 1 from app.event_check_in_events where event_id=eid)
  or exists(select 1 from app.event_check_in_requests where event_id=eid)
  or app.native_mixed_admission_score_history_empty_v1(tid,eid)is distinct from true
  or(select count(*)from app.canonical_games where event_id=eid)<>108
  or exists(select 1 from app.canonical_games where event_id=eid and(state<>'pending'or winner_side is not null or margin is not null))
 then return null;end if;
 select*into c from app.native_mixed_simulation_publication_contexts_v1 where id=s.publication_context_id and tournament_id=tid and event_id=eid;
 if c.id is null or app.native_mixed_simulation_publication_bound_v1(c.id)is distinct from true then return null;end if;
 a:=app.native_mixed_attendance_projection_v1(tid,eid);select*into seal from app.native_mixed_attendance_seals_v1 where id=c.attendance_seal_id and tournament_id=tid and event_id=eid;
 if a->>'status'is distinct from'source_available'or seal.id is null or seal.source_capture is distinct from a
  or app.native_mixed_attendance_operation_bound_v1(seal.actor_id,seal.operation_id,'seal')is distinct from true
  or seal.source_digest is distinct from a->>'sourceDigest'or seal.source_digest is distinct from c.attendance_source_digest
 then return null;end if;
 select*into p from app.native_mixed_simulation_plans_v1 where id=c.plan_id;
 select*into d from app.native_mixed_simulation_draws_v1 where id=c.draw_id;
 select*into rv from app.native_mixed_simulation_reviews_v1 where id=c.review_id;
 if p.attendance_capture is distinct from(a||jsonb_build_object('sealId',seal.id))then return null;end if;
 select assignments_capture into assignments from app.native_mixed_simulation_seating_sidecars_v1 where context_id=c.id;
 select games_capture into games from app.native_mixed_simulation_schedule_sidecars_v1 where context_id=c.id;
 attendance:=jsonb_build_object('sealId',c.attendance_seal_id,'sourceDigest',c.attendance_source_digest);
 plan:=jsonb_build_object('planId',p.id,'sourceDigest',p.source_digest,'config',p.config);
 draw:=jsonb_build_object('drawId',d.id,'sourceDigest',d.source_digest,'candidate',d.candidate);
 review:=jsonb_build_object('reviewId',rv.id,'sourceDigest',rv.source_digest,'decision',rv.decision);
 publication:=jsonb_build_object('contextId',c.id,'seatingReceiptId',c.seating_receipt_id,'seatingPublicationId',c.seating_publication_id,
 'scheduleReceiptId',c.schedule_receipt_id,'schedulePublicationId',c.schedule_publication_id,'sourceMethod','native_mixed_simulation_v1','assignmentCount',18,'roundCount',12,'matchCount',108);
 digest:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-schedule-source-v1',s.actor_id,tid,eid,attendance,plan,draw,review,publication,assignments,games));
 source:=jsonb_build_object('status','source_available','kind','native-mixed-simulation-schedule-source-v1','actorId',s.actor_id,'tournamentId',tid,'eventId',eid,
 'attendance',attendance,'plan',plan,'draw',draw,'review',review,'publication',publication,'fixedAssignments',assignments,'canonicalGames',games,'sourceDigest',digest,
 'simulationRosterProjected',true,'nativeInitialSeatingPublished',true,'nativeCanonicalSchedulePublished',true,
 'ordinaryAttendanceUsed',false,'ordinaryInitialSeatingWriterUsed',false,'ordinaryScheduleWriterUsed',false,
 'humanPresenceVerified',false,'paymentVerified',false,'moneyMoved',false,'normalStartAuthorized',false,'payoutAuthorized',false,'finalizationAuthorized',false);
 if source is distinct from s.source_capture then return null;end if;
 return jsonb_build_object('startId',s.id,'startSourceDigest',s.source_digest,'source',source);
end$$;

-- Offline baseline pins these Auth columns. Session presence is not a claim
-- that every configurable refresh/inactivity policy has been provider-tested.
create function app.native_mixed_game_own_subject_v1()returns uuid
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$declare actor uuid:=auth.uid();sid text;begin
 if actor is null or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),auth.jwt()->>'role','')<>'authenticated'then return null;end if;
 sid:=auth.jwt()->>'session_id';if app.native_mixed_simulation_uuid_v1(sid)is distinct from true then return null;end if;
 perform 1 from auth.users where id=actor and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from auth.sessions where id=sid::uuid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then return null;end if;
 return actor;end$$;

create function app.native_mixed_game_receipt_v1(e app.native_mixed_game_evidence_v1,history_digest text)returns jsonb
language sql stable set search_path=''as $$select jsonb_build_object(
 'kind','native-mixed-simulation-game-write-receipt-v1','status','accepted','code','simulation_evidence_recorded',
 'actorId',(e).actor_id,'tournamentId',(e).tournament_id,'eventId',(e).event_id,'operationId',(e).operation_id,
 'request',(e).request_payload,'entry',(e).entry,'revision',(e).sequence,'historyDigest',history_digest,
 'simulationOnly',true,'ordinaryScoreWritten',false,'normalStartAuthorized',false,'scoringAuthorized',false,
 'officialResultVerified',false,'humanPlayVerified',false,'moneyMoved',false,'payoutAuthorized',false,
 'historicalReceipt',false,'currentSourceVerified',true)$$;

create function app.native_mixed_game_entry_bound_with_start_v1(entry_value uuid,s app.native_mixed_simulation_starts_v1)returns boolean
language plpgsql stable security definer set search_path=''as $$declare e app.native_mixed_game_evidence_v1%rowtype;
 r app.operation_receipts%rowtype;a app.native_mixed_game_artifacts_v1%rowtype;capture_entry app.native_mixed_game_evidence_v1%rowtype;h jsonb;hd text;begin
 select*into e from app.native_mixed_game_evidence_v1 where id=entry_value;if not found then return false;end if;
 select*into r from app.operation_receipts where id=e.operation_receipt_id;
 if s.id is null or s.tournament_id<>e.tournament_id or s.event_id<>e.event_id or s.id<>e.start_id or not exists(select 1 from app.native_mixed_simulation_starts_v1 stored where stored.id=s.id and stored=s)
  or app.native_mixed_game_request_valid_v1(e.request_payload)is distinct from true
  or r.id is null or r.actor_profile_id<>e.actor_id or r.client_operation_id<>e.operation_id or r.tournament_id<>e.tournament_id
  or r.operation_type<>'native_mixed_simulation_game_evidence_v1'or r.target_id<>e.id or r.outcome<>'accepted'
  or r.request_hash<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-game-write-v1',e.actor_id,e.tournament_id,e.event_id,e.request_payload))
  or e.entry->>'id'is distinct from e.id::text or e.entry->>'actorId'is distinct from e.actor_id::text or e.entry->>'receiptId'is distinct from e.operation_receipt_id::text
  or e.entry->>'tournamentId'is distinct from e.tournament_id::text or e.entry->>'eventId'is distinct from e.event_id::text
  or e.request_payload->>'expectedStartSourceDigest'is distinct from s.source_digest
  or e.request_payload->'expectedRevision'is distinct from to_jsonb(e.sequence-1)
  or e.entry->>'payloadDigest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-evidence-v1',e.entry-'payloadDigest',e.authority_capture))
  or e.entry->>'startSourceDigest'is distinct from s.source_digest or e.entry->>'gameId'is distinct from e.game_id::text or e.entry->>'startId'is distinct from e.start_id::text
  or e.entry->>'operationId'is distinct from e.operation_id::text or e.entry->'sequence'is distinct from to_jsonb(e.sequence)
  or e.entry->>'action'is distinct from e.request_payload->>'action'
  or(e.entry-'payloadDigest'-array['id','operationId','receiptId','sequence','actorId','tournamentId','eventId','startId','gameId','startSourceDigest','action'])
    is distinct from(e.request_payload->'payload'||case when e.entry->>'action'='paper-capture'then jsonb_build_object('artifactDigest',e.entry->>'artifactDigest')else'{}'::jsonb end)
  or e.authority_capture->>'subjectId'is distinct from e.actor_id::text or app.native_mixed_simulation_uuid_v1(e.authority_capture->>'sessionId')is distinct from true
 then return false;end if;
 if e.entry->>'action'in('paper-capture','paper-review')then
  if app.native_mixed_game_exact_v1(e.authority_capture,array['subjectId','sessionId','roles','paperIdentityChecked','nonselfChecked','paperIdentityBindingId'])is distinct from true
   or e.authority_capture->'paperIdentityChecked'is distinct from'true'::jsonb or e.authority_capture->'nonselfChecked'is distinct from'true'::jsonb
   or app.native_mixed_simulation_uuid_v1(e.authority_capture->>'paperIdentityBindingId')is distinct from true
   or not exists(select 1 from app.paper_official_identity_bindings b where b.id=(e.authority_capture->>'paperIdentityBindingId')::uuid and b.tournament_id=e.tournament_id and b.official_profile_id=e.actor_id)
   or(e.entry->>'action'='paper-capture'and not(e.authority_capture->'roles'?'cross_checker'))
   or(e.entry->>'action'='paper-review'and not(e.authority_capture->'roles'?|array['director','co_director','cross_checker']))then return false;end if;
 else
  if app.native_mixed_game_exact_v1(e.authority_capture,array['subjectId','sessionId','roles'])is distinct from true
   or not exists(select 1 from app.native_mixed_simulation_publication_contexts_v1 c,
    lateral jsonb_array_elements(c.source_capture#>'{attendance,digitalConsents}')d
    where c.id=s.publication_context_id and d->>'profileId'=e.actor_id::text and d->>'participantId'=e.entry->>'participantId')then return false;end if;
 end if;
 if e.entry->>'action'='paper-capture'then
  select*into a from app.native_mixed_game_artifacts_v1 where id=(e.entry->>'artifactId')::uuid and start_id=e.start_id and game_id=e.game_id;
  if a.id is null or a.creator_id<>e.actor_id or a.operation_receipt_id<>r.id or a.sha256<>e.entry->>'artifactDigest'
   or a.body is distinct from jsonb_build_object('kind','native-mixed-fictional-paper-v1','tournamentId',e.tournament_id,'eventId',e.event_id,
    'startId',e.start_id,'gameId',e.game_id,'claims',e.entry->'claims','physicalOriginal',false,'fictionalOpponentPlayed',false,'independentHumanPlayClaimed',false)then return false;end if;
 end if;
 if e.entry->>'action'='paper-review'then
  select*into capture_entry from app.native_mixed_game_evidence_v1 where id=(e.entry->>'captureId')::uuid and start_id=e.start_id and game_id=e.game_id and sequence<e.sequence;
  if capture_entry.id is null or capture_entry.entry->>'action'is distinct from'paper-capture'or capture_entry.actor_id=e.actor_id
   or e.entry->>'artifactId'is distinct from capture_entry.entry->>'artifactId'or e.entry->>'artifactDigest'is distinct from capture_entry.entry->>'artifactDigest'
   or(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(e.entry->'reenteredClaims')x)
    is distinct from(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(capture_entry.entry->'claims')x)then return false;end if;
 end if;
 select coalesce(jsonb_agg(x.entry order by x.sequence),'[]')into h from app.native_mixed_game_evidence_v1 x where x.start_id=e.start_id and x.game_id=e.game_id and x.sequence<e.sequence;
 if jsonb_array_length(h)<>e.sequence-1 or e.request_payload->>'expectedHistoryDigest'is distinct from app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-history-v1',e.start_id,e.game_id,s.source_digest,h))then return false;end if;
 h:=h||jsonb_build_array(e.entry);
 if jsonb_array_length(h)<>e.sequence then return false;end if;
 hd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-history-v1',e.start_id,e.game_id,s.source_digest,h));
 return r.response_payload=app.native_mixed_game_receipt_v1(e,hd)and exists(select 1 from app.audit_events v
 where v.tournament_id=e.tournament_id and v.actor_profile_id=e.actor_id and v.operation_receipt_id=r.id
  and v.entity_type='native_mixed_simulation_game_evidence'and v.entity_id=e.id and v.action='simulation_game_evidence_recorded'and v.after_state=r.response_payload);end$$;

-- Standalone entry proof retains full Start verification. Internal callers
-- may reuse an exact immutable Start already verified and SHARE-locked by root.
create function app.native_mixed_game_entry_bound_v1(entry_value uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$declare st app.native_mixed_simulation_starts_v1%rowtype;begin
 select x.*into st from app.native_mixed_simulation_starts_v1 x join app.native_mixed_game_evidence_v1 e on e.start_id=x.id where e.id=entry_value;
 if st.id is null or app.native_mixed_simulation_start_bound_v1(st.id)is distinct from true then return false;end if;
 return app.native_mixed_game_entry_bound_with_start_v1(entry_value,st);end$$;

-- Completion is evidence, not ordinary score authority. No current-consent
-- dependency: historical immutable results survive later role/source changes.
create function app.native_mixed_game_complete_with_start_v1(tid uuid,eid uuid,s app.native_mixed_simulation_starts_v1,gid uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$
declare sid uuid:=s.id;g app.canonical_games%rowtype;h jsonb;subs jsonb;confirms jsonb;capture_value jsonb;review_value jsonb;refs jsonb;results jsonb;digital_ids uuid[];digital_profiles uuid[];paper_sides text[];people_count integer;row_value record;
begin
 select*into g from app.canonical_games where id=gid and tournament_id=tid and event_id=eid;if not found then return false;end if;
 if not exists(select 1 from app.native_mixed_simulation_starts_v1 st where st.id=sid and st.tournament_id=tid and st.event_id=eid and st=s
  and exists(select 1 from jsonb_array_elements(st.source_capture->'canonicalGames')x where x->>'gameId'=gid::text))then return false;end if;
 select count(*),array_agg(p.id)filter(where r.scorecard_type='digital'),array_agg(p.profile_id)filter(where r.scorecard_type='digital'),
 array_agg(case when p.id=g.side_a_participant_id then'a'else'b'end order by case when p.id=g.side_a_participant_id then'a'else'b'end)filter(where r.scorecard_type='paper')
 into people_count,digital_ids,digital_profiles,paper_sides from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=tid
 where p.event_id=eid and p.id in(g.side_a_participant_id,g.side_b_participant_id);
 if people_count<>2 or coalesce(cardinality(digital_ids),0)+coalesce(cardinality(paper_sides),0)<>2 then return false;end if;
 select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_game_evidence_v1 where tournament_id=tid and event_id=eid and start_id=sid and game_id=gid;
 if jsonb_array_length(h)<>(case when coalesce(cardinality(digital_ids),0)=0 then 2 else 4 end)then return false;end if;
 for row_value in select id from app.native_mixed_game_evidence_v1 where tournament_id=tid and event_id=eid and start_id=sid and game_id=gid loop
  if app.native_mixed_game_entry_bound_with_start_v1(row_value.id,s)is distinct from true then return false;end if;
 end loop;
 select coalesce(jsonb_agg(x),'[]')into subs from jsonb_array_elements(h)x where x->>'action'='digital-submit';
 select coalesce(jsonb_agg(x),'[]')into confirms from jsonb_array_elements(h)x where x->>'action'='digital-confirm';
 if jsonb_array_length(subs)<>coalesce(cardinality(digital_ids),0)or jsonb_array_length(confirms)<>coalesce(cardinality(digital_ids),0)
  or(select count(distinct x->>'participantId')from jsonb_array_elements(subs)x)<>coalesce(cardinality(digital_ids),0)
  or(select count(distinct x->>'participantId')from jsonb_array_elements(confirms)x)<>coalesce(cardinality(digital_ids),0)
  or exists(select 1 from jsonb_array_elements(subs||confirms)x where not exists(select 1 from app.event_participants p where p.event_id=eid and p.id=any(digital_ids)and p.id::text=x->>'participantId'and p.profile_id::text=x->>'actorId'))then return false;end if;
 if(select count(*)from jsonb_array_elements(h)x where x->>'action'='paper-capture')<>(case when coalesce(cardinality(paper_sides),0)>0 then 1 else 0 end)
  or(select count(*)from jsonb_array_elements(h)x where x->>'action'='paper-review')<>(case when coalesce(cardinality(paper_sides),0)>0 then 1 else 0 end) then return false;end if;
 select x into capture_value from jsonb_array_elements(h)x where x->>'action'='paper-capture';select x into review_value from jsonb_array_elements(h)x where x->>'action'='paper-review';
 if capture_value is not null then
  if capture_value->>'actorId'=review_value->>'actorId'or (capture_value->>'actorId')::uuid=any(digital_profiles)or(review_value->>'actorId')::uuid=any(digital_profiles)
   or(select jsonb_agg(x->>'side'order by x->>'side')from jsonb_array_elements(capture_value->'claims')x)is distinct from to_jsonb(paper_sides)
   or review_value->>'captureId'is distinct from capture_value->>'id'then return false;end if;
 end if;
 select coalesce(jsonb_agg(result_value),'[]')into results from(select x->'result'result_value from jsonb_array_elements(subs)x union all select x->'result'from jsonb_array_elements(coalesce(capture_value->'claims','[]'))x)y;
 if jsonb_array_length(results)<>2 or(select count(distinct x)from jsonb_array_elements(results)x)<>1 then return false;end if;
 select jsonb_agg(to_jsonb(x->>'id')order by x->>'id')into refs from jsonb_array_elements(h)x where x->>'action'<>'digital-confirm';
 if exists(select 1 from jsonb_array_elements(confirms)c where c->'result'is distinct from results->0
  or(select jsonb_agg(x order by x#>>'{}')from jsonb_array_elements(c->'references')x)is distinct from refs
  or exists(select 1 from jsonb_array_elements(h)x where x->>'action'<>'digital-confirm'and(x->>'sequence')::integer>=(c->>'sequence')::integer))then return false;end if;
 return true;
end$$;

create function app.native_mixed_game_complete_v1(tid uuid,eid uuid,sid uuid,gid uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$declare st app.native_mixed_simulation_starts_v1%rowtype;begin
 select*into st from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 if st.id is null or app.native_mixed_simulation_start_bound_v1(st.id)is distinct from true then return false;end if;
 return app.native_mixed_game_complete_with_start_v1(tid,eid,st,gid);end$$;

create function app.native_mixed_game_play_order_with_start_v1(tid uuid,eid uuid,s app.native_mixed_simulation_starts_v1,gid uuid,pid uuid)returns text
language plpgsql stable security definer set search_path=''as $$declare sid uuid:=s.id;current_round integer;prior record;begin
 if not exists(select 1 from app.native_mixed_simulation_starts_v1 st where st.id=sid and st.tournament_id=tid and st.event_id=eid and st=s)then return null;end if;
 select rn.round_number into current_round from app.canonical_games g join app.rounds rn on rn.id=g.round_id and rn.event_id=eid
 where g.id=gid and g.tournament_id=tid and g.event_id=eid and pid in(g.side_a_participant_id,g.side_b_participant_id);
 if current_round is null or current_round not between 1 and 12 then return null;end if;
 -- Exact published graph, not roster order or a client's requested round.
 if(select count(*)from app.canonical_games g join app.rounds rn on rn.id=g.round_id and rn.event_id=eid where g.tournament_id=tid and g.event_id=eid and pid in(g.side_a_participant_id,g.side_b_participant_id))<>12
  or exists(select 1 from generate_series(1,12)n where(select count(*)from app.canonical_games g join app.rounds rn on rn.id=g.round_id and rn.event_id=eid where g.tournament_id=tid and g.event_id=eid and rn.round_number=n and pid in(g.side_a_participant_id,g.side_b_participant_id))<>1)
 then return null;end if;
 if app.native_mixed_game_complete_with_start_v1(tid,eid,s,gid)is true then return'complete';end if;
 for prior in select g.id from app.canonical_games g join app.rounds rn on rn.id=g.round_id and rn.event_id=eid where g.tournament_id=tid and g.event_id=eid and pid in(g.side_a_participant_id,g.side_b_participant_id)and rn.round_number<current_round order by rn.round_number loop
  if app.native_mixed_game_complete_with_start_v1(tid,eid,s,prior.id)is distinct from true then return'upcoming';end if;
 end loop;
 return'current';
end$$;

create function app.native_mixed_game_play_order_v1(tid uuid,eid uuid,sid uuid,gid uuid,pid uuid)returns text
language plpgsql stable security definer set search_path=''as $$declare st app.native_mixed_simulation_starts_v1%rowtype;begin
 select*into st from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 if st.id is null or app.native_mixed_simulation_start_bound_v1(st.id)is distinct from true then return null;end if;
 return app.native_mixed_game_play_order_with_start_v1(tid,eid,st,gid,pid);end$$;

-- Terminal closure consumes the original actor/operation nonce. It never
-- deletes evidence or rewrites a request; delayed writers see this same receipt.
create function app.native_mixed_game_closed_receipt_v1(r app.operation_receipts,actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare v jsonb:=(r).response_payload;begin
 if (r).operation_type<>'native_mixed_game_closed_v1'or(r).actor_profile_id<>actor or(r).tournament_id<>tid
  or(r).client_operation_id<>(request->>'operationId')::uuid or(r).target_id<>(request->>'gameId')::uuid or(r).outcome<>'accepted'
  or(r).request_hash<>app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-game-write-v1',actor,tid,eid,request))
  or v is distinct from jsonb_build_object('kind','native-mixed-game-closed-v1','status','closed','code','terminal_operation_closed',
   'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',request->>'operationId','request',request,'closureId',(r).id,
   'reason',v->>'reason','simulationOnly',true,'noWriteCommitted',true,'ordinaryScoreWritten',false,'normalStartAuthorized',false,
   'scoringAuthorized',false,'officialResultVerified',false,'humanPlayVerified',false,'moneyMoved',false,'payoutAuthorized',false)
  or coalesce(v->>'reason','')not in('source_changed','history_changed')
  or exists(select 1 from app.native_mixed_game_evidence_v1 where actor_id=actor and operation_id=(request->>'operationId')::uuid)
  or not exists(select 1 from app.audit_events where actor_profile_id=actor and tournament_id=tid and operation_receipt_id=(r).id
   and entity_type='native_mixed_game_closed'and entity_id=(r).id and action='terminal_request_closed'and after_state=v)
 then return null;end if;return v;end$$;

create function app.append_native_mixed_simulation_game_evidence_v1(tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare verified_start app.native_mixed_simulation_starts_v1%rowtype;actor uuid;op uuid;sid uuid;gid uuid;g app.canonical_games%rowtype;root jsonb;start_digest text;
 old app.operation_receipts%rowtype;e app.native_mixed_game_evidence_v1%rowtype;row_value record;history jsonb;revision_value integer;hd text;
 payload jsonb;action_value text;digital uuid[];paper_sides text[];actor_own uuid;capture jsonb;review jsonb;submissions jsonb;results jsonb;refs jsonb;
 idv uuid:=extensions.gen_random_uuid();receipt_id uuid:=extensions.gen_random_uuid();request_hash text;body jsonb;entry_value jsonb;authority jsonb;artifact jsonb;artifact_digest text;response jsonb;roles jsonb;
begin
 if app.native_mixed_game_writer_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null or current_setting('transaction_isolation')<>'read committed'then return null;end if;
 if app.native_mixed_game_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 op:=(request->>'operationId')::uuid;sid:=(request->>'startId')::uuid;gid:=(request->>'gameId')::uuid;payload:=request->'payload';action_value:=request->>'action';
 request_hash:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-game-write-v1',actor,tid,eid,request));
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-game:'||sid::text||':'||gid::text,0))
 then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then
  if old.operation_type='native_mixed_game_closed_v1'then
   response:=app.native_mixed_game_closed_receipt_v1(old,actor,tid,eid,request);
   return coalesce(response,jsonb_build_object('status','rejected','code','idempotency_conflict'));end if;
  if old.tournament_id<>tid or old.operation_type<>'native_mixed_simulation_game_evidence_v1'or old.request_hash<>request_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select*into e from app.native_mixed_game_evidence_v1 where operation_receipt_id=old.id and tournament_id=tid and event_id=eid and actor_id=actor;
  if e.id is null or app.native_mixed_game_entry_bound_v1(e.id)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  return old.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);
 end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);
 if root is null or root->>'startSourceDigest'is distinct from request->>'expectedStartSourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 select*into verified_start from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 start_digest:=root->>'startSourceDigest';
 select*into g from app.canonical_games where id=gid and tournament_id=tid and event_id=eid for share nowait;
 if not found or not exists(select 1 from jsonb_array_elements(root#>'{source,canonicalGames}')x where x->>'gameId'=gid::text)then return jsonb_build_object('status','rejected','code','game_not_in_scope');end if;
 lock table app.native_mixed_game_evidence_v1,app.native_mixed_game_artifacts_v1,app.paper_official_identity_bindings in share row exclusive mode nowait;
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)is true
  or exists(select 1 from app.native_mixed_simulation_cancellations_v1 where actor_id=actor and operation_id=op)
 then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 for row_value in select id from app.native_mixed_game_evidence_v1 where start_id=sid and game_id=gid loop
  if app.native_mixed_game_entry_bound_with_start_v1(row_value.id,verified_start)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;end loop;
 select coalesce(jsonb_agg(x.entry order by x.sequence),'[]'),count(*)into history,revision_value from app.native_mixed_game_evidence_v1 x where start_id=sid and game_id=gid;
 hd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-history-v1',sid,gid,start_digest,history));
 if revision_value<>(request->>'expectedRevision')::integer or hd<>request->>'expectedHistoryDigest'then return jsonb_build_object('status','rejected','code','history_changed');end if;
 if revision_value>=4 then return jsonb_build_object('status','rejected','code','evidence_complete_or_review_required');end if;
 select array_agg(p.id order by p.id)filter(where r.scorecard_type='digital'),array_agg(case when p.id=g.side_a_participant_id then'a'else'b'end order by p.id)filter(where r.scorecard_type='paper')
 into digital,paper_sides from app.event_participants p join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
 where p.id in(g.side_a_participant_id,g.side_b_participant_id)and p.event_id=eid;
 select p.id into actor_own from app.event_participants p join app.roster_account_links l on l.tournament_id=p.tournament_id and l.roster_entry_id=p.roster_entry_id and l.profile_id=p.profile_id
 where p.id=any(digital)and p.profile_id=actor and p.event_id=eid;
 select value into capture from jsonb_array_elements(history)x where x->>'action'='paper-capture';
 select value into review from jsonb_array_elements(history)x where x->>'action'='paper-review';
 select coalesce(jsonb_agg(x),'[]')into submissions from jsonb_array_elements(history)x where x->>'action'='digital-submit';
 select coalesce(jsonb_agg(v),'[]')into results from(
  select x->'result'v from jsonb_array_elements(submissions)x
  union all select x->'result'from jsonb_array_elements(coalesce(capture->'claims','[]'))x)y;
 if(select count(distinct v)from jsonb_array_elements(results)v)>1 then return jsonb_build_object('status','rejected','code','mismatch_requires_review');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor for share nowait;
 select coalesce(jsonb_agg(role order by role),'[]')into roles from app.tournament_roles where tournament_id=tid and profile_id=actor;
 authority:=jsonb_build_object('subjectId',actor,'sessionId',auth.jwt()->>'session_id','roles',roles);
 if action_value in('digital-submit','digital-confirm')then
  if actor_own is null or actor_own::text<>payload->>'participantId'then return jsonb_build_object('status','rejected','code','own_digital_side_required');end if;
  if app.native_mixed_game_play_order_with_start_v1(tid,eid,verified_start,gid,actor_own)is distinct from'current'then return jsonb_build_object('status','rejected','code','prior_game_incomplete');end if;
  if action_value='digital-submit'then
   if exists(select 1 from jsonb_array_elements(submissions)x where x->>'participantId'=actor_own::text)
    or exists(select 1 from jsonb_array_elements(history)x where x->>'action'='digital-confirm')then return jsonb_build_object('status','rejected','code','evidence_complete_or_review_required');end if;
  else
   if jsonb_array_length(submissions)<>cardinality(digital)or(coalesce(cardinality(paper_sides),0)>0 and review is null)
    or exists(select 1 from jsonb_array_elements(history)x where x->>'action'='digital-confirm'and x->>'participantId'=actor_own::text)
    or jsonb_array_length(results)=0 or payload->'result'is distinct from results->0
   then return jsonb_build_object('status','rejected','code','exact_confirmation_required');end if;
   select jsonb_agg(to_jsonb(x->>'id')order by x->>'id')into refs from jsonb_array_elements(history)x where x->>'action'in('digital-submit','paper-capture','paper-review');
   if refs is distinct from(select jsonb_agg(x order by x#>>'{}')from jsonb_array_elements(payload->'references')x)then return jsonb_build_object('status','rejected','code','exact_confirmation_required');end if;
  end if;
 else
  if coalesce(cardinality(paper_sides),0)=0 or actor_own is not null
   or app.paper_official_identity_is_current_valid(actor,tid)is distinct from true or app.paper_official_is_independent(actor,tid,gid)is distinct from true
  then return jsonb_build_object('status','rejected','code','independent_official_required');end if;
  authority:=authority||jsonb_build_object('paperIdentityChecked',true,'nonselfChecked',true,'paperIdentityBindingId',
   (select id from app.paper_official_identity_bindings where tournament_id=tid and official_profile_id=actor order by binding_version desc limit 1));
  if action_value='paper-capture'then
   if not(roles?'cross_checker')or capture is not null or jsonb_array_length(payload->'claims')<>cardinality(paper_sides)
    or exists(select 1 from jsonb_array_elements(payload->'claims')x where not(x->>'side'=any(paper_sides)))
   then return jsonb_build_object('status','rejected','code','paper_capture_required');end if;
   artifact:=jsonb_build_object('kind','native-mixed-fictional-paper-v1','tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,
    'claims',payload->'claims','physicalOriginal',false,'fictionalOpponentPlayed',false,'independentHumanPlayClaimed',false);
   artifact_digest:=app.native_mixed_simulation_hash_v1(artifact);payload:=payload||jsonb_build_object('artifactDigest',artifact_digest);
  else
   if not(roles?|array['director','co_director','cross_checker'])or capture is null or review is not null
    or capture->>'actorId'=actor::text or payload->>'captureId'<>capture->>'id'
    or payload->>'artifactId'<>capture->>'artifactId'or payload->>'artifactDigest'<>capture->>'artifactDigest'
    or(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(payload->'reenteredClaims')x)
     is distinct from(select jsonb_agg(x order by x->>'side')from jsonb_array_elements(capture->'claims')x)
   then return jsonb_build_object('status','rejected','code','independent_paper_review_required');end if;
  end if;
 end if;
 body:=jsonb_build_object('id',idv,'operationId',op,'receiptId',receipt_id,'sequence',revision_value+1,'actorId',actor,
 'tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,'startSourceDigest',start_digest,'action',action_value)||payload;
 entry_value:=body||jsonb_build_object('payloadDigest',app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-evidence-v1',body,authority)));
 select idv,tid,eid,sid,gid,revision_value+1,actor,op,receipt_id,request,entry_value,authority,clock_timestamp()into e;
 history:=history||jsonb_build_array(entry_value);hd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-history-v1',sid,gid,start_digest,history));
 response:=app.native_mixed_game_receipt_v1(e,hd);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(receipt_id,tid,actor,'native_mixed_simulation_game_evidence_v1',idv,request_hash,op,'accepted',response,clock_timestamp());
 if action_value='paper-capture'then
  insert into app.native_mixed_game_artifacts_v1(id,tournament_id,event_id,start_id,game_id,creator_id,operation_receipt_id,body,sha256)
  values((payload->>'artifactId')::uuid,tid,eid,sid,gid,actor,receipt_id,artifact,artifact_digest);end if;
 insert into app.native_mixed_game_evidence_v1 select(e).*;
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,receipt_id,'native_mixed_simulation_game_evidence',idv,'simulation_game_evidence_recorded',response);
 if app.native_mixed_game_entry_bound_with_start_v1(idv,verified_start)is distinct from true then raise exception'simulation evidence postcondition failed';end if;
 return response;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.get_native_mixed_simulation_game_operation_v1(tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$declare actor uuid;e app.native_mixed_game_evidence_v1%rowtype;r app.operation_receipts%rowtype;begin
 if app.native_mixed_game_recovery_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','recovery_unavailable');end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null or app.native_mixed_game_request_valid_v1(request)is distinct from true then return null;end if;
 select*into r from app.operation_receipts where tournament_id=tid and actor_profile_id=actor and client_operation_id=(request->>'operationId')::uuid;
 if not found then return null;end if;
 if r.operation_type='native_mixed_game_closed_v1'then return app.native_mixed_game_closed_receipt_v1(r,actor,tid,eid,request);end if;
 select*into e from app.native_mixed_game_evidence_v1 where operation_receipt_id=r.id and actor_id=actor and tournament_id=tid and event_id=eid and request_payload=request;
 if not found or app.native_mixed_game_entry_bound_v1(e.id)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 return r.response_payload||jsonb_build_object('historicalReceipt',true,'currentSourceVerified',false);end$$;

create function app.get_native_mixed_simulation_game_state_v1(tid uuid,eid uuid,sid uuid,gid uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$declare verified_start app.native_mixed_simulation_starts_v1%rowtype;actor uuid;root jsonb;g app.canonical_games%rowtype;h jsonb;hd text;row_value record;blind boolean;private_start_key uuid;own_participant uuid;play_order text;begin
 if app.native_mixed_game_writer_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null then return null;end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);if root is null then return jsonb_build_object('status','blocked','code','source_changed');end if;
 select*into verified_start from app.native_mixed_simulation_starts_v1 where id=sid and tournament_id=tid and event_id=eid;
 select*into g from app.canonical_games where id=gid and tournament_id=tid and event_id=eid;if not found then return null;end if;
 if not exists(select 1 from app.event_participants where id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor)
  and not(exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director','cross_checker'))and app.paper_official_identity_is_current_valid(actor,tid)and app.paper_official_is_independent(actor,tid,gid))then return null;end if;
 lock table app.native_mixed_game_evidence_v1 in share mode nowait;
 for row_value in select id from app.native_mixed_game_evidence_v1 where start_id=sid and game_id=gid loop
  if app.native_mixed_game_entry_bound_with_start_v1(row_value.id,verified_start)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;end loop;
 select coalesce(jsonb_agg(entry order by sequence),'[]')into h from app.native_mixed_game_evidence_v1 where start_id=sid and game_id=gid;
 hd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-history-v1',sid,gid,root->>'startSourceDigest',h));
 select id into own_participant from app.event_participants where event_id=eid and id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor;
 play_order:=case when own_participant is null then'official'else app.native_mixed_game_play_order_with_start_v1(tid,eid,verified_start,gid,own_participant)end;
 if play_order is null then return null;end if;
 -- A participating Digital official is still blind until their own submission.
 -- Revision/digest permit CAS without revealing another person's score.
 blind:=exists(select 1 from app.event_participants where id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor)
  and not exists(select 1 from app.native_mixed_game_evidence_v1 where start_id=sid and game_id=gid and actor_id=actor and entry->>'action'='digital-submit');
 -- Paper preparers cannot copy a prior Digital result either. Once a capture
 -- exists, a nonplaying reviewer needs it for the separate review action.
 blind:=blind or(not exists(select 1 from app.event_participants where id in(g.side_a_participant_id,g.side_b_participant_id)and profile_id=actor)
  and not exists(select 1 from app.native_mixed_game_evidence_v1 where start_id=sid and game_id=gid and entry->>'action'='paper-capture'));
 -- Display DTOs never disclose another account UUID, including to Paper officials. Correlation is
 -- needed only inside this game. The private Start receipt is not exposed to
 -- players and keys the HMAC; canonical journal/hash/own receipt stay unchanged.
 -- Canonical raw journal, digest and owned receipts are unchanged.
 select operation_receipt_id into private_start_key from app.native_mixed_simulation_starts_v1 where id=sid;
  if private_start_key is null then return null;end if;
  select coalesce(jsonb_agg(case when x->>'actorId'=actor::text then x else
   jsonb_set(x,'{actorId}',to_jsonb(substr(encode(extensions.hmac(sid::text||':'||gid::text||':'||(x->>'actorId'),private_start_key::text,'sha256'),'hex'),1,32)::uuid))end order by(x->>'sequence')::integer),'[]')into h from jsonb_array_elements(h)x;
 return jsonb_build_object('kind','native-mixed-simulation-game-state-v1','playOrder',play_order,'actorId',actor,'tournamentId',tid,'eventId',eid,'startId',sid,'gameId',gid,
 'startSourceDigest',root->>'startSourceDigest','revision',jsonb_array_length(h),'historyDigest',hd,'evidenceVisibility',case when blind then 'metadata-only'else 'evidence'end,'entries',case when blind then '[]'::jsonb else h end,'currentSourceVerified',true,
 'simulationOnly',true,'ordinaryScoreWritten',false,'normalStartAuthorized',false,'scoringAuthorized',false,'officialResultVerified',false,'humanPlayVerified',false,'moneyMoved',false,'payoutAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

-- Explicit own-operation resolution. A null read is never permission to
-- discard pending work. Locks fence all delayed scoring calls with this nonce.
create function app.resolve_native_mixed_game_operation_v1(tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid;op uuid;sid uuid;gid uuid;r app.operation_receipts%rowtype;root jsonb;history jsonb;hd text;reason_value text;v jsonb;rid uuid:=extensions.gen_random_uuid();row_value record;
begin
 if app.native_mixed_game_writer_enabled_v1()is distinct from true or app.native_mixed_game_recovery_enabled_v1()is distinct from true then return null;end if;
 actor:=app.native_mixed_game_own_subject_v1();if actor is null or current_setting('transaction_isolation')<>'read committed'or app.native_mixed_game_request_valid_v1(request)is distinct from true then return null;end if;
 op:=(request->>'operationId')::uuid;sid:=(request->>'startId')::uuid;gid:=(request->>'gameId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))
  or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-game:'||sid::text||':'||gid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 select*into r from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then
  if r.operation_type='native_mixed_game_closed_v1'then return app.native_mixed_game_closed_receipt_v1(r,actor,tid,eid,request);end if;
  return app.get_native_mixed_simulation_game_operation_v1(tid,eid,request);
 end if;
 -- Even after consent/source revocation, resolving one's nonce is not a new
 -- scoring permission. Scope must still be a bound private Start/game and own
 -- Digital side, or a current independently bound Paper official.
 if not exists(select 1 from app.native_mixed_simulation_starts_v1 st where st.id=sid and st.tournament_id=tid and st.event_id=eid
   and st.source_digest=request->>'expectedStartSourceDigest'and app.native_mixed_simulation_start_bound_v1(st.id)
   and exists(select 1 from jsonb_array_elements(st.source_capture->'canonicalGames')x where x->>'gameId'=gid::text))
  or not exists(select 1 from app.canonical_games g where g.id=gid and g.tournament_id=tid and g.event_id=eid
   and (request->>'action'in('digital-submit','digital-confirm')and exists(select 1 from app.event_participants p where p.id in(g.side_a_participant_id,g.side_b_participant_id)and p.event_id=eid and p.profile_id=actor and p.id::text=request#>>'{payload,participantId}')
    or request->>'action'in('paper-capture','paper-review')and app.paper_official_identity_is_current_valid(actor,tid)and app.paper_official_is_independent(actor,tid,gid)
     and exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director','cross_checker'))))
 then return jsonb_build_object('status','blocked','code','resolution_scope_unavailable');end if;
 lock table app.native_mixed_game_evidence_v1 in share row exclusive mode nowait;
 if exists(select 1 from app.native_mixed_game_evidence_v1 where actor_id=actor and operation_id=op)
  or app.native_mixed_simulation_operation_reserved_v1(actor,op)is true
  or exists(select 1 from app.native_mixed_simulation_cancellations_v1 where actor_id=actor and operation_id=op)
 then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
 root:=app.native_mixed_game_root_current_v1(sid,tid,eid);
 if root is null then
  -- Generic unavailability, disabled prerequisites or temporary source failure
  -- is NOT a terminal contradiction. Bound own consent revocation is durable.
  if app.native_mixed_simulation_start_enabled_v1()is distinct from true
   or app.native_mixed_simulation_publication_enabled_v1()is distinct from true
   or request->>'action'not in('digital-submit','digital-confirm')then return jsonb_build_object('status','blocked','code','resolution_source_unavailable');end if;
  if not exists(select 1 from app.native_mixed_digital_consent_decisions_v1 c
   join app.native_mixed_attendance_seals_v1 seal on seal.scope_id=c.scope_id
   join app.native_mixed_simulation_starts_v1 st on st.id=sid and st.source_capture#>>'{attendance,sealId}'=seal.id::text
   where c.tournament_id=tid and c.event_id=eid and c.profile_id=actor and c.participant_id::text=request#>>'{payload,participantId}'and c.decision='revoked'
    and app.native_mixed_attendance_consent_bound_v1(c.id)
    and not exists(select 1 from app.native_mixed_digital_consent_decisions_v1 newer where newer.scope_id=c.scope_id and newer.profile_id=c.profile_id and newer.version>c.version))
   then return jsonb_build_object('status','blocked','code','resolution_source_unavailable');end if;
  reason_value:='source_changed';
 else
  for row_value in select id from app.native_mixed_game_evidence_v1 where start_id=sid and game_id=gid loop
   if app.native_mixed_game_entry_bound_v1(row_value.id)is distinct from true then return jsonb_build_object('status','blocked','code','operation_history_unavailable');end if;
  end loop;
  select coalesce(jsonb_agg(entry order by sequence),'[]')into history from app.native_mixed_game_evidence_v1 where start_id=sid and game_id=gid;
  hd:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-game-history-v1',sid,gid,root->>'startSourceDigest',history));
  if jsonb_array_length(history)<>(request->>'expectedRevision')::integer or hd<>request->>'expectedHistoryDigest'then reason_value:='history_changed';end if;
 end if;
 if reason_value is null then return jsonb_build_object('status','blocked','code','resolution_not_terminal');end if;
 v:=jsonb_build_object('kind','native-mixed-game-closed-v1','status','closed','code','terminal_operation_closed','actorId',actor,'tournamentId',tid,'eventId',eid,
  'operationId',op,'request',request,'closureId',rid,'reason',reason_value,'simulationOnly',true,'noWriteCommitted',true,
  'ordinaryScoreWritten',false,'normalStartAuthorized',false,'scoringAuthorized',false,'officialResultVerified',false,'humanPlayVerified',false,'moneyMoved',false,'payoutAuthorized',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(rid,tid,actor,'native_mixed_game_closed_v1',gid,app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-game-write-v1',actor,tid,eid,request)),op,'accepted',v,clock_timestamp());
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,rid,'native_mixed_game_closed',rid,'terminal_request_closed',v);
 select*into r from app.operation_receipts where id=rid;
 if app.native_mixed_game_closed_receipt_v1(r,actor,tid,eid,request)is distinct from v then raise exception'closure postcondition failed';end if;
 return v;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function public.resolve_native_mixed_game_operation_v1(p_tournament_id uuid,p_event_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.native_mixed_game_transport_enabled_v1()is distinct from true then return null;end if;
 return app.resolve_native_mixed_game_operation_v1(p_tournament_id,p_event_id,p_request);end$$;

-- Own-subject public signatures remain REVOKED even from authenticated.
-- A future reviewed grant is separate from implementation and local testing.
create function public.record_native_mixed_simulation_game_evidence_v1(p_tournament_id uuid,p_event_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.native_mixed_game_transport_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 return app.append_native_mixed_simulation_game_evidence_v1(p_tournament_id,p_event_id,p_request);end$$;
create function public.get_native_mixed_simulation_game_operation_v1(p_tournament_id uuid,p_event_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.native_mixed_game_transport_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','recovery_unavailable');end if;
 return app.get_native_mixed_simulation_game_operation_v1(p_tournament_id,p_event_id,p_request);end$$;
create function public.get_native_mixed_simulation_game_state_v1(p_tournament_id uuid,p_event_id uuid,p_start_id uuid,p_game_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$begin
 if app.native_mixed_game_transport_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 return app.get_native_mixed_simulation_game_state_v1(p_tournament_id,p_event_id,p_start_id,p_game_id);end$$;

do $$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_game_writer_enabled_v1()'::regprocedure,'app.native_mixed_game_transport_enabled_v1()'::regprocedure,'app.native_mixed_game_recovery_enabled_v1()'::regprocedure,
 'app.native_mixed_game_exact_v1(jsonb,text[])'::regprocedure,'app.native_mixed_game_result_valid_v1(jsonb)'::regprocedure,'app.native_mixed_game_request_valid_v1(jsonb)'::regprocedure,
 'app.native_mixed_game_entry_bound_with_start_v1(uuid,app.native_mixed_simulation_starts_v1)'::regprocedure,'app.native_mixed_game_complete_with_start_v1(uuid,uuid,app.native_mixed_simulation_starts_v1,uuid)'::regprocedure,'app.native_mixed_game_play_order_with_start_v1(uuid,uuid,app.native_mixed_simulation_starts_v1,uuid,uuid)'::regprocedure,
 'app.native_mixed_game_complete_v1(uuid,uuid,uuid,uuid)'::regprocedure,'app.native_mixed_game_play_order_v1(uuid,uuid,uuid,uuid,uuid)'::regprocedure,
 'app.native_mixed_game_closed_receipt_v1(app.operation_receipts,uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.resolve_native_mixed_game_operation_v1(uuid,uuid,jsonb)'::regprocedure,'public.resolve_native_mixed_game_operation_v1(uuid,uuid,jsonb)'::regprocedure,
 'app.native_mixed_game_root_current_v1(uuid,uuid,uuid)'::regprocedure,'app.native_mixed_game_own_subject_v1()'::regprocedure,
 'app.native_mixed_game_receipt_v1(app.native_mixed_game_evidence_v1,text)'::regprocedure,'app.native_mixed_game_entry_bound_v1(uuid)'::regprocedure,
 'app.append_native_mixed_simulation_game_evidence_v1(uuid,uuid,jsonb)'::regprocedure,'app.get_native_mixed_simulation_game_operation_v1(uuid,uuid,jsonb)'::regprocedure,
 'app.get_native_mixed_simulation_game_state_v1(uuid,uuid,uuid,uuid)'::regprocedure,
 'public.record_native_mixed_simulation_game_evidence_v1(uuid,uuid,jsonb)'::regprocedure,'public.get_native_mixed_simulation_game_operation_v1(uuid,uuid,jsonb)'::regprocedure,
 'public.get_native_mixed_simulation_game_state_v1(uuid,uuid,uuid,uuid)'::regprocedure
 ]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$$;
commit;
