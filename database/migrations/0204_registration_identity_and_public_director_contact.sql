-- New roster intake stores unambiguous name parts. Existing display-name-only
-- records remain historical evidence and are intentionally not backfilled.
alter table app.tournament_roster_entries
  add column claimed_first_name text,
  add column claimed_last_name text,
  add constraint tournament_roster_entries_name_parts_pair check (
    (claimed_first_name is null and claimed_last_name is null) or (
      length(trim(claimed_first_name)) between 1 and 80
      and length(trim(claimed_last_name)) between 1 and 80
      and claimed_display_name = trim(claimed_first_name) || ' ' || trim(claimed_last_name)
    )
  );

create function app.capture_roster_entry_name_parts_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_first text;v_last text;
begin
  if new.claimed_first_name is not null or new.claimed_last_name is not null then return new;end if;
  if new.source_kind='registration_claim' and new.source_claim_id is not null then
    select first_name,last_name into v_first,v_last from app.registration_claims where id=new.source_claim_id and tournament_id=new.tournament_id;
    if v_first is not null and v_last is not null then
      if new.claimed_display_name<>trim(v_first)||' '||trim(v_last) then raise exception using errcode='P0001',message='registration roster name mismatch';end if;
      new.claimed_first_name:=trim(v_first);new.claimed_last_name:=trim(v_last);
    end if;
  end if;
  return new;
end $$;
revoke all on function app.capture_roster_entry_name_parts_v1() from public,anon,authenticated;
create trigger tournament_roster_entries_capture_name_parts before insert on app.tournament_roster_entries
for each row execute function app.capture_roster_entry_name_parts_v1();

-- A tournament-specific public contact is separate from a private account
-- profile. Setup writes a version from its saved public fields; a primary
-- director may later correct only the public contact without reopening events.
create table app.tournament_public_contact_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  version integer not null check (version > 0),
  source_kind text not null check (source_kind in ('setup','correction')),
  setup_revision_id uuid references app.tournament_setup_revisions(id) on delete restrict,
  director_name text not null check (length(trim(director_name)) between 1 and 160),
  tournament_contact_phone text not null check (length(trim(tournament_contact_phone)) between 7 and 40),
  tournament_contact_email text not null check (length(trim(tournament_contact_email)) between 3 and 320),
  tournament_mailing_address text not null default '' check (length(tournament_mailing_address) <= 500),
  actor_profile_id uuid not null references app.profiles(id) on delete restrict,
  operation_receipt_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (tournament_id, version),
  unique (setup_revision_id),
  foreign key (operation_receipt_id, tournament_id)
    references app.operation_receipts(id, tournament_id) on delete restrict
);
alter table app.tournament_public_contact_versions enable row level security;
alter table app.tournament_public_contact_versions force row level security;
revoke all on table app.tournament_public_contact_versions from public, anon, authenticated;
create trigger tournament_public_contact_versions_immutable before update or delete on app.tournament_public_contact_versions
for each row execute function app.reject_immutable_history();
create index tournament_public_contact_versions_lookup_idx on app.tournament_public_contact_versions(tournament_id, version desc);

create or replace function app.valid_public_director_name_v1(p_name text)
returns boolean language sql immutable set search_path='' as $$
  select length(trim(coalesce(p_name,''))) between 1 and 160
    and lower(trim(p_name)) not in ('tournament participant','tournament director','primary director')
$$;
revoke all on function app.valid_public_director_name_v1(text) from public, anon, authenticated;

create function public.configure_tournament_public_contact_from_setup_v1(
  p_actor_id uuid,p_tournament_id uuid,p_setup_revision_id uuid,p_director_name text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_setup app.tournament_setup_revisions%rowtype;v_receipt uuid;v_version integer;v_response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_tournament_id is null or p_setup_revision_id is null
    or not app.valid_public_director_name_v1(p_director_name) then return jsonb_build_object('status','rejected','code','invalid_public_contact');end if;
  if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  select * into v_setup from app.tournament_setup_revisions where id=p_setup_revision_id and tournament_id=p_tournament_id;
  if not found or v_setup.tournament_contact_phone is null or v_setup.tournament_contact_email is null then return jsonb_build_object('status','rejected','code','setup_unavailable');end if;
  select operation_receipt_id into v_receipt from app.tournament_setup_revisions where id=p_setup_revision_id;
  if exists(select 1 from app.tournament_public_contact_versions where setup_revision_id=p_setup_revision_id) then return jsonb_build_object('status','public_contact_configured','setupRevisionId',p_setup_revision_id);end if;
  select coalesce(max(version),0)+1 into v_version from app.tournament_public_contact_versions where tournament_id=p_tournament_id;
  v_response:=jsonb_build_object('status','public_contact_configured','setupRevisionId',p_setup_revision_id,'version',v_version);
  insert into app.tournament_public_contact_versions(tournament_id,version,source_kind,setup_revision_id,director_name,tournament_contact_phone,tournament_contact_email,tournament_mailing_address,actor_profile_id,operation_receipt_id)
  values(p_tournament_id,v_version,'setup',p_setup_revision_id,trim(p_director_name),v_setup.tournament_contact_phone,v_setup.tournament_contact_email,coalesce(v_setup.tournament_mailing_address,''),p_actor_id,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(p_tournament_id,p_actor_id,v_receipt,'tournament_public_contact',p_setup_revision_id,'tournament_public_contact_saved',jsonb_build_object('directorName',trim(p_director_name)));
  return v_response;
end $$;
revoke all on function public.configure_tournament_public_contact_from_setup_v1(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.configure_tournament_public_contact_from_setup_v1(uuid,uuid,uuid,text) to service_role;

create function public.correct_tournament_public_contact_v1(p_tournament_id uuid,p_director_name text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_tournament app.tournaments%rowtype;v_contact app.tournament_public_contact_versions%rowtype;v_setup app.tournament_setup_revisions%rowtype;v_hash text;v_prior app.operation_receipts%rowtype;v_receipt uuid;v_version integer;v_response jsonb;
begin
  if v_actor is null or p_tournament_id is null or p_idempotency_key is null or not app.valid_public_director_name_v1(p_director_name) then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  select * into v_tournament from app.tournaments where id=p_tournament_id for update;
  if not found or v_tournament.director_profile_id<>v_actor then return jsonb_build_object('status','rejected','code','not_primary_director');end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('correct_tournament_public_contact_v1',p_tournament_id::text,trim(p_director_name))::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_idempotency_key::text,0));
  select * into v_prior from app.operation_receipts where actor_profile_id=v_actor and client_operation_id=p_idempotency_key;
  if found then if v_prior.request_hash=v_hash then return v_prior.response_payload;end if;return jsonb_build_object('status','rejected','code','idempotency_conflict');end if;
  select * into v_contact from app.tournament_public_contact_versions where tournament_id=p_tournament_id order by version desc limit 1;
  if not found then select * into v_setup from app.tournament_setup_revisions where tournament_id=p_tournament_id order by version desc limit 1; if not found or v_setup.tournament_contact_phone is null or v_setup.tournament_contact_email is null then return jsonb_build_object('status','rejected','code','public_contact_unavailable');end if; end if;
  select coalesce(max(version),0)+1 into v_version from app.tournament_public_contact_versions where tournament_id=p_tournament_id;
  v_response:=jsonb_build_object('status','public_contact_corrected','directorName',trim(p_director_name),'version',v_version);
  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament_id,v_actor,'correct_tournament_public_contact_v1',p_tournament_id,v_hash,p_idempotency_key,'accepted',v_response,clock_timestamp()) returning id into v_receipt;
  insert into app.tournament_public_contact_versions(tournament_id,version,source_kind,director_name,tournament_contact_phone,tournament_contact_email,tournament_mailing_address,actor_profile_id,operation_receipt_id)
  values(p_tournament_id,v_version,'correction',trim(p_director_name),coalesce(v_contact.tournament_contact_phone,v_setup.tournament_contact_phone),coalesce(v_contact.tournament_contact_email,v_setup.tournament_contact_email),coalesce(v_contact.tournament_mailing_address,v_setup.tournament_mailing_address,''),v_actor,v_receipt);
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(p_tournament_id,v_actor,v_receipt,'tournament_public_contact',p_tournament_id,'tournament_public_contact_corrected',v_response);
  return v_response;
end $$;
revoke all on function public.correct_tournament_public_contact_v1(uuid,text,uuid) from public,anon;
grant execute on function public.correct_tournament_public_contact_v1(uuid,text,uuid) to authenticated;

-- The public reader never exposes account profile data. Legacy events retain a
-- neutral label until the primary director saves a selected public name.
create or replace function public.get_public_registration_payment_options_v1(p_link_id uuid,p_digest bytea)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('tournamentName',tournament.name,
    'acceptedMethods',jsonb_build_array() || case when coalesce(config.cash_enabled,true) then '"cash"'::jsonb else '[]'::jsonb end || case when coalesce(config.check_enabled,true) then '"check"'::jsonb else '[]'::jsonb end,
    'tournamentContact',jsonb_build_object('directorName',coalesce(contact.director_name,'Tournament Director'),'phone',coalesce(contact.tournament_contact_phone,setup.tournament_contact_phone),'email',coalesce(contact.tournament_contact_email,setup.tournament_contact_email),'mailingAddress',coalesce(contact.tournament_mailing_address,setup.tournament_mailing_address,'')))
  from app.tournament_registration_links link
  join app.tournament_registration_link_heads head on head.tournament_id=link.tournament_id and head.registration_link_id=link.id
  join app.tournaments tournament on tournament.id=link.tournament_id
  join lateral(select r.tournament_contact_phone,r.tournament_contact_email,coalesce(r.tournament_mailing_address,'') tournament_mailing_address from app.tournament_setup_revisions r where r.tournament_id=link.tournament_id and r.tournament_contact_phone is not null and r.tournament_contact_email is not null order by r.version desc limit 1) setup on true
  left join lateral(select * from app.tournament_public_contact_versions c where c.tournament_id=link.tournament_id order by c.version desc limit 1) contact on true
  left join lateral(select item.cash_enabled,item.check_enabled from app.tournament_payment_method_config_versions item where item.tournament_id=link.tournament_id order by item.version desc limit 1) config on true
  where link.id=p_link_id and app.fixed_32_byte_equal(link.token_digest,p_digest) and link.lifecycle_state='issued' and link.enabled and link.expires_at>now() and tournament.registration_status='open' and tournament.status in('draft','open')
$$;
revoke all on function public.get_public_registration_payment_options_v1(uuid,bytea) from public,anon,authenticated;
grant execute on function public.get_public_registration_payment_options_v1(uuid,bytea) to service_role;

-- New manual/CSV identities have stored name parts; requests keep a derived
-- display name only at the projection boundary used by existing workflows.
create function public.create_manual_roster_entry_v3(p_actor_id uuid,p_tournament_id uuid,p_first_name text,p_last_name text,p_email text,p_acc_number text,p_scorecard_type text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_first text:=regexp_replace(trim(coalesce(p_first_name,'')),'[[:space:]]+',' ','g');v_last text:=regexp_replace(trim(coalesce(p_last_name,'')),'[[:space:]]+',' ','g');v_name text;v_email text;v_acc text;v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_entry uuid:=extensions.gen_random_uuid();v_response jsonb;v_error text;v_code text;
begin begin
  v_name:=v_first||' '||v_last;
  if p_actor_id is null or p_tournament_id is null or p_idempotency_key is null or length(v_first) not between 1 and 80 or length(v_last) not between 1 and 80 or length(v_name)>160 or length(trim(coalesce(p_email,'')))>320 or (nullif(trim(coalesce(p_email,'')),'') is not null and lower(trim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') or length(trim(coalesce(p_acc_number,'')))>64 or coalesce(p_scorecard_type,'') not in('digital','paper') then raise exception using errcode='P0001',message='invalid manual roster entry';end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then raise exception using errcode='P0001',message='director role required';end if;
  v_name:=lower(v_name);v_email:=nullif(lower(trim(coalesce(p_email,''))),'');v_acc:=nullif(upper(regexp_replace(trim(coalesce(p_acc_number,'')),'[[:space:]]+','','g')),'');
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('create_manual_roster_entry_v3',p_tournament_id::text,v_first,v_last,coalesce(v_email,''),coalesce(v_acc,''),p_scorecard_type)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency conflict';end if;return v_existing.response_payload;end if;
  perform 1 from app.tournaments t where t.id=p_tournament_id and t.status in('draft','open') and t.registration_status='open' for update;if not found then raise exception using errcode='P0001',message='registration closed';end if;if exists(select 1 from app.initial_seating_publications p where p.tournament_id=p_tournament_id) then raise exception using errcode='P0001',message='initial seating already published';end if;if exists(select 1 from app.tournament_roster_entries r where r.tournament_id=p_tournament_id and r.claimed_normalized_name=v_name and coalesce(r.claimed_normalized_email,'')=coalesce(v_email,'') and coalesce(r.claimed_normalized_acc_number,'')=coalesce(v_acc,'')) then raise exception using errcode='P0001',message='duplicate roster entry';end if;
  v_response:=jsonb_build_object('status','manual_roster_entry_created','rosterEntryId',v_entry,'source','director_manual','profileLinked',false,'roleGranted',false,'eventEnrolled',false,'paymentRecorded',false,'checkedIn',false,'seatAssigned',false);insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'create_manual_roster_entry_v3',v_entry,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,claimed_first_name,claimed_last_name,claimed_email,claimed_normalized_email,claimed_acc_number,claimed_normalized_acc_number,scorecard_type,creator_profile_id,operation_receipt_id) values(v_entry,p_tournament_id,'director_manual',v_first||' '||v_last,v_name,v_first,v_last,nullif(trim(coalesce(p_email,'')),''),v_email,nullif(trim(coalesce(p_acc_number,'')),''),v_acc,p_scorecard_type,p_actor_id,v_receipt);insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'tournament_roster_entry',v_entry,'manual_roster_entry_created',v_response||jsonb_build_object('scorecardType',p_scorecard_type));return v_response;
exception when sqlstate 'P0001' then get stacked diagnostics v_error=message_text;v_code:=case v_error when 'director role required' then 'not_director' when 'registration closed' then 'registration_closed' when 'duplicate roster entry' then 'duplicate_roster_entry' when 'initial seating already published' then 'initial_seating_already_published' when 'idempotency conflict' then 'idempotency_conflict' else 'invalid_manual_entry' end;return jsonb_build_object('status','rejected','code',v_code);end;end $$;
revoke all on function public.create_manual_roster_entry_v3(uuid,uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_manual_roster_entry_v3(uuid,uuid,text,text,text,text,text,uuid) to service_role;

create function public.import_roster_csv_v3(p_actor_id uuid,p_tournament_id uuid,p_rows jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash text;v_existing app.operation_receipts%rowtype;v_receipt uuid;v_count integer;v_response jsonb;v_error text;v_code text;
begin begin
  if p_actor_id is null or p_tournament_id is null or p_idempotency_key is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 or exists(select 1 from jsonb_array_elements(p_rows) x where jsonb_typeof(x)<>'object' or x-'firstName'-'lastName'-'email'-'accNumber'-'scorecardType'<>'{}'::jsonb or jsonb_typeof(x->'firstName')<>'string' or jsonb_typeof(x->'lastName')<>'string' or jsonb_typeof(x->'email')<>'string' or jsonb_typeof(x->'accNumber')<>'string' or jsonb_typeof(x->'scorecardType')<>'string' or length(trim(x->>'firstName')) not between 1 and 80 or length(trim(x->>'lastName')) not between 1 and 80 or length(trim(x->>'firstName')||' '||trim(x->>'lastName'))>160 or length(trim(x->>'email'))>320 or(length(trim(x->>'email'))>0 and lower(trim(x->>'email')) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') or length(trim(x->>'accNumber'))>64 or coalesce(x->>'scorecardType','') not in('digital','paper')) then raise exception using errcode='P0001',message='invalid roster batch';end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then raise exception using errcode='P0001',message='director role required';end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array('import_roster_csv_v3',p_tournament_id::text,p_rows)::text,'utf8'),'sha256'),'hex');perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_idempotency_key;if found then if v_existing.request_hash<>v_hash then raise exception using errcode='P0001',message='idempotency conflict';end if;return v_existing.response_payload;end if;perform 1 from app.tournaments t where t.id=p_tournament_id and t.status in('draft','open') and t.registration_status='open' for update;if not found then raise exception using errcode='P0001',message='registration closed';end if;if exists(select 1 from app.initial_seating_publications p where p.tournament_id=p_tournament_id) then raise exception using errcode='P0001',message='initial seating already published';end if;
  if exists(with n as(select lower(regexp_replace(trim(x->>'firstName')||' '||trim(x->>'lastName'),'[[:space:]]+',' ','g')) name_key,coalesce(nullif(lower(trim(x->>'email')),''),'') email_key,coalesce(nullif(upper(regexp_replace(trim(x->>'accNumber'),'[[:space:]]+','','g')),''),'') acc_key from jsonb_array_elements(p_rows)x) select 1 from n where acc_key<>'' group by acc_key having count(*)>1 union all select 1 from n where email_key<>'' group by email_key having count(*)>1 union all select 1 from n where acc_key='' and email_key='' group by name_key having count(*)>1) then raise exception using errcode='P0001',message='duplicate in roster batch';end if;
  if exists(with n as(select lower(regexp_replace(trim(x->>'firstName')||' '||trim(x->>'lastName'),'[[:space:]]+',' ','g')) name_key,coalesce(nullif(lower(trim(x->>'email')),''),'') email_key,coalesce(nullif(upper(regexp_replace(trim(x->>'accNumber'),'[[:space:]]+','','g')),''),'') acc_key from jsonb_array_elements(p_rows)x) select 1 from n join app.tournament_roster_entries r on r.tournament_id=p_tournament_id and ((n.acc_key<>'' and coalesce(r.claimed_normalized_acc_number,'')=n.acc_key) or(n.email_key<>'' and coalesce(r.claimed_normalized_email,'')=n.email_key) or(n.acc_key='' and n.email_key='' and r.claimed_normalized_name=n.name_key))) then raise exception using errcode='P0001',message='duplicate roster entry';end if;
  v_count:=jsonb_array_length(p_rows);v_response:=jsonb_build_object('status','roster_csv_imported','importedCount',v_count);insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at) values(p_actor_id,p_tournament_id,'import_roster_csv_v3',p_tournament_id,v_hash,p_idempotency_key,'accepted',v_response,now()) returning id into v_receipt;insert into app.tournament_roster_entries(id,tournament_id,source_kind,claimed_display_name,claimed_normalized_name,claimed_first_name,claimed_last_name,claimed_email,claimed_normalized_email,claimed_acc_number,claimed_normalized_acc_number,scorecard_type,creator_profile_id,operation_receipt_id) select extensions.gen_random_uuid(),p_tournament_id,'director_csv',first_name||' '||last_name,lower(first_name||' '||last_name),first_name,last_name,nullif(trim(x->>'email'),''),nullif(lower(trim(x->>'email')),''),nullif(trim(x->>'accNumber'),''),nullif(upper(regexp_replace(trim(x->>'accNumber'),'[[:space:]]+','','g')),''),x->>'scorecardType',p_actor_id,v_receipt from jsonb_array_elements(p_rows)x cross join lateral(select regexp_replace(trim(x->>'firstName'),'[[:space:]]+',' ','g') first_name,regexp_replace(trim(x->>'lastName'),'[[:space:]]+',' ','g') last_name)n;insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state) values(p_tournament_id,p_actor_id,v_receipt,'tournament_roster_batch',p_tournament_id,'roster_csv_imported',v_response);return v_response;
exception when sqlstate 'P0001' then get stacked diagnostics v_error=message_text;v_code:=case v_error when 'director role required' then 'not_director' when 'registration closed' then 'registration_closed' when 'duplicate in roster batch' then 'duplicate_in_batch' when 'duplicate roster entry' then 'duplicate_roster_entry' when 'initial seating already published' then 'initial_seating_already_published' when 'idempotency conflict' then 'idempotency_conflict' else 'invalid_roster_batch' end;return jsonb_build_object('status','rejected','code',v_code);end;end $$;
revoke all on function public.import_roster_csv_v3(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.import_roster_csv_v3(uuid,uuid,jsonb,uuid) to service_role;

-- Extend the protected Setup workspace with the selected public name without
-- ever exposing any private profile address or contact field.
alter function public.get_tournament_setup_workspace(uuid) rename to get_tournament_setup_workspace_before_public_director_contact;
create function public.get_tournament_setup_workspace(p_tournament_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb;v_current jsonb;v_name text;
begin
  v_base:=public.get_tournament_setup_workspace_before_public_director_contact(p_tournament_id);
  if v_base is null then return null;end if;
  select director_name into v_name from app.tournament_public_contact_versions where tournament_id=p_tournament_id order by version desc limit 1;
  if v_name is null then select case when app.valid_public_director_name_v1(profile.display_name) then trim(profile.display_name) else '' end into v_name from app.tournaments tournament join app.profiles profile on profile.id=tournament.director_profile_id where tournament.id=p_tournament_id;end if;
  v_current:=v_base->'current';
  if v_current<>'null'::jsonb then v_base:=jsonb_set(v_base,'{current}',v_current||jsonb_build_object('tournamentDirectorPublicName',coalesce(v_name,'')),false);end if;
  return v_base;
end $$;
revoke all on function public.get_tournament_setup_workspace_before_public_director_contact(uuid) from public,anon,authenticated;
revoke all on function public.get_tournament_setup_workspace(uuid) from public,anon;
grant execute on function public.get_tournament_setup_workspace(uuid) to authenticated;

notify pgrst,'reload schema';
