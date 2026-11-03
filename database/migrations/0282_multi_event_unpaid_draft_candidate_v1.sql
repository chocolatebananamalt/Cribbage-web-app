-- LOCAL ONLY. Candidate draft machinery is deliberately inaccessible until the
-- source-backed 0281 preview has passed its structured lifecycle verification.
-- No finalization, funding interpretation, payment, or historical rewrite.
begin;
create table app.multi_event_unpaid_drafts_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version between 1 and 256),source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 preview jsonb not null check(jsonb_typeof(preview)='object'),reason text not null check(length(reason)between 21 and 500 and left(reason,20)='TEST ONLY SYNTHETIC:'),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(event_id,version),unique(id,tournament_id,event_id)
);
alter table app.multi_event_unpaid_drafts_v1 enable row level security;
alter table app.multi_event_unpaid_drafts_v1 force row level security;
revoke all on app.multi_event_unpaid_drafts_v1 from public,anon,authenticated,service_role;
create trigger multi_event_unpaid_drafts_immutable_v1 before update or delete on app.multi_event_unpaid_drafts_v1 for each row execute function app.reject_immutable_history();
create index multi_event_unpaid_drafts_receipt_v1 on app.multi_event_unpaid_drafts_v1(operation_receipt_id,tournament_id);

create function app.write_multi_event_unpaid_draft_candidate_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare preview jsonb;prior app.operation_receipts%rowtype;v integer;h text;result jsonb;id uuid:=extensions.gen_random_uuid();receipt uuid:=extensions.gen_random_uuid();locked uuid[];
begin
 if actor is null or tid is null or eid is null or op is null or coalesce(auth.role(),'')<>'service_role' then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||op::text,0));
 locked:=app.lock_consolation_qualification_sources_v1(tid,eid);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('standard-singles-post-event:'||eid::text,0));
 perform 1 from app.tournaments t where t.id=tid and t.status='open' for update;
 if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 if locked is distinct from coalesce((select array_agg(e.id order by e.id)from app.events e where e.tournament_id=tid and (e.id=eid or (e.event_type='main' and e.operational_state='active'))),'{}'::uuid[])then return jsonb_build_object('status','rejected','code','source_changed');end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director')then return jsonb_build_object('status','rejected','code','not_director');end if;
 perform 1 from app.events e where e.tournament_id=tid and e.id=any(locked) order by e.id for update;
 perform 1 from app.canonical_games g where g.tournament_id=tid and g.event_id=any(locked) order by g.event_id,g.id for update;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('multi_event_unpaid_draft_candidate_v1',tid,eid,req)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if prior.operation_type='multi_event_unpaid_draft_candidate_v1' and prior.tournament_id=tid and prior.target_id=eid and prior.request_hash=h then return prior.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 if jsonb_typeof(req)is distinct from'object' or not(req?&array['expectedVersion','sourceDigest','reason','reviewed']) or (select count(*)from jsonb_object_keys(req))<>4
  or jsonb_typeof(req->'expectedVersion')is distinct from'number' or coalesce(req->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,2})$'
  or jsonb_typeof(req->'sourceDigest')is distinct from'string' or coalesce(req->>'sourceDigest','')!~'^[a-f0-9]{64}$' or req->'reviewed'is distinct from'true'::jsonb
  or jsonb_typeof(req->'reason')is distinct from'string' or length(req->>'reason') not between 21 and 500 or req->>'reason'<>trim(req->>'reason') or req->>'reason'~'[[:cntrl:]]' or left(req->>'reason',20)<>'TEST ONLY SYNTHETIC:' or length(trim(substr(req->>'reason',21)))=0 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 select coalesce(max(version),0)into v from app.multi_event_unpaid_drafts_v1 where tournament_id=tid and event_id=eid;
 if v>=256 or v<>(req->>'expectedVersion')::integer then return jsonb_build_object('status','rejected','code','stale_version');end if;
 preview:=public.get_multi_event_award_preview_v1(actor,tid,eid);
 if preview->>'status'is distinct from'preview' or preview->>'moneyMoved'is distinct from'false' or preview->>'accountingAvailable'is distinct from'false' then return jsonb_build_object('status','rejected','code','preview_blocked');end if;
 if preview->>'sourceDigest' is distinct from req->>'sourceDigest' then return jsonb_build_object('status','rejected','code','source_changed');end if;
 result:=jsonb_build_object('status','synthetic_unpaid_draft_saved','draftId',id,'eventId',eid,'version',v+1,'sourceDigest',preview->'sourceDigest','moneyMoved',false,'financialFinalized',false);
 insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(receipt,tid,actor,'multi_event_unpaid_draft_candidate_v1',eid,h,op,'accepted',result,clock_timestamp());
 insert into app.multi_event_unpaid_drafts_v1(id,tournament_id,event_id,version,source_digest,preview,reason,actor_id,operation_receipt_id)values(id,tid,eid,v+1,preview->>'sourceDigest',preview,req->>'reason',actor,receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,receipt,'multi_event_unpaid_draft',id,'synthetic_unpaid_draft_saved',result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_request');end$$;
revoke all on function app.write_multi_event_unpaid_draft_candidate_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated,service_role;

create function public.save_multi_event_unpaid_draft_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb
language sql immutable set search_path='' as $$select jsonb_build_object('status','rejected','code','structured_preview_verification_pending','moneyMoved',false);$$;
revoke all on function public.save_multi_event_unpaid_draft_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.save_multi_event_unpaid_draft_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;
commit;
