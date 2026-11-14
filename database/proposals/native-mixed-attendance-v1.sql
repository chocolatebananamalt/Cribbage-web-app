-- LOCAL, UNEXECUTED, DEFAULT-OFF CANDIDATE.
--
-- Immutable, pre-draw TEST ONLY readiness evidence for one native-configured
-- 6 Digital / 12 fictional Paper event. This proposal does not write ordinary
-- QR/desk check-in, participant status, seating, schedule, Start, score,
-- qualification, payment, refund, payout or final-award rows. A separate
-- reviewed simulation publication/Start bridge is still required.
begin;

create function app.native_mixed_attendance_enabled_v1()returns boolean
language sql immutable set search_path=''as $$select false$$;

create table app.native_mixed_attendance_operations_v1(
 actor_id uuid not null references app.profiles(id),operation_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,
 action text not null check(action in('scope','consent','paper_declaration','paper_review','seal')),
 request_payload jsonb not null,request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 unique(actor_id,operation_id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 check(request_hash=encode(extensions.digest(convert_to(jsonb_build_array(
  'native-mixed-attendance-v1',action,actor_id,operation_id,tournament_id,event_id,request_payload
 )::text,'utf8'),'sha256'),'hex'))
);

create table app.native_mixed_attendance_scopes_v1(
 id uuid primary key default extensions.gen_random_uuid(),version integer not null default 1 check(version=1),
 tournament_id uuid not null,event_id uuid not null,actor_id uuid not null,operation_id uuid not null,nonce uuid not null,
 admission_intent_id uuid not null,admission_intent_version integer not null,
 admission_source_digest text not null check(admission_source_digest~'^[a-f0-9]{64}$'),
 funding_scope_id uuid not null,funding_source_digest text not null check(funding_source_digest~'^[a-f0-9]{64}$'),
 operational_binding_id uuid not null,roster_capture jsonb not null,
 participant_count integer not null default 18 check(participant_count=18),
 digital_count integer not null default 6 check(digital_count=6),paper_count integer not null default 12 check(paper_count=12),
 source_capture jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 reason text not null check(reason=trim(reason)and length(reason)between 1 and 500 and reason!~'[[:cntrl:]]'),
 ordinary_attendance_used boolean not null default false check(not ordinary_attendance_used),
 payment_verified boolean not null default false check(not payment_verified),
 human_presence_verified boolean not null default false check(not human_presence_verified),
 physical_presence_verified boolean not null default false check(not physical_presence_verified),
 money_moved boolean not null default false check(not money_moved),
 payout_authorized boolean not null default false check(not payout_authorized),
 finalization_authorized boolean not null default false check(not finalization_authorized),
 created_at timestamptz not null default clock_timestamp(),
 unique(tournament_id,event_id),unique(tournament_id,event_id,nonce),unique(actor_id,operation_id),
 unique(id,tournament_id,event_id),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(admission_intent_id,tournament_id,event_id)references app.native_mixed_admission_intents_v1(id,tournament_id,event_id),
 foreign key(funding_scope_id,tournament_id,event_id)references app.native_mixed_funding_scopes_v1(id,tournament_id,event_id),
 foreign key(operational_binding_id)references app.event_settings_operational_bindings_v1(id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_attendance_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

create table app.native_mixed_digital_consent_decisions_v1(
 id uuid primary key default extensions.gen_random_uuid(),scope_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,roster_entry_id uuid not null,participant_id uuid not null,
 profile_id uuid not null,version integer not null check(version between 1 and 2147483647),prior_consent_id uuid,
 decision text not null check(decision in('granted','revoked')),
 statement text not null check(statement='test-only-simulation-participation-v1'),
 actor_id uuid not null check(actor_id=profile_id),operation_id uuid not null,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 reason text not null check(reason=trim(reason)and length(reason)between 1 and 500 and reason!~'[[:cntrl:]]'),
 created_at timestamptz not null default clock_timestamp(),
 unique(scope_id,roster_entry_id,version),unique(scope_id,profile_id,version),unique(actor_id,operation_id),
 unique(id,scope_id),unique(id,tournament_id,event_id),
 foreign key(scope_id,tournament_id,event_id)references app.native_mixed_attendance_scopes_v1(id,tournament_id,event_id),
 foreign key(roster_entry_id,tournament_id)references app.tournament_roster_entries(id,tournament_id),
 foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id),
 foreign key(prior_consent_id,scope_id)references app.native_mixed_digital_consent_decisions_v1(id,scope_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_attendance_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

create table app.native_mixed_paper_declarations_v1(
 id uuid primary key default extensions.gen_random_uuid(),scope_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,preparer_id uuid not null,operation_id uuid not null,nonce uuid not null,
 entries_capture jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 reason text not null check(reason=trim(reason)and length(reason)between 1 and 500 and reason!~'[[:cntrl:]]'),
 fictional boolean not null default true check(fictional),created_at timestamptz not null default clock_timestamp(),
 unique(scope_id),unique(id,tournament_id,event_id),
 foreign key(scope_id,tournament_id,event_id)references app.native_mixed_attendance_scopes_v1(id,tournament_id,event_id),
 foreign key(preparer_id,operation_id,tournament_id,event_id)
  references app.native_mixed_attendance_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

-- The operation table calls this column actor_id. The declaration stores the
-- same value as preparer_id; no user can prepare on behalf of a Paper subject.
create unique index native_mixed_paper_declarations_actor_operation_v1
 on app.native_mixed_paper_declarations_v1(preparer_id,operation_id);

create table app.native_mixed_paper_declaration_entries_v1(
 declaration_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 roster_entry_id uuid not null,participant_id uuid not null,profile_id uuid check(profile_id is null),
 mode text not null default'paper'check(mode='paper'),fictional boolean not null default true check(fictional),
 primary key(declaration_id,roster_entry_id),unique(declaration_id,participant_id),
 foreign key(declaration_id,tournament_id,event_id)references app.native_mixed_paper_declarations_v1(id,tournament_id,event_id),
 foreign key(roster_entry_id,tournament_id)references app.tournament_roster_entries(id,tournament_id),
 foreign key(participant_id,event_id,tournament_id)references app.event_participants(id,event_id,tournament_id)
);

create table app.native_mixed_paper_reviews_v1(
 id uuid primary key default extensions.gen_random_uuid(),scope_id uuid not null,declaration_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,preparer_id uuid not null,reviewer_id uuid not null,
 operation_id uuid not null,decision text not null check(decision='accepted-synthetic-only'),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 reason text not null check(reason=trim(reason)and length(reason)between 1 and 500 and reason!~'[[:cntrl:]]'),
 created_at timestamptz not null default clock_timestamp(),check(reviewer_id<>preparer_id),
 unique(scope_id),unique(reviewer_id,operation_id),unique(id,tournament_id,event_id),
 foreign key(scope_id,tournament_id,event_id)references app.native_mixed_attendance_scopes_v1(id,tournament_id,event_id),
 foreign key(declaration_id,tournament_id,event_id)references app.native_mixed_paper_declarations_v1(id,tournament_id,event_id),
 foreign key(reviewer_id,operation_id,tournament_id,event_id)
  references app.native_mixed_attendance_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

create table app.native_mixed_attendance_seals_v1(
 id uuid primary key default extensions.gen_random_uuid(),scope_id uuid not null,declaration_id uuid not null,review_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,actor_id uuid not null,operation_id uuid not null,
 source_capture jsonb not null,source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 reason text not null check(reason=trim(reason)and length(reason)between 1 and 500 and reason!~'[[:cntrl:]]'),
 normal_draw_authorized boolean not null default false check(not normal_draw_authorized),
 normal_start_authorized boolean not null default false check(not normal_start_authorized),
 created_at timestamptz not null default clock_timestamp(),unique(tournament_id,event_id),unique(actor_id,operation_id),
 unique(id,tournament_id,event_id),
 foreign key(scope_id,tournament_id,event_id)references app.native_mixed_attendance_scopes_v1(id,tournament_id,event_id),
 foreign key(declaration_id,tournament_id,event_id)references app.native_mixed_paper_declarations_v1(id,tournament_id,event_id),
 foreign key(review_id,tournament_id,event_id)references app.native_mixed_paper_reviews_v1(id,tournament_id,event_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_attendance_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

create table app.native_mixed_attendance_outcomes_v1(
 actor_id uuid not null,operation_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 foreign key(actor_id,operation_id,tournament_id,event_id)
  references app.native_mixed_attendance_operations_v1(actor_id,operation_id,tournament_id,event_id)
);

do $$declare n text;begin foreach n in array array[
 'native_mixed_attendance_operations_v1','native_mixed_attendance_scopes_v1','native_mixed_digital_consent_decisions_v1',
 'native_mixed_paper_declarations_v1','native_mixed_paper_declaration_entries_v1','native_mixed_paper_reviews_v1',
 'native_mixed_attendance_seals_v1','native_mixed_attendance_outcomes_v1'
]loop execute format('alter table app.%I owner to postgres',n);
 execute format('alter table app.%I enable row level security',n);execute format('alter table app.%I force row level security',n);
 execute format('revoke all on table app.%I from public,anon,authenticated,service_role',n);
 execute format('create trigger %I before update or delete on app.%I for each row execute function app.reject_immutable_history()',n||'_immutable',n);
end loop;end$$;

create function app.native_mixed_attendance_uuid_v1(v text)returns boolean
language sql immutable set search_path=''as $$select coalesce(v,'')~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'$$;
create function app.native_mixed_attendance_reason_v1(v jsonb,k text)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v->k)='string'and v->>k=trim(v->>k)
 and length(v->>k)between 1 and 500 and(v->>k)!~'[[:cntrl:]]'$$;

create function app.native_mixed_attendance_scope_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array[
  'expectedAdmissionIntentId','expectedAdmissionSourceDigest','expectedFundingScopeId','expectedFundingSourceDigest',
  'expectedOperationalBindingId','kind','nonce','operationId','reason']
 and v->>'kind'='native-mixed-attendance-scope-v1'
 and app.native_mixed_attendance_uuid_v1(v->>'operationId')and app.native_mixed_attendance_uuid_v1(v->>'nonce')
 and app.native_mixed_attendance_uuid_v1(v->>'expectedAdmissionIntentId')
 and app.native_mixed_attendance_uuid_v1(v->>'expectedFundingScopeId')
 and app.native_mixed_attendance_uuid_v1(v->>'expectedOperationalBindingId')
 and coalesce(v->>'expectedAdmissionSourceDigest','')~'^[a-f0-9]{64}$'
 and coalesce(v->>'expectedFundingSourceDigest','')~'^[a-f0-9]{64}$'
 and app.native_mixed_attendance_reason_v1(v,'reason')$$;

create function app.native_mixed_attendance_consent_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array[
  'decision','expectedPriorConsentId','expectedScopeDigest','expectedScopeId','expectedVersion','kind','operationId','reason','rosterEntryId','statement']
 and v->>'kind'='native-mixed-digital-consent-v1'
 and app.native_mixed_attendance_uuid_v1(v->>'operationId')and app.native_mixed_attendance_uuid_v1(v->>'expectedScopeId')
 and app.native_mixed_attendance_uuid_v1(v->>'rosterEntryId')
 and(v->'expectedPriorConsentId'='null'::jsonb or app.native_mixed_attendance_uuid_v1(v->>'expectedPriorConsentId'))
 and coalesce(v->>'expectedScopeDigest','')~'^[a-f0-9]{64}$'
 and jsonb_typeof(v->'expectedVersion')='number'and coalesce(v->>'expectedVersion','')~'^[0-9]{1,10}$'
 and(v->>'expectedVersion')::bigint<=2147483646
 and v->>'decision'in('granted','revoked')and v->>'statement'='test-only-simulation-participation-v1'
 and app.native_mixed_attendance_reason_v1(v,'reason')$$;

create function app.native_mixed_attendance_declaration_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array[
  'expectedPaperRosterEntryIds','expectedScopeDigest','expectedScopeId','kind','nonce','operationId','reason']
 and v->>'kind'='native-mixed-paper-declaration-v1'
 and app.native_mixed_attendance_uuid_v1(v->>'operationId')and app.native_mixed_attendance_uuid_v1(v->>'nonce')
 and app.native_mixed_attendance_uuid_v1(v->>'expectedScopeId')and coalesce(v->>'expectedScopeDigest','')~'^[a-f0-9]{64}$'
 and jsonb_typeof(v->'expectedPaperRosterEntryIds')='array'and jsonb_array_length(v->'expectedPaperRosterEntryIds')=12
 and not exists(select 1 from jsonb_array_elements(v->'expectedPaperRosterEntryIds')x where jsonb_typeof(x)<>'string'or not app.native_mixed_attendance_uuid_v1(x#>>'{}'))
 and(select count(distinct x#>>'{}')from jsonb_array_elements(v->'expectedPaperRosterEntryIds')x)=12
 and app.native_mixed_attendance_reason_v1(v,'reason')$$;

create function app.native_mixed_attendance_review_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array[
  'decision','expectedDeclarationDigest','expectedDeclarationId','expectedScopeDigest','expectedScopeId','kind','operationId','reason']
 and v->>'kind'='native-mixed-paper-review-v1'
 and app.native_mixed_attendance_uuid_v1(v->>'operationId')and app.native_mixed_attendance_uuid_v1(v->>'expectedScopeId')
 and app.native_mixed_attendance_uuid_v1(v->>'expectedDeclarationId')
 and coalesce(v->>'expectedScopeDigest','')~'^[a-f0-9]{64}$'
 and coalesce(v->>'expectedDeclarationDigest','')~'^[a-f0-9]{64}$'
 and v->>'decision'='accepted-synthetic-only'and app.native_mixed_attendance_reason_v1(v,'reason')$$;

create function app.native_mixed_attendance_seal_request_valid_v1(v jsonb)returns boolean
language sql immutable set search_path=''as $$select jsonb_typeof(v)='object'
 and(select array_agg(k order by k)from jsonb_object_keys(v)k)=array[
  'expectedDeclarationId','expectedReviewId','expectedScopeDigest','expectedScopeId','kind','operationId','reason']
 and v->>'kind'='native-mixed-attendance-seal-v1'
 and app.native_mixed_attendance_uuid_v1(v->>'operationId')and app.native_mixed_attendance_uuid_v1(v->>'expectedScopeId')
 and app.native_mixed_attendance_uuid_v1(v->>'expectedDeclarationId')and app.native_mixed_attendance_uuid_v1(v->>'expectedReviewId')
 and coalesce(v->>'expectedScopeDigest','')~'^[a-f0-9]{64}$'and app.native_mixed_attendance_reason_v1(v,'reason')$$;

create function app.lock_native_mixed_attendance_sources_v1()returns void
language plpgsql security definer set search_path=''as $$begin
 perform app.lock_native_mixed_funding_sources_v1();
 lock table app.native_mixed_attendance_operations_v1,app.native_mixed_attendance_scopes_v1,
  app.native_mixed_digital_consent_decisions_v1,app.native_mixed_paper_declarations_v1,
  app.native_mixed_paper_declaration_entries_v1,app.native_mixed_paper_reviews_v1,
  app.native_mixed_attendance_seals_v1,app.native_mixed_attendance_outcomes_v1,
  app.tournament_roles,app.event_play_starts,app.initial_seating_publications,
  app.event_schedule_publications,app.random_seating_draws_v1,app.qualification_result_versions,
  app.event_check_in_windows,app.event_check_in_events,app.event_check_in_requests
 in share mode nowait;
end$$;

create function app.native_mixed_attendance_preactivity_v1(tid uuid,eid uuid)returns boolean
language sql stable security definer set search_path=''as $$select
 not exists(select 1 from app.random_seating_draws_v1 where tournament_id=tid)
 and not exists(select 1 from app.initial_seating_publications where tournament_id=tid)
 and not exists(select 1 from app.event_schedule_publications where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_play_starts where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.qualification_result_versions where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_check_in_windows where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_check_in_events where tournament_id=tid and event_id=eid)
 and not exists(select 1 from app.event_check_in_requests where tournament_id=tid and event_id=eid)
 and app.native_mixed_admission_score_history_empty_v1(tid,eid)is true$$;

create function app.native_mixed_attendance_operation_reserved_v1(actor uuid,op uuid)returns boolean
language sql stable security definer set search_path=''as $$select
 app.native_mixed_admission_operation_reserved_v1(actor,op)is true
 or exists(select 1 from app.native_mixed_funding_operations_v1 where actor_id=actor and operation_id=op)
 or exists(select 1 from app.native_mixed_attendance_operations_v1 where actor_id=actor and operation_id=op)$$;

create function app.native_mixed_attendance_scope_current_v1(scope_value uuid)returns boolean
language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$
declare s app.native_mixed_attendance_scopes_v1%rowtype;i app.native_mixed_admission_intents_v1%rowtype;f jsonb;b jsonb;begin
 select*into s from app.native_mixed_attendance_scopes_v1 where id=scope_value;if not found then return false;end if;
 select*into i from app.native_mixed_admission_intents_v1 where tournament_id=s.tournament_id and event_id=s.event_id order by version desc limit 1;
 f:=app.native_mixed_funding_seal_source_v1(s.tournament_id,s.event_id);b:=app.native_mixed_admission_base_source_v1(s.tournament_id,s.event_id);
 return i.id is not distinct from s.admission_intent_id and i.version is not distinct from s.admission_intent_version
  and i.source_digest is not distinct from s.admission_source_digest
  and f->>'status'='source_available'and(f#>>'{scope,scopeId}')::uuid=s.funding_scope_id
  and f->>'sourceDigest'=s.funding_source_digest and(f#>>'{scope,operationalBindingId}')::uuid=s.operational_binding_id
  and b->>'status'='source_available'and b->'roster'is not distinct from s.roster_capture
  and s.source_capture is not distinct from jsonb_build_object('admissionIntentId',i.id,'admissionIntentVersion',i.version,
   'admissionSourceDigest',i.source_digest,'fundingScopeId',(f#>>'{scope,scopeId}')::uuid,'fundingSourceDigest',f->>'sourceDigest',
   'operationalBindingId',(f#>>'{scope,operationalBindingId}')::uuid,'roster',b->'roster');
end$$;

create function app.native_mixed_attendance_insert_operation_v1(actor uuid,op uuid,tid uuid,eid uuid,action_value text,request jsonb)returns text
language plpgsql security definer set search_path=''as $$declare h text;begin
 h:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-attendance-v1',action_value,actor,op,tid,eid,request)::text,'utf8'),'sha256'),'hex');
 if app.native_mixed_attendance_operation_reserved_v1(actor,op)then return null;end if;
 insert into app.native_mixed_attendance_operations_v1 values(actor,op,tid,eid,action_value,request,h,clock_timestamp());return h;
end$$;

create function app.native_mixed_attendance_operation_bound_v1(actor uuid,op uuid,action_value text)returns boolean
language sql stable security definer set search_path=''as $$select exists(
 select 1 from app.native_mixed_attendance_operations_v1 o join app.native_mixed_attendance_outcomes_v1 x
  on x.actor_id=o.actor_id and x.operation_id=o.operation_id
 where o.actor_id=actor and o.operation_id=op and o.action=action_value
  and x.tournament_id=o.tournament_id and x.event_id=o.event_id
  and x.result->>'kind'='native-mixed-attendance-receipt-v1'and x.result->>'action'=action_value
  and x.result->>'status'='accepted'and(x.result->>'actorId')::uuid=o.actor_id
  and(x.result->>'tournamentId')::uuid=o.tournament_id and(x.result->>'eventId')::uuid=o.event_id
  and(x.result->>'operationId')::uuid=o.operation_id and x.result->'request'is not distinct from o.request_payload
)$$;

create function app.native_mixed_attendance_scope_bound_v1(scope_value uuid)returns boolean
language sql stable security definer set search_path=''set timezone='UTC'as $$select exists(
 select 1 from app.native_mixed_attendance_scopes_v1 s where s.id=scope_value
  and app.native_mixed_attendance_operation_bound_v1(s.actor_id,s.operation_id,'scope')is true
  and s.source_digest=encode(extensions.digest(convert_to(jsonb_build_array(
   'native-mixed-attendance-scope-source-v1',s.tournament_id,s.event_id,s.source_capture
  )::text,'utf8'),'sha256'),'hex')
  and exists(select 1 from app.native_mixed_attendance_outcomes_v1 x where x.actor_id=s.actor_id and x.operation_id=s.operation_id
   and(x.result->>'scopeId')::uuid=s.id and(x.result->>'version')::integer=s.version and x.result->>'sourceDigest'=s.source_digest)
)$$;

create function app.native_mixed_attendance_consent_bound_v1(consent_value uuid)returns boolean
language sql stable security definer set search_path=''set timezone='UTC'as $$select exists(
 select 1 from app.native_mixed_digital_consent_decisions_v1 c join app.native_mixed_attendance_scopes_v1 s on s.id=c.scope_id
 where c.id=consent_value and app.native_mixed_attendance_operation_bound_v1(c.actor_id,c.operation_id,'consent')is true
  and c.source_digest=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-digital-consent-source-v1',s.source_digest,
   c.roster_entry_id::text,c.participant_id::text,c.profile_id,c.version,c.prior_consent_id,c.decision,c.statement)::text,'utf8'),'sha256'),'hex')
  and exists(select 1 from app.native_mixed_attendance_outcomes_v1 x where x.actor_id=c.actor_id and x.operation_id=c.operation_id
   and(x.result->>'consentId')::uuid=c.id and(x.result->>'version')::integer=c.version
   and x.result->>'decision'=c.decision and x.result->>'sourceDigest'=c.source_digest)
)$$;

create function app.native_mixed_attendance_declaration_bound_v1(declaration_value uuid)returns boolean
language sql stable security definer set search_path=''set timezone='UTC'as $$select exists(
 select 1 from app.native_mixed_paper_declarations_v1 d join app.native_mixed_attendance_scopes_v1 s on s.id=d.scope_id
 where d.id=declaration_value and app.native_mixed_attendance_operation_bound_v1(d.preparer_id,d.operation_id,'paper_declaration')is true
  and d.source_digest=encode(extensions.digest(convert_to(jsonb_build_array(
   'native-mixed-paper-declaration-source-v1',s.source_digest,d.preparer_id,d.entries_capture
  )::text,'utf8'),'sha256'),'hex')
  and exists(select 1 from app.native_mixed_attendance_outcomes_v1 x where x.actor_id=d.preparer_id and x.operation_id=d.operation_id
   and(x.result->>'declarationId')::uuid=d.id and x.result->>'sourceDigest'=d.source_digest)
)$$;

create function app.native_mixed_attendance_review_bound_v1(review_value uuid)returns boolean
language sql stable security definer set search_path=''set timezone='UTC'as $$select exists(
 select 1 from app.native_mixed_paper_reviews_v1 r join app.native_mixed_attendance_scopes_v1 s on s.id=r.scope_id
 join app.native_mixed_paper_declarations_v1 d on d.id=r.declaration_id
 where r.id=review_value and app.native_mixed_attendance_operation_bound_v1(r.reviewer_id,r.operation_id,'paper_review')is true
  and r.source_digest=encode(extensions.digest(convert_to(jsonb_build_array(
   'native-mixed-paper-review-source-v1',s.source_digest,d.source_digest,d.preparer_id,r.reviewer_id,r.decision
  )::text,'utf8'),'sha256'),'hex')
  and exists(select 1 from app.native_mixed_attendance_outcomes_v1 x where x.actor_id=r.reviewer_id and x.operation_id=r.operation_id
   and(x.result->>'reviewId')::uuid=r.id and(x.result->>'declarationId')::uuid=d.id and x.result->>'sourceDigest'=r.source_digest)
)$$;

create function app.save_native_mixed_attendance_scope_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare op uuid;o app.native_mixed_attendance_operations_v1%rowtype;r jsonb;i app.native_mixed_admission_intents_v1%rowtype;
 f jsonb;b jsonb;capture jsonb;digest text;new_id uuid:=extensions.gen_random_uuid();begin
 if app.native_mixed_attendance_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if app.native_mixed_attendance_scope_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;op:=(request->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-attendance-v1:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform 1 from app.tournaments where id=tid and name like'TEST ONLY%'for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_attendance_sources_v1();
 select*into o from app.native_mixed_attendance_operations_v1 where actor_id=actor and operation_id=op;
 if found then if o.action<>'scope'or o.tournament_id<>tid or o.event_id<>eid or o.request_payload is distinct from request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;select result into r from app.native_mixed_attendance_outcomes_v1 where actor_id=actor and operation_id=op;return r;end if;
 if app.native_mixed_attendance_preactivity_v1(tid,eid)is distinct from true then return jsonb_build_object('status','rejected','code','predraw_scope_required');end if;
 select*into i from app.native_mixed_admission_intents_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 f:=app.native_mixed_funding_seal_source_v1(tid,eid);b:=app.native_mixed_admission_base_source_v1(tid,eid);
 if i.id is null or i.id<>(request->>'expectedAdmissionIntentId')::uuid or i.source_digest<>request->>'expectedAdmissionSourceDigest'
  or f->>'status'<>'source_available'or(f#>>'{scope,scopeId}')::uuid<>(request->>'expectedFundingScopeId')::uuid
  or f->>'sourceDigest'<>request->>'expectedFundingSourceDigest'or(f#>>'{scope,operationalBindingId}')::uuid<>(request->>'expectedOperationalBindingId')::uuid
  or b->>'status'<>'source_available'or b->'roster'is distinct from i.roster_capture
 then return jsonb_build_object('status','rejected','code','source_changed');end if;
 if exists(select 1 from app.native_mixed_attendance_scopes_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','scope_already_recorded');end if;
 capture:=jsonb_build_object('admissionIntentId',i.id,'admissionIntentVersion',i.version,'admissionSourceDigest',i.source_digest,
  'fundingScopeId',(f#>>'{scope,scopeId}')::uuid,'fundingSourceDigest',f->>'sourceDigest',
  'operationalBindingId',(f#>>'{scope,operationalBindingId}')::uuid,'roster',b->'roster');
 digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-attendance-scope-source-v1',tid,eid,capture)::text,'utf8'),'sha256'),'hex');
 if app.native_mixed_attendance_insert_operation_v1(actor,op,tid,eid,'scope',request)is null then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 insert into app.native_mixed_attendance_scopes_v1(id,tournament_id,event_id,actor_id,operation_id,nonce,admission_intent_id,admission_intent_version,admission_source_digest,
  funding_scope_id,funding_source_digest,operational_binding_id,roster_capture,source_capture,source_digest,reason)
 values(new_id,tid,eid,actor,op,(request->>'nonce')::uuid,i.id,i.version,i.source_digest,(f#>>'{scope,scopeId}')::uuid,f->>'sourceDigest',
  (f#>>'{scope,operationalBindingId}')::uuid,b->'roster',capture,digest,request->>'reason');
 r:=jsonb_build_object('kind','native-mixed-attendance-receipt-v1','action','scope','status','accepted','code','attendance_scope_recorded','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'scopeId',new_id,'version',1,'sourceDigest',digest,'normalDrawAuthorized',false,'normalStartAuthorized',false);
 insert into app.native_mixed_attendance_outcomes_v1 values(actor,op,tid,eid,r,clock_timestamp());return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.record_native_mixed_digital_consent_v1(tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare actor uuid:=auth.uid();op uuid;s app.native_mixed_attendance_scopes_v1%rowtype;o app.native_mixed_attendance_operations_v1%rowtype;
 old app.native_mixed_digital_consent_decisions_v1%rowtype;r jsonb;entry jsonb;next_version integer;new_id uuid:=extensions.gen_random_uuid();digest text;begin
 if app.native_mixed_attendance_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or actor is null
  or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'authenticated'
 then return null;end if;
 if app.native_mixed_attendance_consent_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;op:=(request->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-attendance-v1:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform app.lock_native_mixed_attendance_sources_v1();select*into o from app.native_mixed_attendance_operations_v1 where actor_id=actor and operation_id=op;
 if found then if o.action<>'consent'or o.tournament_id<>tid or o.event_id<>eid or o.request_payload is distinct from request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;select result into r from app.native_mixed_attendance_outcomes_v1 where actor_id=actor and operation_id=op;return r;end if;
 select*into s from app.native_mixed_attendance_scopes_v1 where id=(request->>'expectedScopeId')::uuid and tournament_id=tid and event_id=eid;
 select value into entry from jsonb_array_elements(s.roster_capture)x where x->>'rosterEntryId'=request->>'rosterEntryId'and x->>'mode'='digital'and x->>'profileId'=actor::text;
 if s.id is null or s.source_digest<>request->>'expectedScopeDigest'or entry is null then return jsonb_build_object('status','rejected','code','subject_or_scope_changed');end if;
 select*into old from app.native_mixed_digital_consent_decisions_v1 where scope_id=s.id and roster_entry_id=(request->>'rosterEntryId')::uuid order by version desc limit 1;
 if coalesce(old.version,0)<>(request->>'expectedVersion')::integer or request->'expectedPriorConsentId'is distinct from coalesce(to_jsonb(old.id),'null'::jsonb)then return jsonb_build_object('status','rejected','code','consent_changed');end if;
 if request->>'decision'='granted'and(exists(select 1 from app.native_mixed_attendance_seals_v1 where scope_id=s.id)or app.native_mixed_attendance_preactivity_v1(tid,eid)is distinct from true or app.native_mixed_attendance_scope_current_v1(s.id)is distinct from true)
 then return jsonb_build_object('status','rejected','code','new_trial_required');end if;
 if old.id is not null and old.decision=request->>'decision'then return jsonb_build_object('status','rejected','code','consent_unchanged');end if;
 next_version:=coalesce(old.version,0)+1;digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-digital-consent-source-v1',s.source_digest,
  request->>'rosterEntryId',entry->>'participantId',actor,next_version,old.id,request->>'decision',request->>'statement')::text,'utf8'),'sha256'),'hex');
 if app.native_mixed_attendance_insert_operation_v1(actor,op,tid,eid,'consent',request)is null then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 insert into app.native_mixed_digital_consent_decisions_v1 values(new_id,s.id,tid,eid,(request->>'rosterEntryId')::uuid,(entry->>'participantId')::uuid,actor,next_version,old.id,
  request->>'decision',request->>'statement',actor,op,digest,request->>'reason',clock_timestamp());
 r:=jsonb_build_object('kind','native-mixed-attendance-receipt-v1','action','consent','status','accepted','code','digital_consent_recorded','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,
  'consentId',new_id,'version',next_version,'priorConsentId',old.id,'decision',request->>'decision','sourceDigest',digest,'normalDrawAuthorized',false,'normalStartAuthorized',false);
 insert into app.native_mixed_attendance_outcomes_v1 values(actor,op,tid,eid,r,clock_timestamp());return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.record_native_mixed_paper_declaration_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare op uuid;s app.native_mixed_attendance_scopes_v1%rowtype;o app.native_mixed_attendance_operations_v1%rowtype;r jsonb;entries jsonb;
 new_id uuid:=extensions.gen_random_uuid();digest text;begin
 if app.native_mixed_attendance_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if app.native_mixed_attendance_declaration_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;op:=(request->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-attendance-v1:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_attendance_sources_v1();select*into o from app.native_mixed_attendance_operations_v1 where actor_id=actor and operation_id=op;
 if found then if o.action<>'paper_declaration'or o.request_payload is distinct from request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;select result into r from app.native_mixed_attendance_outcomes_v1 where actor_id=actor and operation_id=op;return r;end if;
 select*into s from app.native_mixed_attendance_scopes_v1 where id=(request->>'expectedScopeId')::uuid and tournament_id=tid and event_id=eid;
 if s.id is null or s.source_digest<>request->>'expectedScopeDigest'or app.native_mixed_attendance_scope_current_v1(s.id)is distinct from true or app.native_mixed_attendance_preactivity_v1(tid,eid)is distinct from true then return jsonb_build_object('status','rejected','code','source_changed');end if;
 select jsonb_agg(jsonb_build_object('rosterEntryId',x->>'rosterEntryId','participantId',x->>'participantId','profileId',null,'mode','paper','fictional',true)order by x->>'rosterEntryId')into entries from jsonb_array_elements(s.roster_capture)x where x->>'mode'='paper'and x->>'profileId'is null;
 if jsonb_array_length(entries)<>12 or(select jsonb_agg(x order by x)from jsonb_array_elements_text(request->'expectedPaperRosterEntryIds')x)is distinct from(select jsonb_agg(to_jsonb(x->>'rosterEntryId')order by x->>'rosterEntryId')from jsonb_array_elements(entries)x)then return jsonb_build_object('status','rejected','code','paper_roster_changed');end if;
 if exists(select 1 from app.native_mixed_paper_declarations_v1 where scope_id=s.id)then return jsonb_build_object('status','rejected','code','declaration_already_recorded');end if;
 digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-paper-declaration-source-v1',s.source_digest,actor,entries)::text,'utf8'),'sha256'),'hex');
 if app.native_mixed_attendance_insert_operation_v1(actor,op,tid,eid,'paper_declaration',request)is null then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 insert into app.native_mixed_paper_declarations_v1(id,scope_id,tournament_id,event_id,preparer_id,operation_id,nonce,entries_capture,source_digest,reason)
 values(new_id,s.id,tid,eid,actor,op,(request->>'nonce')::uuid,entries,digest,request->>'reason');
 insert into app.native_mixed_paper_declaration_entries_v1 select new_id,tid,eid,(x->>'rosterEntryId')::uuid,(x->>'participantId')::uuid,null,'paper',true from jsonb_array_elements(entries)x;
 r:=jsonb_build_object('kind','native-mixed-attendance-receipt-v1','action','paper_declaration','status','accepted','code','paper_declaration_recorded','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'declarationId',new_id,'sourceDigest',digest,'fictional',true,'normalDrawAuthorized',false,'normalStartAuthorized',false);
 insert into app.native_mixed_attendance_outcomes_v1 values(actor,op,tid,eid,r,clock_timestamp());return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.review_native_mixed_paper_declaration_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare op uuid;s app.native_mixed_attendance_scopes_v1%rowtype;d app.native_mixed_paper_declarations_v1%rowtype;o app.native_mixed_attendance_operations_v1%rowtype;r jsonb;
 new_id uuid:=extensions.gen_random_uuid();digest text;begin
 if app.native_mixed_attendance_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if app.native_mixed_attendance_review_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;op:=(request->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-attendance-v1:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='cross_checker'for key share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_attendance_sources_v1();select*into o from app.native_mixed_attendance_operations_v1 where actor_id=actor and operation_id=op;
 if found then if o.action<>'paper_review'or o.request_payload is distinct from request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;select result into r from app.native_mixed_attendance_outcomes_v1 where actor_id=actor and operation_id=op;return r;end if;
 select*into s from app.native_mixed_attendance_scopes_v1 where id=(request->>'expectedScopeId')::uuid and tournament_id=tid and event_id=eid;
 select*into d from app.native_mixed_paper_declarations_v1 where id=(request->>'expectedDeclarationId')::uuid and scope_id=s.id;
 if s.id is null or s.source_digest<>request->>'expectedScopeDigest'or d.id is null or d.source_digest<>request->>'expectedDeclarationDigest'
  or d.preparer_id=actor or app.native_mixed_attendance_scope_current_v1(s.id)is distinct from true or app.native_mixed_attendance_preactivity_v1(tid,eid)is distinct from true
 then return jsonb_build_object('status','rejected','code','source_or_independence_changed');end if;
 if exists(select 1 from app.native_mixed_paper_reviews_v1 where scope_id=s.id)then return jsonb_build_object('status','rejected','code','review_already_recorded');end if;
 digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-paper-review-source-v1',s.source_digest,d.source_digest,d.preparer_id,actor,request->>'decision')::text,'utf8'),'sha256'),'hex');
 if app.native_mixed_attendance_insert_operation_v1(actor,op,tid,eid,'paper_review',request)is null then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 insert into app.native_mixed_paper_reviews_v1 values(new_id,s.id,d.id,tid,eid,d.preparer_id,actor,op,request->>'decision',digest,request->>'reason',clock_timestamp());
 r:=jsonb_build_object('kind','native-mixed-attendance-receipt-v1','action','paper_review','status','accepted','code','paper_declaration_reviewed','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'reviewId',new_id,'declarationId',d.id,'sourceDigest',digest,'decision',request->>'decision','normalDrawAuthorized',false,'normalStartAuthorized',false);
 insert into app.native_mixed_attendance_outcomes_v1 values(actor,op,tid,eid,r,clock_timestamp());return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.native_mixed_attendance_projection_v1(tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$
declare s app.native_mixed_attendance_scopes_v1%rowtype;d app.native_mixed_paper_declarations_v1%rowtype;rv app.native_mixed_paper_reviews_v1%rowtype;
 consents jsonb;paper jsonb;review jsonb;source jsonb;digest text;begin
 if app.native_mixed_attendance_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'then return jsonb_build_object('status','retry_exact','code','isolation_not_supported');end if;
 perform app.lock_native_mixed_attendance_sources_v1();select*into s from app.native_mixed_attendance_scopes_v1 where tournament_id=tid and event_id=eid;
 if s.id is null then return jsonb_build_object('status','blocked','code','attendance_scope_required');end if;
 if exists(select 1 from app.event_play_starts where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','blocked','code','simulation_rehearsal_started');end if;
 if app.native_mixed_attendance_scope_current_v1(s.id)is distinct from true or app.native_mixed_attendance_scope_bound_v1(s.id)is distinct from true
 then return jsonb_build_object('status','blocked','code','source_changed');end if;
 select*into d from app.native_mixed_paper_declarations_v1 where scope_id=s.id;select*into rv from app.native_mixed_paper_reviews_v1 where scope_id=s.id;
 select jsonb_agg(jsonb_build_object('consentId',c.id,'version',c.version,'priorConsentId',c.prior_consent_id,'decision',c.decision,
  'rosterEntryId',c.roster_entry_id,'participantId',c.participant_id,'profileId',c.profile_id,'operationId',c.operation_id,
  'statement',c.statement,'sourceDigest',c.source_digest)order by c.roster_entry_id)into consents
 from app.native_mixed_digital_consent_decisions_v1 c where c.scope_id=s.id and c.version=(select max(x.version)from app.native_mixed_digital_consent_decisions_v1 x where x.scope_id=s.id and x.roster_entry_id=c.roster_entry_id);
 if coalesce(jsonb_array_length(consents),0)<>6 or exists(select 1 from jsonb_array_elements(consents)x where x->>'decision'<>'granted')
  or exists(select 1 from app.native_mixed_digital_consent_decisions_v1 c where c.scope_id=s.id
   and c.version=(select max(x.version)from app.native_mixed_digital_consent_decisions_v1 x where x.scope_id=s.id and x.roster_entry_id=c.roster_entry_id)
   and app.native_mixed_attendance_consent_bound_v1(c.id)is distinct from true)
  or exists(select 1 from app.native_mixed_digital_consent_decisions_v1 c where c.scope_id=s.id
   and c.version=(select max(x.version)from app.native_mixed_digital_consent_decisions_v1 x where x.scope_id=s.id and x.roster_entry_id=c.roster_entry_id)
   and not exists(select 1 from jsonb_array_elements(s.roster_capture)b where b->>'mode'='digital'
    and c.roster_entry_id=(b->>'rosterEntryId')::uuid and c.participant_id=(b->>'participantId')::uuid
    and c.profile_id=(b->>'profileId')::uuid))
  or exists(select 1 from jsonb_array_elements(s.roster_capture)b where b->>'mode'='digital'and not exists(
   select 1 from app.native_mixed_digital_consent_decisions_v1 c where c.scope_id=s.id
    and c.roster_entry_id=(b->>'rosterEntryId')::uuid and c.participant_id=(b->>'participantId')::uuid
    and c.profile_id=(b->>'profileId')::uuid and c.decision='granted'
    and c.version=(select max(x.version)from app.native_mixed_digital_consent_decisions_v1 x where x.scope_id=s.id and x.roster_entry_id=c.roster_entry_id)))
 then return jsonb_build_object('status','blocked','code','six_current_digital_consents_required');end if;
 if d.id is null or rv.id is null or rv.declaration_id<>d.id or rv.preparer_id<>d.preparer_id or rv.reviewer_id=d.preparer_id
  or app.native_mixed_attendance_declaration_bound_v1(d.id)is distinct from true
  or app.native_mixed_attendance_review_bound_v1(rv.id)is distinct from true
  or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=d.preparer_id and role='director')
  or not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=rv.reviewer_id and role='cross_checker')
  or(select count(*)from app.native_mixed_paper_declaration_entries_v1 where declaration_id=d.id and profile_id is null and mode='paper'and fictional)<>12
  or exists(select 1 from jsonb_array_elements(d.entries_capture)x where not exists(
   select 1 from app.native_mixed_paper_declaration_entries_v1 e where e.declaration_id=d.id
    and e.roster_entry_id=(x->>'rosterEntryId')::uuid and e.participant_id=(x->>'participantId')::uuid
    and e.profile_id is null and e.mode='paper'and e.fictional))
  or exists(select 1 from app.native_mixed_paper_declaration_entries_v1 e where e.declaration_id=d.id and not exists(
   select 1 from jsonb_array_elements(s.roster_capture)x where x->>'mode'='paper'and x->>'profileId'is null
    and e.roster_entry_id=(x->>'rosterEntryId')::uuid and e.participant_id=(x->>'participantId')::uuid))
 then return jsonb_build_object('status','blocked','code','independent_paper_review_required');end if;
 paper:=jsonb_build_object('declarationId',d.id,'preparerId',d.preparer_id,'entries',d.entries_capture,'operationId',d.operation_id,'sourceDigest',d.source_digest,'fictional',true);
 review:=jsonb_build_object('reviewId',rv.id,'reviewerId',rv.reviewer_id,'declarationId',d.id,'operationId',rv.operation_id,'sourceDigest',rv.source_digest,'decision',rv.decision);
 source:=jsonb_build_object('scopeId',s.id,'version',s.version,'admissionIntentId',s.admission_intent_id,'fundingScopeId',s.funding_scope_id,
  'fundingSourceDigest',s.funding_source_digest,'operationalBindingId',s.operational_binding_id,'participantCount',18,'digitalCount',6,'paperCount',12,'sourceDigest',s.source_digest);
 digest:=encode(extensions.digest(convert_to(jsonb_build_array('native-mixed-attendance-source-v1',tid,eid,source,consents,paper,review)::text,'utf8'),'sha256'),'hex');
 return jsonb_build_object('status','source_available','kind','native-mixed-attendance-source-v1','tournamentId',tid,'eventId',eid,
  'scope',source,'digitalConsents',consents,'paperDeclaration',paper,'paperReview',review,'sourceDigest',digest,
  'ordinaryAttendanceUsed',false,'paymentVerified',false,'humanPresenceVerified',false,'physicalPresenceVerified',false,
  'actualMoneyReceived',false,'moneyMoved',false,'refundAuthorized',false,'payoutAuthorized',false,'finalizationAuthorized',false,
  'normalDrawAuthorized',false,'normalStartAuthorized',false);
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.seal_native_mixed_attendance_v1(actor uuid,tid uuid,eid uuid,request jsonb)returns jsonb
language plpgsql security definer set search_path=''set timezone='UTC'set lock_timeout='250ms'as $$
declare op uuid;s app.native_mixed_attendance_scopes_v1%rowtype;d app.native_mixed_paper_declarations_v1%rowtype;rv app.native_mixed_paper_reviews_v1%rowtype;
 o app.native_mixed_attendance_operations_v1%rowtype;r jsonb;source jsonb;new_id uuid:=extensions.gen_random_uuid();begin
 if app.native_mixed_attendance_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 if app.native_mixed_attendance_seal_request_valid_v1(request)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;op:=(request->>'operationId')::uuid;
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended('native-mixed-attendance-v1:'||tid::text||':'||eid::text,0))then return jsonb_build_object('status','retry_exact','code','source_busy');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 perform app.lock_native_mixed_attendance_sources_v1();select*into o from app.native_mixed_attendance_operations_v1 where actor_id=actor and operation_id=op;
 if found then if o.action<>'seal'or o.request_payload is distinct from request then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;select result into r from app.native_mixed_attendance_outcomes_v1 where actor_id=actor and operation_id=op;return r;end if;
 if app.native_mixed_attendance_preactivity_v1(tid,eid)is distinct from true then return jsonb_build_object('status','rejected','code','predraw_seal_required');end if;
 select*into s from app.native_mixed_attendance_scopes_v1 where id=(request->>'expectedScopeId')::uuid and tournament_id=tid and event_id=eid;
 select*into d from app.native_mixed_paper_declarations_v1 where id=(request->>'expectedDeclarationId')::uuid and scope_id=s.id;
 select*into rv from app.native_mixed_paper_reviews_v1 where id=(request->>'expectedReviewId')::uuid and scope_id=s.id and declaration_id=d.id;
 if s.id is null or s.source_digest<>request->>'expectedScopeDigest'or d.id is null or rv.id is null then return jsonb_build_object('status','rejected','code','source_changed');end if;
 if exists(select 1 from app.native_mixed_attendance_seals_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','already_sealed');end if;
 source:=app.native_mixed_attendance_projection_v1(tid,eid);if source->>'status'<>'source_available'then return jsonb_build_object('status','rejected','code',coalesce(source->>'code','readiness_incomplete'));end if;
 if app.native_mixed_attendance_insert_operation_v1(actor,op,tid,eid,'seal',request)is null then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 insert into app.native_mixed_attendance_seals_v1 values(new_id,s.id,d.id,rv.id,tid,eid,actor,op,source,source->>'sourceDigest',request->>'reason',false,false,clock_timestamp());
 r:=jsonb_build_object('kind','native-mixed-attendance-receipt-v1','action','seal','status','accepted','code','predraw_simulation_readiness_sealed','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'request',request,'sealId',new_id,'sourceDigest',source->>'sourceDigest','normalDrawAuthorized',false,'normalStartAuthorized',false);
 insert into app.native_mixed_attendance_outcomes_v1 values(actor,op,tid,eid,r,clock_timestamp());return r;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.native_mixed_attendance_source_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$declare v jsonb;seal_id uuid;begin
 if app.native_mixed_attendance_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 select id into seal_id from app.native_mixed_attendance_seals_v1 where tournament_id=tid and event_id=eid;if seal_id is null then return jsonb_build_object('status','blocked','code','readiness_seal_required');end if;
 v:=app.native_mixed_attendance_projection_v1(tid,eid);
 if v->>'status'='source_available'and not exists(select 1 from app.native_mixed_attendance_seals_v1 z
  where z.id=seal_id and z.source_capture is not distinct from v and z.source_digest=v->>'sourceDigest'
   and app.native_mixed_attendance_operation_bound_v1(z.actor_id,z.operation_id,'seal')is true)
 then return jsonb_build_object('status','blocked','code','readiness_seal_changed');end if;
 return case when v->>'status'='source_available'then v||jsonb_build_object('actorId',actor,'sealId',seal_id)else v end;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');end$$;

create function app.get_native_mixed_attendance_operation_v1(actor uuid,tid uuid,eid uuid,op uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$declare o app.native_mixed_attendance_operations_v1%rowtype;r jsonb;begin
 if app.native_mixed_attendance_enabled_v1()is distinct from true then return jsonb_build_object('status','rejected','code','feature_unavailable');end if;
 if current_setting('transaction_isolation')<>'read committed'or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'service_role'or actor is null then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for key share nowait;if not found then return null;end if;
 select*into o from app.native_mixed_attendance_operations_v1 where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;if not found then return null;end if;
 select result into r from app.native_mixed_attendance_outcomes_v1 where actor_id=actor and operation_id=op;
 return case when r is null then null else jsonb_build_object('kind','native-mixed-attendance-operation-v1','actorId',actor,'tournamentId',tid,'eventId',eid,'operationId',op,'action',o.action,'request',o.request_payload,'receipt',r,'historicalReceipt',true,'currentSourceVerified',false)end;
end$$;

-- Reciprocally reserve attendance operation IDs against later admission and
-- funding writes without changing either frozen proposal file.
create function app.reject_native_mixed_attendance_operation_collision_v1()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from app.native_mixed_attendance_operations_v1 where actor_id=new.actor_id and operation_id=new.operation_id)
 then raise exception using errcode='23505',message='native mixed attendance operation reserved';end if;return new;end$$;
create trigger native_mixed_admission_attendance_operation_guard_v1 before insert on app.native_mixed_admission_operations_v1
 for each row execute function app.reject_native_mixed_attendance_operation_collision_v1();
create trigger native_mixed_funding_attendance_operation_guard_v1 before insert on app.native_mixed_funding_operations_v1
 for each row execute function app.reject_native_mixed_attendance_operation_collision_v1();

do $$declare p regprocedure;begin foreach p in array array[
 'app.native_mixed_attendance_enabled_v1()'::regprocedure,'app.native_mixed_attendance_uuid_v1(text)'::regprocedure,
 'app.native_mixed_attendance_reason_v1(jsonb,text)'::regprocedure,'app.native_mixed_attendance_scope_request_valid_v1(jsonb)'::regprocedure,
 'app.native_mixed_attendance_consent_request_valid_v1(jsonb)'::regprocedure,'app.native_mixed_attendance_declaration_request_valid_v1(jsonb)'::regprocedure,
 'app.native_mixed_attendance_review_request_valid_v1(jsonb)'::regprocedure,'app.native_mixed_attendance_seal_request_valid_v1(jsonb)'::regprocedure,
 'app.lock_native_mixed_attendance_sources_v1()'::regprocedure,'app.native_mixed_attendance_preactivity_v1(uuid,uuid)'::regprocedure,
 'app.native_mixed_attendance_operation_reserved_v1(uuid,uuid)'::regprocedure,'app.native_mixed_attendance_scope_current_v1(uuid)'::regprocedure,
 'app.native_mixed_attendance_insert_operation_v1(uuid,uuid,uuid,uuid,text,jsonb)'::regprocedure,
 'app.native_mixed_attendance_operation_bound_v1(uuid,uuid,text)'::regprocedure,'app.native_mixed_attendance_scope_bound_v1(uuid)'::regprocedure,
 'app.native_mixed_attendance_consent_bound_v1(uuid)'::regprocedure,'app.native_mixed_attendance_declaration_bound_v1(uuid)'::regprocedure,
 'app.native_mixed_attendance_review_bound_v1(uuid)'::regprocedure,
 'app.save_native_mixed_attendance_scope_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.record_native_mixed_digital_consent_v1(uuid,uuid,jsonb)'::regprocedure,
 'app.record_native_mixed_paper_declaration_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.review_native_mixed_paper_declaration_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.native_mixed_attendance_projection_v1(uuid,uuid)'::regprocedure,'app.seal_native_mixed_attendance_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'app.native_mixed_attendance_source_v1(uuid,uuid,uuid)'::regprocedure,
 'app.get_native_mixed_attendance_operation_v1(uuid,uuid,uuid,uuid)'::regprocedure,
 'app.reject_native_mixed_attendance_operation_collision_v1()'::regprocedure
]loop execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);end loop;end$$;
commit;
