-- Complete event-scoped Side Pool operations. Side Pools remain independent
-- from Q Pools and use integer cents throughout.

alter table app.event_side_pool_election_versions
  add column payment_method text check(payment_method in('cash','check')),
  add column payment_reference text check(payment_reference is null or length(payment_reference)<=100),
  add column reason text not null default 'Initial election' check(length(trim(reason)) between 1 and 500);
alter table app.event_side_pool_payout_versions
  add column reason text not null default 'Director-reviewed payout' check(length(trim(reason)) between 1 and 500);

create table app.event_side_pool_policy_versions(
 id uuid primary key default extensions.gen_random_uuid(),pool_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 version integer not null check(version>0),payout_ratio_denominator integer not null check(payout_ratio_denominator between 2 and 100),
 posted_payout_schedule jsonb not null check(jsonb_typeof(posted_payout_schedule)='array'),posted_before_play boolean not null,
 active boolean not null default true,reason text not null check(length(trim(reason)) between 1 and 500),
 actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(pool_id,tournament_id,event_id) references app.event_side_pools(id,tournament_id,event_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 unique(pool_id,version)
);
alter table app.event_side_pool_policy_versions enable row level security;alter table app.event_side_pool_policy_versions force row level security;
revoke all on table app.event_side_pool_policy_versions from public,anon,authenticated;
create trigger event_side_pool_policies_immutable before update or delete on app.event_side_pool_policy_versions for each row execute function app.reject_immutable_history();
create index event_side_pool_policies_current_idx on app.event_side_pool_policy_versions(pool_id,version desc);

create table app.event_side_pool_reconciliations(
 id uuid primary key,pool_id uuid not null,tournament_id uuid not null,event_id uuid not null,
 collected_minor integer not null check(collected_minor>=0),paid_minor integer not null check(paid_minor>=0),remaining_minor integer not null check(remaining_minor>=0),
 actor_profile_id uuid not null references app.profiles(id) on delete restrict,operation_receipt_id uuid not null,finalized_at timestamptz not null default clock_timestamp(),
 foreign key(pool_id,tournament_id,event_id) references app.event_side_pools(id,tournament_id,event_id) on delete restrict,
 foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict,
 unique(pool_id),check(collected_minor=paid_minor+remaining_minor),check(remaining_minor=0)
);
alter table app.event_side_pool_reconciliations enable row level security;alter table app.event_side_pool_reconciliations force row level security;
revoke all on table app.event_side_pool_reconciliations from public,anon,authenticated;
create trigger event_side_pool_reconciliations_immutable before update or delete on app.event_side_pool_reconciliations for each row execute function app.reject_immutable_history();

create or replace function public.configure_event_side_pool_policy_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_ratio_denominator integer,p_payout_schedule jsonb,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_version integer;v_response jsonb;
begin
 if p_actor_id is null or p_idempotency_key is null or p_ratio_denominator not between 2 and 100 or jsonb_typeof(p_payout_schedule)<>'array' or jsonb_array_length(p_payout_schedule)<1 or length(trim(p_reason)) not between 1 and 500 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 if exists(select 1 from jsonb_array_elements(p_payout_schedule) item where coalesce((item->>'placement')::integer,0)<1 or coalesce((item->>'amountMinor')::integer,-1)<0) then return jsonb_build_object('status','rejected','code','invalid_schedule');end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('configure_event_side_pool_policy_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_pool_id::text,p_ratio_denominator,p_payout_schedule,p_reason)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('side-pool-policy:'||p_pool_id::text,0));
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
 if not exists(select 1 from app.event_side_pools where id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id) or exists(select 1 from app.event_side_pool_reconciliations where pool_id=p_pool_id) then return jsonb_build_object('status','rejected','code','pool_unavailable');end if;
 if app.event_play_state_v1(p_event_id) in('in_progress','completed','finalized') then return jsonb_build_object('status','rejected','code','policy_must_be_posted_before_play');end if;
 select coalesce(max(version),0)+1 into v_version from app.event_side_pool_policy_versions where pool_id=p_pool_id;
 v_response:=jsonb_build_object('status','side_pool_policy_configured','poolId',p_pool_id,'version',v_version,'payoutRatioDenominator',p_ratio_denominator,'postedBeforePlay',true);
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt,p_actor_id,p_tournament_id,'configure_event_side_pool_policy_v1',p_pool_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
 insert into app.event_side_pool_policy_versions(pool_id,tournament_id,event_id,version,payout_ratio_denominator,posted_payout_schedule,posted_before_play,reason,actor_profile_id,operation_receipt_id) values(p_pool_id,p_tournament_id,p_event_id,v_version,p_ratio_denominator,p_payout_schedule,true,trim(p_reason),p_actor_id,v_receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'event_side_pool',p_pool_id,'side_pool_policy_configured',v_response||jsonb_build_object('schedule',p_payout_schedule));
 return v_response;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('status','rejected','code','invalid_schedule');
end $$;
revoke all on function public.configure_event_side_pool_policy_v1(uuid,uuid,uuid,uuid,integer,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.configure_event_side_pool_policy_v1(uuid,uuid,uuid,uuid,integer,jsonb,text,uuid) to service_role;

create or replace function public.set_event_side_pool_election_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_participant_id uuid,p_election_id uuid,p_elected boolean,p_amount_received_minor integer,p_payment_method text,p_payment_reference text,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_definition app.event_side_pool_definition_versions%rowtype;v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_version integer;v_response jsonb;
begin
 if p_actor_id is null or p_election_id is null or p_idempotency_key is null or p_elected is null or p_amount_received_minor<0 or p_payment_method not in('cash','check') or length(coalesce(p_payment_reference,''))>100 or length(trim(p_reason)) not between 1 and 500 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('set_event_side_pool_election_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_pool_id::text,p_participant_id::text,p_election_id::text,p_elected,p_amount_received_minor,p_payment_method,p_payment_reference,p_reason)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('side-pool-election:'||p_pool_id::text||':'||p_participant_id::text,0));
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
 select * into v_definition from app.event_side_pool_definition_versions where pool_id=p_pool_id and tournament_id=p_tournament_id and event_id=p_event_id order by version desc limit 1;
 if not found or not v_definition.active or not exists(select 1 from app.event_participants where id=p_participant_id and tournament_id=p_tournament_id and event_id=p_event_id) or exists(select 1 from app.event_side_pool_reconciliations where pool_id=p_pool_id) then return jsonb_build_object('status','rejected','code','pool_unavailable');end if;
 if p_elected and p_amount_received_minor>v_definition.entry_fee_minor then return jsonb_build_object('status','rejected','code','received_exceeds_due');end if;
 if not p_elected and p_amount_received_minor<>0 then return jsonb_build_object('status','rejected','code','removed_election_requires_zero');end if;
 select coalesce(max(version),0)+1 into v_version from app.event_side_pool_election_versions where pool_id=p_pool_id and participant_id=p_participant_id;
 if v_version>1 and not exists(select 1 from app.event_side_pool_election_versions where election_id=p_election_id and pool_id=p_pool_id and participant_id=p_participant_id) then return jsonb_build_object('status','rejected','code','election_id_conflict');end if;
 v_response:=jsonb_build_object('status','side_pool_election_recorded','poolId',p_pool_id,'participantId',p_participant_id,'electionId',p_election_id,'version',v_version,'elected',p_elected,'amountDueMinor',case when p_elected then v_definition.entry_fee_minor else 0 end,'amountReceivedMinor',p_amount_received_minor,'amountRemainingMinor',case when p_elected then v_definition.entry_fee_minor-p_amount_received_minor else 0 end);
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt,p_actor_id,p_tournament_id,'set_event_side_pool_election_v1',p_election_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
 insert into app.event_side_pool_election_versions(election_id,pool_id,tournament_id,event_id,participant_id,version,elected,amount_due_minor,amount_received_minor,payment_method,payment_reference,reason,actor_profile_id,operation_receipt_id)
 values(p_election_id,p_pool_id,p_tournament_id,p_event_id,p_participant_id,v_version,p_elected,case when p_elected then v_definition.entry_fee_minor else 0 end,p_amount_received_minor,p_payment_method,nullif(trim(coalesce(p_payment_reference,'')),''),trim(p_reason),p_actor_id,v_receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'side_pool_election',p_election_id,case when p_elected then 'side_pool_election_recorded' else 'side_pool_election_removed' end,v_response);
 return v_response;
end $$;
revoke all on function public.set_event_side_pool_election_v1(uuid,uuid,uuid,uuid,uuid,uuid,boolean,integer,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.set_event_side_pool_election_v1(uuid,uuid,uuid,uuid,uuid,uuid,boolean,integer,text,text,text,uuid) to service_role;

create or replace function public.set_event_side_pool_payout_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_participant_id uuid,p_payout_id uuid,p_placement integer,p_amount_minor integer,p_voided boolean,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_version integer;v_collected integer;v_other_paid integer;v_response jsonb;
begin
 if p_actor_id is null or p_payout_id is null or p_idempotency_key is null or p_placement<1 or p_amount_minor<0 or p_voided is null or length(trim(p_reason)) not between 1 and 500 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('set_event_side_pool_payout_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_pool_id::text,p_participant_id::text,p_payout_id::text,p_placement,p_amount_minor,p_voided,p_reason)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('side-pool-payout:'||p_pool_id::text,0));
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
 if not exists(select 1 from app.event_side_pool_policy_versions where pool_id=p_pool_id and posted_before_play order by version desc limit 1) or not exists(select 1 from app.event_participants where id=p_participant_id and event_id=p_event_id and tournament_id=p_tournament_id) or exists(select 1 from app.event_side_pool_reconciliations where pool_id=p_pool_id) then return jsonb_build_object('status','rejected','code','pool_unavailable');end if;
 if not exists(select 1 from(select distinct on(election.participant_id) election.* from app.event_side_pool_election_versions election where election.pool_id=p_pool_id order by election.participant_id,election.version desc) current where current.participant_id=p_participant_id and current.elected) then return jsonb_build_object('status','rejected','code','winner_not_elected');end if;
 if not p_voided and exists(select 1 from(select distinct on(payout.payout_id) payout.* from app.event_side_pool_payout_versions payout where payout.pool_id=p_pool_id order by payout.payout_id,payout.version desc) current where not current.voided and current.placement=p_placement and current.payout_id<>p_payout_id) then return jsonb_build_object('status','rejected','code','placement_exists');end if;
 select coalesce(sum(current.amount_received_minor),0)::integer into v_collected from(select distinct on(election.participant_id) election.* from app.event_side_pool_election_versions election where election.pool_id=p_pool_id order by election.participant_id,election.version desc) current where current.elected;
 select coalesce(sum(current.amount_minor),0)::integer into v_other_paid from(select distinct on(payout.payout_id) payout.* from app.event_side_pool_payout_versions payout where payout.pool_id=p_pool_id order by payout.payout_id,payout.version desc) current where not current.voided and current.payout_id<>p_payout_id;
 if not p_voided and v_other_paid+p_amount_minor>v_collected then return jsonb_build_object('status','rejected','code','payout_exceeds_collected');end if;
 select coalesce(max(version),0)+1 into v_version from app.event_side_pool_payout_versions where payout_id=p_payout_id;
 v_response:=jsonb_build_object('status','side_pool_payout_recorded','poolId',p_pool_id,'participantId',p_participant_id,'payoutId',p_payout_id,'version',v_version,'placement',p_placement,'amountMinor',p_amount_minor,'voided',p_voided,'collectedMinor',v_collected,'paidMinor',case when p_voided then v_other_paid else v_other_paid+p_amount_minor end);
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt,p_actor_id,p_tournament_id,'set_event_side_pool_payout_v1',p_payout_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
 insert into app.event_side_pool_payout_versions(payout_id,pool_id,tournament_id,event_id,participant_id,version,placement,amount_minor,voided,reason,actor_profile_id,operation_receipt_id) values(p_payout_id,p_pool_id,p_tournament_id,p_event_id,p_participant_id,v_version,p_placement,p_amount_minor,p_voided,trim(p_reason),p_actor_id,v_receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'side_pool_payout',p_payout_id,case when p_voided then 'side_pool_payout_voided' else 'side_pool_payout_recorded' end,v_response);
 return v_response;
end $$;
revoke all on function public.set_event_side_pool_payout_v1(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,boolean,text,uuid) from public,anon,authenticated;
grant execute on function public.set_event_side_pool_payout_v1(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,boolean,text,uuid) to service_role;

create or replace function public.finalize_event_side_pool_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_pool_id uuid,p_reconciliation_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid:=extensions.gen_random_uuid();v_collected integer;v_paid integer;v_response jsonb;
begin
 if p_actor_id is null or p_reconciliation_id is null or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('finalize_event_side_pool_v1',p_actor_id::text,p_tournament_id::text,p_event_id::text,p_pool_id::text,p_reconciliation_id::text)::text,'utf8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('side-pool-finalize:'||p_pool_id::text,0));
 perform 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director') for update;if not found then return jsonb_build_object('status','rejected','code','not_director');end if;
 select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
 if exists(select 1 from app.event_side_pool_reconciliations where pool_id=p_pool_id) then return jsonb_build_object('status','rejected','code','already_finalized');end if;
 if not exists(select 1 from app.event_side_pool_policy_versions where pool_id=p_pool_id and posted_before_play) then return jsonb_build_object('status','rejected','code','policy_unavailable');end if;
 if exists(select 1 from(select distinct on(election.participant_id) election.* from app.event_side_pool_election_versions election where election.pool_id=p_pool_id order by election.participant_id,election.version desc) current where current.elected and current.amount_received_minor<>current.amount_due_minor) then return jsonb_build_object('status','rejected','code','unpaid_elections');end if;
 select coalesce(sum(current.amount_received_minor),0)::integer into v_collected from(select distinct on(election.participant_id) election.* from app.event_side_pool_election_versions election where election.pool_id=p_pool_id order by election.participant_id,election.version desc) current where current.elected;
 select coalesce(sum(current.amount_minor),0)::integer into v_paid from(select distinct on(payout.payout_id) payout.* from app.event_side_pool_payout_versions payout where payout.pool_id=p_pool_id order by payout.payout_id,payout.version desc) current where not current.voided;
 if v_collected<>v_paid then return jsonb_build_object('status','rejected','code','unreconciled','collectedMinor',v_collected,'paidMinor',v_paid,'remainingMinor',v_collected-v_paid);end if;
 v_response:=jsonb_build_object('status','side_pool_finalized','poolId',p_pool_id,'reconciliationId',p_reconciliation_id,'collectedMinor',v_collected,'paidMinor',v_paid,'remainingMinor',0);
 insert into app.operation_receipts(id,actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(v_receipt,p_actor_id,p_tournament_id,'finalize_event_side_pool_v1',p_reconciliation_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp());
 insert into app.event_side_pool_reconciliations(id,pool_id,tournament_id,event_id,collected_minor,paid_minor,remaining_minor,actor_profile_id,operation_receipt_id) values(p_reconciliation_id,p_pool_id,p_tournament_id,p_event_id,v_collected,v_paid,0,p_actor_id,v_receipt);
 insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'event_side_pool',p_pool_id,'side_pool_finalized',v_response);
 return v_response;
end $$;
revoke all on function public.finalize_event_side_pool_v1(uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.finalize_event_side_pool_v1(uuid,uuid,uuid,uuid,uuid,uuid) to service_role;

create or replace function public.get_event_side_pool_workspace_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select case when exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director','player','cross_checker','judge','viewer')) then jsonb_build_object(
 'tournamentName',tournament.name,'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',event_row.id,'name',event_row.name,'eventType',event_row.event_type,'pools',coalesce((select jsonb_agg(jsonb_build_object(
   'poolId',definition.pool_id,'version',definition.version,'categoryCode',definition.category_code,'displayName',definition.display_name,'entryFeeMinor',definition.entry_fee_minor,
   'policy',case when policy.id is null then null else jsonb_build_object('version',policy.version,'payoutRatioDenominator',policy.payout_ratio_denominator,'postedPayoutSchedule',policy.posted_payout_schedule,'postedBeforePlay',policy.posted_before_play) end,
   'elections',coalesce((select jsonb_agg(jsonb_build_object('electionId',election.election_id,'participantId',election.participant_id,'displayName',coalesce(roster.claimed_display_name,profile.display_name),'version',election.version,'elected',election.elected,'amountDueMinor',election.amount_due_minor,'amountReceivedMinor',election.amount_received_minor,'amountRemainingMinor',election.amount_due_minor-election.amount_received_minor,'paymentMethod',election.payment_method,'paymentReference',election.payment_reference) order by coalesce(roster.claimed_display_name,profile.display_name)) from(select distinct on(e.participant_id) e.* from app.event_side_pool_election_versions e where e.pool_id=definition.pool_id order by e.participant_id,e.version desc)election join app.event_participants participant on participant.id=election.participant_id left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id left join app.profiles profile on profile.id=participant.profile_id),'[]'::jsonb),
   'payouts',coalesce((select jsonb_agg(jsonb_build_object('payoutId',payout.payout_id,'participantId',payout.participant_id,'displayName',coalesce(roster.claimed_display_name,profile.display_name),'version',payout.version,'placement',payout.placement,'amountMinor',payout.amount_minor,'voided',payout.voided) order by payout.placement) from(select distinct on(p.payout_id)p.* from app.event_side_pool_payout_versions p where p.pool_id=definition.pool_id order by p.payout_id,p.version desc)payout join app.event_participants participant on participant.id=payout.participant_id left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id left join app.profiles profile on profile.id=participant.profile_id where not payout.voided),'[]'::jsonb),
   'collectedMinor',coalesce((select sum(e.amount_received_minor) from(select distinct on(x.participant_id)x.* from app.event_side_pool_election_versions x where x.pool_id=definition.pool_id order by x.participant_id,x.version desc)e where e.elected),0),
   'paidMinor',coalesce((select sum(p.amount_minor) from(select distinct on(x.payout_id)x.* from app.event_side_pool_payout_versions x where x.pool_id=definition.pool_id order by x.payout_id,x.version desc)p where not p.voided),0),
   'finalized',exists(select 1 from app.event_side_pool_reconciliations r where r.pool_id=definition.pool_id)
 ) order by definition.entry_fee_minor) from(select distinct on(d.pool_id)d.* from app.event_side_pool_definition_versions d where d.event_id=event_row.id order by d.pool_id,d.version desc)definition left join lateral(select * from app.event_side_pool_policy_versions p where p.pool_id=definition.pool_id order by p.version desc limit 1)policy on true where definition.active),'[]'::jsonb),
 'participants',coalesce((select jsonb_agg(jsonb_build_object('participantId',participant.id,'displayName',coalesce(roster.claimed_display_name,profile.display_name)) order by coalesce(roster.claimed_display_name,profile.display_name)) from app.event_participants participant left join app.tournament_roster_entries roster on roster.id=participant.roster_entry_id left join app.profiles profile on profile.id=participant.profile_id where participant.event_id=event_row.id),'[]'::jsonb)) order by event_row.event_type,event_row.name) from app.events event_row where event_row.tournament_id=tournament.id),'[]'::jsonb)
) else null end from app.tournaments tournament where tournament.id=p_tournament_id
$$;
revoke all on function public.get_event_side_pool_workspace_v1(uuid,uuid) from public,anon,authenticated;grant execute on function public.get_event_side_pool_workspace_v1(uuid,uuid) to service_role;

create or replace function public.get_event_side_pool_director_export_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when exists(
    select 1 from app.tournament_roles role_row
    where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id
      and role_row.role in('director','co_director')
  ) then public.get_event_side_pool_workspace_v1(p_actor_id,p_tournament_id) else null end
$$;
revoke all on function public.get_event_side_pool_director_export_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_event_side_pool_director_export_v1(uuid,uuid) to service_role;

notify pgrst,'reload schema';
