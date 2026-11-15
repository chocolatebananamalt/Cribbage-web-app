-- Integrity repairs for team beneficiaries: all guards live in the database so
-- service-role callers cannot bypass the director, lifecycle, or money rules.
create table app.event_side_pool_payout_review_versions(
 id uuid primary key default extensions.gen_random_uuid(), payout_id uuid not null,
 beneficiary_kind text not null check(beneficiary_kind in('participant','team_entry')),
 payout_version integer not null check(payout_version>0), tournament_id uuid not null,
 event_id uuid not null, reviewer_profile_id uuid not null references app.profiles(id) on delete restrict,
 approved boolean not null, evidence_reference text not null check(length(trim(evidence_reference)) between 1 and 500),
 reason text not null default 'Independent payout review', operation_receipt_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 unique(payout_id,beneficiary_kind,payout_version,reviewer_profile_id)
);
alter table app.event_side_pool_payout_review_versions enable row level security;
alter table app.event_side_pool_payout_review_versions force row level security;
revoke all on table app.event_side_pool_payout_review_versions from public,anon,authenticated;
create trigger event_side_pool_review_versions_immutable before update or delete on app.event_side_pool_payout_review_versions for each row execute function app.reject_immutable_history();

create or replace function app.guard_side_pool_team_election_v3() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from app.tournament_roles where tournament_id=new.tournament_id and profile_id=new.actor_profile_id and role in('director','co_director')) then raise exception 'side_pool_not_director'; end if;
 if app.event_play_state_v1(new.event_id) in('in_progress','completed','finalized') or exists(select 1 from app.event_side_pool_reconciliations where pool_id=new.pool_id) then raise exception 'side_pool_finalized'; end if;
 if exists(select 1 from app.event_side_pool_team_election_versions where pool_id=new.pool_id and team_entry_id=new.team_entry_id and election_id<>new.election_id) then raise exception 'election_id_conflict'; end if;
 if exists(select 1 from app.event_side_pool_team_election_versions where election_id=new.election_id and team_entry_id=new.team_entry_id) and not exists(select 1 from app.event_side_pool_team_election_versions where election_id=new.election_id and team_entry_id=new.team_entry_id and version=new.version-1) then raise exception 'election_id_conflict'; end if;
 return new;
end $$;
create trigger event_side_pool_team_election_guard before insert on app.event_side_pool_team_election_versions for each row execute function app.guard_side_pool_team_election_v3();
create trigger event_side_pool_team_election_immutable before update or delete on app.event_side_pool_team_election_versions for each row execute function app.reject_immutable_history();
create trigger event_side_pool_team_payout_immutable before update or delete on app.event_side_pool_team_payout_versions for each row execute function app.reject_immutable_history();
create index if not exists event_side_pool_team_election_current_idx on app.event_side_pool_team_election_versions(pool_id,team_entry_id,version desc);

create or replace function app.guard_side_pool_team_payout_v3() returns trigger language plpgsql security definer set search_path='' as $$
declare collected integer; old_amount integer:=0; paid_other integer; current_elected boolean;
begin
 if not exists(select 1 from app.tournament_roles where tournament_id=new.tournament_id and profile_id=new.actor_profile_id and role in('director','co_director')) then raise exception 'side_pool_not_director'; end if;
 if exists(select 1 from app.event_side_pool_reconciliations where pool_id=new.pool_id) then raise exception 'side_pool_finalized'; end if;
 if not exists(select 1 from app.event_side_pool_policy_versions where pool_id=new.pool_id and posted_before_play) then raise exception 'policy_unavailable'; end if;
 select elected into current_elected from (select distinct on(team_entry_id) elected from app.event_side_pool_team_election_versions where pool_id=new.pool_id and team_entry_id=new.team_entry_id order by team_entry_id,version desc) x; if coalesce(current_elected,false)=false then raise exception 'winner_not_elected'; end if;
 select coalesce(sum(amount_received_minor),0) into collected from (select distinct on(participant_id) amount_received_minor,elected from app.event_side_pool_election_versions where pool_id=new.pool_id order by participant_id,version desc) x where elected;
 select collected+coalesce(sum(amount_received_minor),0) into collected from (select distinct on(team_entry_id) amount_received_minor,elected from app.event_side_pool_team_election_versions where pool_id=new.pool_id order by team_entry_id,version desc) x where elected;
 select coalesce(amount_minor,0) into old_amount from (select amount_minor,voided from app.event_side_pool_team_payout_versions where payout_id=new.payout_id order by version desc limit 1) x where not voided;
 select coalesce(sum(amount_minor),0) into paid_other from (select distinct on(payout_id) amount_minor,voided from app.event_side_pool_payout_versions where pool_id=new.pool_id order by payout_id,version desc) x where not voided;
 select paid_other+coalesce(sum(amount_minor),0) into paid_other from (select distinct on(payout_id) amount_minor,voided from app.event_side_pool_team_payout_versions where pool_id=new.pool_id and payout_id<>new.payout_id order by payout_id,version desc) x where not voided;
 if not new.voided and paid_other+new.amount_minor>collected then raise exception 'payout_exceeds_collected'; end if;
 if not new.voided and exists(select 1 from app.event_side_pool_payout_versions where pool_id=new.pool_id and placement=new.placement and not voided) or not new.voided and exists(select 1 from app.event_side_pool_team_payout_versions where pool_id=new.pool_id and placement=new.placement and payout_id<>new.payout_id and not voided) then raise exception 'placement_exists'; end if;
 return new;
end $$;
create trigger event_side_pool_team_payout_guard before insert on app.event_side_pool_team_payout_versions for each row execute function app.guard_side_pool_team_payout_v3();

create or replace function app.mirror_side_pool_review_v3() returns trigger language plpgsql security definer set search_path='' as $$
declare pv integer;
begin
 select case when new.beneficiary_kind='participant' then (select max(version) from app.event_side_pool_payout_versions where payout_id=new.payout_id) else (select max(version) from app.event_side_pool_team_payout_versions where payout_id=new.payout_id) end into pv;
 insert into app.event_side_pool_payout_review_versions(payout_id,beneficiary_kind,payout_version,tournament_id,event_id,reviewer_profile_id,approved,evidence_reference,operation_receipt_id)
 values(new.payout_id,new.beneficiary_kind,coalesce(pv,1),new.tournament_id,new.event_id,new.reviewer_profile_id,new.approved,new.evidence_reference,new.operation_receipt_id)
 on conflict(payout_id,beneficiary_kind,payout_version,reviewer_profile_id) do nothing;
 return new;
end $$;
create trigger event_side_pool_payout_review_mirror after insert or update on app.event_side_pool_payout_reviews for each row execute function app.mirror_side_pool_review_v3();
create trigger event_side_pool_payout_reviews_immutable before update or delete on app.event_side_pool_payout_reviews for each row execute function app.reject_immutable_history();

create or replace function app.check_side_pool_reconciliation_v2() returns trigger language plpgsql security definer set search_path='' as $$
declare expected integer; paid integer;
begin
 select coalesce(sum(amount_received_minor),0) into expected from (select distinct on(participant_id) amount_received_minor,elected from app.event_side_pool_election_versions where pool_id=new.pool_id order by participant_id,version desc) x where elected;
 select expected+coalesce(sum(amount_received_minor),0) into expected from (select distinct on(team_entry_id) amount_received_minor,elected from app.event_side_pool_team_election_versions where pool_id=new.pool_id order by team_entry_id,version desc) x where elected;
 select coalesce(sum(amount_minor),0) into paid from (select distinct on(payout_id) amount_minor,voided from app.event_side_pool_payout_versions where pool_id=new.pool_id order by payout_id,version desc) x where not voided;
 select paid+coalesce(sum(amount_minor),0) into paid from (select distinct on(payout_id) amount_minor,voided from app.event_side_pool_team_payout_versions where pool_id=new.pool_id order by payout_id,version desc) x where not voided;
 if exists(select 1 from (select amount_due_minor,amount_received_minor,elected from (select distinct on(participant_id) amount_due_minor,amount_received_minor,elected from app.event_side_pool_election_versions where pool_id=new.pool_id order by participant_id,version desc)x union all select amount_due_minor,amount_received_minor,elected from (select distinct on(team_entry_id) amount_due_minor,amount_received_minor,elected from app.event_side_pool_team_election_versions where pool_id=new.pool_id order by team_entry_id,version desc)x) unpaid where elected and amount_received_minor<>amount_due_minor) then raise exception 'side_pool_unpaid_elections'; end if;
 if expected<>paid then raise exception 'side_pool_combined_unreconciled'; end if;
 new.collected_minor:=expected; new.paid_minor:=paid; new.remaining_minor:=expected-paid;
 if exists(select 1 from (select payout_id,'participant' beneficiary_kind,version,voided from (select distinct on(payout_id) payout_id,version,voided from app.event_side_pool_payout_versions where pool_id=new.pool_id order by payout_id,version desc)x union all select payout_id,'team_entry',version,voided from (select distinct on(payout_id) payout_id,version,voided from app.event_side_pool_team_payout_versions where pool_id=new.pool_id order by payout_id,version desc)x) p where not p.voided and not exists(select 1 from app.event_side_pool_payout_review_versions r where r.payout_id=p.payout_id and r.beneficiary_kind=p.beneficiary_kind and r.approved and r.reviewer_profile_id<>new.actor_profile_id and r.payout_version=p.version)) then raise exception 'side_pool_payout_review_required'; end if;
 return new;
end $$;
drop trigger if exists event_side_pool_reconciliation_team_guard on app.event_side_pool_reconciliations;
create trigger event_side_pool_reconciliation_team_guard before insert on app.event_side_pool_reconciliations for each row execute function app.check_side_pool_reconciliation_v2();

-- Reviews are appended against the exact current payout version. Correcting a
-- payout therefore requires a new independent review and cannot inherit an
-- approval from an older amount or placement.
create or replace function public.review_event_side_pool_payout_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_payout_id uuid,p_beneficiary_kind text,p_approved boolean,p_evidence_reference text,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid:=extensions.gen_random_uuid();h text;prior app.operation_receipts%rowtype;response jsonb;pv integer;creator uuid;
begin
 if p_beneficiary_kind not in('participant','team_entry') or p_evidence_reference is null or length(trim(p_evidence_reference)) not between 1 and 500 or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director','cross_checker','judge')) then return jsonb_build_object('status','rejected','code','not_reviewer');end if;
 if p_beneficiary_kind='participant' then select version,actor_profile_id into pv,creator from app.event_side_pool_payout_versions where payout_id=p_payout_id and tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;else select version,actor_profile_id into pv,creator from app.event_side_pool_team_payout_versions where payout_id=p_payout_id and tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;end if;
 if pv is null then return jsonb_build_object('status','rejected','code','payout_unavailable');end if;if creator=p_actor_id then return jsonb_build_object('status','rejected','code','self_review_forbidden');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array('review_event_side_pool_payout_v1',p_actor_id,p_tournament_id,p_event_id,p_payout_id,p_beneficiary_kind,pv,p_approved,p_evidence_reference)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return prior.response_payload;end if;
 response:=jsonb_build_object('status','side_pool_payout_reviewed','payoutId',p_payout_id,'beneficiaryKind',p_beneficiary_kind,'payoutVersion',pv,'approved',p_approved);insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,p_actor_id,p_tournament_id,'review_event_side_pool_payout_v1',p_payout_id,h,p_idempotency_key,'accepted',response,clock_timestamp());insert into app.event_side_pool_payout_review_versions(payout_id,beneficiary_kind,payout_version,tournament_id,event_id,reviewer_profile_id,approved,evidence_reference,operation_receipt_id)values(p_payout_id,p_beneficiary_kind,pv,p_tournament_id,p_event_id,p_actor_id,p_approved,trim(p_evidence_reference),rid);insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,rid,'event_side_pool_payout',p_payout_id,'side_pool_payout_reviewed',response);return response;
end $$;
revoke all on function public.review_event_side_pool_payout_v1(uuid,uuid,uuid,uuid,text,boolean,text,uuid) from public,anon,authenticated;grant execute on function public.review_event_side_pool_payout_v1(uuid,uuid,uuid,uuid,text,boolean,text,uuid) to service_role;
create or replace function public.finalize_event_side_pool_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_reconciliation_id uuid,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;prior app.operation_receipts%rowtype;rid uuid:=extensions.gen_random_uuid();collected integer;paid integer;response jsonb;
begin
 if p_actor_id is null or p_reconciliation_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;h:=encode(extensions.digest(convert_to(jsonb_build_array('finalize_event_side_pool_v1',p_actor_id,p_tournament_id,p_event_id,p_pool_id,p_reconciliation_id)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('side-pool-finalize:'||p_pool_id::text,0));select * into prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if prior.request_hash<>h then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return prior.response_payload;end if;
 if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;if exists(select 1 from app.event_side_pool_reconciliations where pool_id=p_pool_id) then return jsonb_build_object('status','rejected','code','already_finalized');end if;if not exists(select 1 from app.event_side_pool_policy_versions where pool_id=p_pool_id and posted_before_play) then return jsonb_build_object('status','rejected','code','policy_unavailable');end if;
 if exists(select 1 from(select amount_due_minor,amount_received_minor,elected from(select distinct on(participant_id) amount_due_minor,amount_received_minor,elected from app.event_side_pool_election_versions where pool_id=p_pool_id order by participant_id,version desc)a union all select amount_due_minor,amount_received_minor,elected from(select distinct on(team_entry_id) amount_due_minor,amount_received_minor,elected from app.event_side_pool_team_election_versions where pool_id=p_pool_id order by team_entry_id,version desc)b)c where elected and amount_due_minor<>amount_received_minor)then return jsonb_build_object('status','rejected','code','unpaid_elections');end if;
 select coalesce(sum(amount_received_minor),0) into collected from(select amount_received_minor,elected from(select distinct on(participant_id) amount_received_minor,elected from app.event_side_pool_election_versions where pool_id=p_pool_id order by participant_id,version desc)a union all select amount_received_minor,elected from(select distinct on(team_entry_id) amount_received_minor,elected from app.event_side_pool_team_election_versions where pool_id=p_pool_id order by team_entry_id,version desc)b)c where elected;select coalesce(sum(amount_minor),0) into paid from(select amount_minor,voided from(select distinct on(payout_id) amount_minor,voided from app.event_side_pool_payout_versions where pool_id=p_pool_id order by payout_id,version desc)a union all select amount_minor,voided from(select distinct on(payout_id) amount_minor,voided from app.event_side_pool_team_payout_versions where pool_id=p_pool_id order by payout_id,version desc)b)c where not voided;if collected<>paid then return jsonb_build_object('status','rejected','code','unreconciled','collectedMinor',collected,'paidMinor',paid,'remainingMinor',collected-paid);end if;
 response:=jsonb_build_object('status','side_pool_finalized','poolId',p_pool_id,'reconciliationId',p_reconciliation_id,'collectedMinor',collected,'paidMinor',paid,'remainingMinor',0);insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)values(rid,p_actor_id,p_tournament_id,'finalize_event_side_pool_v1',p_reconciliation_id,h,p_idempotency_key,'accepted',response,clock_timestamp());insert into app.event_side_pool_reconciliations(id,pool_id,tournament_id,event_id,collected_minor,paid_minor,remaining_minor,actor_profile_id,operation_receipt_id)values(p_reconciliation_id,p_pool_id,p_tournament_id,p_event_id,collected,paid,0,p_actor_id,rid);insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)values(p_tournament_id,p_actor_id,rid,'event_side_pool',p_pool_id,'side_pool_finalized',response);return response;
exception when others then if sqlerrm like '%side_pool_payout_review_required%' then return jsonb_build_object('status','rejected','code','payout_review_required');end if;raise;end $$;
revoke all on function public.finalize_event_side_pool_v1(uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;grant execute on function public.finalize_event_side_pool_v1(uuid,uuid,uuid,uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
