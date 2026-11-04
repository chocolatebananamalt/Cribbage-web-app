-- Local proposal: reviewed UNPAID liabilities only. No settlement/payment writer changes.
create table app.q_obligation_reviews_v1 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id),
 event_id uuid not null,
 version integer not null check(version between 1 and 256),
 supersedes_id uuid references app.q_obligation_reviews_v1(id),
 source_digest text not null check(source_digest ~ '^[a-f0-9]{64}$'),
 source_manifest jsonb not null check(jsonb_typeof(source_manifest)='object'),
 obligations jsonb not null check(jsonb_typeof(obligations)='array'),
 status text not null default 'unpaid' check(status='unpaid'),
 reason text not null check(length(trim(reason)) between 1 and 500 and reason !~ '[[:cntrl:]]'),
 actor_id uuid not null references app.profiles(id),
 operation_receipt_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 unique(event_id,version),
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id)
);
alter table app.q_obligation_reviews_v1 enable row level security;
alter table app.q_obligation_reviews_v1 force row level security;
revoke all on app.q_obligation_reviews_v1 from public,anon,authenticated,service_role;
create index q_obligation_review_tournament_idx on app.q_obligation_reviews_v1(tournament_id);
create index q_obligation_review_actor_idx on app.q_obligation_reviews_v1(actor_id);
create index q_obligation_review_receipt_idx on app.q_obligation_reviews_v1(operation_receipt_id,tournament_id);
create index q_obligation_review_supersedes_idx on app.q_obligation_reviews_v1(supersedes_id);
create trigger q_obligation_review_immutable before update or delete on app.q_obligation_reviews_v1 for each row execute function app.reject_immutable_history();

-- Database-owned calculation; callers cannot supply recipients, amounts or paid state.
create function app.calculate_q_obligations_v1(s jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare p jsonb; pol jsonb; e jsonb; ep jsonb; q jsonb; contributors jsonb; recipients jsonb; rows jsonb; output jsonb:='[]';
 fund numeric; n integer; i integer; share bigint; remainder integer; rank_no integer;
begin
 if s is null or s->'membership' is null or s->'membership'='null'::jsonb
  or s->'membership'->>'supported' is distinct from 'true' or s->'qualification' is null or s->'qualification'='null'::jsonb
  or jsonb_array_length(s->'blockers')<>0 then return null; end if;
 if exists(select 1 from jsonb_array_elements(s->'qualification'->'qualifiers') x where x->>'tied'='true') then return null;end if;
 for p in select value from jsonb_array_elements(s->'membership'->'pools') loop
  select value into pol from jsonb_array_elements(s->'policies') where value->>'poolVersionId'=p->>'poolVersionId';
  if pol is null or pol->>'method' is distinct from 'equal-paid-qualifiers-v1' then return null; end if;
  contributors:='[]'; fund:=0;
  for e in select value from jsonb_array_elements(s->'membership'->'entries') loop
   if (e->>'receivedMinor')::numeric>0 and e->>'allocationCurrent' is distinct from 'true' then return null;end if;
   select value into ep from jsonb_array_elements(e->'pools') where value->>'poolVersionId'=p->>'poolVersionId';
   if ep is null then return null;end if;
   if ep->>'elected'='true' then
    if ep->>'paidEntryEligible' is distinct from 'true' or e->>'allocationCurrent' is distinct from 'true'
     or (ep->>'amountAllocatedMinor')::numeric is distinct from (p->>'feeMinor')::numeric
     or coalesce(not starts_with(ep->>'consentReference','Q policy '||(pol->>'id')||': '),true)
     or coalesce(length(trim(substr(ep->>'consentReference',length('Q policy '||(pol->>'id')||': ')+1))),0)=0 then return null;end if;
    contributors:=contributors||jsonb_build_array(jsonb_build_object('participantId',e->>'participantId','displayName',e->>'displayName','amountMinor',(ep->>'amountAllocatedMinor')::bigint,'qualificationRank',null));
    fund:=fund+(ep->>'amountAllocatedMinor')::numeric;
   elsif (ep->>'amountAllocatedMinor')::numeric>0 then return null;
   end if;
  end loop;
  if fund>9007199254740991 then return null;end if;
  select coalesce(jsonb_agg(c.value||jsonb_build_object('qualificationRank',(x.value->>'qualificationRank')::integer) order by (x.value->>'qualificationRank')::integer),'[]') into recipients
   from jsonb_array_elements(contributors)c join jsonb_array_elements(s->'qualification'->'qualifiers')x on c.value->>'participantId'=x.value->>'participantId';
  n:=jsonb_array_length(recipients); rows:='[]';
  if n=0 then rows:=contributors;
  else
   share:=floor(fund/n)::bigint;remainder:=mod(fund,n)::integer;i:=0;
   for q in select value from jsonb_array_elements(recipients) loop
    rows:=rows||jsonb_build_array(q||jsonb_build_object('amountMinor',share+case when i<remainder then 1 else 0 end));i:=i+1;
   end loop;
  end if;
  if coalesce((select sum((value->>'amountMinor')::numeric) from jsonb_array_elements(rows)),0)<>fund then return null;end if;
  output:=output||jsonb_build_array(jsonb_build_object('poolVersionId',p->>'poolVersionId','policyId',pol->>'id','name',p->>'name','fundMinor',fund::bigint,
   'kind',case when n=0 then 'refund' else 'award' end,'status','unpaid','rows',rows));
 end loop;
 if jsonb_array_length(output)=0 then return null;end if;
 return output;
end $$;
revoke all on function app.calculate_q_obligations_v1(jsonb) from public,anon,authenticated,service_role;

-- Bind the full financial manifest and current effective scoring, not only old qualification.
create function app.q_obligation_sources_v1(actor uuid,tid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s jsonb; c jsonb; manifest jsonb; q app.qualification_result_versions%rowtype; eid uuid; digest text; obligations jsonb; blockers jsonb:='[]';
begin
 if not exists(select 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role='director') then return null;end if;
 s:=public.get_q_pool_preview_sources_v1(actor,tid);if s is null then return null;end if;
 c:=app.q_pool_context_v1(tid);eid:=(c->>'eventId')::uuid;
 select * into q from app.qualification_result_versions where id=(s->'qualification'->>'id')::uuid;
 if q.id is null then blockers:=blockers||'"finalized_qualification_required"'::jsonb;
 else
  if q.qualifier_count<4 or (q.qualifier_count & (q.qualifier_count-1))<>0 then blockers:=blockers||'"unsupported_byes"'::jsonb;end if;
  with totals as (
   select p.id,coalesce(nullif(trim(r.claimed_display_name),''),nullif(trim(pr.display_name),'')) display_name,
    count(l.line_id)::integer verified_games,coalesce(sum(l.game_points),0)::integer game_points,
    count(*) filter(where l.is_winner)::integer games_won,coalesce(sum(l.plus_points),0)::integer plus_points,coalesce(sum(l.minus_points),0)::integer minus_points
   from app.event_participants p left join app.tournament_roster_entries r on r.id=p.roster_entry_id and r.tournament_id=p.tournament_id
   left join app.profiles pr on pr.id=p.profile_id left join lateral(select * from app.current_effective_scorelines(tid,eid) x where x.participant_id=p.id)l on true
   where p.tournament_id=tid and p.event_id=eid group by p.id,coalesce(nullif(trim(r.claimed_display_name),''),nullif(trim(pr.display_name),''))
  ),ranked as(select totals.*,row_number()over(order by game_points desc,games_won desc,(plus_points-minus_points)desc,plus_points desc,id)::integer ordinal,
   rank()over(order by game_points desc,games_won desc,(plus_points-minus_points)desc,plus_points desc)::integer numeric_rank,
   count(*)over(partition by game_points,games_won,(plus_points-minus_points),plus_points)>1 tied from totals)
  select encode(extensions.digest(convert_to(jsonb_agg(to_jsonb(ranked)order by ordinal)::text,'utf8'),'sha256'),'hex') into digest from ranked;
  if digest is distinct from q.standings_digest then blockers:=blockers||'"qualification_scores_changed"'::jsonb;end if;
 end if;
 manifest:=jsonb_build_object('sources',s,'calculatorVersion','equal-paid-qualifiers-v1','context',c,
  'memberships',(select coalesce(jsonb_agg(to_jsonb(m)order by m.id),'[]')from app.q_pool_membership_versions_v1 m where m.tournament_id=tid),
  'allocations',(select coalesce(jsonb_agg(to_jsonb(a)order by a.id),'[]')from app.q_pool_allocation_versions_v1 a where a.tournament_id=tid),
  'receipts',(select coalesce(jsonb_agg(to_jsonb(p)order by p.id),'[]')from app.roster_payment_events p where p.tournament_id=tid),
  'obligations',(select coalesce(jsonb_agg(to_jsonb(o)order by o.id),'[]')from app.roster_payment_obligation_versions o where o.tournament_id=tid),
  'games',(select coalesce(jsonb_agg(to_jsonb(g)order by g.id),'[]')from app.canonical_games g where g.event_id=eid),
  'scores',(select coalesce(jsonb_agg(to_jsonb(l)order by l.line_id),'[]')from app.current_effective_scorelines(tid,eid)l),
  'participants',(select coalesce(jsonb_agg(to_jsonb(p)order by p.id),'[]')from app.event_participants p where p.event_id=eid),
  'schedules',(select coalesce(jsonb_agg(to_jsonb(p)order by p.id),'[]')from app.event_schedule_publications p where p.event_id=eid));
 obligations:=app.calculate_q_obligations_v1(s);
 if obligations is null then blockers:=blockers||'"q_sources_blocked"'::jsonb;end if;
 return jsonb_build_object('eventId',eid,'sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'),
  'manifest',manifest,'obligations',obligations,'blockers',blockers);
end $$;
revoke all on function app.q_obligation_sources_v1(uuid,uuid) from public,anon,authenticated,service_role;

create function public.get_q_obligation_review_workspace_v1(p_actor_id uuid,p_tournament_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b jsonb; latest app.q_obligation_reviews_v1%rowtype; history jsonb;
begin
 b:=app.q_obligation_sources_v1(p_actor_id,p_tournament_id);if b is null then return null;end if;
 select * into latest from app.q_obligation_reviews_v1 where tournament_id=p_tournament_id and event_id=(b->>'eventId')::uuid order by version desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'supersedesId',r.supersedes_id,'reason',r.reason,'recordedAt',r.recorded_at,
  'actorId',r.actor_id,'sourceDigest',r.source_digest,'status',r.status,'obligations',r.obligations)order by r.version desc),'[]') into history from app.q_obligation_reviews_v1 r where r.tournament_id=p_tournament_id and r.event_id=(b->>'eventId')::uuid;
 return jsonb_build_object('tournamentId',p_tournament_id,'eventId',b->'eventId','sourceDigest',b->'sourceDigest','preview',b->'obligations','blockers',b->'blockers',
  'currentVersion',coalesce(latest.version,0),'current',latest.id is not null and latest.source_digest=b->>'sourceDigest' and jsonb_array_length(b->'blockers')=0,
  'history',history,'automaticPayout',false,'canonicalSettlement',false);
end $$;

create function public.record_q_obligation_review_v1(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b jsonb;c jsonb;eid uuid;h text;receipt app.operation_receipts%rowtype;latest app.q_obligation_reviews_v1%rowtype;
 response jsonb;code text;rid uuid:=extensions.gen_random_uuid();oid uuid:=extensions.gen_random_uuid();
begin
 if p_actor_id is null or p_tournament_id is null or p_operation_id is null then return null;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 c:=app.q_pool_context_v1(p_tournament_id);eid:=(c->>'eventId')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qualification-finalization:'||eid::text,0));
 perform 1 from app.tournaments where id=p_tournament_id and status='open' for update;
 if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director' for update;
 if not found then return null;end if;
 perform 1 from app.events where id=eid and tournament_id=p_tournament_id for update;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('q_obligation_review_v1',p_actor_id,p_tournament_id,p_request)::text,'utf8'),'sha256'),'hex');
 select * into receipt from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if receipt.tournament_id=p_tournament_id and receipt.operation_type='q_obligation_review_v1' and receipt.request_hash=h then return receipt.response_payload;end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 begin
  if p_request is null or jsonb_typeof(p_request)<>'object' or (select count(*)from jsonb_object_keys(p_request))<>4
   or not(p_request ?& array['expectedVersion','sourceDigest','reason','reviewed']) or p_request->'reviewed' is distinct from 'true'::jsonb
   or jsonb_typeof(p_request->'expectedVersion') is distinct from 'number' or coalesce((p_request->>'expectedVersion')!~'^(0|[1-9][0-9]*)$',true) or (p_request->>'expectedVersion')::numeric>255
   or jsonb_typeof(p_request->'sourceDigest') is distinct from 'string' or coalesce((p_request->>'sourceDigest')!~'^[a-f0-9]{64}$',true)
   or jsonb_typeof(p_request->'reason') is distinct from 'string' or length(trim(p_request->>'reason'))not between 1 and 500
   or (p_request->>'reason')~'[[:cntrl:]]' then raise exception 'invalid_request';end if;
  b:=app.q_obligation_sources_v1(p_actor_id,p_tournament_id);
  if b is null or jsonb_array_length(b->'blockers')<>0 or b->'obligations'='null'::jsonb then raise exception 'source_blocked';end if;
  if b->>'sourceDigest'<>p_request->>'sourceDigest' then raise exception 'source_changed';end if;
  select * into latest from app.q_obligation_reviews_v1 where event_id=eid order by version desc limit 1;
  if coalesce(latest.version,0)<>(p_request->>'expectedVersion')::integer then raise exception 'stale_version';end if;
  if latest.id is not null and latest.source_digest=b->>'sourceDigest' then raise exception 'already_reviewed';end if;
  response:=jsonb_build_object('status','q_obligations_recorded','reviewId',rid,'eventId',eid,'version',coalesce(latest.version,0)+1,'sourceDigest',b->>'sourceDigest');
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(oid,p_tournament_id,p_actor_id,'q_obligation_review_v1',eid,h,p_operation_id,'accepted',response,clock_timestamp());
  insert into app.q_obligation_reviews_v1(id,tournament_id,event_id,version,supersedes_id,source_digest,source_manifest,obligations,reason,actor_id,operation_receipt_id)
   values(rid,p_tournament_id,eid,coalesce(latest.version,0)+1,latest.id,b->>'sourceDigest',b->'manifest',b->'obligations',trim(p_request->>'reason'),p_actor_id,oid);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
   values(p_tournament_id,p_actor_id,oid,'q_obligation_review',rid,'q_obligations_recorded_unpaid',response);
  return response;
 exception when raise_exception or invalid_text_representation or numeric_value_out_of_range then
  code:=case when sqlerrm in('source_blocked','source_changed','stale_version','already_reviewed')then sqlerrm else 'invalid_request'end;
  response:=jsonb_build_object('status','rejected','code',code);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload)
   values(p_tournament_id,p_actor_id,'q_obligation_review_v1',coalesce(eid,p_tournament_id),h,p_operation_id,'rejected',response);
  return response;
 end;
end $$;

create function public.get_q_obligation_review_reconciliation_v1(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director')then
 jsonb_build_object('authorized',true,'result',(select response_payload from app.operation_receipts where actor_profile_id=p_actor_id and tournament_id=p_tournament_id and client_operation_id=p_operation_id and operation_type='q_obligation_review_v1'))else null end
$$;
revoke all on function public.get_q_obligation_review_workspace_v1(uuid,uuid),public.record_q_obligation_review_v1(uuid,uuid,jsonb,uuid),public.get_q_obligation_review_reconciliation_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_q_obligation_review_workspace_v1(uuid,uuid),public.record_q_obligation_review_v1(uuid,uuid,jsonb,uuid),public.get_q_obligation_review_reconciliation_v1(uuid,uuid,uuid) to service_role;
