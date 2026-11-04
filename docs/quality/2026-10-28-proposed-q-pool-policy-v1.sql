-- LOCAL proposal: immutable pre-collection policy plus read-only preview sources.
-- Does not enable Q settlement, payouts, refunds or change historical records.
create table app.q_pool_policies_v1 (
 id uuid primary key default extensions.gen_random_uuid(),
 tournament_id uuid not null references app.tournaments(id),
 event_id uuid not null,
 pool_version_id uuid not null unique references app.tournament_setup_q_pool_versions(id),
 version integer not null default 1 check(version=1),
 method text not null check(method='equal-paid-qualifiers-v1'),
 disclosure_reference text not null check(length(trim(disclosure_reference)) between 1 and 500),
 published_at timestamptz not null default clock_timestamp(),
 actor_id uuid not null references app.profiles(id),
 operation_receipt_id uuid not null,
 foreign key(event_id,tournament_id) references app.events(id,tournament_id),
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id)
);
alter table app.q_pool_policies_v1 enable row level security;
alter table app.q_pool_policies_v1 force row level security;
revoke all on app.q_pool_policies_v1 from public,anon,authenticated,service_role;
create index q_pool_policy_event_idx on app.q_pool_policies_v1(event_id,tournament_id);
create index q_pool_policy_actor_idx on app.q_pool_policies_v1(actor_id);
create index q_pool_policy_receipt_idx on app.q_pool_policies_v1(operation_receipt_id,tournament_id);
create trigger q_pool_policy_immutable before update or delete on app.q_pool_policies_v1 for each row execute function app.reject_immutable_history();

-- Covers every receipt path (including legacy/import writers) at the shared ledger seam.
-- Existing policy-less tournaments are unaffected except for the same tournament row lock.
create function app.guard_q_pool_disclosure_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare p app.q_pool_policies_v1%rowtype; x jsonb; prefix text;
begin
 perform 1 from app.tournaments where id=new.tournament_id for no key update;
 if tg_table_name='roster_payment_events' then
  if new.event_type='received' and exists(select 1 from app.q_pool_policies_v1 where tournament_id=new.tournament_id and new.payment_received_at<published_at) then
   raise exception 'q_policy_backdated_receipt';
  end if;
 else
  for x in select value from jsonb_array_elements(new.request->'pools') where value->>'elected'='true' loop
   select * into p from app.q_pool_policies_v1 where tournament_id=new.tournament_id and event_id=new.event_id and pool_version_id=(x->>'poolVersionId')::uuid;
   if found then
    prefix:='Q policy '||p.id::text||': ';
    if left(coalesce(x->>'consentReference',''),length(prefix))<>prefix or length(trim(substr(x->>'consentReference',length(prefix)+1)))=0 then raise exception 'q_policy_acknowledgment_required'; end if;
   end if;
  end loop;
 end if;
 return new;
end $$;
revoke all on function app.guard_q_pool_disclosure_v1() from public,anon,authenticated,service_role;
create trigger q_pool_receipt_disclosure_guard before insert on app.roster_payment_events for each row execute function app.guard_q_pool_disclosure_v1();
create trigger q_pool_election_disclosure_guard before insert on app.q_pool_membership_versions_v1 for each row execute function app.guard_q_pool_disclosure_v1();

create function public.publish_q_pool_policy_v1(p_actor_id uuid,p_tournament_id uuid,p_request jsonb,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; prior app.operation_receipts%rowtype; pol app.q_pool_policies_v1%rowtype; h text; response jsonb; op uuid; code text; poolid uuid;
begin
 if p_actor_id is null or p_tournament_id is null or p_operation_id is null then return null; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 perform 1 from app.tournaments where id=p_tournament_id and status in('draft','open','pending_finalization') for no key update;
 if not found or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director') then return null; end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('q_pool_policy_v1',p_tournament_id,p_request)::text,'utf8'),'sha256'),'hex');
 select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id;
 if found then
  if prior.tournament_id=p_tournament_id and prior.operation_type='q_pool_policy_v1' and prior.request_hash=h then return prior.response_payload; end if;
  return jsonb_build_object('status','rejected','code','idempotency_conflict');
 end if;
 begin
  if jsonb_typeof(p_request) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_request))<>4
    or not p_request ?& array['poolVersionId','method','disclosureReference','disclosed']
    or p_request->>'poolVersionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_request->'poolVersionId') is distinct from 'string' or p_request->>'method' is distinct from 'equal-paid-qualifiers-v1'
    or jsonb_typeof(p_request->'method') is distinct from 'string' or p_request->'disclosed' is distinct from 'true'::jsonb
    or jsonb_typeof(p_request->'disclosureReference') is distinct from 'string' or length(trim(p_request->>'disclosureReference')) not between 1 and 500
    or p_request->>'disclosureReference' ~ '[[:cntrl:]]' then raise exception 'invalid_request'; end if;
  c:=app.q_pool_context_v1(p_tournament_id); poolid:=(p_request->>'poolVersionId')::uuid;
  if c is null or c->>'supported' is distinct from 'true' then raise exception 'unsupported_scope'; end if;
  if c->>'started'='true' then raise exception 'entries_locked'; end if;
  if not exists(select 1 from jsonb_array_elements(c->'pools') x where x->>'poolVersionId'=poolid::text) then raise exception 'pool_version_mismatch'; end if;
  if exists(select 1 from app.q_pool_policies_v1 where pool_version_id=poolid) then raise exception 'policy_frozen'; end if;
  if exists(select 1 from app.roster_payment_events where tournament_id=p_tournament_id)
    or exists(select 1 from app.q_pool_membership_versions_v1 m cross join lateral jsonb_array_elements(m.request->'pools') x where m.tournament_id=p_tournament_id and x->>'elected'='true') then raise exception 'collection_or_consent_already_started'; end if;
  if not exists(select 1 from app.tournament_setup_q_pool_versions where id=poolid and tournament_id=p_tournament_id and pool_type_code='Equal (Pays All Equally)') then raise exception 'setup_method_conflict'; end if;
  op:=extensions.gen_random_uuid(); pol.id:=extensions.gen_random_uuid();
  response:=jsonb_build_object('status','q_policy_published','policyId',pol.id,'poolVersionId',poolid,'version',1);
  insert into app.operation_receipts(id,tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
   values(op,p_tournament_id,p_actor_id,'q_pool_policy_v1',poolid,h,p_operation_id,'accepted',response,now());
  insert into app.q_pool_policies_v1(id,tournament_id,event_id,pool_version_id,method,disclosure_reference,actor_id,operation_receipt_id)
   values(pol.id,p_tournament_id,(c->>'eventId')::uuid,poolid,p_request->>'method',trim(p_request->>'disclosureReference'),p_actor_id,op);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
   values(p_tournament_id,p_actor_id,op,'q_pool_policy',pol.id,'q_pool_policy_published',response);
  return response;
 exception when raise_exception or invalid_text_representation then
  code:=case when sqlerrm in('invalid_request','unsupported_scope','entries_locked','pool_version_mismatch','policy_frozen','collection_or_consent_already_started','setup_method_conflict') then sqlerrm else 'invalid_request' end;
  response:=jsonb_build_object('status','rejected','code',code);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload)
   values(p_tournament_id,p_actor_id,'q_pool_policy_v1',p_tournament_id,h,p_operation_id,'rejected',response);
  return response;
 end;
end $$;

create function public.get_q_pool_policy_reconciliation_v1(p_actor_id uuid,p_tournament_id uuid,p_operation_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director')
 then jsonb_build_object('authorized',true,'result',(select response_payload from app.operation_receipts where tournament_id=p_tournament_id and actor_profile_id=p_actor_id and client_operation_id=p_operation_id and operation_type='q_pool_policy_v1')) else null end
$$;

create function public.get_q_pool_preview_sources_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c jsonb; w jsonb; q app.qualification_result_versions%rowtype; policies jsonb; qualifier jsonb; manifest jsonb; blockers jsonb:='[]'; canpub boolean;
begin
 w:=public.get_q_pool_membership_workspace_v1(p_actor_id,p_tournament_id); if w is null then return null; end if;
 c:=app.q_pool_context_v1(p_tournament_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'poolVersionId',p.pool_version_id,'version',p.version,'method',p.method,'disclosureReference',p.disclosure_reference,'publishedAt',p.published_at)order by p.pool_version_id),'[]') into policies
 from app.q_pool_policies_v1 p where p.tournament_id=p_tournament_id and p.event_id=(c->>'eventId')::uuid;
 if exists(select 1 from app.q_pool_policies_v1 p join app.tournament_setup_q_pool_versions s on s.id=p.pool_version_id where p.tournament_id=p_tournament_id and s.pool_type_code<>'Equal (Pays All Equally)') then blockers:=blockers||'"setup_method_conflict"'::jsonb; end if;
 select * into q from app.qualification_result_versions where tournament_id=p_tournament_id and event_id=(c->>'eventId')::uuid order by version desc limit 1;
 if q.id is not null then
  select jsonb_build_object('id',q.id,'version',q.version,'qualifiers',coalesce(jsonb_agg(jsonb_build_object('participantId',r.participant_id,'qualificationRank',r.ranking_ordinal,'tied',r.tied)order by r.ranking_ordinal),'[]')) into qualifier from app.qualification_result_rows r where r.result_version_id=q.id and r.qualification_status='qualified';
  if jsonb_array_length(qualifier->'qualifiers')<>q.qualifier_count then blockers:=blockers||'"qualification_incomplete"'::jsonb; end if;
 end if;
 if exists(select 1 from app.event_disputes where tournament_id=p_tournament_id and event_id=(c->>'eventId')::uuid and app.event_dispute_is_open(id)) then blockers:=blockers||'"qualification_disputed"'::jsonb; end if;
 if exists(select 1 from app.roster_payment_events p where p.tournament_id=p_tournament_id and p.event_type='received' and p.amount_minor>0
   and not exists(select 1 from app.roster_payment_events newer where newer.tournament_id=p.tournament_id and newer.roster_entry_id=p.roster_entry_id and newer.version>p.version)
   and not exists(select 1 from jsonb_array_elements(w->'entries') e where e->>'rosterEntryId'=p.roster_entry_id::text)) then blockers:=blockers||'"unresolved_receipt_allocation"'::jsonb; end if;
 -- A removed/withdrawn contributor, or a historical positive allocation now declined,
 -- cannot disappear from the funding universe. Refund resolution is not yet implemented.
 if exists(select 1 from app.q_pool_allocation_versions_v1 a cross join lateral jsonb_array_elements(a.request->'pools') p
  where a.tournament_id=p_tournament_id and (p->>'amountMinor')::bigint>0 and not exists(select 1 from jsonb_array_elements(w->'entries') e cross join lateral jsonb_array_elements(e->'pools') ep where e->>'rosterEntryId'=a.roster_entry_id::text and ep->>'poolVersionId'=p->>'poolVersionId' and ep->>'elected'='true')) then blockers:=blockers||'"refund_resolution_required"'::jsonb; end if;
 canpub:=c->>'supported'='true' and c->>'started'='false' and exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role='director')
  and not exists(select 1 from app.roster_payment_events where tournament_id=p_tournament_id)
  and not exists(select 1 from app.q_pool_membership_versions_v1 m cross join lateral jsonb_array_elements(m.request->'pools') p where m.tournament_id=p_tournament_id and p->>'elected'='true');
 manifest:=jsonb_build_object('context',c,'workspace',w,'policies',policies,'qualification',qualifier,'qualificationRecord',to_jsonb(q),'blockers',blockers,
  'membershipHistory',(select coalesce(jsonb_agg(to_jsonb(m)order by m.id),'[]') from app.q_pool_membership_versions_v1 m where m.tournament_id=p_tournament_id),
  'allocationHistory',(select coalesce(jsonb_agg(to_jsonb(a)order by a.id),'[]') from app.q_pool_allocation_versions_v1 a where a.tournament_id=p_tournament_id),
  'paymentHistory',(select coalesce(jsonb_agg(to_jsonb(p)order by p.id),'[]') from app.roster_payment_events p where p.tournament_id=p_tournament_id),
  'obligationHistory',(select coalesce(jsonb_agg(to_jsonb(o)order by o.id),'[]') from app.roster_payment_obligation_versions o where o.tournament_id=p_tournament_id));
 return jsonb_build_object('tournamentId',p_tournament_id,'membership',w,'canPublish',coalesce(canpub,false),'policies',policies,'qualification',qualifier,'blockers',blockers,
  'sourceDigest',encode(extensions.digest(convert_to(manifest::text,'utf8'),'sha256'),'hex'));
end $$;
revoke all on function public.publish_q_pool_policy_v1(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.get_q_pool_policy_reconciliation_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_q_pool_preview_sources_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.publish_q_pool_policy_v1(uuid,uuid,jsonb,uuid) to service_role;
grant execute on function public.get_q_pool_policy_reconciliation_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.get_q_pool_preview_sources_v1(uuid,uuid) to service_role;
