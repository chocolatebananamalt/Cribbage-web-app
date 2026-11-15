-- LOCAL proposal. Classifies existing simulated event allocations, never creates money.
begin;
create function app.classify_multi_event_expenses_v1(expenses jsonb,classes jsonb,assessment bigint)returns jsonb
language plpgsql immutable set search_path=''as $$
declare e jsonb;c jsonb;amount numeric;total numeric:=0;benefit numeric:=0;operating numeric:=0;sanction numeric:=0;
begin
 if jsonb_typeof(expenses)is distinct from'array'or jsonb_typeof(classes)is distinct from'array'or assessment is null or assessment<0 or jsonb_array_length(expenses)>2048 or jsonb_array_length(classes)>4096 then return jsonb_build_object('status','blocked','code','invalid_expense_classification');end if;
 for e in select value from jsonb_array_elements(expenses)loop
  if jsonb_typeof(e)is distinct from'object'or coalesce(e->>'id','')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'or jsonb_typeof(e->'amountMinor')is distinct from'number'or coalesce(e->>'amountMinor','')!~'^[1-9][0-9]{0,8}$'then return jsonb_build_object('status','blocked','code','invalid_expense_source');end if;
  total:=total+(e->>'amountMinor')::numeric;
 end loop;
 if(select count(distinct value->>'id')from jsonb_array_elements(expenses))<>jsonb_array_length(expenses)then return jsonb_build_object('status','blocked','code','duplicate_expense_source');end if;
 for c in select value from jsonb_array_elements(classes)loop
  if jsonb_typeof(c)is distinct from'object'or not(c?&array['sourceId','category','amountMinor'])or(select count(*)from jsonb_object_keys(c))<>3
   or coalesce(c->>'category','')not in('operating','player_benefit','sanctioning')or jsonb_typeof(c->'amountMinor')is distinct from'number'or coalesce(c->>'amountMinor','')!~'^[1-9][0-9]{0,8}$'
   or not exists(select 1 from jsonb_array_elements(expenses)x where x->>'id'=c->>'sourceId')then return jsonb_build_object('status','blocked','code','invalid_expense_classification');end if;
  amount:=(c->>'amountMinor')::numeric;
  if c->>'category'='operating'then operating:=operating+amount;else benefit:=benefit+amount;end if;
  if c->>'category'='sanctioning'then sanction:=sanction+amount;end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(classes)class_item group by class_item->>'sourceId',class_item->>'category' having count(*)>1)then return jsonb_build_object('status','blocked','code','duplicate_expense_classification');end if;
 if exists(select 1 from jsonb_array_elements(expenses)expense_item where(expense_item->>'amountMinor')::numeric is distinct from(select coalesce(sum((class_item->>'amountMinor')::numeric),0)from jsonb_array_elements(classes)class_item where class_item->>'sourceId'=expense_item->>'id'))then return jsonb_build_object('status','blocked','code','expense_allocation_unbalanced');end if;
 if sanction<>assessment then return jsonb_build_object('status','blocked','code','sanctioning_allocation_unfunded');end if;
 if total<>benefit+operating or total>9007199254740991 then return jsonb_build_object('status','blocked','code','unsafe_expense_total');end if;
 return jsonb_build_object('status','classified','expenseMinor',total::bigint,'benefitMinor',benefit::bigint,'operatingMinor',operating::bigint,'sanctioningMinor',sanction::bigint);
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','blocked','code','invalid_expense_classification');end$$;
revoke all on function app.classify_multi_event_expenses_v1(jsonb,jsonb,bigint)from public,anon,authenticated,service_role;

create table app.multi_event_expense_reviews_v1(
 id uuid primary key default extensions.gen_random_uuid(),tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version between 1 and 256),source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 classifications jsonb not null check(jsonb_typeof(classifications)='array'),facts jsonb not null,
 reason text not null check(length(reason)between 21 and 500 and left(reason,20)='TEST ONLY SYNTHETIC:'),
 actor_id uuid not null references app.profiles(id),operation_receipt_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,tournament_id)references app.events(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id)references app.operation_receipts(id,tournament_id),unique(event_id,version),unique(id,tournament_id,event_id)
);
alter table app.multi_event_expense_reviews_v1 enable row level security;
alter table app.multi_event_expense_reviews_v1 force row level security;
revoke all on app.multi_event_expense_reviews_v1 from public,anon,authenticated,service_role;
create trigger multi_event_expense_reviews_v1_immutable before update or delete on app.multi_event_expense_reviews_v1 for each row execute function app.reject_immutable_history();
create index multi_event_expense_reviews_v1_actor_idx on app.multi_event_expense_reviews_v1(actor_id);
create index multi_event_expense_reviews_v1_receipt_idx on app.multi_event_expense_reviews_v1(operation_receipt_id,tournament_id);

create function public.review_multi_event_expenses_v1(actor uuid,tid uuid,eid uuid,req jsonb,op uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare source jsonb;facts jsonb;assessment bigint;current_version integer;h text;prior app.operation_receipts%rowtype;rid uuid;review_id uuid:=extensions.gen_random_uuid();result jsonb;
begin
 if actor is null or tid is null or eid is null or op is null or coalesce(auth.role(),'')<>'service_role'then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||op::text,0));
 perform 1 from app.tournaments where id=tid and status='open'for update;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in('director','co_director'))then return jsonb_build_object('status','rejected','code','not_director');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('review_multi_event_expenses_v1',tid,eid,req)::text,'utf8'),'sha256'),'hex');
 select*into prior from app.operation_receipts where actor_profile_id=actor and client_operation_id=op;
 if found then if prior.operation_type='review_multi_event_expenses_v1'and prior.tournament_id=tid and prior.target_id=eid and prior.request_hash=h then return prior.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
 if jsonb_typeof(req)is distinct from'object'or not(req?&array['expectedVersion','sourceDigest','classifications','reason','reviewed'])or(select count(*)from jsonb_object_keys(req))<>5
  or jsonb_typeof(req->'expectedVersion')is distinct from'number'or coalesce(req->>'expectedVersion','')!~'^(0|[1-9][0-9]{0,2})$'
  or jsonb_typeof(req->'sourceDigest')is distinct from'string'or coalesce(req->>'sourceDigest','')!~'^[a-f0-9]{64}$'or req->'reviewed'is distinct from'true'::jsonb
  or jsonb_typeof(req->'reason')is distinct from'string'or req->>'reason'<>trim(req->>'reason')or length(req->>'reason')not between 21 and 500 or(req->>'reason')~'[[:cntrl:]]'or left(req->>'reason',20)<>'TEST ONLY SYNTHETIC:'or length(trim(substr(req->>'reason',21)))=0 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 source:=public.get_multi_event_synthetic_event_sources_v1(actor,tid,eid);
 if source->>'sourceDigest'is null or exists(select 1 from jsonb_array_elements_text(coalesce(source->'blockers','[]'))b where b<>'expense_classification_required')then return jsonb_build_object('status','rejected','code','source_blocked');end if;
 if source->>'sourceDigest'is distinct from req->>'sourceDigest'then return jsonb_build_object('status','rejected','code','source_changed');end if;
 select coalesce(max(version),0)into current_version from app.multi_event_expense_reviews_v1 where tournament_id=tid and event_id=eid;
 if current_version>=256 or current_version<>(req->>'expectedVersion')::integer then return jsonb_build_object('status','rejected','code','stale_version');end if;
 assessment:=app.settlement_assessment_v5(eid);if assessment is null then return jsonb_build_object('status','rejected','code','assessment_unavailable');end if;
 facts:=app.classify_multi_event_expenses_v1(source->'expenseEvidence',req->'classifications',assessment);
 if facts->>'status'<>'classified'then return jsonb_build_object('status','rejected','code',facts->>'code');end if;
 result:=jsonb_build_object('status','synthetic_expenses_classified','eventId',eid,'reviewId',review_id,'version',current_version+1,'facts',facts,'moneyMoved',false,'accountingAvailable',false);
 insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(tid,actor,'review_multi_event_expenses_v1',eid,h,op,'accepted',result,now())returning id into rid;
 insert into app.multi_event_expense_reviews_v1(id,tournament_id,event_id,version,source_digest,classifications,facts,reason,actor_id,operation_receipt_id)values(review_id,tid,eid,current_version+1,req->>'sourceDigest',req->'classifications',facts,req->>'reason',actor,rid);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(tid,actor,rid,'multi_event_expense_review',review_id,'synthetic_expenses_classified',result);
 return result;
end$$;
revoke all on function public.review_multi_event_expenses_v1(uuid,uuid,uuid,jsonb,uuid)from public,anon,authenticated;
grant execute on function public.review_multi_event_expenses_v1(uuid,uuid,uuid,jsonb,uuid)to service_role;

create function public.get_classified_multi_event_sources_v1(actor uuid,tid uuid,eid uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare source jsonb;review app.multi_event_expense_reviews_v1%rowtype;facts jsonb;assessment bigint;digest text;
begin
 source:=public.get_multi_event_synthetic_event_sources_v1(actor,tid,eid);
 if source is null or source->>'sourceDigest'is null then return source;end if;
 -- Never remove another source blocker just because expense review exists.
 if exists(select 1 from jsonb_array_elements_text(coalesce(source->'blockers','[]'))b where b<>'expense_classification_required')then return source;end if;
 assessment:=app.settlement_assessment_v5(eid);
 if assessment is null then return source||jsonb_build_object('status','blocked','blockers',jsonb_build_array('assessment_unavailable'),'accountingAvailable',false);end if;
 select*into review from app.multi_event_expense_reviews_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if jsonb_array_length(source->'expenseEvidence')=0 and assessment=0 then facts:=app.classify_multi_event_expenses_v1('[]','[]',0);
 else
  if review.id is null then return source||jsonb_build_object('status','blocked','blockers',jsonb_build_array('expense_classification_required'),'accountingAvailable',false);end if;
  if review.source_digest is distinct from source->>'sourceDigest'then return source||jsonb_build_object('status','blocked','blockers',jsonb_build_array('expense_classification_stale'),'accountingAvailable',false);end if;
  facts:=app.classify_multi_event_expenses_v1(source->'expenseEvidence',review.classifications,assessment);
  if facts->>'status'<>'classified'or facts is distinct from review.facts then return source||jsonb_build_object('status','blocked','blockers',jsonb_build_array('expense_classification_invalid'),'accountingAvailable',false);end if;
 end if;
 digest:=encode(extensions.digest(convert_to(jsonb_build_object('financialSource',source->>'sourceDigest','expenseReview',to_jsonb(review),'assessment',assessment,'classification',facts)::text,'utf8'),'sha256'),'hex');
 return source||jsonb_build_object('status','available','blockers','[]'::jsonb,'financialSourceDigest',source->>'sourceDigest','sourceDigest',digest,'expenseReviewId',review.id,'classifiedExpenses',facts,'accountingAvailable',false);
end$$;
revoke all on function public.get_classified_multi_event_sources_v1(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.get_classified_multi_event_sources_v1(uuid,uuid,uuid)to service_role;
notify pgrst,'reload schema';
commit;
