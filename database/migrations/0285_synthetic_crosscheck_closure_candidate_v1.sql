-- LOCAL ONLY. Candidate source-bound synthetic closure; public access remains
-- disabled until full structured-lifecycle and concurrency verification.
begin;
create table app.synthetic_event_crosscheck_closures_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),reviewer_profile_ids jsonb not null check(jsonb_typeof(reviewer_profile_ids)='array' and jsonb_array_length(reviewer_profile_ids)>0),
 reason text not null check(length(reason)between 21 and 500 and left(reason,20)='TEST ONLY SYNTHETIC:'),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 human_review_claimed boolean not null default false check(not human_review_claimed),physical_play_claimed boolean not null default false check(not physical_play_claimed),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),
 unique(event_id),unique(id,tournament_id,event_id)
);
alter table app.synthetic_event_crosscheck_closures_v1 enable row level security;
alter table app.synthetic_event_crosscheck_closures_v1 force row level security;
revoke all on app.synthetic_event_crosscheck_closures_v1 from public,anon,authenticated,service_role;
create trigger synthetic_event_crosscheck_closures_immutable_v1 before update or delete on app.synthetic_event_crosscheck_closures_v1 for each row execute function app.reject_immutable_history();
create index synthetic_event_crosscheck_closures_receipt_v1 on app.synthetic_event_crosscheck_closures_v1(operation_receipt_id,tournament_id);

create function app.close_synthetic_event_crosscheck_candidate_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare previous app.operation_receipts%rowtype;readiness jsonb;reviewers jsonb;h text;receipt uuid:=extensions.gen_random_uuid();id uuid:=extensions.gen_random_uuid();result jsonb;locked uuid[];
begin
 if actor is null or tid is null or eid is null or op is null or coalesce(auth.role(),'')<>'service_role' then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||op::text,0));
 locked:=app.lock_consolation_qualification_sources_v1(tid,eid);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||eid::text,0));
 perform 1 from app.tournaments t where t.id=tid and t.status in('open','pending_finalization') for update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 if locked is distinct from coalesce((select array_agg(e.id order by e.id)from app.events e where e.tournament_id=tid and (e.id=eid or (e.event_type='main' and e.operational_state='active'))),'{}'::uuid[])then return jsonb_build_object('status','rejected','code','source_changed');end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director')then return jsonb_build_object('status','rejected','code','not_director');end if;
 perform 1 from app.events e where e.tournament_id=tid and e.id=any(locked) order by e.id for update;
 perform 1 from app.canonical_games g where g.tournament_id=tid and g.event_id=any(locked) order by g.event_id,g.id for update;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('synthetic_event_crosscheck_closure_candidate_v1',tid,eid,req)::text,'utf8'),'sha256'),'hex');
 select * into previous from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if previous.tournament_id=tid and previous.target_id=eid and previous.operation_type='synthetic_event_crosscheck_closure_candidate_v1' and previous.request_hash=h then return previous.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 if jsonb_typeof(req)is distinct from'object' or not(req?&array['sourceDigest','reason','reviewed']) or (select count(*)from jsonb_object_keys(req))<>3 or jsonb_typeof(req->'sourceDigest')is distinct from'string' or coalesce(req->>'sourceDigest','')!~'^[a-f0-9]{64}$' or req->'reviewed'is distinct from'true'::jsonb or jsonb_typeof(req->'reason')is distinct from'string' or length(req->>'reason') not between 21 and 500 or req->>'reason'<>trim(req->>'reason') or req->>'reason'~'[[:cntrl:]]' or left(req->>'reason',20)<>'TEST ONLY SYNTHETIC:' or length(trim(substr(req->>'reason',21)))=0 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if exists(select 1 from app.synthetic_event_crosscheck_closures_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object('status','rejected','code','crosscheck_already_closed');end if;
 readiness:=app.synthetic_event_crosscheck_readiness_candidate_v1(actor,tid,eid);
 if readiness->>'status'is distinct from'candidate_ready'then return jsonb_build_object('status','rejected','code','crosscheck_not_ready');end if;
 if readiness->>'sourceDigest'is distinct from req->>'sourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 select coalesce(jsonb_agg(distinct p.actor_id order by p.actor_id),'[]')into reviewers from app.synthetic_paper_provenance_v1 p where p.tournament_id=tid and p.event_id=eid and p.phase='review';
 if jsonb_array_length(reviewers)=0 or exists(select 1 from jsonb_array_elements_text(reviewers)x where not exists(select 1 from app.tournament_roles r where r.tournament_id=tid and r.profile_id=x::uuid and r.role='cross_checker'))then return jsonb_build_object('status','rejected','code','crosschecker_role_required');end if;
 result:=jsonb_build_object('status','synthetic_event_crosscheck_closed','eventId',eid,'closureId',id,'sourceDigest',readiness->'sourceDigest','reviewerProfileIds',reviewers,'humanReviewClaimed',false,'physicalPlayClaimed',false,'moneyMoved',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,tid,actor,'synthetic_event_crosscheck_closure_candidate_v1',eid,h,op,'accepted',result,clock_timestamp());
 insert into app.synthetic_event_crosscheck_closures_v1(id,tournament_id,event_id,source_digest,reviewer_profile_ids,reason,actor_id,operation_receipt_id)values(id,tid,eid,readiness->>'sourceDigest',reviewers,req->>'reason',actor,receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,receipt,'synthetic_event_crosscheck_closure',id,'synthetic_event_crosscheck_closed',result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');end$$;
revoke all on function app.close_synthetic_event_crosscheck_candidate_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated,service_role;
create function public.close_synthetic_event_crosscheck_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb
language sql immutable set search_path=''as $$select jsonb_build_object('status','rejected','code','structured_crosscheck_verification_pending','humanReviewClaimed',false,'moneyMoved',false);$$;
revoke all on function public.close_synthetic_event_crosscheck_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.close_synthetic_event_crosscheck_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;
commit;
