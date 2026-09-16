-- ACC Sanctioning Fee is a rate calculation, never a director-entered total.
-- Legacy totals remain immutable historical evidence and are not reinterpreted.

alter table app.tournament_setup_revisions
  add column main_sanctioning_fee_rate_cents integer not null default 300,
  add column consolation_sanctioning_fee_rate_cents integer not null default 100,
  add column main_sanctioning_fee_override_reason text not null default '',
  add column main_sanctioning_fee_override_reference text not null default '',
  add column consolation_sanctioning_fee_override_reason text not null default '',
  add column consolation_sanctioning_fee_override_reference text not null default '',
  add constraint tournament_setup_main_sanctioning_rate_range check(main_sanctioning_fee_rate_cents between 0 and 100000),
  add constraint tournament_setup_consolation_sanctioning_rate_range check(consolation_sanctioning_fee_rate_cents between 0 and 100000),
  add constraint tournament_setup_main_sanctioning_override_length check(length(main_sanctioning_fee_override_reason)<=1000 and length(main_sanctioning_fee_override_reference)<=1000),
  add constraint tournament_setup_consolation_sanctioning_override_length check(length(consolation_sanctioning_fee_override_reason)<=1000 and length(consolation_sanctioning_fee_override_reference)<=1000),
  add constraint tournament_setup_main_nondefault_sanctioning_source check(main_sanctioning_fee_rate_cents=300 or (length(trim(main_sanctioning_fee_override_reason))>0 and length(trim(main_sanctioning_fee_override_reference))>0)),
  add constraint tournament_setup_consolation_nondefault_sanctioning_source check(consolation_sanctioning_fee_rate_cents=100 or (length(trim(consolation_sanctioning_fee_override_reason))>0 and length(trim(consolation_sanctioning_fee_override_reference))>0));

create table app.tournament_sanctioning_fee_rate_overrides(
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  version integer not null check(version>0),
  event_kind text not null check(event_kind in('main','consolation')),
  prior_rate_cents integer not null check(prior_rate_cents between 0 and 100000),
  rate_cents integer not null check(rate_cents between 0 and 100000),
  reason text not null check(length(trim(reason)) between 1 and 1000),
  acc_reference text not null check(length(trim(acc_reference)) between 1 and 1000),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null unique,
  created_at timestamptz not null default clock_timestamp(),
  unique(tournament_id,version),
  unique(id,tournament_id),
  foreign key(operation_receipt_id,tournament_id) references app.operation_receipts(id,tournament_id) on delete restrict
);
alter table app.tournament_sanctioning_fee_rate_overrides enable row level security;
alter table app.tournament_sanctioning_fee_rate_overrides force row level security;
revoke all on table app.tournament_sanctioning_fee_rate_overrides from public,anon,authenticated;
create trigger tournament_sanctioning_fee_rate_overrides_immutable before update or delete on app.tournament_sanctioning_fee_rate_overrides for each row execute function app.reject_immutable_history();
create index tournament_sanctioning_fee_rate_overrides_lookup_idx on app.tournament_sanctioning_fee_rate_overrides(tournament_id,event_kind,version desc);

create table app.event_sanctioning_fee_snapshots(
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  event_id uuid not null,
  event_play_start_id uuid not null unique,
  event_kind text not null check(event_kind in('main','consolation')),
  rate_cents integer not null check(rate_cents between 0 and 100000),
  eligible_participant_count integer not null check(eligible_participant_count between 0 and 10000),
  total_cents integer not null check(total_cents between 0 and 1000000000),
  rate_source text not null check(rate_source in('setup','override')),
  rate_override_id uuid,
  setup_revision_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  unique(event_id),
  unique(id,tournament_id,event_id),
  foreign key(event_id,tournament_id) references app.events(id,tournament_id) on delete restrict,
  foreign key(event_play_start_id,tournament_id,event_id) references app.event_play_starts(id,tournament_id,event_id) on delete restrict,
  foreign key(rate_override_id,tournament_id) references app.tournament_sanctioning_fee_rate_overrides(id,tournament_id) on delete restrict,
  foreign key(setup_revision_id,tournament_id) references app.tournament_setup_revisions(id,tournament_id) on delete restrict,
  check((rate_source='override' and rate_override_id is not null) or (rate_source='setup' and setup_revision_id is not null))
);
alter table app.event_sanctioning_fee_snapshots enable row level security;
alter table app.event_sanctioning_fee_snapshots force row level security;
revoke all on table app.event_sanctioning_fee_snapshots from public,anon,authenticated;
create trigger event_sanctioning_fee_snapshots_immutable before update or delete on app.event_sanctioning_fee_snapshots for each row execute function app.reject_immutable_history();
create index event_sanctioning_fee_snapshots_tournament_idx on app.event_sanctioning_fee_snapshots(tournament_id,event_kind,created_at);

create or replace function app.current_sanctioning_fee_rate_v1(p_tournament_id uuid,p_event_kind text)
returns table(rate_cents integer,rate_source text,rate_override_id uuid,setup_revision_id uuid,reason text,acc_reference text)
language sql stable security definer set search_path='' as $$
  with latest_setup as (
    select id,main_sanctioning_fee_rate_cents,consolation_sanctioning_fee_rate_cents,
      main_sanctioning_fee_override_reason,main_sanctioning_fee_override_reference,
      consolation_sanctioning_fee_override_reason,consolation_sanctioning_fee_override_reference
    from app.tournament_setup_revisions where tournament_id=p_tournament_id order by version desc limit 1
  ), latest_override as (
    select id,rate_cents,reason,acc_reference from app.tournament_sanctioning_fee_rate_overrides
    where tournament_id=p_tournament_id and event_kind=p_event_kind order by version desc limit 1
  )
  select coalesce(o.rate_cents,case when p_event_kind='main' then s.main_sanctioning_fee_rate_cents else s.consolation_sanctioning_fee_rate_cents end,case when p_event_kind='main' then 300 else 100 end),
    case when o.id is null then 'setup' else 'override' end,o.id,s.id,
    coalesce(o.reason,case when p_event_kind='main' then s.main_sanctioning_fee_override_reason else s.consolation_sanctioning_fee_override_reason end,''),
    coalesce(o.acc_reference,case when p_event_kind='main' then s.main_sanctioning_fee_override_reference else s.consolation_sanctioning_fee_override_reference end,'')
  from (select 1) seed left join latest_setup s on true left join latest_override o on true
$$;
revoke all on function app.current_sanctioning_fee_rate_v1(uuid,text) from public,anon,authenticated;

-- The contact-safe writer is retained as a private implementation. This
-- adapter accepts only rate data, stores no new tournament-wide total, and
-- writes the rate values into the immutable setup revision created below it.
alter function public.save_tournament_setup_version(uuid,integer,jsonb,uuid) rename to save_tournament_setup_version_structured_contact;
create function public.save_tournament_setup_version(p_tournament_id uuid,p_expected_version integer,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_main_rate integer;v_consolation_rate integer;v_main_reason text;v_main_reference text;v_consolation_reason text;v_consolation_reference text;
  v_legacy_payload jsonb;v_result jsonb;v_revision_id uuid;v_receipt_id uuid;
begin
  if coalesce(jsonb_typeof(p_payload),'')<>'object'
    or not(p_payload ?& array['tournamentName','city','venue','startsAt','endsAt','timezone','tournamentContactPhone','tournamentContactEmail','tournamentMailingAddress','mainSanctioningFeeRateCents','consolationSanctioningFeeRateCents','mainSanctioningFeeOverrideReason','mainSanctioningFeeOverrideReference','consolationSanctioningFeeOverrideReason','consolationSanctioningFeeOverrideReference','officials','events'])
    or exists(select 1 from jsonb_object_keys(p_payload) key where key<>all(array['tournamentName','city','venue','startsAt','endsAt','timezone','tournamentContactPhone','tournamentContactEmail','tournamentMailingAddress','mainSanctioningFeeRateCents','consolationSanctioningFeeRateCents','mainSanctioningFeeOverrideReason','mainSanctioningFeeOverrideReference','consolationSanctioningFeeOverrideReason','consolationSanctioningFeeOverrideReference','officials','events']))
    or jsonb_typeof(p_payload->'mainSanctioningFeeRateCents')<>'number' or jsonb_typeof(p_payload->'consolationSanctioningFeeRateCents')<>'number'
    or jsonb_typeof(p_payload->'mainSanctioningFeeOverrideReason')<>'string' or jsonb_typeof(p_payload->'mainSanctioningFeeOverrideReference')<>'string'
    or jsonb_typeof(p_payload->'consolationSanctioningFeeOverrideReason')<>'string' or jsonb_typeof(p_payload->'consolationSanctioningFeeOverrideReference')<>'string' then
    return jsonb_build_object('status','rejected','code','invalid_setup_payload');
  end if;
  if (p_payload->>'mainSanctioningFeeRateCents') !~ '^(0|[1-9][0-9]*)$' or (p_payload->>'consolationSanctioningFeeRateCents') !~ '^(0|[1-9][0-9]*)$' then return jsonb_build_object('status','rejected','code','invalid_setup_payload');end if;
  v_main_rate:=(p_payload->>'mainSanctioningFeeRateCents')::integer;v_consolation_rate:=(p_payload->>'consolationSanctioningFeeRateCents')::integer;
  v_main_reason:=trim(p_payload->>'mainSanctioningFeeOverrideReason');v_main_reference:=trim(p_payload->>'mainSanctioningFeeOverrideReference');
  v_consolation_reason:=trim(p_payload->>'consolationSanctioningFeeOverrideReason');v_consolation_reference:=trim(p_payload->>'consolationSanctioningFeeOverrideReference');
  if v_main_rate not between 0 and 100000 or v_consolation_rate not between 0 and 100000 or length(v_main_reason)>1000 or length(v_main_reference)>1000 or length(v_consolation_reason)>1000 or length(v_consolation_reference)>1000 or (v_main_rate<>300 and (v_main_reason='' or v_main_reference='')) or (v_consolation_rate<>100 and (v_consolation_reason='' or v_consolation_reference='')) then return jsonb_build_object('status','rejected','code','invalid_setup_payload');end if;
  perform set_config('app.setup_main_sanctioning_fee_rate_cents',v_main_rate::text,true);perform set_config('app.setup_consolation_sanctioning_fee_rate_cents',v_consolation_rate::text,true);
  perform set_config('app.setup_main_sanctioning_fee_override_reason',v_main_reason,true);perform set_config('app.setup_main_sanctioning_fee_override_reference',v_main_reference,true);
  perform set_config('app.setup_consolation_sanctioning_fee_override_reason',v_consolation_reason,true);perform set_config('app.setup_consolation_sanctioning_fee_override_reference',v_consolation_reference,true);
  v_legacy_payload:=(p_payload-array['mainSanctioningFeeRateCents','consolationSanctioningFeeRateCents','mainSanctioningFeeOverrideReason','mainSanctioningFeeOverrideReference','consolationSanctioningFeeOverrideReason','consolationSanctioningFeeOverrideReference'])||jsonb_build_object('sanctioningFeeCents',null);
  v_result:=public.save_tournament_setup_version_structured_contact(p_tournament_id,p_expected_version,v_legacy_payload,p_idempotency_key);
  if v_result->>'status'<>'setup_draft_saved' then return v_result;end if;
  v_revision_id:=(v_result->>'revisionId')::uuid;select operation_receipt_id into v_receipt_id from app.tournament_setup_revisions where id=v_revision_id;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,auth.uid(),v_receipt_id,'tournament_setup_sanctioning_fee',v_revision_id,'tournament_setup_sanctioning_fee_rates_saved',jsonb_build_object('mainRateCents',v_main_rate,'consolationRateCents',v_consolation_rate,'mainReason',v_main_reason,'mainReference',v_main_reference,'consolationReason',v_consolation_reason,'consolationReference',v_consolation_reference));
  return v_result;
end $$;
revoke all on function public.save_tournament_setup_version_structured_contact(uuid,integer,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.save_tournament_setup_version(uuid,integer,jsonb,uuid) from public,anon;
grant execute on function public.save_tournament_setup_version(uuid,integer,jsonb,uuid) to authenticated;

create or replace function app.inherit_sanctioning_fee_rates()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.main_sanctioning_fee_rate_cents:=coalesce(nullif(current_setting('app.setup_main_sanctioning_fee_rate_cents',true), '')::integer,new.main_sanctioning_fee_rate_cents,300);
  new.consolation_sanctioning_fee_rate_cents:=coalesce(nullif(current_setting('app.setup_consolation_sanctioning_fee_rate_cents',true), '')::integer,new.consolation_sanctioning_fee_rate_cents,100);
  new.main_sanctioning_fee_override_reason:=coalesce(current_setting('app.setup_main_sanctioning_fee_override_reason',true),new.main_sanctioning_fee_override_reason,'');
  new.main_sanctioning_fee_override_reference:=coalesce(current_setting('app.setup_main_sanctioning_fee_override_reference',true),new.main_sanctioning_fee_override_reference,'');
  new.consolation_sanctioning_fee_override_reason:=coalesce(current_setting('app.setup_consolation_sanctioning_fee_override_reason',true),new.consolation_sanctioning_fee_override_reason,'');
  new.consolation_sanctioning_fee_override_reference:=coalesce(current_setting('app.setup_consolation_sanctioning_fee_override_reference',true),new.consolation_sanctioning_fee_override_reference,'');
  return new;
end $$;
revoke all on function app.inherit_sanctioning_fee_rates() from public,anon,authenticated;
create trigger tournament_setup_revision_sanctioning_fee_rate_inheritance before insert on app.tournament_setup_revisions for each row execute function app.inherit_sanctioning_fee_rates();

create function public.override_tournament_sanctioning_fee_rate_v1(p_actor_id uuid,p_tournament_id uuid,p_event_kind text,p_rate_cents integer,p_reason text,p_acc_reference text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_prior app.operation_receipts%rowtype;v_hash text;v_current record;v_receipt_id uuid;v_override_id uuid:=extensions.gen_random_uuid();v_version integer;v_response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_tournament_id is null or p_event_kind not in('main','consolation') or p_rate_cents not between 0 and 100000 or length(trim(coalesce(p_reason,''))) not between 1 and 1000 or length(trim(coalesce(p_acc_reference,''))) not between 1 and 1000 or p_idempotency_key is null then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('override_tournament_sanctioning_fee_rate_v1',p_actor_id::text,p_tournament_id::text,p_event_kind,p_rate_cents,trim(p_reason),trim(p_acc_reference),p_idempotency_key::text)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));perform 1 from app.tournaments where id=p_tournament_id and status in('draft','open') for update;if not found then return jsonb_build_object('status','rejected','code','tournament_unavailable');end if;
  if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  select * into v_prior from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_prior.request_hash<>v_hash then return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;return v_prior.response_payload;end if;
  if exists(select 1 from app.events e join app.event_play_starts s on s.event_id=e.id where e.tournament_id=p_tournament_id and e.event_type=p_event_kind) then return jsonb_build_object('status','rejected','code','rate_locked_after_start');end if;
  select * into v_current from app.current_sanctioning_fee_rate_v1(p_tournament_id,p_event_kind);if p_rate_cents=v_current.rate_cents then return jsonb_build_object('status','rejected','code','rate_unchanged');end if;
  select coalesce(max(version),0)+1 into v_version from app.tournament_sanctioning_fee_rate_overrides where tournament_id=p_tournament_id;
  v_response:=jsonb_build_object('status','sanctioning_fee_rate_overridden','eventKind',p_event_kind,'rateCents',p_rate_cents,'version',v_version);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'override_tournament_sanctioning_fee_rate_v1',v_override_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp()) returning id into v_receipt_id;
  insert into app.tournament_sanctioning_fee_rate_overrides(id,tournament_id,version,event_kind,prior_rate_cents,rate_cents,reason,acc_reference,actor_profile_id,operation_receipt_id) values(v_override_id,p_tournament_id,v_version,p_event_kind,v_current.rate_cents,p_rate_cents,trim(p_reason),trim(p_acc_reference),p_actor_id,v_receipt_id);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state) values(p_tournament_id,p_actor_id,v_receipt_id,'tournament_sanctioning_fee_rate',v_override_id,'tournament_sanctioning_fee_rate_overridden',jsonb_build_object('rateCents',v_current.rate_cents),v_response||jsonb_build_object('reason',trim(p_reason),'accReference',trim(p_acc_reference)));
  return v_response;
end $$;
revoke all on function public.override_tournament_sanctioning_fee_rate_v1(uuid,uuid,text,integer,text,text,uuid) from public,anon,authenticated;
grant execute on function public.override_tournament_sanctioning_fee_rate_v1(uuid,uuid,text,integer,text,text,uuid) to service_role;

alter function public.get_tournament_setup_workspace(uuid) rename to get_tournament_setup_workspace_structured_contact;
create function public.get_tournament_setup_workspace(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb;v_main record;v_consolation record;v_counts record;v_current jsonb;
begin
  v_base:=public.get_tournament_setup_workspace_structured_contact(p_tournament_id);if v_base is null then return null;end if;
  select * into v_main from app.current_sanctioning_fee_rate_v1(p_tournament_id,'main');select * into v_consolation from app.current_sanctioning_fee_rate_v1(p_tournament_id,'consolation');
  select count(*) filter(where e.event_type='main' and p.status in('registered','checked_in'))::integer main_count,count(*) filter(where e.event_type='consolation' and p.status in('registered','checked_in'))::integer consolation_count into v_counts from app.event_participants p join app.events e on e.id=p.event_id where p.tournament_id=p_tournament_id;
  v_current:=v_base->'current';if v_current<>'null'::jsonb then v_current:=(v_current-'sanctioningFeeCents')||jsonb_build_object('mainSanctioningFeeRateCents',v_main.rate_cents,'consolationSanctioningFeeRateCents',v_consolation.rate_cents,'mainSanctioningFeeOverrideReason',v_main.reason,'mainSanctioningFeeOverrideReference',v_main.acc_reference,'consolationSanctioningFeeOverrideReason',v_consolation.reason,'consolationSanctioningFeeOverrideReference',v_consolation.acc_reference);v_base:=jsonb_set(v_base,'{current}',v_current,false);end if;
  return v_base||jsonb_build_object('sanctioningFee',jsonb_build_object('mainRateCents',v_main.rate_cents,'consolationRateCents',v_consolation.rate_cents,'mainEligibleParticipantCount',coalesce(v_counts.main_count,0),'consolationEligibleParticipantCount',coalesce(v_counts.consolation_count,0),'runningTotalCents',coalesce(v_counts.main_count,0)*v_main.rate_cents+coalesce(v_counts.consolation_count,0)*v_consolation.rate_cents,'mainRateSource',v_main.rate_source,'consolationRateSource',v_consolation.rate_source));
end $$;
revoke all on function public.get_tournament_setup_workspace_structured_contact(uuid) from public,anon,authenticated;
revoke all on function public.get_tournament_setup_workspace(uuid) from public,anon;
grant execute on function public.get_tournament_setup_workspace(uuid) to authenticated;

alter function public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) rename to start_event_play_v1_before_sanctioning_snapshot;
create function public.start_event_play_v1(p_actor_id uuid,p_tournament_id uuid,p_event_id uuid,p_schedule_publication_id uuid,p_participant_snapshot_digest text,p_expected_participant_count integer,p_expected_game_count integer,p_confirmed boolean,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_kind text;v_start app.event_play_starts%rowtype;v_rate record;v_count integer;v_setup_revision uuid;
begin
  v_result:=public.start_event_play_v1_before_sanctioning_snapshot(p_actor_id,p_tournament_id,p_event_id,p_schedule_publication_id,p_participant_snapshot_digest,p_expected_participant_count,p_expected_game_count,p_confirmed,p_idempotency_key);
  if v_result->>'status'<>'event_started' then return v_result;end if;
  select event_type into v_kind from app.events where id=p_event_id and tournament_id=p_tournament_id;if v_kind not in('main','consolation') then return v_result;end if;
  select * into v_start from app.event_play_starts where id=(v_result->>'startId')::uuid and tournament_id=p_tournament_id and event_id=p_event_id;if not found then raise exception using errcode='P0001',message='sanctioning snapshot start unavailable';end if;
  select * into v_rate from app.current_sanctioning_fee_rate_v1(p_tournament_id,v_kind);select count(*) into v_count from app.event_participants where tournament_id=p_tournament_id and event_id=p_event_id and status='checked_in';select id into v_setup_revision from app.tournament_setup_revisions where tournament_id=p_tournament_id order by version desc limit 1;
  insert into app.event_sanctioning_fee_snapshots(tournament_id,event_id,event_play_start_id,event_kind,rate_cents,eligible_participant_count,total_cents,rate_source,rate_override_id,setup_revision_id) values(p_tournament_id,p_event_id,v_start.id,v_kind,v_rate.rate_cents,v_count,v_rate.rate_cents*v_count,v_rate.rate_source,v_rate.rate_override_id,case when v_rate.rate_source='setup' then v_setup_revision else null end) on conflict(event_id) do nothing;
  return v_result;
end $$;
revoke all on function public.start_event_play_v1_before_sanctioning_snapshot(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) from public,anon,authenticated;
revoke all on function public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) from public,anon,authenticated;
grant execute on function public.start_event_play_v1(uuid,uuid,uuid,uuid,text,integer,integer,boolean,uuid) to service_role;

notify pgrst,'reload schema';
