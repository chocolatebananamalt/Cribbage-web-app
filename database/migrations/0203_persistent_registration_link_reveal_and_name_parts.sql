-- Active registration credentials remain bearer secrets.  The digest remains
-- the sole redemption authority; this private envelope only permits an
-- authorized director to redisplay a current link after it is issued.

create table app.registration_link_reveal_envelopes (
  registration_link_id uuid primary key references app.tournament_registration_links(id) on delete restrict,
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  nonce text not null check (nonce ~ '^[A-Za-z0-9_-]{16}$'),
  ciphertext text not null check (ciphertext ~ '^[A-Za-z0-9_-]{24,1024}$'),
  created_at timestamptz not null default now()
);
create index registration_link_reveal_envelopes_tournament_idx
  on app.registration_link_reveal_envelopes(tournament_id, registration_link_id);
alter table app.registration_link_reveal_envelopes enable row level security;
alter table app.registration_link_reveal_envelopes force row level security;
revoke all on table app.registration_link_reveal_envelopes from public, anon, authenticated;
create trigger registration_link_reveal_envelopes_immutable
before update or delete on app.registration_link_reveal_envelopes
for each row execute function app.reject_immutable_history();

-- Keep existing v2 lifecycle behavior intact and add a separate, atomic v3
-- writer for the encrypted envelope.  Older deployed clients can continue to
-- use v2 during the release; their links remain correctly legacy/unrecoverable.
create function public.issue_registration_link_v3(
  p_actor_id uuid,p_tournament_id uuid,p_link_id uuid,p_salt bytea,p_digest bytea,
  p_reveal_nonce text,p_reveal_ciphertext text,p_expires_at timestamptz,
  p_max_claims integer,p_max_claims_per_hour integer,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  if p_reveal_nonce is null or p_reveal_nonce !~ '^[A-Za-z0-9_-]{16}$'
    or p_reveal_ciphertext is null or p_reveal_ciphertext !~ '^[A-Za-z0-9_-]{24,1024}$' then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  v_result:=public.issue_registration_link_v2(
    p_actor_id,p_tournament_id,p_link_id,p_salt,p_digest,p_expires_at,p_max_claims,p_max_claims_per_hour,p_operation_id
  );
  if v_result->>'status'='issued' and v_result->>'linkId'=p_link_id::text then
    insert into app.registration_link_reveal_envelopes(registration_link_id,tournament_id,nonce,ciphertext)
    values(p_link_id,p_tournament_id,p_reveal_nonce,p_reveal_ciphertext)
    on conflict(registration_link_id) do nothing;
  end if;
  return v_result;
end;
$$;
revoke all on function public.issue_registration_link_v3(uuid,uuid,uuid,bytea,bytea,text,text,timestamptz,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.issue_registration_link_v3(uuid,uuid,uuid,bytea,bytea,text,text,timestamptz,integer,integer,uuid) to service_role;

create function public.rotate_registration_link_v3(
  p_actor_id uuid,p_tournament_id uuid,p_expected_link_id uuid,p_expected_version integer,
  p_link_id uuid,p_salt bytea,p_digest bytea,p_reveal_nonce text,p_reveal_ciphertext text,
  p_expires_at timestamptz,p_max_claims integer,p_max_claims_per_hour integer,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  if p_reveal_nonce is null or p_reveal_nonce !~ '^[A-Za-z0-9_-]{16}$'
    or p_reveal_ciphertext is null or p_reveal_ciphertext !~ '^[A-Za-z0-9_-]{24,1024}$' then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  v_result:=public.rotate_registration_link_v2(
    p_actor_id,p_tournament_id,p_expected_link_id,p_expected_version,p_link_id,p_salt,p_digest,
    p_expires_at,p_max_claims,p_max_claims_per_hour,p_operation_id
  );
  if v_result->>'status'='rotated' and v_result->>'linkId'=p_link_id::text then
    insert into app.registration_link_reveal_envelopes(registration_link_id,tournament_id,nonce,ciphertext)
    values(p_link_id,p_tournament_id,p_reveal_nonce,p_reveal_ciphertext)
    on conflict(registration_link_id) do nothing;
  end if;
  return v_result;
end;
$$;
revoke all on function public.rotate_registration_link_v3(uuid,uuid,uuid,integer,uuid,bytea,bytea,text,text,timestamptz,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.rotate_registration_link_v3(uuid,uuid,uuid,integer,uuid,bytea,bytea,text,text,timestamptz,integer,integer,uuid) to service_role;

create function public.reveal_registration_link_v1(
  p_actor_id uuid,p_tournament_id uuid,p_expected_link_id uuid,p_expected_version integer,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_head app.tournament_registration_link_heads%rowtype;
  v_link app.tournament_registration_links%rowtype;
  v_envelope app.registration_link_reveal_envelopes%rowtype;
  v_existing app.operation_receipts%rowtype;
  v_hash text;v_metadata jsonb;v_receipt_id uuid;
begin
  perform app.registration_v2_service_only();
  if p_actor_id is null or p_tournament_id is null or p_expected_link_id is null
    or p_expected_version is null or p_expected_version<1 or p_operation_id is null then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id
    and r.profile_id=p_actor_id and r.role in('director','co_director')) then
    return jsonb_build_object('status','rejected','code','not_authorized');
  end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_array(
    'registration_link_reveal_v1',p_actor_id::text,p_tournament_id::text,p_expected_link_id::text,p_expected_version,p_operation_id::text
  )::text,'utf8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registration-link-v2:'||p_tournament_id::text,0));
  select * into v_head from app.tournament_registration_link_heads where tournament_id=p_tournament_id for update;
  if not found then return jsonb_build_object('status','rejected','code','link_unavailable'); end if;
  select * into v_link from app.tournament_registration_links where id=p_expected_link_id and tournament_id=p_tournament_id for update;
  if not found or v_head.state<>'open' or v_head.registration_link_id<>p_expected_link_id
    or v_head.version<>p_expected_version or v_link.lifecycle_state<>'issued' or not v_link.enabled
    or v_link.expires_at<=now() or not exists(select 1 from app.tournaments t where t.id=p_tournament_id and t.status in('draft','open') and t.registration_status='open') then
    return jsonb_build_object('status','rejected','code','link_unavailable');
  end if;
  select * into v_envelope from app.registration_link_reveal_envelopes
    where registration_link_id=p_expected_link_id and tournament_id=p_tournament_id;
  if not found then return jsonb_build_object('status','legacy_unrecoverable','linkId',p_expected_link_id,'version',p_expected_version); end if;
  select * into v_existing from app.operation_receipts where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type<>'registration_link_reveal_v1' or v_existing.request_hash<>v_hash then
      return jsonb_build_object('status','rejected','code','idempotency_conflict');
    end if;
    return jsonb_build_object('status','revealable','linkId',p_expected_link_id,'version',p_expected_version,'nonce',v_envelope.nonce,'ciphertext',v_envelope.ciphertext);
  end if;
  v_metadata:=jsonb_build_object('status','revealable','linkId',p_expected_link_id,'version',p_expected_version);
  insert into app.operation_receipts(actor_profile_id,tournament_id,operation_type,target_id,request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_actor_id,p_tournament_id,'registration_link_reveal_v1',p_expected_link_id,v_hash,p_operation_id,'accepted',v_metadata,now()) returning id into v_receipt_id;
  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,entity_id,action,after_state)
  values(p_tournament_id,p_actor_id,v_receipt_id,'registration_link',p_expected_link_id,'registration_link_credential_revealed',v_metadata);
  return v_metadata||jsonb_build_object('nonce',v_envelope.nonce,'ciphertext',v_envelope.ciphertext);
end;
$$;
revoke all on function public.reveal_registration_link_v1(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.reveal_registration_link_v1(uuid,uuid,uuid,integer,uuid) to service_role;

-- Keep the existing state-reader response stable while the application is
-- deployed.  The new UI asks this separate protected function whether the
-- current credential can be shown again; older application versions ignore it.
create function public.get_registration_link_reveal_availability_v1(
  p_actor_id uuid,p_tournament_id uuid,p_expected_link_id uuid,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_head app.tournament_registration_link_heads%rowtype;v_link app.tournament_registration_links%rowtype;v_tournament app.tournaments%rowtype;
begin
  perform app.registration_v2_service_only();
  if p_actor_id is null or p_tournament_id is null or p_expected_link_id is null or p_expected_version is null or p_expected_version<1 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  if not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=p_actor_id and r.role in('director','co_director')) then
    return jsonb_build_object('status','rejected','code','not_authorized');
  end if;
  select * into v_head from app.tournament_registration_link_heads where tournament_id=p_tournament_id;
  if not found then return jsonb_build_object('status','rejected','code','link_unavailable'); end if;
  select * into v_link from app.tournament_registration_links where id=p_expected_link_id and tournament_id=p_tournament_id;
  if not found then return jsonb_build_object('status','rejected','code','link_unavailable'); end if;
  select * into v_tournament from app.tournaments where id=p_tournament_id;
  if not found or v_head.state<>'open' or v_head.registration_link_id<>p_expected_link_id or v_head.version<>p_expected_version
    or v_link.lifecycle_state<>'issued' or not v_link.enabled or v_link.expires_at<=now()
    or v_tournament.status not in('draft','open') or v_tournament.registration_status<>'open' then
    return jsonb_build_object('status','rejected','code','link_unavailable');
  end if;
  if exists(select 1 from app.registration_link_reveal_envelopes e where e.registration_link_id=p_expected_link_id and e.tournament_id=p_tournament_id) then
    return jsonb_build_object('status','recoverable');
  end if;
  return jsonb_build_object('status','legacy_unrecoverable');
end;
$$;
revoke all on function public.get_registration_link_reveal_availability_v1(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.get_registration_link_reveal_availability_v1(uuid,uuid,uuid,integer) to service_role;

-- The public contact card uses the primary director's public display name and
-- only the director-selected setup contact fields.
create or replace function public.get_public_registration_payment_options_v1(
  p_link_id uuid,p_digest bytea
) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'tournamentName', tournament.name,
    'acceptedMethods', jsonb_build_array() || case when coalesce(config.cash_enabled,true) then '"cash"'::jsonb else '[]'::jsonb end
      || case when coalesce(config.check_enabled,true) then '"check"'::jsonb else '[]'::jsonb end,
    'tournamentContact', jsonb_build_object(
      'directorName',coalesce(nullif(trim(director.display_name),''),'Tournament Director'),
      'phone',contact.tournament_contact_phone,
      'email',contact.tournament_contact_email,
      'mailingAddress',contact.tournament_mailing_address
    )
  )
  from app.tournament_registration_links link
  join app.tournament_registration_link_heads head on head.tournament_id=link.tournament_id and head.registration_link_id=link.id
  join app.tournaments tournament on tournament.id=link.tournament_id
  join app.profiles director on director.id=tournament.director_profile_id
  join lateral (
    select r.tournament_contact_phone,r.tournament_contact_email,coalesce(r.tournament_mailing_address,'') as tournament_mailing_address
    from app.tournament_setup_revisions r where r.tournament_id=link.tournament_id
      and r.tournament_contact_phone is not null and r.tournament_contact_email is not null
    order by r.version desc limit 1
  ) contact on true
  left join lateral(select item.cash_enabled,item.check_enabled from app.tournament_payment_method_config_versions item where item.tournament_id=link.tournament_id order by item.version desc limit 1)config on true
  where link.id=p_link_id and app.fixed_32_byte_equal(link.token_digest,p_digest)
    and link.lifecycle_state='issued' and link.enabled and link.expires_at>now()
    and tournament.registration_status='open' and tournament.status in('draft','open')
$$;
revoke all on function public.get_public_registration_payment_options_v1(uuid,bytea) from public,anon,authenticated;
grant execute on function public.get_public_registration_payment_options_v1(uuid,bytea) to service_role;

-- New public claims preserve the entered name parts while retaining the
-- established display-name projection used by roster, scorecards, and results.
alter table app.registration_claims
  add column first_name text,
  add column last_name text,
  add constraint registration_claims_name_parts_pair check ((first_name is null and last_name is null) or (
    length(trim(first_name)) between 1 and 80 and length(trim(last_name)) between 1 and 80
  ));

create function app.capture_registration_claim_name_parts()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_first text:=current_setting('app.registration_claim_first_name',true);v_last text:=current_setting('app.registration_claim_last_name',true);
begin
  if v_first is null and v_last is null then return new;end if;
  if v_first is null or v_last is null or length(trim(v_first)) not between 1 and 80 or length(trim(v_last)) not between 1 and 80 then
    raise exception using errcode='P0001',message='invalid registration name parts';
  end if;
  v_first:=regexp_replace(trim(v_first),'[[:space:]]+',' ','g');v_last:=regexp_replace(trim(v_last),'[[:space:]]+',' ','g');
  if new.display_name<>v_first||' '||v_last then raise exception using errcode='P0001',message='registration display name mismatch';end if;
  new.first_name:=v_first;new.last_name:=v_last;return new;
end;
$$;
revoke all on function app.capture_registration_claim_name_parts() from public,anon,authenticated;
create trigger registration_claims_capture_name_parts before insert on app.registration_claims
for each row execute function app.capture_registration_claim_name_parts();

create function public.submit_registration_claim_v4(
  p_link_id uuid,p_digest bytea,p_first_name text,p_last_name text,p_email text,p_acc_number text,
  p_intended_payment_method text,p_scorecard_type text,p_client_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_first text;v_last text;
begin
  if p_first_name is null or p_last_name is null or length(trim(p_first_name)) not between 1 and 80 or length(trim(p_last_name)) not between 1 and 80 then
    return jsonb_build_object('status','rejected','code','invalid_request');
  end if;
  v_first:=regexp_replace(trim(p_first_name),'[[:space:]]+',' ','g');v_last:=regexp_replace(trim(p_last_name),'[[:space:]]+',' ','g');
  if length(v_first||' '||v_last)>160 then return jsonb_build_object('status','rejected','code','invalid_request');end if;
  perform set_config('app.registration_claim_first_name',v_first,true);
  perform set_config('app.registration_claim_last_name',v_last,true);
  return public.submit_registration_claim_v3(p_link_id,p_digest,v_first||' '||v_last,p_email,p_acc_number,p_intended_payment_method,p_scorecard_type,p_client_operation_id);
end;
$$;
revoke all on function public.submit_registration_claim_v4(uuid,bytea,text,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.submit_registration_claim_v4(uuid,bytea,text,text,text,text,text,text,uuid) to service_role;

notify pgrst,'reload schema';
