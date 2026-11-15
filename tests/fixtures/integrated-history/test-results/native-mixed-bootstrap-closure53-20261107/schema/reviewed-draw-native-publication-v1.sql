-- LOCAL UNEXECUTED PROPOSAL. Owner-only transaction core, NOT a migration/release.
-- No public/authenticated/service_role EXECUTE grant or HTTP route. Runtime,
-- concurrency, FK/phantom and forced-rollback proof must precede any enablement.
begin;
create table app.reviewed_initial_seating_publications_v1 (
 actor_id uuid not null references app.profiles(id), operation_id uuid not null,
 tournament_id uuid not null references app.tournaments(id), request jsonb not null,
 request_hash text not null, plan_id uuid not null references app.random_seating_plans_v1(id),
 draw_actor_id uuid not null, draw_operation_id uuid not null, source_hash text not null,
 publication_id uuid not null unique references app.initial_seating_publications(id),
 native_receipt_id uuid not null unique references app.operation_receipts(id),
 response jsonb not null, created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,operation_id),
 foreign key(draw_actor_id,draw_operation_id) references app.random_seating_operations_v1(actor_id,operation_id)
);
alter table app.reviewed_initial_seating_publications_v1 enable row level security;
alter table app.reviewed_initial_seating_publications_v1 force row level security;
revoke all on app.reviewed_initial_seating_publications_v1 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.reviewed_initial_seating_publications_v1
 for each row execute function app.reject_immutable_history();

-- Deterministic validation of the literal single-table physical map, NOT a new
-- random draw. All108 matches are rederived from the SAME stored starting IDs.
create function app.reviewed_candidate_a18_valid_v1(p_config jsonb,p_snapshot jsonb,p_candidate jsonb)returns boolean
 language plpgsql immutable set search_path=''as $$
declare positions jsonb;next_positions jsonb;expected jsonb:='[]';a jsonb;round_no integer;board integer;seat_no integer;next_no integer;entry record;
begin
 if p_config->'tables'is distinct from'[{"tableId":"A","seatCount":18}]'::jsonb
  or p_config->'activePairIds'is distinct from'["A:1-2","A:3-4","A:5-6","A:7-8","A:9-10","A:11-12","A:13-14","A:15-16","A:17-18"]'::jsonb
  or p_config->'anchor'->>'seatId'is distinct from'A-1' or p_config->'anchor'->'directorApproved'is distinct from'true'::jsonb
  or jsonb_typeof(p_candidate)is distinct from'object'
  or(select array_agg(k order by k)from jsonb_object_keys(p_candidate)k)is distinct from array['algorithmVersion','anchor','assignments','attempts','matches','physicalReviewRequired','publishable']
  or p_candidate->>'algorithmVersion'is distinct from'local-circle-18-v1' or p_candidate->'publishable'is distinct from'false'::jsonb
  or p_candidate->'physicalReviewRequired'is distinct from'true'::jsonb or p_candidate->'anchor'->>'seatId'is distinct from'A-1'
  or jsonb_typeof(p_candidate->'attempts')is distinct from'number'or coalesce(p_candidate->>'attempts','')!~'^[1-9][0-9]{0,2}$'
  or(p_candidate->>'attempts')::integer>256
  or jsonb_typeof(p_candidate->'anchor')is distinct from'object'
  or(select array_agg(k order by k)from jsonb_object_keys(p_candidate->'anchor')k)is distinct from array['participantId','seatId','selection']
  or coalesce(p_candidate->'anchor'->>'selection','')not in('blind-draw','approved-person')
  or jsonb_typeof(p_candidate->'assignments')is distinct from'array'or jsonb_array_length(p_candidate->'assignments')<>18
  or jsonb_typeof(p_candidate->'matches')is distinct from'array'or jsonb_array_length(p_candidate->'matches')<>108
  or jsonb_typeof(p_snapshot->'roster')is distinct from'array'or jsonb_array_length(p_snapshot->'roster')<>18 then return false;end if;
 for a in select value from jsonb_array_elements(p_candidate->'assignments')loop
  if jsonb_typeof(a)is distinct from'object'or(select array_agg(k order by k)from jsonb_object_keys(a)k)is distinct from array['logicalSlot','participantId','tournamentId']
   or coalesce(a->>'participantId','')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
   or coalesce(a->>'tournamentId','')!~'^A-([1-9]|1[0-8])$'
   or jsonb_typeof(a->'logicalSlot')is distinct from'number'or coalesce(a->>'logicalSlot','')!~'^(0|[1-9]|1[0-7])$'
   or not exists(select 1 from jsonb_array_elements(p_snapshot->'roster')r where r->>'rosterEntryId'=a->>'participantId')then return false;end if;
 end loop;
 if(select count(distinct j.value->>'participantId')from jsonb_array_elements(p_candidate->'assignments')j(value))<>18
  or(select count(distinct j.value->>'tournamentId')from jsonb_array_elements(p_candidate->'assignments')j(value))<>18
  or(select count(distinct j.value->>'logicalSlot')from jsonb_array_elements(p_candidate->'assignments')j(value))<>18 then return false;end if;
 positions:=(select jsonb_object_agg(j.value->>'tournamentId',j.value->'participantId')from jsonb_array_elements(p_candidate->'assignments')j(value));
 if positions->>'A-1'is distinct from p_candidate->'anchor'->>'participantId'then return false;end if;
 for round_no in 1..12 loop
  for board in 1..9 loop
   expected:=expected||jsonb_build_array(jsonb_build_object('round',round_no,'pairId','A:'||(board*2-1)::text||'-'||(board*2)::text,
    'sides',jsonb_build_array(jsonb_build_object('participantId',positions->>('A-'||(board*2-1)::text),'seatId','A-'||(board*2-1)::text),
     jsonb_build_object('participantId',positions->>('A-'||(board*2)::text),'seatId','A-'||(board*2)::text))));
  end loop;
  next_positions:='{}';
  for entry in select key,value from jsonb_each(positions)loop
   seat_no:=split_part(entry.key,'-',2)::integer;
   next_no:=case when seat_no=1 then 1 when seat_no=2 then 3 when seat_no=17 then 18 when seat_no%2=1 then seat_no+2 else seat_no-2 end;
   next_positions:=next_positions||jsonb_build_object('A-'||next_no::text,entry.value);
  end loop;
  positions:=next_positions;
 end loop;
 return p_candidate->'matches'=expected;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end$$;

-- Accepted history is returned only when its unchanged native receipt/publication
-- and every assignment still prove the exact server-derived native request.
create function app.reviewed_initial_seating_bound_v1(p_actor uuid,p_operation uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.reviewed_initial_seating_publications_v1 b
 join app.operation_receipts r on r.id=b.native_receipt_id
 join app.initial_seating_publications p on p.id=b.publication_id
 where b.actor_id=p_actor and b.operation_id=p_operation
 and r.actor_profile_id=b.actor_id and r.client_operation_id=b.operation_id and r.tournament_id=b.tournament_id
 and r.operation_type='publish_initial_seating' and r.target_id=b.tournament_id and r.outcome='accepted'
 and p.tournament_id=b.tournament_id and p.actor_profile_id=b.actor_id and p.operation_receipt_id=r.id
 and p.table_count=1 and p.seats_per_table=18
 and r.request_hash=encode(extensions.digest(convert_to(jsonb_build_array('publish_initial_seating',b.tournament_id::text,1,18,
   (select jsonb_agg(jsonb_build_object('rosterEntryId',(a->>'participantId')::uuid,'tableSeat',a->>'tournamentId')order by(a->>'participantId')::uuid)
    from jsonb_array_elements(b.request->'reviewedCandidate'->'assignments')a),b.operation_id::text)::text,'utf8'),'sha256'),'hex')
 and r.response_payload=jsonb_build_object('status','initial_seating_published','publicationId',p.id,'assignmentCount',18,'registrationClosed',true,'roundRotationGenerated',false)
 and (select count(*)from app.initial_seating_assignments a where a.publication_id=p.id and a.tournament_id=b.tournament_id)=18
 and not exists(select 1 from jsonb_array_elements(b.request->'reviewedCandidate'->'assignments')e where not exists(
   select 1 from app.initial_seating_assignments a where a.publication_id=p.id and a.tournament_id=b.tournament_id
    and a.roster_entry_id=(e->>'participantId')::uuid and a.initial_table_seat=e->>'tournamentId' and a.verification_id=e->>'tournamentId'))
 and b.request_hash=app.random_seating_hash_v1(b.request) and b.response->'request'=b.request)
$$;

create function app.publish_reviewed_initial_seating_unverified_v1(p_tournament_id uuid,p_request jsonb)
 returns jsonb language plpgsql security definer set search_path='' set lock_timeout='250ms' as $$
declare
 actor uuid:=auth.uid();op uuid;rh text;native_hash text;binding jsonb;snapshot jsonb;assignments jsonb;
 plan app.random_seating_plans_v1%rowtype;latest record;draw app.random_seating_draws_v1%rowtype;
 old app.reviewed_initial_seating_publications_v1%rowtype;receipt app.operation_receipts%rowtype;
 native jsonb;publication uuid;response jsonb;reason text;code text;
begin
 -- The owner-only core still derives the real actor and requires authenticated
 -- claims. A service-role actor parameter or caller-supplied role is not accepted.
 if actor is null or coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')<>'authenticated'
 or not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=actor and r.role in('director','co_director'))then return null;end if;
 begin
  if p_tournament_id is null or jsonb_typeof(p_request)is distinct from'object'
   or(select array_agg(k order by k)from jsonb_object_keys(p_request)k)is distinct from array['drawActorId','drawOperationId','expectedPlanRevision','expectedSourceHash','idempotencyKey','planId','review','reviewedCandidate']
   or octet_length(p_request::text)>100000 then raise exception using errcode='P0001',message='invalid_request';end if;
  foreach reason in array array['drawActorId','drawOperationId','idempotencyKey','planId']loop
   if coalesce(p_request->>reason,'')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'then raise exception using errcode='P0001',message='invalid_request';end if;
  end loop;
  if coalesce(p_request->>'expectedSourceHash','')!~'^[a-f0-9]{64}$'
   or jsonb_typeof(p_request->'expectedPlanRevision')is distinct from'number'
   or coalesce(p_request->>'expectedPlanRevision','')!~'^[1-9][0-9]{0,9}$'
   or(p_request->>'expectedPlanRevision')::bigint>2147483647
   or jsonb_typeof(p_request->'review')is distinct from'object'
   or(select array_agg(k order by k)from jsonb_object_keys(p_request->'review')k)is distinct from array['constraintsConfirmed','physicalLayoutConfirmed','reason','stationaryDecisionsConfirmed']
   or p_request->'review'->'physicalLayoutConfirmed'is distinct from'true'::jsonb
   or p_request->'review'->'stationaryDecisionsConfirmed'is distinct from'true'::jsonb
   or p_request->'review'->'constraintsConfirmed'is distinct from'true'::jsonb
   or jsonb_typeof(p_request->'review'->'reason')is distinct from'string'
   or length(trim(p_request->'review'->>'reason'))=0 or length(p_request->'review'->>'reason')>500
   or(p_request->'review'->>'reason')~'[[:cntrl:]]'then raise exception using errcode='P0001',message='invalid_request';end if;
  op:=(p_request->>'idempotencyKey')::uuid;rh:=app.random_seating_hash_v1(p_request);
  if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='P0001',message='unsupported_isolation';end if;
  -- Never wait while holding the opposite side of legacy0204/0205 lock order.
  if not pg_try_advisory_xact_lock(hashtextextended(actor::text||':'||op::text,0))then raise exception using errcode='55P03',message='busy';end if;
  perform 1 from app.tournaments t where t.id=p_tournament_id for update nowait;
  if not found then raise exception using errcode='P0001',message='source_not_ready';end if;
  perform 1 from app.profiles p where p.id=actor for key share nowait;
  if not found then return null;end if;
  perform 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=actor and r.role in('director','co_director')order by r.role for share nowait;
  if not found then return null;end if;
  -- Replay precedes freshness checks, but follows current-role and native binding.
  select * into old from app.reviewed_initial_seating_publications_v1 b where b.actor_id=actor and b.operation_id=op;
  if found then
   if old.tournament_id<>p_tournament_id or old.request_hash<>rh or old.request<>p_request then raise exception using errcode='P0001',message='operation_conflict';end if;
   if not app.reviewed_initial_seating_bound_v1(actor,op)then raise exception using errcode='P0001',message='native_binding_unavailable';end if;
   return old.response;
  end if;
  if exists(select 1 from app.operation_receipts r where r.actor_profile_id=actor and r.client_operation_id=op)
   or exists(select 1 from app.random_seating_operations_v1 r where r.actor_id=actor and r.operation_id=op)then raise exception using errcode='P0001',message='operation_conflict';end if;
  -- FOR UPDATE also conflicts with append-only child FK KEY SHARE; FOR SHARE
  -- alone would NOT exclude that phantom/version path. This assumption and all
  -- source FK/writer families still require actual two-session runtime proof.
  perform 1 from app.tournament_roster_entries r where r.tournament_id=p_tournament_id order by r.id for update nowait;
  -- Current event retirement is not represented in the old candidate source
  -- hash. Validate it independently, serialized with normal0194 lifecycle.
  if not exists(select 1 from app.tournament_setup_activations a
   join app.tournament_setup_event_versions s on s.id=a.setup_event_version_id and s.tournament_id=p_tournament_id
   join app.events e on e.id=a.event_id and e.tournament_id=p_tournament_id and e.ruleset_version_id=a.ruleset_version_id
   join app.ruleset_versions r on r.id=a.ruleset_version_id and r.tournament_id=p_tournament_id
   where a.tournament_id=p_tournament_id and s.event_kind='main'and s.format_code='standard_singles'and s.style_code='Standard'and s.game_count=12
    and e.operational_state='active'and e.event_type='main'and e.format='standard_singles'and r.format='standard_singles')
   then raise exception using errcode='P0001',message='source_not_ready';end if;
  binding:=app.random_seating_binding_v1(p_tournament_id);snapshot:=binding->'projection';
  if app.random_seating_source_error_v1(p_tournament_id,snapshot)is not null then raise exception using errcode='P0001',message='source_not_ready';end if;
  select * into plan from app.random_seating_plans_v1 p where p.tournament_id=p_tournament_id order by p.revision desc limit 1;
  if not found or plan.id<>(p_request->>'planId')::uuid or plan.revision<>(p_request->>'expectedPlanRevision')::integer
   or plan.source_hash<>p_request->>'expectedSourceHash' or plan.source_hash<>app.random_seating_hash_v1(binding)
   or plan.source_binding<>binding then raise exception using errcode='P0001',message='source_or_plan_changed';end if;
  select o.actor_id,o.operation_id,x.response into latest from app.random_seating_operations_v1 o
   join app.random_seating_outcomes_v1 x using(actor_id,operation_id)
   where o.tournament_id=p_tournament_id and o.operation_kind='draw'
    and(x.response->>'status'='accepted'or x.response->>'code'in('bounded_search_exhausted','draw_failed'))order by o.operation_sequence desc limit 1;
  if not found or latest.actor_id<>(p_request->>'drawActorId')::uuid or latest.operation_id<>(p_request->>'drawOperationId')::uuid
   or latest.response->>'status'<>'accepted' or latest.response->'candidate'is distinct from p_request->'reviewedCandidate'
   or latest.response->>'planId'<>plan.id::text then raise exception using errcode='P0001',message='draw_changed';end if;
  select * into draw from app.random_seating_draws_v1 d where d.tournament_id=p_tournament_id and d.plan_id=plan.id
   and d.actor_id=latest.actor_id and d.operation_id=latest.operation_id;
  if not found or draw.candidate is distinct from p_request->'reviewedCandidate'
   or plan.config->'tables'is distinct from'[{"tableId":"A","seatCount":18}]'::jsonb
   or draw.candidate->>'algorithmVersion'<>'local-circle-18-v1' or draw.candidate->'publishable'is distinct from'false'::jsonb
   or draw.candidate->'physicalReviewRequired'is distinct from'true'::jsonb or draw.candidate->'anchor'->>'seatId'<>'A-1'
   or jsonb_array_length(draw.candidate->'assignments')<>18
   or not app.reviewed_candidate_a18_valid_v1(plan.config,snapshot,draw.candidate)then raise exception using errcode='P0001',message='unsupported_candidate';end if;
  assignments:=(select jsonb_agg(jsonb_build_object('rosterEntryId',(a->>'participantId')::uuid,'tableSeat',a->>'tournamentId')order by(a->>'participantId')::uuid)
   from jsonb_array_elements(draw.candidate->'assignments')a);
  if exists(select 1 from app.initial_seating_publications p where p.tournament_id=p_tournament_id)then raise exception using errcode='P0001',message='fixed_ids_readonly';end if;
  native:=public.publish_initial_seating_v2(p_tournament_id,1::smallint,18::smallint,assignments,op);
  if native is null or native->>'status'<>'initial_seating_published' or native->>'tournamentId'<>p_tournament_id::text or native->>'operationId'<>op::text then raise exception using errcode='P0001',message='native_postcondition_failed';end if;
  publication:=(native->>'publicationId')::uuid;
  native_hash:=encode(extensions.digest(convert_to(jsonb_build_array('publish_initial_seating',p_tournament_id::text,1,18,assignments,op::text)::text,'utf8'),'sha256'),'hex');
  select * into receipt from app.operation_receipts r where r.actor_profile_id=actor and r.client_operation_id=op and r.tournament_id=p_tournament_id
   and r.operation_type='publish_initial_seating' and r.target_id=p_tournament_id and r.outcome='accepted' and r.request_hash=native_hash;
  if not found or native is distinct from receipt.response_payload||jsonb_build_object('tournamentId',p_tournament_id,'operationId',op)
   or binding is distinct from app.random_seating_binding_v1(p_tournament_id)then raise exception using errcode='P0001',message='native_postcondition_failed';end if;
  response:=jsonb_build_object('kind','reviewed-initial-seating-receipt-v1','status','initial_seating_published','actorId',actor,'tournamentId',p_tournament_id,
   'operationId',op,'publicationId',publication,'nativeReceiptId',receipt.id,'planId',plan.id,'planRevision',plan.revision,'drawActorId',draw.actor_id,'drawOperationId',draw.operation_id,
   'sourceHash',plan.source_hash,'assignmentCount',18,'idsWritten',true,'schedulePublished',false,'distributionSent',false,'request',p_request);
  insert into app.reviewed_initial_seating_publications_v1(actor_id,operation_id,tournament_id,request,request_hash,plan_id,draw_actor_id,draw_operation_id,source_hash,publication_id,native_receipt_id,response)
   values(actor,op,p_tournament_id,p_request,rh,plan.id,draw.actor_id,draw.operation_id,plan.source_hash,publication,receipt.id,response);
  if not app.reviewed_initial_seating_bound_v1(actor,op)then raise exception using errcode='P0001',message='native_postcondition_failed';end if;
  return response;
 exception
  when lock_not_available then return jsonb_build_object('kind','reviewed-initial-seating-receipt-v1','status','retry_exact','code','source_busy','actorId',actor,'tournamentId',p_tournament_id,'operationId',op,'request',p_request);
  when sqlstate 'P0001' then
   get stacked diagnostics code=message_text;
   if code not in('invalid_request','unsupported_isolation','source_not_ready','operation_conflict','native_binding_unavailable','source_or_plan_changed','draw_changed','unsupported_candidate','fixed_ids_readonly','native_postcondition_failed')then raise;end if;
   -- This exception block rolls back native receipt/IDs/audit and bridge row
   -- together. A rejection never adopts a pre-existing native receipt.
   return jsonb_build_object('kind','reviewed-initial-seating-receipt-v1','status','rejected','code',code,'actorId',actor,'tournamentId',p_tournament_id,'operationId',op,'request',p_request);
 end;
end$$;

create function app.get_reviewed_initial_seating_operation_unverified_v1(p_tournament_id uuid,p_operation_id uuid)returns jsonb
 language sql stable security definer set search_path='' as $$
 select jsonb_build_object('kind','reviewed-initial-seating-operation-v1','actorId',b.actor_id,'tournamentId',b.tournament_id,'operationId',b.operation_id,'request',b.request,'receipt',b.response)
 from app.reviewed_initial_seating_publications_v1 b where b.actor_id=auth.uid() and b.operation_id=p_operation_id and b.tournament_id=p_tournament_id
 and current_setting('transaction_isolation')='read committed'
 and coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb)->>'role','')='authenticated'
 and exists(select 1 from app.tournament_roles r where r.tournament_id=b.tournament_id and r.profile_id=auth.uid() and r.role in('director','co_director'))
 and app.reviewed_initial_seating_bound_v1(b.actor_id,b.operation_id)
$$;
revoke all on function app.reviewed_initial_seating_bound_v1(uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function app.reviewed_candidate_a18_valid_v1(jsonb,jsonb,jsonb)from public,anon,authenticated,service_role;
revoke all on function app.publish_reviewed_initial_seating_unverified_v1(uuid,jsonb)from public,anon,authenticated,service_role;
revoke all on function app.get_reviewed_initial_seating_operation_unverified_v1(uuid,uuid)from public,anon,authenticated,service_role;
-- Deliberately NO public wrapper/GRANT. A tested migration and authorized
-- authenticated wrapper are separate future work, not a flag flip.
commit;
