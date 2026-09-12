-- Tournament-scoped scorecard preference and signed-in results discovery.
-- Scorecard preference is explicit roster data; account linkage never implies it.

alter table app.registration_claims
  add column requested_scorecard_type text not null default 'digital'
  check (requested_scorecard_type in ('digital','paper'));

alter table app.tournament_roster_entries
  add column scorecard_type text not null default 'digital'
  check (scorecard_type in ('digital','paper')),
  add column scorecard_preference_version integer not null default 1
  check (scorecard_preference_version >= 1);

create table app.roster_scorecard_preference_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  roster_entry_id uuid not null references app.tournament_roster_entries(id) on delete restrict,
  version integer not null check (version >= 1),
  scorecard_type text not null check (scorecard_type in ('digital','paper')),
  source text not null check (source in ('registration_claim','director_manual','director_csv','director_update')),
  reason text check (reason is null or (length(reason) between 1 and 500 and octet_length(reason) <= 2000)),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null references app.operation_receipts(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (roster_entry_id, version)
);
create index roster_scorecard_preference_events_tournament_idx on app.roster_scorecard_preference_events(tournament_id, roster_entry_id, version desc);
alter table app.roster_scorecard_preference_events enable row level security;
alter table app.roster_scorecard_preference_events force row level security;
revoke all on table app.roster_scorecard_preference_events from public,anon,authenticated;
create trigger roster_scorecard_preference_events_immutable before update or delete on app.roster_scorecard_preference_events for each row execute function app.reject_immutable_history();

insert into app.roster_scorecard_preference_events(tournament_id,roster_entry_id,version,scorecard_type,source,actor_profile_id,operation_receipt_id,recorded_at)
select r.tournament_id,r.id,1,'digital',r.source_kind,r.creator_profile_id,r.operation_receipt_id,r.created_at
from app.tournament_roster_entries r;

create or replace function app.prepare_roster_scorecard_preference()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.source_kind='registration_claim' then
    select c.requested_scorecard_type into new.scorecard_type from app.registration_claims c where c.id=new.source_claim_id;
  end if;
  new.scorecard_preference_version:=1;
  return new;
end $$;
create trigger tournament_roster_entries_prepare_scorecard before insert on app.tournament_roster_entries for each row execute function app.prepare_roster_scorecard_preference();

create or replace function app.record_initial_roster_scorecard_preference()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into app.roster_scorecard_preference_events(tournament_id,roster_entry_id,version,scorecard_type,source,actor_profile_id,operation_receipt_id,recorded_at)
  values(new.tournament_id,new.id,1,new.scorecard_type,new.source_kind,new.creator_profile_id,new.operation_receipt_id,new.created_at);
  return new;
end $$;
create trigger tournament_roster_entries_record_scorecard after insert on app.tournament_roster_entries for each row execute function app.record_initial_roster_scorecard_preference();

create or replace function public.submit_registration_claim_v3(
  p_link_id uuid,p_digest bytea,p_display_name text,p_email text,p_acc_number text,
  p_intended_payment_method text,p_scorecard_type text,p_client_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_head app.tournament_registration_link_heads%rowtype; v_link app.tournament_registration_links%rowtype;
  v_name text; v_email text; v_acc text; v_status text; v_fingerprint text; v_existing text; v_tournament_id uuid;
begin
  if p_link_id is null or octet_length(p_digest)<>32 or p_display_name is null or length(trim(p_display_name)) not between 1 and 160
    or p_email is null or length(trim(p_email)) not between 3 and 320 or lower(trim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or coalesce(p_intended_payment_method,'') not in ('cash','check','other','unspecified')
    or coalesce(p_scorecard_type,'') not in ('digital','paper') or p_client_operation_id is null
  then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  v_name:=lower(regexp_replace(trim(p_display_name),'[[:space:]]+',' ','g')); v_email:=lower(trim(p_email));
  v_acc:=nullif(upper(regexp_replace(trim(coalesce(p_acc_number,'')),'[[:space:]]+','','g')),'');
  if v_acc is not null and length(v_acc)>64 then return jsonb_build_object('status','rejected','code','invalid_request'); end if;
  select l.tournament_id into v_tournament_id from app.tournament_registration_links l where l.id=p_link_id and app.fixed_32_byte_equal(l.token_digest,p_digest);
  if not found then return jsonb_build_object('status','unavailable'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registration-link-v2:'||v_tournament_id::text,0));
  perform 1 from app.tournaments where id=v_tournament_id for update;
  select * into v_head from app.tournament_registration_link_heads h where h.tournament_id=v_tournament_id and h.registration_link_id=p_link_id for update;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  select * into v_link from app.tournament_registration_links where id=p_link_id and tournament_id=v_tournament_id for update;
  if not found or v_head.state<>'open' or v_link.lifecycle_state<>'issued' or v_link.expires_at<=now() or not app.fixed_32_byte_equal(v_link.token_digest,p_digest)
    or not exists(select 1 from app.tournaments t where t.id=v_link.tournament_id and t.status in('draft','open') and t.registration_status='open')
  then return jsonb_build_object('status','unavailable'); end if;
  v_fingerprint:=encode(extensions.digest(convert_to(jsonb_build_array('registration_claim_v3',p_link_id::text,v_name,v_email,coalesce(v_acc,''),p_intended_payment_method,p_scorecard_type,p_client_operation_id::text)::text,'utf8'),'sha256'),'hex');
  select request_fingerprint into v_existing from app.registration_claims where tournament_id=v_link.tournament_id and client_operation_id=p_client_operation_id for update;
  if found then if v_existing<>v_fingerprint then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if; return jsonb_build_object('status','received'); end if;
  if (select count(*) from app.registration_claims c where c.registration_link_id=v_link.id)>=v_link.max_claims
    or (select count(*) from app.registration_claims c where c.registration_link_id=v_link.id and c.submitted_at>=now()-interval '1 hour')>=v_link.max_claims_per_hour
  then return jsonb_build_object('status','rejected','code','registration_capacity_reached'); end if;
  v_status:=case when exists(select 1 from app.registration_claims c where c.tournament_id=v_link.tournament_id and c.status not in('rejected','withdrawn') and (c.normalized_email=v_email or c.normalized_name=v_name or (v_acc is not null and c.normalized_acc_number=v_acc))) then 'needs_review' else 'pending_review' end;
  insert into app.registration_claims(tournament_id,registration_link_id,display_name,normalized_name,email,normalized_email,acc_number,normalized_acc_number,intended_payment_method,requested_scorecard_type,status,client_operation_id,request_fingerprint)
  values(v_link.tournament_id,v_link.id,trim(p_display_name),v_name,trim(p_email),v_email,nullif(trim(p_acc_number),''),v_acc,p_intended_payment_method,p_scorecard_type,v_status,p_client_operation_id,v_fingerprint);
  return jsonb_build_object('status','received');
end $$;

create or replace function public.create_manual_roster_entry_v2(p_actor_id uuid,p_tournament_id uuid,p_display_name text,p_email text,p_acc_number text,p_scorecard_type text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_name text;v_email text;v_acc text;v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_entry uuid:=extensions.gen_random_uuid();v_response jsonb;v_error text;v_code text;
begin begin
  if p_actor_id is null or p_tournament_id is null or p_idempotency_key is null or p_display_name is null or length(trim(p_display_name)) not between 1 and 160
    or length(trim(coalesce(p_email,'')))>320 or (nullif(trim(coalesce(p_email,'')),'') is not null and lower(trim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
    or length(trim(coalesce(p_acc_number,'')))>64 or coalesce(p_scorecard_type,'') not in('digital','paper') then raise exception using errcode='P0001',message='invalid manual roster entry'; end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then raise exception using errcode='P0001',message='director role required'; end if;
  v_name:=lower(regexp_replace(trim(p_display_name),'[[:space:]]+',' ','g'));v_email:=nullif(lower(trim(coalesce(p_email,''))),'');v_acc:=nullif(upper(regexp_replace(trim(coalesce(p_acc_number,'')),'[[:space:]]+','','g')),'');
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('create_manual_roster_entry_v2',p_tournament_id::text,v_name,coalesce(v_email,''),coalesce(v_acc,''),p_scorecard_type)::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;
  if found then if v_existing.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency conflict'; end if;return v_existing.response_payload;end if;
  perform 1 from app.tournaments t where t.id=p_tournament_id and t.status in('draft','open') and t.registration_status='open' for update;
  if not found then raise exception using errcode='P0001',message='registration closed';end if;
  if exists(select 1 from app.initial_seating_publications p where p.tournament_id=p_tournament_id) then raise exception using errcode='P0001',message='initial seating already published';end if;
  if exists(select 1 from app.tournament_roster_entries r where r.tournament_id=p_tournament_id and r.claimed_normalized_name=v_name and coalesce(r.claimed_normalized_email,'')=coalesce(v_email,'') and coalesce(r.claimed_normalized_acc_number,'')=coalesce(v_acc,'')) then raise exception using errcode='P0001',message='duplicate roster entry';end if;
  v_response:=jsonb_build_object('status','manual_roster_entry_created','rosterEntryId',v_entry,'source','director_manual','profileLinked',false,'roleGranted',false,'eventEnrolled',false,'paymentRecorded',false,'checkedIn',false,'seatAssigned',false);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'create_manual_roster_entry_v1',v_entry,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,claimed_email,claimed_normalized_email,claimed_acc_number,claimed_normalized_acc_number,scorecard_type,creator_profile_id,operation_receipt_id)
  values(v_entry,p_tournament_id,'director_manual',trim(p_display_name),v_name,nullif(trim(coalesce(p_email,'')),''),v_email,nullif(trim(coalesce(p_acc_number,'')),''),v_acc,p_scorecard_type,p_actor_id,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'tournament_roster_entry',v_entry,'manual_roster_entry_created',v_response||jsonb_build_object('scorecardType',p_scorecard_type));return v_response;
exception when sqlstate 'P0001' then get stacked diagnostics v_error=message_text;v_code:=case v_error when 'director role required' then 'not_director' when 'registration closed' then 'registration_closed' when 'duplicate roster entry' then 'duplicate_roster_entry' when 'initial seating already published' then 'initial_seating_already_published' when 'idempotency conflict' then 'idempotency_conflict' else 'invalid_manual_entry' end;return jsonb_build_object('status','rejected','code',v_code);end;end $$;

create or replace function public.import_roster_csv_v2(p_actor_id uuid,p_tournament_id uuid,p_rows jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_count integer;v_response jsonb;v_error text;v_code text;
begin begin
  if p_actor_id is null or p_tournament_id is null or p_idempotency_key is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500
    or exists(select 1 from jsonb_array_elements(p_rows) row_data where jsonb_typeof(row_data)<>'object' or row_data-'displayName'-'email'-'accNumber'-'scorecardType'<>'{}'::jsonb
      or jsonb_typeof(row_data->'displayName')<>'string' or jsonb_typeof(row_data->'email')<>'string' or jsonb_typeof(row_data->'accNumber')<>'string' or jsonb_typeof(row_data->'scorecardType')<>'string'
      or length(trim(row_data->>'displayName')) not between 1 and 160 or length(trim(row_data->>'email'))>320 or(length(trim(row_data->>'email'))>0 and lower(trim(row_data->>'email')) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') or length(trim(row_data->>'accNumber'))>64 or coalesce(row_data->>'scorecardType','') not in('digital','paper'))
  then raise exception using errcode='P0001',message='invalid roster batch';end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then raise exception using errcode='P0001',message='director role required';end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('import_roster_csv_v2',p_tournament_id::text,p_rows)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency conflict';end if;return v_existing.response_payload;end if;
  perform 1 from app.tournaments t where t.id=p_tournament_id and t.status in('draft','open') and t.registration_status='open' for update;if not found then raise exception using errcode='P0001',message='registration closed';end if;
  if exists(select 1 from app.initial_seating_publications p where p.tournament_id=p_tournament_id) then raise exception using errcode='P0001',message='initial seating already published';end if;
  if exists(with n as(select lower(regexp_replace(trim(x->>'displayName'),'[[:space:]]+',' ','g')) name_key,coalesce(nullif(lower(trim(x->>'email')),''),'') email_key,coalesce(nullif(upper(regexp_replace(trim(x->>'accNumber'),'[[:space:]]+','','g')),''),'') acc_key from jsonb_array_elements(p_rows)x)
    select 1 from n where acc_key<>'' group by acc_key having count(*)>1 union all select 1 from n where email_key<>'' group by email_key having count(*)>1 union all select 1 from n where acc_key='' and email_key='' group by name_key having count(*)>1)
  then raise exception using errcode='P0001',message='duplicate in roster batch';end if;
  if exists(with n as(select lower(regexp_replace(trim(x->>'displayName'),'[[:space:]]+',' ','g')) name_key,coalesce(nullif(lower(trim(x->>'email')),''),'') email_key,coalesce(nullif(upper(regexp_replace(trim(x->>'accNumber'),'[[:space:]]+','','g')),''),'') acc_key from jsonb_array_elements(p_rows)x) select 1 from n join app.tournament_roster_entries r on r.tournament_id=p_tournament_id and ((n.acc_key<>'' and coalesce(r.claimed_normalized_acc_number,'')=n.acc_key) or (n.email_key<>'' and coalesce(r.claimed_normalized_email,'')=n.email_key) or(n.acc_key='' and n.email_key='' and r.claimed_normalized_name=n.name_key))) then raise exception using errcode='P0001',message='duplicate roster entry';end if;
  v_count:=jsonb_array_length(p_rows);v_response:=jsonb_build_object('status','roster_csv_imported','importedCount',v_count);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'import_roster_csv_v1',p_tournament_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,claimed_email,claimed_normalized_email,claimed_acc_number,claimed_normalized_acc_number,scorecard_type,creator_profile_id,operation_receipt_id)
  select extensions.gen_random_uuid(),p_tournament_id,'director_csv',trim(x->>'displayName'),lower(regexp_replace(trim(x->>'displayName'),'[[:space:]]+',' ','g')),nullif(trim(x->>'email'),''),nullif(lower(trim(x->>'email')),''),nullif(trim(x->>'accNumber'),''),nullif(upper(regexp_replace(trim(x->>'accNumber'),'[[:space:]]+','','g')),''),x->>'scorecardType',p_actor_id,v_receipt from jsonb_array_elements(p_rows)x;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'tournament_roster_batch',p_tournament_id,'roster_csv_imported',v_response);return v_response;
exception when sqlstate 'P0001' then get stacked diagnostics v_error=message_text;v_code:=case v_error when 'director role required' then 'not_director' when 'registration closed' then 'registration_closed' when 'duplicate in roster batch' then 'duplicate_in_batch' when 'duplicate roster entry' then 'duplicate_roster_entry' when 'initial seating already published' then 'initial_seating_already_published' when 'idempotency conflict' then 'idempotency_conflict' else 'invalid_roster_batch' end;return jsonb_build_object('status','rejected','code',v_code);end;end $$;

create or replace function public.set_roster_scorecard_preference_v1(p_actor_id uuid,p_tournament_id uuid,p_roster_entry_id uuid,p_expected_version integer,p_scorecard_type text,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row app.tournament_roster_entries%rowtype;v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_response jsonb;v_error text;v_code text;
begin begin
  if p_actor_id is null or p_tournament_id is null or p_roster_entry_id is null or p_expected_version is null or p_expected_version<1 or p_scorecard_type not in('digital','paper') or p_idempotency_key is null or length(coalesce(p_reason,''))>500 then raise exception using errcode='P0001',message='invalid request';end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then raise exception using errcode='P0001',message='director role required';end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('set_roster_scorecard_preference_v1',p_tournament_id::text,p_roster_entry_id::text,p_expected_version,p_scorecard_type,coalesce(nullif(trim(p_reason),''),''))::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency conflict';end if;return v_existing.response_payload;end if;
  perform 1 from app.tournaments t where t.id=p_tournament_id and t.status in('draft','open') and t.registration_status='open' for update;if not found then raise exception using errcode='P0001',message='registration closed';end if;
  if exists(select 1 from app.initial_seating_publications p where p.tournament_id=p_tournament_id) then raise exception using errcode='P0001',message='initial seating already published';end if;
  select * into v_row from app.tournament_roster_entries r where r.id=p_roster_entry_id and r.tournament_id=p_tournament_id for update;if not found then raise exception using errcode='P0001',message='roster entry unavailable';end if;
  if v_row.scorecard_preference_version<>p_expected_version then raise exception using errcode='P0001',message='stale preference version';end if;
  v_response:=jsonb_build_object('status','scorecard_preference_updated','rosterEntryId',p_roster_entry_id,'scorecardType',p_scorecard_type,'version',p_expected_version+1);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'set_roster_scorecard_preference_v1',p_roster_entry_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;
  update app.tournament_roster_entries set scorecard_type=p_scorecard_type,scorecard_preference_version=p_expected_version+1 where id=p_roster_entry_id;
  insert into app.roster_scorecard_preference_events(tournament_id,roster_entry_id,version,scorecard_type,source,reason,actor_profile_id,operation_receipt_id) values(p_tournament_id,p_roster_entry_id,p_expected_version+1,p_scorecard_type,'director_update',nullif(trim(coalesce(p_reason,'')),''),p_actor_id,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,before_state,after_state) values(p_tournament_id,p_actor_id,v_receipt,'roster_scorecard_preference',p_roster_entry_id,'scorecard_preference_updated',jsonb_build_object('scorecardType',v_row.scorecard_type,'version',v_row.scorecard_preference_version),v_response);return v_response;
exception when sqlstate 'P0001' then get stacked diagnostics v_error=message_text;v_code:=case v_error when 'director role required' then 'not_director' when 'registration closed' then 'registration_closed' when 'initial seating already published' then 'initial_seating_already_published' when 'roster entry unavailable' then 'roster_entry_unavailable' when 'stale preference version' then 'stale_preference_version' when 'idempotency conflict' then 'idempotency_conflict' when 'invalid request' then 'invalid_request' else 'scorecard_preference_rejected' end;return jsonb_build_object('status','rejected','code',v_code,'rosterEntryId',p_roster_entry_id);end;end $$;

create or replace function public.get_tournament_result_events_v1(p_actor_id uuid,p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select case when exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('viewer','player','cross_checker','director','co_director')) then jsonb_build_object(
  'tournamentId',t.id,'tournamentName',t.name,'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',e.id,'name',e.name,'participantCount',(select count(*) from app.event_participants ep where ep.event_id=e.id)) order by sev.ordinal)
  from app.tournament_setup_activations a join app.events e on e.id=a.event_id and e.tournament_id=a.tournament_id join app.tournament_setup_event_versions sev on sev.id=a.setup_event_version_id and sev.tournament_id=a.tournament_id where a.tournament_id=t.id and e.format='standard_singles' and e.scoring_method='digital'),'[]'::jsonb)) else null end from app.tournaments t where t.id=p_tournament_id
$$;

create or replace function public.get_tournament_roster_workspace(p_tournament_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
select case when auth.uid() is not null and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=auth.uid() and r.role in('director','co_director')) then jsonb_build_object(
 'rosterEntries',coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId',e.id,'sourceClaimId',e.source_claim_id,'approvalDecisionId',e.approval_decision_id,'source',e.source_kind,'displayName',e.claimed_display_name,'email',e.claimed_email,'accNumber',e.claimed_acc_number,'scorecardType',e.scorecard_type,'scorecardPreferenceVersion',e.scorecard_preference_version,'createdAt',e.created_at) order by e.created_at) from app.tournament_roster_entries e where e.tournament_id=p_tournament_id),'[]'::jsonb),
 'promotionCandidates',coalesce((select jsonb_agg(jsonb_build_object('approvalDecisionId',d.id,'sourceClaimId',c.id,'displayName',c.display_name,'email',c.email,'accNumber',c.acc_number,'intendedPaymentMethod',c.intended_payment_method,'scorecardType',c.requested_scorecard_type,'submittedAt',c.submitted_at) order by c.submitted_at) from app.registration_claim_decisions d join app.registration_claims c on c.id=d.claim_id and c.tournament_id=d.tournament_id left join app.tournament_roster_entries e on e.approval_decision_id=d.id where d.tournament_id=p_tournament_id and d.decision='approved_for_roster' and e.id is null),'[]'::jsonb)) else null end
$$;

create or replace function public.get_registration_claim_review_workspace(p_tournament_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_result jsonb;
begin
 if v_actor is null or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=v_actor and role in('director','co_director')) then return null;end if;
 select jsonb_build_object('claims',coalesce(jsonb_agg(jsonb_build_object('claimId',c.id,'displayName',c.display_name,'email',c.email,'accNumber',c.acc_number,'intendedPaymentMethod',c.intended_payment_method,'scorecardType',c.requested_scorecard_type,'submittedAt',c.submitted_at,'decision',d.decision,'collisionClaimIds',coalesce(collisions.ids,'[]'::jsonb)) order by c.submitted_at),'[]'::jsonb)) into v_result
 from app.registration_claims c left join app.registration_claim_decisions d on d.claim_id=c.id left join lateral(select jsonb_agg(other.id)ids from app.registration_claims other left join app.registration_claim_decisions od on od.claim_id=other.id where other.tournament_id=c.tournament_id and other.id<>c.id and od.decision is distinct from 'rejected' and(other.normalized_email=c.normalized_email or other.normalized_name=c.normalized_name or(c.normalized_acc_number is not null and other.normalized_acc_number=c.normalized_acc_number)))collisions on true where c.tournament_id=p_tournament_id;
 return v_result;
end $$;

create or replace function public.get_initial_seating_workspace(p_tournament_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
select case when auth.uid() is not null and exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=auth.uid() and r.role in('director','co_director')) then jsonb_build_object(
 'registrationClosed',(select t.registration_status='closed' from app.tournaments t where t.id=p_tournament_id),
 'publication',(select jsonb_build_object('publicationId',p.id,'tableCount',p.table_count,'seatsPerTable',p.seats_per_table,'publishedAt',p.published_at,'assignments',coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId',a.roster_entry_id,'displayName',e.claimed_display_name,'scorecardType',e.scorecard_type,'initialTableSeat',a.initial_table_seat,'verificationId',a.verification_id) order by a.initial_table_seat) from app.initial_seating_assignments a join app.tournament_roster_entries e on e.id=a.roster_entry_id and e.tournament_id=a.tournament_id where a.publication_id=p.id),'[]'::jsonb)) from app.initial_seating_publications p where p.tournament_id=p_tournament_id),
 'checkIn',coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId',e.id,'displayName',e.claimed_display_name,'scorecardType',e.scorecard_type,'state',coalesce(c.check_in_state,'not_checked_in')) order by e.claimed_normalized_name,e.id) from app.tournament_roster_entries e left join lateral(select x.check_in_state from app.roster_check_in_events x where x.tournament_id=p_tournament_id and x.roster_entry_id=e.id order by x.version desc limit 1)c on true where e.tournament_id=p_tournament_id),'[]'::jsonb)) else null end
$$;

create or replace function public.get_event_roster_enrollment_workspace_v3(p_actor_id uuid,p_tournament_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
select case when exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id and role_row.profile_id=p_actor_id and role_row.role in('director','co_director')) then jsonb_build_object(
 'tournamentName',t.name,'registrationClosed',t.registration_status='closed','seatingPublished',exists(select 1 from app.initial_seating_publications p where p.tournament_id=t.id),
 'events',coalesce((select jsonb_agg(jsonb_build_object('eventId',e.id,'name',e.name,'eventType',e.event_type,'format',e.format,'scoringMethod',e.scoring_method,'participantCount',(select count(*) from app.event_participants ep where ep.event_id=e.id)) order by sev.ordinal) from app.tournament_setup_activations a join app.events e on e.id=a.event_id and e.tournament_id=a.tournament_id join app.tournament_setup_event_versions sev on sev.id=a.setup_event_version_id and sev.tournament_id=a.tournament_id where a.tournament_id=t.id),'[]'::jsonb),
 'roster',coalesce((select jsonb_agg(jsonb_build_object('rosterEntryId',r.id,'displayName',r.claimed_display_name,'checkInState',coalesce(ci.check_in_state,'not_checked_in'),'profileLinked',l.profile_id is not null,'scorecardType',r.scorecard_type,'verificationId',seat.verification_id,'enrolledEventIds',coalesce((select jsonb_agg(ep.event_id order by ep.event_id) from app.event_participants ep where ep.tournament_id=r.tournament_id and (ep.roster_entry_id=r.id or(ep.roster_entry_id is null and ep.profile_id=l.profile_id))),'[]'::jsonb)) order by r.claimed_normalized_name,r.id) from app.tournament_roster_entries r left join app.roster_account_links l on l.tournament_id=r.tournament_id and l.roster_entry_id=r.id left join lateral(select c.check_in_state from app.roster_check_in_events c where c.tournament_id=r.tournament_id and c.roster_entry_id=r.id order by c.version desc limit 1)ci on true left join app.initial_seating_assignments seat on seat.tournament_id=r.tournament_id and seat.roster_entry_id=r.id where r.tournament_id=t.id),'[]'::jsonb)) else null end from app.tournaments t where t.id=p_tournament_id
$$;

revoke all on function public.submit_registration_claim_v3(uuid,bytea,text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.create_manual_roster_entry_v2(uuid,uuid,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.import_roster_csv_v2(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.set_roster_scorecard_preference_v1(uuid,uuid,uuid,integer,text,text,uuid) from public,anon,authenticated;
revoke all on function public.get_tournament_result_events_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.submit_registration_claim_v3(uuid,bytea,text,text,text,text,text,uuid) to service_role;
grant execute on function public.create_manual_roster_entry_v2(uuid,uuid,text,text,text,text,uuid) to service_role;
grant execute on function public.import_roster_csv_v2(uuid,uuid,jsonb,uuid) to service_role;
grant execute on function public.set_roster_scorecard_preference_v1(uuid,uuid,uuid,integer,text,text,uuid) to service_role;
grant execute on function public.get_tournament_result_events_v1(uuid,uuid) to service_role;
notify pgrst,'reload schema';
