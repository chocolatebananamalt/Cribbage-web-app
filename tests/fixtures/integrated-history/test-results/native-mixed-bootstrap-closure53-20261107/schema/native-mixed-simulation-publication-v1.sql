-- LOCAL, UNEXECUTED, DEFAULT-OFF CANDIDATE.
--
-- TEST ONLY 6 Digital / 12 fictional Paper draw and native publication branch.
-- It consumes a current sealed native-mixed-attendance-v1 source without
-- changing ordinary roster/event attendance, payment or Start state. Native
-- seating and the 108-game canonical graph receive distinct receipt types and
-- mandatory immutable sidecars; they are never labelled CSV/direct-entry.
begin;

create function app.native_mixed_simulation_publication_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create table app.native_mixed_simulation_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,action text not null check(action in('plan','draw','review','publish')),
 request_payload jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 unique(actor_id,operation_id,tournament_id,event_id),foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
  'native-mixed-simulation-publication-v1',action,actor_id,operation_id,tournament_id,event_id,request_payload
 )::text,'utf8'),'sha256'),'hex'))
);
create table app.native_mixed_simulation_outcomes_v1(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_simulation_operations_v1(actor_id,operation_id,tournament_id,event_id)
);
create table app.native_mixed_simulation_plans_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 version integer not null default 1 check(version=1),actor_id uuid not null,operation_id uuid not null,
 attendance_seal_id uuid not null,attendance_source_digest text not null check(attendance_source_digest~'^[a-f0-9]{64}$'),
 attendance_capture jsonb not null,roster_snapshot jsonb not null,config jsonb not null,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id),unique(actor_id,operation_id),unique(id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(attendance_seal_id,tournament_id,event_id)references app.native_mixed_attendance_seals_v1(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_simulation_operations_v1(actor_id,operation_id,tournament_id,event_id)
);
create table app.native_mixed_simulation_draws_v1(
 id uuid primary key default extensions.gen_random_uuid(),plan_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 actor_id uuid not null,operation_id uuid not null,candidate jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),unique(plan_id),unique(actor_id,operation_id),unique(id,tournament_id,event_id),
 foreign key(plan_id,tournament_id,event_id)references app.native_mixed_simulation_plans_v1(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_simulation_operations_v1(actor_id,operation_id,tournament_id,event_id)
);
create table app.native_mixed_simulation_reviews_v1(
 id uuid primary key default extensions.gen_random_uuid(),plan_id uuid not null,draw_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,actor_id uuid not null,operation_id uuid not null,
 decision text not null check(decision='accepted-test-simulation-only'),review_capture jsonb not null,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 unique(draw_id),unique(actor_id,operation_id),unique(id,tournament_id,event_id),
 foreign key(plan_id,tournament_id,event_id)references app.native_mixed_simulation_plans_v1(id,tournament_id,event_id),
 foreign key(draw_id,tournament_id,event_id)references app.native_mixed_simulation_draws_v1(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_simulation_operations_v1(actor_id,operation_id,tournament_id,event_id)
);
create table app.native_mixed_simulation_publication_contexts_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 actor_id uuid not null,operation_id uuid not null,plan_id uuid not null,draw_id uuid not null,review_id uuid not null,
 attendance_seal_id uuid not null,attendance_source_digest text not null check(attendance_source_digest~'^[a-f0-9]{64}$'),
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),backend_pid integer not null,transaction_id bigint not null,
 seating_operation_id uuid not null,schedule_operation_id uuid not null,seating_receipt_id uuid not null,schedule_receipt_id uuid not null,
 seating_publication_id uuid not null,schedule_publication_id uuid not null,source_capture jsonb not null,
 created_at timestamptz not null default clock_timestamp(),unique(tournament_id,event_id),unique(actor_id,operation_id),
 unique(seating_receipt_id),unique(schedule_receipt_id),unique(seating_publication_id),unique(schedule_publication_id),
 unique(id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(plan_id,tournament_id,event_id)references app.native_mixed_simulation_plans_v1(id,tournament_id,event_id),
 foreign key(draw_id,tournament_id,event_id)references app.native_mixed_simulation_draws_v1(id,tournament_id,event_id),
 foreign key(review_id,tournament_id,event_id)references app.native_mixed_simulation_reviews_v1(id,tournament_id,event_id),
 foreign key(attendance_seal_id,tournament_id,event_id)references app.native_mixed_attendance_seals_v1(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_simulation_operations_v1(actor_id,operation_id,tournament_id,event_id),
 foreign key(seating_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 foreign key(schedule_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 foreign key(seating_publication_id,tournament_id)references app.initial_seating_publications(id,tournament_id),
 foreign key(schedule_publication_id,tournament_id,event_id)references app.event_schedule_publications(id,tournament_id,event_id)
);
create table app.native_mixed_simulation_seating_sidecars_v1(
 context_id uuid primary key,tournament_id uuid not null,event_id uuid not null,publication_id uuid not null,receipt_id uuid not null,
 assignments_capture jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_simulation_publication_contexts_v1(id,tournament_id,event_id),
 foreign key(publication_id,tournament_id)references app.initial_seating_publications(id,tournament_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id)
);
create table app.native_mixed_simulation_schedule_sidecars_v1(
 context_id uuid primary key,tournament_id uuid not null,event_id uuid not null,publication_id uuid not null,receipt_id uuid not null,
 games_capture jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 foreign key(context_id,tournament_id,event_id)references app.native_mixed_simulation_publication_contexts_v1(id,tournament_id,event_id),
 foreign key(publication_id,tournament_id,event_id)references app.event_schedule_publications(id,tournament_id,event_id),
 foreign key(receipt_id,tournament_id)references app.operation_receipts(id,tournament_id)
);

do $$declare n text;begin foreach n in array array[
 'native_mixed_simulation_operations_v1','native_mixed_simulation_outcomes_v1','native_mixed_simulation_plans_v1',
 'native_mixed_simulation_draws_v1','native_mixed_simulation_reviews_v1','native_mixed_simulation_publication_contexts_v1',
 'native_mixed_simulation_seating_sidecars_v1','native_mixed_simulation_schedule_sidecars_v1'
]loop execute format('alter table app.%I owner to postgres',n);execute format('alter table app.%I enable row level security',n);
 execute format('alter table app.%I force row level security',n);execute format('revoke all on table app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;

-- Add a truthful source discriminator. Ordinary writers still emit only their
-- existing director_csv/director_entry values.
alter table app.event_schedule_publications drop constraint event_schedule_publications_source_method_check;
alter table app.event_schedule_publications add constraint event_schedule_publications_source_method_check
 check(source_method in('director_csv','director_entry','native_mixed_simulation_v1'));

create function app.native_mixed_simulation_uuid_v1(v text)returns boolean
language sql immutable set search_path=''as $$select coalesce(v,'')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'$$;
create function app.native_mixed_simulation_reason_v1(v jsonb,k text)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v->k)='string'and v->>k=trim(v->>k)
 and length(v->>k)between 1 and 500 and(v->>k)!~'[[:cntrl:]]'$$;
create function app.native_mixed_simulation_hash_v1(v jsonb)returns text
language sql immutable set search_path=''as $$select encode(extensions.digest(convert_to(v::text,'utf8'),'sha256'),'hex')$$;

create function app.native_mixed_simulation_plan_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array['config','expectedAttendanceSealId','expectedAttendanceSourceDigest','kind','operationId','reason']
 and v->>'kind'='native-mixed-simulation-plan-v1'and app.native_mixed_simulation_uuid_v1(v->>'operationId')
 and app.native_mixed_simulation_uuid_v1(v->>'expectedAttendanceSealId')
 and coalesce(v->>'expectedAttendanceSourceDigest','')~'^[a-f0-9]{64}$'and app.native_mixed_simulation_reason_v1(v,'reason')$$;
create function app.native_mixed_simulation_draw_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array['expectedAttendanceSourceDigest','expectedPlanDigest','kind','operationId','planId','reason']
 and v->>'kind'='native-mixed-simulation-draw-v1'and app.native_mixed_simulation_uuid_v1(v->>'operationId')
 and app.native_mixed_simulation_uuid_v1(v->>'planId')and coalesce(v->>'expectedPlanDigest','')~'^[a-f0-9]{64}$'
 and coalesce(v->>'expectedAttendanceSourceDigest','')~'^[a-f0-9]{64}$'and app.native_mixed_simulation_reason_v1(v,'reason')$$;
create function app.native_mixed_simulation_review_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array['decision','drawId','expectedAttendanceSourceDigest','expectedDrawDigest','fictionalPaperAcknowledged','humanPresenceNotVerified','kind','operationId','reason','simulationLayoutReviewed']
 and v->>'kind'='native-mixed-simulation-review-v1'and app.native_mixed_simulation_uuid_v1(v->>'operationId')
 and app.native_mixed_simulation_uuid_v1(v->>'drawId')and coalesce(v->>'expectedDrawDigest','')~'^[a-f0-9]{64}$'
 and coalesce(v->>'expectedAttendanceSourceDigest','')~'^[a-f0-9]{64}$'
 and v->>'decision'='accepted-test-simulation-only'and v->'humanPresenceNotVerified'='true'::jsonb
 and v->'simulationLayoutReviewed'='true'::jsonb and v->'fictionalPaperAcknowledged'='true'::jsonb
 and app.native_mixed_simulation_reason_v1(v,'reason')$$;
create function app.native_mixed_simulation_publish_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array['expectedAttendanceSourceDigest','expectedReviewDigest','kind','operationId','reason','reviewId','scheduleOperationId','seatingOperationId']
 and v->>'kind'='native-mixed-simulation-publish-v1'and app.native_mixed_simulation_uuid_v1(v->>'operationId')
 and app.native_mixed_simulation_uuid_v1(v->>'reviewId')and app.native_mixed_simulation_uuid_v1(v->>'seatingOperationId')
 and app.native_mixed_simulation_uuid_v1(v->>'scheduleOperationId')and v->>'operationId'<>v->>'seatingOperationId'
 and v->>'operationId'<>v->>'scheduleOperationId'and v->>'seatingOperationId'<>v->>'scheduleOperationId'
 and coalesce(v->>'expectedReviewDigest','')~'^[a-f0-9]{64}$'
 and coalesce(v->>'expectedAttendanceSourceDigest','')~'^[a-f0-9]{64}$'and app.native_mixed_simulation_reason_v1(v,'reason')$$;

create function app.lock_native_mixed_simulation_sources_v1()returns void
language plpgsql security definer set search_path=''as $$begin
 perform app.lock_native_mixed_attendance_sources_v1();
 lock table app.native_mixed_simulation_operations_v1,app.native_mixed_simulation_outcomes_v1,
  app.native_mixed_simulation_plans_v1,app.native_mixed_simulation_draws_v1,app.native_mixed_simulation_reviews_v1,
  app.native_mixed_simulation_publication_contexts_v1,app.native_mixed_simulation_seating_sidecars_v1,
  app.native_mixed_simulation_schedule_sidecars_v1,app.operation_receipts,app.initial_seating_publications,
  app.initial_seating_assignments,app.event_schedule_publications,app.event_schedule_games,app.rounds,app.canonical_games,
  app.event_participants,app.roster_check_in_events,app.event_participant_status_events,
  app.event_check_in_windows,app.event_check_in_events,app.event_check_in_requests,app.audit_events in share mode nowait;
end$$;

create function app.native_mixed_simulation_lifecycle_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$declare a jsonb;e app.events%rowtype;t app.tournaments%rowtype;begin
 a:=app.native_mixed_attendance_source_v1(actor,tid,eid);select*into t from app.tournaments where id=tid;select*into e from app.events where id=eid and tournament_id=tid;
 if a->>'status'<>'source_available'then return jsonb_build_object('status','blocked','code',coalesce(a->>'code','attendance_source_changed'));end if;
 if t.id is null or e.id is null or t.name not like'TEST ONLY%'or t.status<>'open'or t.registration_status<>'closed'or e.operational_state<>'active'or e.event_type<>'main'
  or e.format<>'standard_singles'or e.scoring_method<>'digital'
  or not exists(select 1 from app.tournament_setup_activations x join app.tournament_setup_event_versions s on s.id=x.setup_event_version_id
   where x.tournament_id=tid and x.event_id=eid and s.event_kind='main'and s.style_code='Standard'and s.game_count=12)
  or(select count(*)from app.event_participants p where p.tournament_id=tid and p.event_id=eid)<>18
  or exists(select 1 from app.event_participants p where p.tournament_id=tid and p.event_id=eid and p.status<>'registered')
  or exists(select 1 from app.roster_check_in_events x where x.tournament_id=tid)
  or exists(select 1 from app.event_participant_status_events x where x.tournament_id=tid and x.event_id=eid)
  or exists(select 1 from app.event_check_in_windows x where x.tournament_id=tid and x.event_id=eid)
  or exists(select 1 from app.event_check_in_events x where x.tournament_id=tid and x.event_id=eid)
  or exists(select 1 from app.event_check_in_requests x where x.tournament_id=tid and x.event_id=eid)
  or exists(select 1 from app.event_play_starts where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.qualification_result_versions where tournament_id=tid and event_id=eid)
 then return jsonb_build_object('status','blocked','code','simulation_lifecycle_unavailable');end if;
 return a;
end$$;

create function app.native_mixed_simulation_snapshot_v1(attendance jsonb)returns jsonb
language sql immutable set search_path=''as $$select jsonb_build_object('status','open','registrationStatus','closed','roster',(
 select jsonb_agg(jsonb_build_object('rosterEntryId',x.value->>'rosterEntryId','state','sim_ready')order by x.value->>'rosterEntryId')
 from(select value from jsonb_array_elements(attendance->'digitalConsents')union all
  select value from jsonb_array_elements(attendance#>'{paperDeclaration,entries}'))x))$$;

create function app.native_mixed_simulation_operation_reserved_v1(actor uuid,op uuid)returns boolean
language sql stable security definer set search_path=''as $$select
 app.native_mixed_attendance_operation_reserved_v1(actor,op)is true
 or exists(select 1 from app.native_mixed_simulation_operations_v1 where actor_id=actor and operation_id=op)$$;

create function app.reject_native_mixed_simulation_operation_reuse_v1()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from app.native_mixed_simulation_operations_v1 x
  where x.actor_id=new.actor_id and x.operation_id=new.operation_id)
 then raise exception using errcode='P0001',message='operation id reserved by native mixed simulation';end if;
 return new;
end$$;
create trigger native_mixed_admission_simulation_operation_guard_v1 before insert on app.native_mixed_admission_operations_v1
 for each row execute function app.reject_native_mixed_simulation_operation_reuse_v1();
create trigger native_mixed_funding_simulation_operation_guard_v1 before insert on app.native_mixed_funding_operations_v1
 for each row execute function app.reject_native_mixed_simulation_operation_reuse_v1();
create trigger native_mixed_attendance_simulation_operation_guard_v1 before insert on app.native_mixed_attendance_operations_v1
 for each row execute function app.reject_native_mixed_simulation_operation_reuse_v1();

create function app.native_mixed_simulation_insert_operation_v1(actor uuid,op uuid,tid uuid,eid uuid,action_value text,request jsonb)returns boolean
language plpgsql security definer set search_path=''as $$declare h text;begin
 if app.native_mixed_simulation_operation_reserved_v1(actor,op)then return false;end if;
 h:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-publication-v1',action_value,actor,op,tid,eid,request));
 insert into app.native_mixed_simulation_operations_v1 values(actor,op,tid,eid,action_value,request,h,clock_timestamp());return true;
end$$;

create function app.native_mixed_simulation_operation_bound_v1(actor uuid,op uuid,action_value text)returns boolean
language sql stable security definer set search_path=''as $$select exists(
 select 1 from app.native_mixed_simulation_operations_v1 o join app.native_mixed_simulation_outcomes_v1 x
  on x.actor_id=o.actor_id and x.operation_id=o.operation_id
 where o.actor_id=actor and o.operation_id=op and o.action=action_value
  and x.tournament_id=o.tournament_id and x.event_id=o.event_id
  and x.result->>'kind'='native-mixed-simulation-receipt-v1'and x.result->>'action'=action_value and x.result->>'status'='accepted'
  and(x.result->>'actorId')::uuid=o.actor_id and(x.result->>'tournamentId')::uuid=o.tournament_id
  and(x.result->>'eventId')::uuid=o.event_id and(x.result->>'operationId')::uuid=o.operation_id
  and x.result->'request'is not distinct from o.request_payload
)$$;

create function app.native_mixed_simulation_plan_bound_v1(plan_value uuid)returns boolean
language sql stable security definer set search_path=''as $$select exists(
 select 1 from app.native_mixed_simulation_plans_v1 p where p.id=plan_value
  and app.native_mixed_simulation_operation_bound_v1(p.actor_id,p.operation_id,'plan')is true
  and p.attendance_capture->>'status'='source_available'and(p.attendance_capture->>'sealId')::uuid=p.attendance_seal_id
  and p.attendance_capture->>'sourceDigest'=p.attendance_source_digest
  and not(p.attendance_capture?'actorId')
  and p.roster_snapshot=app.native_mixed_simulation_snapshot_v1(p.attendance_capture)
  and p.source_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array(
   'native-mixed-simulation-plan-source-v1',p.tournament_id,p.event_id,p.attendance_source_digest,p.roster_snapshot,p.config))
  and exists(select 1 from app.native_mixed_simulation_outcomes_v1 x where x.actor_id=p.actor_id and x.operation_id=p.operation_id
   and(x.result->>'planId')::uuid=p.id and x.result->>'sourceDigest'=p.source_digest)
)$$;
create function app.native_mixed_simulation_draw_bound_v1(draw_value uuid)returns boolean
language sql stable security definer set search_path=''as $$select exists(
 select 1 from app.native_mixed_simulation_draws_v1 d join app.native_mixed_simulation_plans_v1 p on p.id=d.plan_id
 where d.id=draw_value and app.native_mixed_simulation_plan_bound_v1(p.id)is true
  and app.native_mixed_simulation_operation_bound_v1(d.actor_id,d.operation_id,'draw')is true
  and d.source_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-draw-source-v1',p.source_digest,d.candidate))
  and app.reviewed_candidate_a18_valid_v1(p.config,p.roster_snapshot,d.candidate)is true
  and exists(select 1 from app.native_mixed_simulation_outcomes_v1 x where x.actor_id=d.actor_id and x.operation_id=d.operation_id
   and(x.result->>'drawId')::uuid=d.id and x.result->'candidate'is not distinct from d.candidate and x.result->>'sourceDigest'=d.source_digest)
)$$;
create function app.native_mixed_simulation_review_bound_v1(review_value uuid)returns boolean
language sql stable security definer set search_path=''as $$select exists(
 select 1 from app.native_mixed_simulation_reviews_v1 r join app.native_mixed_simulation_draws_v1 d on d.id=r.draw_id
 where r.id=review_value and r.plan_id=d.plan_id and app.native_mixed_simulation_draw_bound_v1(d.id)is true
  and app.native_mixed_simulation_operation_bound_v1(r.actor_id,r.operation_id,'review')is true
  and r.source_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array(
   'native-mixed-simulation-review-source-v1',d.source_digest,r.actor_id,r.review_capture))
  and exists(select 1 from app.native_mixed_simulation_outcomes_v1 x where x.actor_id=r.actor_id and x.operation_id=r.operation_id
   and(x.result->>'reviewId')::uuid=r.id and x.result->>'sourceDigest'=r.source_digest
   and x.result->'request'is not distinct from r.review_capture)
)$$;

create function app.save_native_mixed_simulation_plan_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare op uuid;o app.native_mixed_simulation_operations_v1%rowtype;r jsonb;a jsonb;snapshot jsonb;err text;idv uuid:=extensions.gen_random_uuid();digest text;begin
 if app.native_mixed_simulation_publication_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null
  or app.native_mixed_simulation_plan_request_valid_v1(request)is distinct from true then return null;end if;op:=(request->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_simulation_sources_v1();select*into o from app.native_mixed_simulation_operations_v1 where actor_id=actor and operation_id=op;
 if found then if o.action<>'plan'or o.request_payload is distinct from request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;select result into r from app.native_mixed_simulation_outcomes_v1 where actor_id=actor and operation_id=op;return r||jsonb_build_object('currentSourceVerified',false,'historicalReceipt',true);end if;
 if exists(select 1 from app.native_mixed_simulation_plans_v1 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.initial_seating_publications where tournament_id=tid)or exists(select 1 from app.event_schedule_publications where event_id=eid)
  or exists(select 1 from app.rounds where event_id=eid)or exists(select 1 from app.canonical_games where event_id=eid)
 then return jsonb_build_object('status','rejected','code','simulation_already_planned_or_published');end if;
 a:=app.native_mixed_simulation_lifecycle_v1(actor,tid,eid);if a->>'status'<>'source_available'or(a->>'sealId')::uuid<>(request->>'expectedAttendanceSealId')::uuid
  or a->>'sourceDigest'<>request->>'expectedAttendanceSourceDigest'then return jsonb_build_object('status','rejected','code','attendance_source_changed');end if;
 snapshot:=app.native_mixed_simulation_snapshot_v1(a);err:=app.random_seating_config_error_v1(request->'config',snapshot);
 if err is not null or request#>'{config,tables}'is distinct from'[{"tableId":"A","seatCount":18}]'::jsonb
  or request#>'{config,activePairIds}'is distinct from'["A:1-2","A:3-4","A:5-6","A:7-8","A:9-10","A:11-12","A:13-14","A:15-16","A:17-18"]'::jsonb
  or request#>>'{config,anchor,seatId}'<>'A-1'or request#>'{config,anchor,directorApproved}'is distinct from'true'::jsonb
 then return jsonb_build_object('status','rejected','code',coalesce(err,'unsupported_a18_geometry'));end if;
 digest:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-plan-source-v1',tid,eid,a->>'sourceDigest',snapshot,request->'config'));
 if app.native_mixed_simulation_insert_operation_v1(actor,op,tid,eid,'plan',request)is distinct from true then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 insert into app.native_mixed_simulation_plans_v1 values(idv,tid,eid,1,actor,op,(a->>'sealId')::uuid,a->>'sourceDigest',a-'actorId',snapshot,request->'config',digest,clock_timestamp());
 r:=jsonb_build_object('kind','native-mixed-simulation-receipt-v1','action','plan','status','accepted','code','simulation_plan_saved','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'planId',idv,'version',1,'sourceDigest',digest,'normalDrawAuthorized',false,'normalStartAuthorized',false);
 insert into app.native_mixed_simulation_outcomes_v1 values(actor,op,tid,eid,r,clock_timestamp());return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.draw_native_mixed_simulation_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare op uuid;o app.native_mixed_simulation_operations_v1%rowtype;p app.native_mixed_simulation_plans_v1%rowtype;r jsonb;a jsonb;c jsonb;idv uuid:=extensions.gen_random_uuid();digest text;begin
 if app.native_mixed_simulation_publication_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null
  or app.native_mixed_simulation_draw_request_valid_v1(request)is distinct from true then return null;end if;op:=(request->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_simulation_sources_v1();select*into o from app.native_mixed_simulation_operations_v1 where actor_id=actor and operation_id=op;
 if found then if o.action<>'draw'or o.request_payload is distinct from request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;select result into r from app.native_mixed_simulation_outcomes_v1 where actor_id=actor and operation_id=op;return r||jsonb_build_object('currentSourceVerified',false,'historicalReceipt',true);end if;
 if exists(select 1 from app.native_mixed_simulation_operations_v1 where tournament_id=tid and event_id=eid and action='draw')then return jsonb_build_object('status','rejected','code','draw_already_attempted');end if;
 select*into p from app.native_mixed_simulation_plans_v1 where id=(request->>'planId')::uuid and tournament_id=tid and event_id=eid;
 a:=app.native_mixed_simulation_lifecycle_v1(actor,tid,eid);if p.id is null or p.source_digest<>request->>'expectedPlanDigest'
  or p.attendance_source_digest<>request->>'expectedAttendanceSourceDigest'or a->>'sourceDigest'<>p.attendance_source_digest or a-'actorId' is distinct from p.attendance_capture
 then return jsonb_build_object('status','rejected','code','source_or_plan_changed');end if;
 if app.native_mixed_simulation_insert_operation_v1(actor,op,tid,eid,'draw',request)is distinct from true then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 -- A sampler error after the operation insert becomes a terminal committed
 -- attempt. Transaction cancellation/crash before commit is not claimed to
 -- preserve physical entropy outside PostgreSQL transaction durability.
 begin
  c:=app.random_seating_candidate_v1(p.config,p.roster_snapshot);
 exception when others then
  r:=jsonb_build_object('kind','native-mixed-simulation-receipt-v1','action','draw','status','rejected','code','simulation_draw_failed',
   'actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,
   'entropyConsumed',true,'retryWithNewOperationAuthorized',false);
  insert into app.native_mixed_simulation_outcomes_v1 values(actor,op,tid,eid,r,clock_timestamp());return r;
 end;
 if c->>'status'='blocked'then r:=jsonb_build_object('kind','native-mixed-simulation-receipt-v1','action','draw','status','rejected','code','bounded_search_exhausted','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'entropyConsumed',true,'retryWithNewOperationAuthorized',false);
 else digest:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-draw-source-v1',p.source_digest,c));
  insert into app.native_mixed_simulation_draws_v1 values(idv,p.id,tid,eid,actor,op,c,digest,clock_timestamp());
  r:=jsonb_build_object('kind','native-mixed-simulation-receipt-v1','action','draw','status','accepted','code','simulation_draw_recorded','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'drawId',idv,'candidate',c,'sourceDigest',digest,'publishAuthorized',false);
 end if;insert into app.native_mixed_simulation_outcomes_v1 values(actor,op,tid,eid,r,clock_timestamp());return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.review_native_mixed_simulation_draw_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare op uuid;o app.native_mixed_simulation_operations_v1%rowtype;p app.native_mixed_simulation_plans_v1%rowtype;d app.native_mixed_simulation_draws_v1%rowtype;r jsonb;a jsonb;idv uuid:=extensions.gen_random_uuid();digest text;begin
 if app.native_mixed_simulation_publication_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null
  or app.native_mixed_simulation_review_request_valid_v1(request)is distinct from true then return null;end if;op:=(request->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform 1 from app.tournaments where id=tid for update nowait;perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_simulation_sources_v1();select*into o from app.native_mixed_simulation_operations_v1 where actor_id=actor and operation_id=op;
 if found then if o.action<>'review'or o.request_payload is distinct from request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;select result into r from app.native_mixed_simulation_outcomes_v1 where actor_id=actor and operation_id=op;return r||jsonb_build_object('currentSourceVerified',false,'historicalReceipt',true);end if;
 select*into d from app.native_mixed_simulation_draws_v1 where id=(request->>'drawId')::uuid and tournament_id=tid and event_id=eid;select*into p from app.native_mixed_simulation_plans_v1 where id=d.plan_id;
 a:=app.native_mixed_simulation_lifecycle_v1(actor,tid,eid);if d.id is null or d.source_digest<>request->>'expectedDrawDigest'or a->>'sourceDigest'<>request->>'expectedAttendanceSourceDigest'
  or a-'actorId' is distinct from p.attendance_capture or app.reviewed_candidate_a18_valid_v1(p.config,p.roster_snapshot,d.candidate)is distinct from true
 then return jsonb_build_object('status','rejected','code','draw_or_source_changed');end if;
 if exists(select 1 from app.native_mixed_simulation_reviews_v1 where draw_id=d.id)then return jsonb_build_object('status','rejected','code','draw_already_reviewed');end if;
 digest:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-review-source-v1',d.source_digest,actor,request));
 if app.native_mixed_simulation_insert_operation_v1(actor,op,tid,eid,'review',request)is distinct from true then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 insert into app.native_mixed_simulation_reviews_v1 values(idv,p.id,d.id,tid,eid,actor,op,request->>'decision',request,digest,clock_timestamp());
 r:=jsonb_build_object('kind','native-mixed-simulation-receipt-v1','action','review','status','accepted','code','simulation_draw_reviewed','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'reviewId',idv,'sourceDigest',digest,'publishAuthorized',false);
 insert into app.native_mixed_simulation_outcomes_v1 values(actor,op,tid,eid,r,clock_timestamp());return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.native_mixed_simulation_publication_bound_v1(context_value uuid)returns boolean
language sql stable security definer set search_path=''as $$select exists(
 select 1 from app.native_mixed_simulation_publication_contexts_v1 c
 join app.native_mixed_simulation_plans_v1 p on p.id=c.plan_id
 join app.native_mixed_simulation_draws_v1 d on d.id=c.draw_id and d.plan_id=p.id
 join app.native_mixed_simulation_reviews_v1 rv on rv.id=c.review_id and rv.draw_id=d.id and rv.plan_id=p.id
 join app.native_mixed_simulation_seating_sidecars_v1 ss on ss.context_id=c.id
 join app.native_mixed_simulation_schedule_sidecars_v1 gs on gs.context_id=c.id
 join app.initial_seating_publications sp on sp.id=c.seating_publication_id
 join app.event_schedule_publications ep on ep.id=c.schedule_publication_id
 join app.operation_receipts sr on sr.id=c.seating_receipt_id join app.operation_receipts er on er.id=c.schedule_receipt_id
 where c.id=context_value and c.backend_pid>0 and c.transaction_id>0
  and app.native_mixed_simulation_plan_bound_v1(c.plan_id)is true
  and app.native_mixed_simulation_draw_bound_v1(c.draw_id)is true
  and app.native_mixed_simulation_review_bound_v1(c.review_id)is true
  and app.native_mixed_simulation_operation_bound_v1(c.actor_id,c.operation_id,'publish')is true
  and c.attendance_seal_id=p.attendance_seal_id and c.attendance_source_digest=p.attendance_source_digest
  and jsonb_typeof(ss.assignments_capture)='array'and jsonb_array_length(ss.assignments_capture)=18
  and jsonb_typeof(gs.games_capture)='array'and jsonb_array_length(gs.games_capture)=108
  and(select count(distinct x->>'assignmentId')from jsonb_array_elements(ss.assignments_capture)x)=18
  and(select count(distinct x->>'rosterEntryId')from jsonb_array_elements(ss.assignments_capture)x)=18
  and(select count(distinct x->>'fixedId')from jsonb_array_elements(ss.assignments_capture)x)=18
  and(select count(distinct x->>'gameId')from jsonb_array_elements(gs.games_capture)x)=108
  and(select count(distinct x->>'importRowNumber')from jsonb_array_elements(gs.games_capture)x)=108
  and sr.operation_type='publish_native_mixed_simulation_seating_v1'and sr.outcome='accepted'
  and er.operation_type='publish_native_mixed_simulation_schedule_v1'and er.outcome='accepted'
  and sr.actor_profile_id=c.actor_id and sr.client_operation_id=c.seating_operation_id and sr.tournament_id=c.tournament_id
  and er.actor_profile_id=c.actor_id and er.client_operation_id=c.schedule_operation_id and er.tournament_id=c.tournament_id
  and sr.request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array(
   'publish_native_mixed_simulation_seating_v1',c.actor_id,c.tournament_id,c.event_id,
   c.source_capture->'candidateAssignments',c.seating_operation_id,c.attendance_source_digest))
  and er.request_hash=app.native_mixed_simulation_hash_v1(jsonb_build_array(
   'publish_native_mixed_simulation_schedule_v1',c.actor_id,c.tournament_id,c.event_id,
   c.source_capture->'candidateMatches',c.schedule_operation_id,(select source_digest from app.native_mixed_simulation_reviews_v1 where id=c.review_id)))
  and sr.target_id=sp.id and er.target_id=ep.id
  and sr.response_payload=jsonb_build_object('status','native_mixed_simulation_seating_published','publicationId',sp.id,'assignmentCount',18)
  and er.response_payload=jsonb_build_object('status','native_mixed_simulation_schedule_published','publicationId',ep.id,'matchCount',108)
  and sp.operation_receipt_id=sr.id and sp.tournament_id=c.tournament_id and sp.table_count=1 and sp.seats_per_table=18 and sp.actor_profile_id=c.actor_id
  and ep.operation_receipt_id=er.id and ep.tournament_id=c.tournament_id and ep.event_id=c.event_id
  and ep.source_method='native_mixed_simulation_v1'and ep.game_count=12 and ep.participant_count=18 and ep.match_count=108
  and ep.schedule_digest=er.request_hash and ep.actor_profile_id=c.actor_id
  and ss.publication_id=sp.id and ss.receipt_id=sr.id and gs.publication_id=ep.id and gs.receipt_id=er.id
  and ss.source_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array(
   'native-mixed-simulation-seating-sidecar-v1',c.id,sp.id,sr.id,ss.assignments_capture))
  and gs.source_digest=app.native_mixed_simulation_hash_v1(jsonb_build_array(
   'native-mixed-simulation-schedule-sidecar-v1',c.id,ep.id,er.id,gs.games_capture))
  and c.request_hash=(select request_hash from app.native_mixed_simulation_operations_v1 where actor_id=c.actor_id and operation_id=c.operation_id)
  and c.source_capture=jsonb_build_object('attendance',p.attendance_capture,'planId',p.id,'drawId',d.id,'reviewId',rv.id,
   'candidateAssignments',(select jsonb_agg(jsonb_build_object('rosterEntryId',(x->>'participantId')::uuid,'tableSeat',x->>'tournamentId')order by x->>'participantId')from jsonb_array_elements(d.candidate->'assignments')x),
   'candidateMatches',d.candidate->'matches','nativeAssignments',ss.assignments_capture,'nativeGames',gs.games_capture)
  and exists(select 1 from app.native_mixed_simulation_outcomes_v1 x where x.actor_id=c.actor_id and x.operation_id=c.operation_id
   and(x.result->>'contextId')::uuid=c.id and(x.result->>'seatingPublicationId')::uuid=sp.id
   and(x.result->>'schedulePublicationId')::uuid=ep.id and(x.result->>'assignmentCount')::integer=18
   and(x.result->>'roundCount')::integer=12 and(x.result->>'matchCount')::integer=108
   and x.result->'currentSourceVerified'='true'::jsonb and x.result->'ordinaryAttendanceUsed'='false'::jsonb
   and x.result->'normalStartAuthorized'='false'::jsonb)
  and(select count(*)from app.initial_seating_assignments x where x.publication_id=sp.id)=18
  and(select count(*)from app.rounds x where x.event_id=c.event_id)=12
  and(select count(*)from app.event_schedule_games x where x.publication_id=ep.id)=108
  and(select count(*)from app.canonical_games x where x.event_id=c.event_id)=108
  and not exists(select 1 from jsonb_array_elements(ss.assignments_capture)x where not exists(
   select 1 from app.initial_seating_assignments a join app.event_participants p
    on p.tournament_id=a.tournament_id and p.roster_entry_id=a.roster_entry_id and p.event_id=c.event_id
   where a.id=(x->>'assignmentId')::uuid and a.publication_id=sp.id and a.roster_entry_id=(x->>'rosterEntryId')::uuid
    and p.id=(x->>'participantId')::uuid and a.verification_id=x->>'fixedId'))
  and not exists(select 1 from jsonb_array_elements(ss.assignments_capture)x where not exists(
   select 1 from jsonb_array_elements(d.candidate->'assignments') candidate(value)
   where candidate.value->>'participantId'=x->>'rosterEntryId'and candidate.value->>'tournamentId'=x->>'fixedId'))
  and not exists(select 1 from jsonb_array_elements(d.candidate->'assignments')candidate(value)where not exists(
   select 1 from jsonb_array_elements(ss.assignments_capture)x
   where x->>'rosterEntryId'=candidate.value->>'participantId'and x->>'fixedId'=candidate.value->>'tournamentId'))
  and not exists(select 1 from jsonb_array_elements(gs.games_capture)x where not exists(
   select 1 from app.event_schedule_games eg join app.canonical_games g on g.id=eg.canonical_game_id join app.rounds r on r.id=g.round_id
   where eg.publication_id=ep.id and eg.import_row_number=(x->>'importRowNumber')::integer and g.id=(x->>'gameId')::uuid
    and r.round_number=(x->>'round')::integer and g.side_a_participant_id=(x->>'sideAParticipantId')::uuid
    and g.side_b_participant_id=(x->>'sideBParticipantId')::uuid and g.side_a_table_seat_snapshot=x->>'sideATableSeat'
    and g.side_b_table_seat_snapshot=x->>'sideBTableSeat'))
  and not exists(select 1 from jsonb_array_elements(gs.games_capture)x where not exists(
   select 1 from jsonb_array_elements(d.candidate->'matches')with ordinality candidate(value,ord)
   join app.event_participants side_a on side_a.tournament_id=c.tournament_id and side_a.event_id=c.event_id
    and side_a.roster_entry_id=(candidate.value#>>'{sides,0,participantId}')::uuid
   join app.event_participants side_b on side_b.tournament_id=c.tournament_id and side_b.event_id=c.event_id
    and side_b.roster_entry_id=(candidate.value#>>'{sides,1,participantId}')::uuid
   where candidate.ord=(x->>'importRowNumber')::bigint and(candidate.value->>'round')::integer=(x->>'round')::integer
    and side_a.id=(x->>'sideAParticipantId')::uuid and side_b.id=(x->>'sideBParticipantId')::uuid
    and candidate.value#>>'{sides,0,seatId}'=x->>'sideATableSeat'and candidate.value#>>'{sides,1,seatId}'=x->>'sideBTableSeat'))
  and exists(select 1 from app.audit_events x where x.operation_receipt_id=sr.id and x.tournament_id=c.tournament_id
   and x.actor_profile_id=c.actor_id and x.entity_type='initial_seating_publication'and x.entity_id=sp.id
   and x.action='native_mixed_simulation_seating_published'and x.after_state=jsonb_build_object('assignmentCount',18,'ordinaryAttendanceUsed',false))
  and exists(select 1 from app.audit_events x where x.operation_receipt_id=er.id and x.tournament_id=c.tournament_id
   and x.actor_profile_id=c.actor_id and x.entity_type='event_schedule_publication'and x.entity_id=ep.id
   and x.action='native_mixed_simulation_schedule_published'and x.after_state=jsonb_build_object('matchCount',108,'normalStartAuthorized',false))
)$$;

create function app.require_native_mixed_simulation_sidecar_v1()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if tg_table_name='event_schedule_publications'then
  if new.source_method='native_mixed_simulation_v1'
   and not exists(select 1 from app.native_mixed_simulation_schedule_sidecars_v1 s where s.publication_id=new.id)then raise exception'native mixed simulation schedule sidecar required';end if;
 elsif tg_table_name='initial_seating_publications'then
  if exists(select 1 from app.operation_receipts r where r.id=new.operation_receipt_id and r.operation_type='publish_native_mixed_simulation_seating_v1')
   and not exists(select 1 from app.native_mixed_simulation_seating_sidecars_v1 s where s.publication_id=new.id)then raise exception'native mixed simulation seating sidecar required';end if;
 end if;
 return new;
end$$;
create constraint trigger native_mixed_simulation_schedule_sidecar_guard_v1 after insert on app.event_schedule_publications
 deferrable initially deferred for each row execute function app.require_native_mixed_simulation_sidecar_v1();
create constraint trigger native_mixed_simulation_seating_sidecar_guard_v1 after insert on app.initial_seating_publications
 deferrable initially deferred for each row execute function app.require_native_mixed_simulation_sidecar_v1();

create function app.publish_native_mixed_simulation_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare op uuid;seat_op uuid;sched_op uuid;o app.native_mixed_simulation_operations_v1%rowtype;p app.native_mixed_simulation_plans_v1%rowtype;
 d app.native_mixed_simulation_draws_v1%rowtype;rv app.native_mixed_simulation_reviews_v1%rowtype;r jsonb;a jsonb;
 context_id uuid:=extensions.gen_random_uuid();seat_receipt uuid:=extensions.gen_random_uuid();sched_receipt uuid:=extensions.gen_random_uuid();
 seat_publication uuid:=extensions.gen_random_uuid();sched_publication uuid:=extensions.gen_random_uuid();assignments jsonb;games jsonb;
 seat_hash text;sched_hash text;context_capture jsonb;native_assignments jsonb;native_games jsonb;seat_digest text;sched_digest text;main_hash text;begin
 if app.native_mixed_simulation_publication_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null
  or app.native_mixed_simulation_publish_request_valid_v1(request)is distinct from true then return null;end if;
 op:=(request->>'operationId')::uuid;seat_op:=(request->>'seatingOperationId')::uuid;sched_op:=(request->>'scheduleOperationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-simulation:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_simulation_sources_v1();select*into o from app.native_mixed_simulation_operations_v1 where actor_id=actor and operation_id=op;
 if found then if o.action<>'publish'or o.request_payload is distinct from request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;select result into r from app.native_mixed_simulation_outcomes_v1 where actor_id=actor and operation_id=op;return r||jsonb_build_object('currentSourceVerified',false,'historicalReceipt',true);end if;
 select*into rv from app.native_mixed_simulation_reviews_v1 where id=(request->>'reviewId')::uuid and tournament_id=tid and event_id=eid;select*into d from app.native_mixed_simulation_draws_v1 where id=rv.draw_id;select*into p from app.native_mixed_simulation_plans_v1 where id=rv.plan_id;
 a:=app.native_mixed_simulation_lifecycle_v1(actor,tid,eid);if rv.id is null or rv.source_digest<>request->>'expectedReviewDigest'or a->>'sourceDigest'<>request->>'expectedAttendanceSourceDigest'or a-'actorId' is distinct from p.attendance_capture
  or app.reviewed_candidate_a18_valid_v1(p.config,p.roster_snapshot,d.candidate)is distinct from true
  or exists(select 1 from app.initial_seating_publications where tournament_id=tid)or exists(select 1 from app.event_schedule_publications where event_id=eid)
  or exists(select 1 from app.rounds where event_id=eid)or exists(select 1 from app.canonical_games where event_id=eid)
 then return jsonb_build_object('status','rejected','code','review_or_source_changed');end if;
 if app.native_mixed_simulation_operation_reserved_v1(actor,seat_op)or app.native_mixed_simulation_operation_reserved_v1(actor,sched_op)then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 if app.native_mixed_simulation_insert_operation_v1(actor,op,tid,eid,'publish',request)is distinct from true then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 assignments:=(select jsonb_agg(jsonb_build_object('rosterEntryId',(x->>'participantId')::uuid,'tableSeat',x->>'tournamentId')order by x->>'participantId')from jsonb_array_elements(d.candidate->'assignments')x);
 games:=d.candidate->'matches';seat_hash:=app.native_mixed_simulation_hash_v1(jsonb_build_array('publish_native_mixed_simulation_seating_v1',actor,tid,eid,assignments,seat_op,a->>'sourceDigest'));
 sched_hash:=app.native_mixed_simulation_hash_v1(jsonb_build_array('publish_native_mixed_simulation_schedule_v1',actor,tid,eid,games,sched_op,rv.source_digest));
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(seat_receipt,actor,tid,'publish_native_mixed_simulation_seating_v1',seat_publication,seat_hash,seat_op,'accepted',jsonb_build_object('status','native_mixed_simulation_seating_published','publicationId',seat_publication,'assignmentCount',18),clock_timestamp());
 insert into app.initial_seating_publications values(seat_publication,tid,1,18,actor,seat_receipt,clock_timestamp());
 insert into app.initial_seating_assignments(publication_id,tournament_id,roster_entry_id,initial_table_seat)
 select seat_publication,tid,(x->>'participantId')::uuid,x->>'tournamentId'from jsonb_array_elements(d.candidate->'assignments')x;
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
 values(sched_receipt,actor,tid,'publish_native_mixed_simulation_schedule_v1',sched_publication,sched_hash,sched_op,'accepted',jsonb_build_object('status','native_mixed_simulation_schedule_published','publicationId',sched_publication,'matchCount',108),clock_timestamp());
 insert into app.event_schedule_publications values(sched_publication,tid,eid,'native_mixed_simulation_v1',12,18,108,sched_hash,actor,sched_receipt,clock_timestamp());
 insert into app.rounds(tournament_id,event_id,round_number)select tid,eid,n from generate_series(1,12)n;
 with m as(select ord::integer n,x from jsonb_array_elements(games)with ordinality j(x,ord))
 insert into app.canonical_games(tournament_id,event_id,round_id,match_instance,side_a_participant_id,side_b_participant_id,side_a_table_seat_snapshot,side_b_table_seat_snapshot)
 select tid,eid,rn.id,1,a.id,b.id,m.x#>>'{sides,0,seatId}',m.x#>>'{sides,1,seatId}'from m join app.rounds rn on rn.event_id=eid and rn.round_number=(m.x->>'round')::integer
 join app.event_participants a on a.event_id=eid and a.roster_entry_id=(m.x#>>'{sides,0,participantId}')::uuid
 join app.event_participants b on b.event_id=eid and b.roster_entry_id=(m.x#>>'{sides,1,participantId}')::uuid;
 with m as(select ord::integer n,x from jsonb_array_elements(games)with ordinality j(x,ord))
 insert into app.event_schedule_games select sched_publication,tid,eid,g.id,m.n from m join app.rounds rn on rn.event_id=eid and rn.round_number=(m.x->>'round')::integer
 join app.event_participants a on a.event_id=eid and a.roster_entry_id=(m.x#>>'{sides,0,participantId}')::uuid
 join app.event_participants b on b.event_id=eid and b.roster_entry_id=(m.x#>>'{sides,1,participantId}')::uuid
 join app.canonical_games g on g.round_id=rn.id and g.side_low_participant_id=least(a.id,b.id)and g.side_high_participant_id=greatest(a.id,b.id);
 select jsonb_agg(jsonb_build_object('assignmentId',x.id,'rosterEntryId',x.roster_entry_id,'participantId',p0.id,'fixedId',x.verification_id)order by x.verification_id)
 into native_assignments from app.initial_seating_assignments x join app.event_participants p0 on p0.tournament_id=x.tournament_id and p0.roster_entry_id=x.roster_entry_id and p0.event_id=eid where x.publication_id=seat_publication;
 select jsonb_agg(jsonb_build_object('gameId',g.id,'importRowNumber',eg.import_row_number,'round',rn.round_number,
  'sideAParticipantId',g.side_a_participant_id,'sideBParticipantId',g.side_b_participant_id,'sideATableSeat',g.side_a_table_seat_snapshot,'sideBTableSeat',g.side_b_table_seat_snapshot)order by eg.import_row_number)
 into native_games from app.event_schedule_games eg join app.canonical_games g on g.id=eg.canonical_game_id join app.rounds rn on rn.id=g.round_id where eg.publication_id=sched_publication;
 context_capture:=jsonb_build_object('attendance',p.attendance_capture,'planId',p.id,'drawId',d.id,'reviewId',rv.id,
  'candidateAssignments',assignments,'candidateMatches',games,'nativeAssignments',native_assignments,'nativeGames',native_games);
 main_hash:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-publication-v1','publish',actor,op,tid,eid,request));
 insert into app.native_mixed_simulation_publication_contexts_v1 values(context_id,tid,eid,actor,op,p.id,d.id,rv.id,(a->>'sealId')::uuid,a->>'sourceDigest',main_hash,pg_backend_pid(),txid_current(),seat_op,sched_op,seat_receipt,sched_receipt,seat_publication,sched_publication,context_capture,clock_timestamp());
 seat_digest:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-seating-sidecar-v1',context_id,seat_publication,seat_receipt,native_assignments));
 sched_digest:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-schedule-sidecar-v1',context_id,sched_publication,sched_receipt,native_games));
 insert into app.native_mixed_simulation_seating_sidecars_v1 values(context_id,tid,eid,seat_publication,seat_receipt,native_assignments,seat_digest);
 insert into app.native_mixed_simulation_schedule_sidecars_v1 values(context_id,tid,eid,sched_publication,sched_receipt,native_games,sched_digest);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
 values(tid,actor,seat_receipt,'initial_seating_publication',seat_publication,'native_mixed_simulation_seating_published',jsonb_build_object('assignmentCount',18,'ordinaryAttendanceUsed',false)),
 (tid,actor,sched_receipt,'event_schedule_publication',sched_publication,'native_mixed_simulation_schedule_published',jsonb_build_object('matchCount',108,'normalStartAuthorized',false));
 r:=jsonb_build_object('kind','native-mixed-simulation-receipt-v1','action','publish','status','accepted','code','native_mixed_simulation_published','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'contextId',context_id,'seatingPublicationId',seat_publication,'schedulePublicationId',sched_publication,'assignmentCount',18,'roundCount',12,'matchCount',108,'currentSourceVerified',true,'ordinaryAttendanceUsed',false,'normalStartAuthorized',false);
 insert into app.native_mixed_simulation_outcomes_v1 values(actor,op,tid,eid,r,clock_timestamp());
 if app.native_mixed_simulation_publication_bound_v1(context_id)is distinct from true then raise exception'native mixed simulation publication postcondition failed';end if;return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.native_mixed_simulation_schedule_source_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$declare c app.native_mixed_simulation_publication_contexts_v1%rowtype;
 p app.native_mixed_simulation_plans_v1%rowtype;d app.native_mixed_simulation_draws_v1%rowtype;
 rv app.native_mixed_simulation_reviews_v1%rowtype;a jsonb;assignments jsonb;games jsonb;
 attendance_source jsonb;plan_source jsonb;draw_source jsonb;review_source jsonb;publication_source jsonb;digest text;begin
 if app.native_mixed_simulation_publication_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_simulation_sources_v1();select*into c from app.native_mixed_simulation_publication_contexts_v1 where tournament_id=tid and event_id=eid;
 a:=app.native_mixed_simulation_lifecycle_v1(actor,tid,eid);if c.id is null or a->>'status'<>'source_available'or a->>'sourceDigest'<>c.attendance_source_digest
  or app.native_mixed_simulation_publication_bound_v1(c.id)is distinct from true then return jsonb_build_object('status','blocked','code','simulation_publication_not_current');end if;
 select*into p from app.native_mixed_simulation_plans_v1 where id=c.plan_id;
 select*into d from app.native_mixed_simulation_draws_v1 where id=c.draw_id;
 select*into rv from app.native_mixed_simulation_reviews_v1 where id=c.review_id;
 select assignments_capture into assignments from app.native_mixed_simulation_seating_sidecars_v1 where context_id=c.id;
 select games_capture into games from app.native_mixed_simulation_schedule_sidecars_v1 where context_id=c.id;
 attendance_source:=jsonb_build_object('sealId',c.attendance_seal_id,'sourceDigest',c.attendance_source_digest);
 plan_source:=jsonb_build_object('planId',p.id,'sourceDigest',p.source_digest,'config',p.config);
 draw_source:=jsonb_build_object('drawId',d.id,'sourceDigest',d.source_digest,'candidate',d.candidate);
 review_source:=jsonb_build_object('reviewId',rv.id,'sourceDigest',rv.source_digest,'decision',rv.decision);
 publication_source:=jsonb_build_object('contextId',c.id,'seatingReceiptId',c.seating_receipt_id,
  'seatingPublicationId',c.seating_publication_id,'scheduleReceiptId',c.schedule_receipt_id,
  'schedulePublicationId',c.schedule_publication_id,'sourceMethod','native_mixed_simulation_v1',
  'assignmentCount',18,'roundCount',12,'matchCount',108);
 digest:=app.native_mixed_simulation_hash_v1(jsonb_build_array('native-mixed-simulation-schedule-source-v1',actor,tid,eid,
  attendance_source,plan_source,draw_source,review_source,publication_source,assignments,games));
 return jsonb_build_object('status','source_available','kind','native-mixed-simulation-schedule-source-v1','actorId',actor,'tournamentId',tid,'eventId',eid,
  'attendance',attendance_source,'plan',plan_source,'draw',draw_source,'review',review_source,'publication',publication_source,
  'fixedAssignments',assignments,'canonicalGames',games,'sourceDigest',digest,
  'simulationRosterProjected',true,'nativeInitialSeatingPublished',true,'nativeCanonicalSchedulePublished',true,
  'ordinaryAttendanceUsed',false,'ordinaryInitialSeatingWriterUsed',false,'ordinaryScheduleWriterUsed',false,
  'humanPresenceVerified',false,'paymentVerified',false,'moneyMoved',false,
  'normalStartAuthorized',false,'payoutAuthorized',false,'finalizationAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

do $$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_simulation_publication_enabled_v1()'::regprocedure,'app.native_mixed_simulation_uuid_v1(text)'::regprocedure,
 'app.native_mixed_simulation_reason_v1(jsonb,text)'::regprocedure,'app.native_mixed_simulation_hash_v1(jsonb)'::regprocedure,
 'app.native_mixed_simulation_plan_request_valid_v1(jsonb)'::regprocedure,'app.native_mixed_simulation_draw_request_valid_v1(jsonb)'::regprocedure,
 'app.native_mixed_simulation_review_request_valid_v1(jsonb)'::regprocedure,'app.native_mixed_simulation_publish_request_valid_v1(jsonb)'::regprocedure,
 'app.lock_native_mixed_simulation_sources_v1()'::regprocedure,'app.native_mixed_simulation_lifecycle_v1(uuid,uuid,uuid)'::regprocedure,
 'app.native_mixed_simulation_snapshot_v1(jsonb)'::regprocedure,'app.native_mixed_simulation_operation_reserved_v1(uuid,uuid)'::regprocedure,
 'app.reject_native_mixed_simulation_operation_reuse_v1()'::regprocedure,
 'app.native_mixed_simulation_insert_operation_v1(uuid,uuid,uuid,uuid,text,jsonb)'::regprocedure,
 'app.native_mixed_simulation_operation_bound_v1(uuid,uuid,text)'::regprocedure,
 'app.native_mixed_simulation_plan_bound_v1(uuid)'::regprocedure,'app.native_mixed_simulation_draw_bound_v1(uuid)'::regprocedure,
 'app.native_mixed_simulation_review_bound_v1(uuid)'::regprocedure,
 'app.save_native_mixed_simulation_plan_v1(uuid,uuid,uuid,jsonb)'::regprocedure,'app.draw_native_mixed_simulation_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.review_native_mixed_simulation_draw_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.native_mixed_simulation_publication_bound_v1(uuid)'::regprocedure,'app.require_native_mixed_simulation_sidecar_v1()'::regprocedure,
 'app.publish_native_mixed_simulation_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.native_mixed_simulation_schedule_source_v1(uuid,uuid,uuid)'::regprocedure
]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$$;
commit;
