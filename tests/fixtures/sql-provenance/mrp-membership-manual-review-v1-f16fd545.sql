-- PRIVATE SOURCE PROPOSAL. NOT EXECUTED, NOT A REGISTERED MIGRATION.
-- Manual evidence journal only. No applicable-membership date is inferred;
-- no eligibility, MRP, registration, roster identity or result is written.
-- Requires existing 0001 receipts/audit/immutable history, 0113 roster binding,
-- 0210 ACC identity normalization and 0211 primary-director authorization.
begin;

create function app.mrp_manual_review_enabled_v1() returns boolean
language sql immutable set search_path='' as $$select false$$;

create function app.mrp_manual_review_actor_v1(tid uuid) returns uuid
language plpgsql security definer set search_path='' set lock_timeout='250ms' as $$
declare actor uuid:=auth.uid();claims jsonb:=auth.jwt();sid text;begin
 if actor is null or claims->>'sub'is distinct from actor::text or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),claims->>'role','')<>'authenticated'
  or jsonb_typeof(claims->'exp')is distinct from'number'or coalesce(claims->>'exp','')!~'^[0-9]{1,16}$' then return null;end if;
 if (claims->>'exp')::numeric<=extract(epoch from clock_timestamp())then return null;end if;
 sid:=claims->>'session_id';if coalesce(sid,'')!~*'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return null;end if;
 perform 1 from auth.users where id=actor and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from auth.sessions where id=sid::uuid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then return null;end if;
 perform 1 from app.tournaments where id=tid and director_profile_id=actor for share nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director'for share nowait;if not found then return null;end if;
 if app.setup_official_is_primary_director_v1(actor,tid)is distinct from true then return null;end if;
 return actor;
end$$;

create table app.mrp_membership_manual_reviews_v1(
 id uuid primary key,tournament_id uuid not null,event_id uuid not null,roster_entry_id uuid not null,
 version integer not null check(version>0),prior_id uuid,prior_digest text,
 action text not null check(action in('observation','correction','withdrawal')),
 observation_id uuid,supersedes_correction_id uuid,data jsonb not null check(jsonb_typeof(data)='object'),
 actor_id uuid not null references app.profiles(id),actor_session_id uuid not null,
 operation_receipt_id uuid not null,recorded_at timestamptz not null,record_digest text not null check(record_digest~'^[a-f0-9]{64}$'),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(roster_entry_id,tournament_id)references app.tournament_roster_entries(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id,roster_entry_id,version),unique(id,tournament_id,event_id,roster_entry_id),
 foreign key(prior_id,tournament_id,event_id,roster_entry_id)references app.mrp_membership_manual_reviews_v1(id,tournament_id,event_id,roster_entry_id),
 foreign key(observation_id,tournament_id,event_id,roster_entry_id)references app.mrp_membership_manual_reviews_v1(id,tournament_id,event_id,roster_entry_id),
 foreign key(supersedes_correction_id,tournament_id,event_id,roster_entry_id)references app.mrp_membership_manual_reviews_v1(id,tournament_id,event_id,roster_entry_id),
 check((version=1)=(prior_id is null)),check((prior_id is null)=(prior_digest is null)),
 check(prior_digest is null or prior_digest~'^[a-f0-9]{64}$'),
 check((action='observation')=(observation_id is null)),check(action<>'observation'or supersedes_correction_id is null)
);
alter table app.mrp_membership_manual_reviews_v1 enable row level security;
alter table app.mrp_membership_manual_reviews_v1 force row level security;
revoke all on app.mrp_membership_manual_reviews_v1 from public,anon,authenticated,service_role;
create trigger mrp_membership_manual_reviews_v1_immutable before update or delete on app.mrp_membership_manual_reviews_v1
 for each row execute function app.reject_immutable_history();
create index mrp_manual_review_receipt_idx on app.mrp_membership_manual_reviews_v1(operation_receipt_id,tournament_id);
create index mrp_manual_review_actor_idx on app.mrp_membership_manual_reviews_v1(actor_id);
create index mrp_manual_review_observation_idx on app.mrp_membership_manual_reviews_v1(observation_id,tournament_id,event_id,roster_entry_id);
create index mrp_manual_review_supersedes_idx on app.mrp_membership_manual_reviews_v1(supersedes_correction_id,tournament_id,event_id,roster_entry_id);

create function app.mrp_manual_review_request_valid_v1(request jsonb)returns boolean
language plpgsql immutable set search_path=''as $$declare d jsonb;k text;v text;begin
 if jsonb_typeof(request)is distinct from'object'or(select count(*)from jsonb_object_keys(request))<>8
  or not(request?&array['version','action','rosterEntryId','expectedHeadId','expectedHeadDigest','observationId','supersedesCorrectionId','data'])
  or request->>'version'is distinct from'mrp-membership-manual-review-v1'
  or coalesce(request->>'action','')not in('observation','correction','withdrawal')
  or coalesce(request->>'rosterEntryId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return false;end if;
 foreach k in array array['expectedHeadId','observationId','supersedesCorrectionId']loop
  if request->k<>'null'::jsonb and coalesce(request->>k,'')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'then return false;end if;
 end loop;
 if(request->'expectedHeadId'='null'::jsonb)is distinct from(request->'expectedHeadDigest'='null'::jsonb)
  or(request->'expectedHeadDigest'<>'null'::jsonb and coalesce(request->>'expectedHeadDigest','')!~'^[a-f0-9]{64}$')then return false;end if;
 d:=request->'data';if jsonb_typeof(d)is distinct from'object'then return false;end if;
 if request->>'action'='observation'then
  if request->'observationId'<>'null'::jsonb or request->'supersedesCorrectionId'<>'null'::jsonb
   or(select count(*)from jsonb_object_keys(d))<>7 or not(d?&array['status','observedAt','sourceReference','sourceAsOf','evidenceDate','evidenceReference','observedAccNumber'])
   or coalesce(d->>'status','')not in('active','inactive','nonmember','unknown','not_found','unavailable')
   or coalesce(d->>'observedAt','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
   or jsonb_typeof(d->'sourceReference')is distinct from'string'or length(d->>'sourceReference')not between 1 and 500
   or d->>'sourceReference'<>trim(d->>'sourceReference')or d->>'sourceReference'~'[[:cntrl:]]'then return false;end if;
  perform(d->>'observedAt')::timestamptz;
  if to_char((d->>'observedAt')::timestamptz at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>d->>'observedAt'then return false;end if;
  if d->'observedAccNumber'<>'null'::jsonb and(jsonb_typeof(d->'observedAccNumber')is distinct from'string'
   or coalesce(d->>'observedAccNumber','')!~'^[A-Z]{2}[0-9]+Y?$'or length(d->>'observedAccNumber')>64)then return false;end if;
  if d->>'status'in('active','inactive','nonmember')and d->'observedAccNumber'='null'::jsonb then return false;end if;
 else
  if request->'observationId'='null'::jsonb
   or(select count(*)from jsonb_object_keys(d))<>(case when request->>'action'='correction'then 6 else 4 end)
   or not(d?&array['reason','evidenceReference','evidenceDate','sourceAsOf'])
   or jsonb_typeof(d->'reason')is distinct from'string'or length(d->>'reason')not between 1 and 500
   or d->>'reason'<>trim(d->>'reason')or d->>'reason'~'[[:cntrl:]]'then return false;end if;
  if request->>'action'='correction'and(d->>'status'is distinct from'verified_active'or d->>'reasonCode'is distinct from'website_reporting_error')then return false;end if;
 end if;
 if jsonb_typeof(d->'evidenceReference')is distinct from'string'or length(d->>'evidenceReference')not between 1 and 500
  or d->>'evidenceReference'<>trim(d->>'evidenceReference')or d->>'evidenceReference'~'[[:cntrl:]]'then return false;end if;
 foreach k in array array['sourceAsOf','evidenceDate']loop
  if d->k<>'null'::jsonb then v:=d->>k;if jsonb_typeof(d->k)is distinct from'string'or coalesce(v,'')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'or to_char(v::date,'YYYY-MM-DD')<>v then return false;end if;end if;
 end loop;
 return true;
exception when invalid_datetime_format or datetime_field_overflow then return false;
end$$;

-- No actor parameter: the normal authenticated cookie session owns the request.
create function public.record_mrp_membership_manual_review_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$
declare actor uuid;rid uuid;entry uuid;head app.mrp_membership_manual_reviews_v1%rowtype;
 observation app.mrp_membership_manual_reviews_v1%rowtype;correction app.mrp_membership_manual_reviews_v1%rowtype;
 old app.operation_receipts%rowtype;h text;digest text;receipt uuid;recorded timestamptz;response jsonb;code text;acc text;
begin
 if app.mrp_manual_review_enabled_v1()is distinct from true then return jsonb_build_object('status','blocked','code','feature_disabled');end if;
 actor:=app.mrp_manual_review_actor_v1(p_tournament_id);if actor is null then return jsonb_build_object('status','blocked','code','permission_required');end if;
 if p_event_id is null or p_operation_id is null or p_request is null or octet_length(convert_to(p_request::text,'UTF8'))>8192
  or app.mrp_manual_review_request_valid_v1(p_request)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 entry:=(p_request->>'rosterEntryId')::uuid;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('mrp-membership-manual-review-v1',actor,p_tournament_id,p_event_id,p_request)::text,'UTF8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||p_operation_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mrp-membership-manual-review:'||p_event_id::text||':'||entry::text,0));
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=p_operation_id;
 if found then
  if old.tournament_id=p_tournament_id and old.operation_type='mrp_membership_manual_review_v1'and old.target_id=p_event_id and old.request_hash=h then return old.response_payload;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 begin
  select app.acc_identity_key_v1(r.claimed_acc_number)into acc from app.tournament_roster_entries r
   join app.event_participants p on p.roster_entry_id=r.id and p.tournament_id=r.tournament_id
   where r.id=entry and r.tournament_id=p_tournament_id and p.event_id=p_event_id for share of r,p nowait;
  if not found then raise exception using errcode='22023',message='entry_unavailable';end if;
  select*into head from app.mrp_membership_manual_reviews_v1 where tournament_id=p_tournament_id and event_id=p_event_id and roster_entry_id=entry order by version desc limit 1;
  if head.id is distinct from(p_request->>'expectedHeadId')::uuid or head.record_digest is distinct from p_request->>'expectedHeadDigest'then raise exception using errcode='22023',message='stale_head';end if;
  if p_request->>'action'='observation'then
   if(p_request#>>'{data,observedAt}')::timestamptz>clock_timestamp()then raise exception using errcode='22023',message='future_observation';end if;
   if p_request#>'{data,observedAccNumber}'<>'null'::jsonb and(nullif(acc,'')is null or app.acc_identity_key_v1(p_request#>>'{data,observedAccNumber}')is distinct from acc)then raise exception using errcode='22023',message='identity_mismatch';end if;
  else
   select*into observation from app.mrp_membership_manual_reviews_v1 where tournament_id=p_tournament_id and event_id=p_event_id and roster_entry_id=entry and action='observation'order by version desc limit 1;
   if observation.id is null or observation.id is distinct from(p_request->>'observationId')::uuid then raise exception using errcode='22023',message='stale_observation';end if;
   select*into correction from app.mrp_membership_manual_reviews_v1 where tournament_id=p_tournament_id and event_id=p_event_id and roster_entry_id=entry and observation_id=observation.id order by version desc limit 1;
   if correction.id is distinct from(p_request->>'supersedesCorrectionId')::uuid then raise exception using errcode='22023',message='stale_correction';end if;
   if p_request->>'action'='correction'and observation.data->>'status'not in('inactive','nonmember')then raise exception using errcode='22023',message='definitive_website_error_required';end if;
   if p_request->>'action'='withdrawal'and(correction.id is null or correction.action<>'correction')then raise exception using errcode='22023',message='current_correction_required';end if;
  end if;
  rid:=extensions.gen_random_uuid();receipt:=extensions.gen_random_uuid();recorded:=clock_timestamp();
  digest:=encode(extensions.digest(convert_to(jsonb_build_array('mrp-membership-manual-review-record-v1',rid,p_tournament_id,p_event_id,entry,coalesce(head.version,0)+1,head.id,head.record_digest,p_request,actor,auth.jwt()->>'session_id',recorded)::text,'UTF8'),'sha256'),'hex');
  response:=jsonb_build_object('status','manual_review_recorded','recordId',rid,'version',coalesce(head.version,0)+1,'recordDigest',digest,'recordedAt',recorded,
   'tournamentId',p_tournament_id,'eventId',p_event_id,'rosterEntryId',entry,'action',p_request->>'action','eligibility','review_pending','awarded',null,'currentHeadVerified',false,'officialEligibilityDetermined',false,'registrationChanged',false,'mrpWritten',false);
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(receipt,p_tournament_id,actor,'mrp_membership_manual_review_v1',p_event_id,h,p_operation_id,'accepted',response,recorded);
  insert into app.mrp_membership_manual_reviews_v1(id,tournament_id,event_id,roster_entry_id,version,prior_id,prior_digest,action,observation_id,supersedes_correction_id,data,actor_id,actor_session_id,operation_receipt_id,recorded_at,record_digest)
   values(rid,p_tournament_id,p_event_id,entry,coalesce(head.version,0)+1,head.id,head.record_digest,p_request->>'action',(p_request->>'observationId')::uuid,(p_request->>'supersedesCorrectionId')::uuid,p_request->'data',actor,(auth.jwt()->>'session_id')::uuid,receipt,recorded,digest);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state)
   values(p_tournament_id,actor,receipt,'mrp_membership_manual_review',rid,'mrp_membership_manual_review_recorded',jsonb_build_object('headId',head.id,'headDigest',head.record_digest),response||jsonb_build_object('evidence',p_request->'data','observationId',p_request->'observationId','supersedesCorrectionId',p_request->'supersedesCorrectionId'));
  return response;
 exception when invalid_parameter_value then
  code:=sqlerrm;if code not in('entry_unavailable','stale_head','future_observation','identity_mismatch','stale_observation','stale_correction','definitive_website_error_required','current_correction_required')then raise;end if;
  response:=jsonb_build_object('status','rejected','code',code);receipt:=extensions.gen_random_uuid();
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(receipt,p_tournament_id,actor,'mrp_membership_manual_review_v1',p_event_id,h,p_operation_id,'rejected',response,clock_timestamp());
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
   values(p_tournament_id,actor,receipt,'mrp_membership_manual_review',entry,'mrp_membership_manual_review_rejected',response);
  return response;
 end;
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;

-- Fresh head only; a replay receipt never claims that its record is current.
create function public.get_mrp_membership_manual_review_v1(p_tournament_id uuid,p_event_id uuid,p_roster_entry_id uuid)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$declare actor uuid;result jsonb;begin
 if app.mrp_manual_review_enabled_v1()is distinct from true then return null;end if;
 actor:=app.mrp_manual_review_actor_v1(p_tournament_id);if actor is null then return null;end if;
 if not exists(select 1 from app.event_participants where tournament_id=p_tournament_id and event_id=p_event_id and roster_entry_id=p_roster_entry_id)then return null;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mrp-membership-manual-review:'||p_event_id::text||':'||p_roster_entry_id::text,0));
 select jsonb_build_object('kind','mrp-membership-manual-review-workspace-v1','tournamentId',p_tournament_id,'eventId',p_event_id,'rosterEntryId',p_roster_entry_id,
  'currentHeadId',h.id,'currentHeadDigest',h.record_digest,'currentVersion',coalesce(h.version,0),
  'records',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'priorId',r.prior_id,'recordDigest',r.record_digest,'action',r.action,'observationId',r.observation_id,'supersedesCorrectionId',r.supersedes_correction_id,'data',r.data,'actorId',r.actor_id,'recordedAt',r.recorded_at)order by r.version)from app.mrp_membership_manual_reviews_v1 r where r.tournament_id=p_tournament_id and r.event_id=p_event_id and r.roster_entry_id=p_roster_entry_id),'[]'),
  'eligibility','review_pending','awarded',null,'officialEligibilityDetermined',false,'registrationChanged',false,'mrpWritten',false)into result
 from(select 1)x left join lateral(select*from app.mrp_membership_manual_reviews_v1 where tournament_id=p_tournament_id and event_id=p_event_id and roster_entry_id=p_roster_entry_id order by version desc limit 1)h on true;
 return result;
exception when lock_not_available then return null;
end$$;

create function public.get_mrp_membership_manual_review_operation_v1(p_tournament_id uuid,p_event_id uuid,p_operation_id uuid,p_request jsonb)returns jsonb
language plpgsql security definer set search_path=''set lock_timeout='250ms'as $$declare actor uuid;old app.operation_receipts%rowtype;h text;begin
 if app.mrp_manual_review_enabled_v1()is distinct from true then return null;end if;
 actor:=app.mrp_manual_review_actor_v1(p_tournament_id);if actor is null then return null;end if;
 if p_event_id is null or p_operation_id is null or p_request is null or octet_length(convert_to(p_request::text,'UTF8'))>8192
  or app.mrp_manual_review_request_valid_v1(p_request)is distinct from true then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('mrp-membership-manual-review-v1',actor,p_tournament_id,p_event_id,p_request)::text,'UTF8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||p_operation_id::text,0));
 select*into old from app.operation_receipts where actor_profile_id=actor and client_operation_id=p_operation_id;
 if not found then return jsonb_build_object('status','not_found','writeAuthorized',false,'currentHeadVerified',false);end if;
 if old.tournament_id=p_tournament_id and old.operation_type='mrp_membership_manual_review_v1'and old.target_id=p_event_id and old.request_hash=h then return old.response_payload;end if;
 return jsonb_build_object('status','rejected','code','idempotency_conflict');
exception when lock_not_available then return jsonb_build_object('status','retry_exact','code','source_busy');
end$$;

do $closed$declare p regprocedure;begin foreach p in array array[
 'app.mrp_manual_review_enabled_v1()'::regprocedure,'app.mrp_manual_review_actor_v1(uuid)'::regprocedure,
 'app.mrp_manual_review_request_valid_v1(jsonb)'::regprocedure,
 'public.record_mrp_membership_manual_review_v1(uuid,uuid,uuid,jsonb)'::regprocedure,
 'public.get_mrp_membership_manual_review_v1(uuid,uuid,uuid)'::regprocedure,
 'public.get_mrp_membership_manual_review_operation_v1(uuid,uuid,uuid,jsonb)'::regprocedure]loop
 execute format('alter function %s owner to postgres',p);execute format('revoke all on function %s from public,anon,authenticated,service_role',p);
end loop;end$closed$;
alter table app.mrp_membership_manual_reviews_v1 owner to postgres;
commit;
