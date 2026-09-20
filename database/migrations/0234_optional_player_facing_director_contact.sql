-- Phone and email in Tournament Director Information are player-facing choices,
-- not activation prerequisites. Preserve strict validation when either value is
-- supplied, store an omitted value as null, and never fall back to private
-- profile contact data.

create function app.apply_optional_tournament_contact_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_phone text:=current_setting('app.optional_tournament_contact_phone',true);
  v_email text:=current_setting('app.optional_tournament_contact_email',true);
begin
  if v_phone is not null and v_email is not null then
    new.tournament_contact_phone:=nullif(trim(v_phone),'');
    new.tournament_contact_email:=nullif(lower(trim(v_email)),'');
  end if;
  return new;
end $$;
revoke all on function app.apply_optional_tournament_contact_v1() from public,anon,authenticated;

-- PostgreSQL runs same-kind triggers alphabetically. This final trigger runs
-- after the legacy contact-inheritance trigger and replaces only values that
-- the current setup request deliberately supplied or omitted.
create trigger zz_tournament_setup_revision_optional_contact
before insert on app.tournament_setup_revisions
for each row execute function app.apply_optional_tournament_contact_v1();

-- Public contact snapshots preserve the director's player-facing choices.
-- Null means the director deliberately did not publish that contact channel;
-- any supplied value still has the original length and shape protections.
alter table app.tournament_public_contact_versions
  alter column tournament_contact_phone drop not null,
  alter column tournament_contact_email drop not null;
alter table app.tournament_public_contact_versions
  drop constraint tournament_public_contact_versions_tournament_contact_phone_check,
  drop constraint tournament_public_contact_versions_tournament_contact_email_check;
alter table app.tournament_public_contact_versions
  add constraint tournament_public_contact_versions_tournament_contact_phone_check
    check (tournament_contact_phone is null or length(trim(tournament_contact_phone)) between 7 and 40),
  add constraint tournament_public_contact_versions_tournament_contact_email_check
    check (tournament_contact_email is null or length(trim(tournament_contact_email)) between 3 and 320);

alter function public.save_tournament_setup_version(uuid,integer,jsonb,uuid)
  rename to save_tournament_setup_version_before_optional_contact;
create function public.save_tournament_setup_version(
  p_tournament_id uuid,p_expected_version integer,p_payload jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_phone text;
  v_email text;
  v_forward_payload jsonb;
begin
  if coalesce(jsonb_typeof(p_payload),'')<>'object'
     or jsonb_typeof(p_payload->'tournamentContactPhone')<>'string'
     or jsonb_typeof(p_payload->'tournamentContactEmail')<>'string' then
    return jsonb_build_object('status','rejected','code','invalid_setup_payload');
  end if;
  v_phone:=trim(p_payload->>'tournamentContactPhone');
  v_email:=lower(trim(p_payload->>'tournamentContactEmail'));
  if length(v_phone)>40
     or (v_phone<>'' and length(regexp_replace(v_phone,'[^0-9]','','g'))<7)
     or length(v_email)>320
     or (v_email<>'' and v_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    return jsonb_build_object('status','rejected','code','invalid_setup_payload');
  end if;
  perform set_config('app.optional_tournament_contact_phone',v_phone,true);
  perform set_config('app.optional_tournament_contact_email',v_email,true);
  -- The prior immutable writer predates optional contact values. Feed it
  -- internal validation placeholders only when a value was deliberately
  -- omitted; the final BEFORE INSERT trigger above stores null instead.
  v_forward_payload:=jsonb_set(jsonb_set(p_payload,'{tournamentContactPhone}',to_jsonb(case when v_phone='' then '0000000' else v_phone end),false),'{tournamentContactEmail}',to_jsonb(case when v_email='' then 'not-provided@example.invalid' else v_email end),false);
  return public.save_tournament_setup_version_before_optional_contact(
    p_tournament_id,p_expected_version,v_forward_payload,p_idempotency_key);
end $$;
revoke all on function public.save_tournament_setup_version_before_optional_contact(uuid,integer,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.save_tournament_setup_version(uuid,integer,jsonb,uuid) from public,anon;
grant execute on function public.save_tournament_setup_version(uuid,integer,jsonb,uuid) to authenticated;

create or replace function public.configure_tournament_public_contact_from_setup_v1(
  p_actor_id uuid,p_tournament_id uuid,p_setup_revision_id uuid,p_director_name text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_setup app.tournament_setup_revisions%rowtype;v_receipt uuid;v_version integer;v_response jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' or p_actor_id is null or p_tournament_id is null or p_setup_revision_id is null
    or not app.valid_public_director_name_v1(p_director_name) then return jsonb_build_object('status','rejected','code','invalid_public_contact');end if;
  if not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=p_actor_id and role in('director','co_director')) then return jsonb_build_object('status','rejected','code','not_director');end if;
  select * into v_setup from app.tournament_setup_revisions where id=p_setup_revision_id and tournament_id=p_tournament_id;
  if not found then return jsonb_build_object('status','rejected','code','setup_unavailable');end if;
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

-- The public reader always returns the newest deliberate Setup values and
-- never falls back to profile phone, email, or address information.
create or replace function public.get_public_registration_payment_options_v1(p_link_id uuid,p_digest bytea)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('tournamentName',tournament.name,
    'acceptedMethods',jsonb_build_array() || case when coalesce(config.cash_enabled,true) then '"cash"'::jsonb else '[]'::jsonb end || case when coalesce(config.check_enabled,true) then '"check"'::jsonb else '[]'::jsonb end,
    'tournamentContact',jsonb_build_object('directorName',coalesce(contact.director_name,'Tournament Director'),'phone',coalesce(contact.tournament_contact_phone,setup.tournament_contact_phone,''),'email',coalesce(contact.tournament_contact_email,setup.tournament_contact_email,''),'mailingAddress',coalesce(contact.tournament_mailing_address,setup.tournament_mailing_address,'')))
  from app.tournament_registration_links link
  join app.tournament_registration_link_heads head on head.tournament_id=link.tournament_id and head.registration_link_id=link.id
  join app.tournaments tournament on tournament.id=link.tournament_id
  join lateral(select r.tournament_contact_phone,r.tournament_contact_email,coalesce(r.tournament_mailing_address,'') tournament_mailing_address from app.tournament_setup_revisions r where r.tournament_id=link.tournament_id order by r.version desc limit 1) setup on true
  left join lateral(select * from app.tournament_public_contact_versions c where c.tournament_id=link.tournament_id order by c.version desc limit 1) contact on true
  left join lateral(select item.cash_enabled,item.check_enabled from app.tournament_payment_method_config_versions item where item.tournament_id=link.tournament_id order by item.version desc limit 1) config on true
  where link.id=p_link_id and app.fixed_32_byte_equal(link.token_digest,p_digest) and link.lifecycle_state='issued' and link.enabled and link.expires_at>now() and tournament.registration_status='open' and tournament.status in('draft','open')
$$;
revoke all on function public.get_public_registration_payment_options_v1(uuid,bytea) from public,anon,authenticated;
grant execute on function public.get_public_registration_payment_options_v1(uuid,bytea) to service_role;

-- Preserve the State/Territory finalization guard while removing only the old
-- phone/email prerequisite. The pre-contact activation function remains the
-- authoritative lifecycle and idempotency implementation.
alter function public.activate_tournament_setup_v2(uuid,uuid,uuid,integer,uuid)
  rename to activate_tournament_setup_v2_before_optional_contact;
create function public.activate_tournament_setup_v2(
  p_actor_id uuid,p_tournament_id uuid,p_setup_revision_id uuid,p_expected_version integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from app.tournament_setup_revisions revision
    where revision.id=p_setup_revision_id and revision.tournament_id=p_tournament_id
      and revision.version=p_expected_version and length(trim(revision.state_territory))>0) then
    return jsonb_build_object('status','rejected','code','missing_state_territory');
  end if;
  return public.activate_tournament_setup_v2_legacy(
    p_actor_id,p_tournament_id,p_setup_revision_id,p_expected_version,p_idempotency_key);
end $$;
revoke all on function public.activate_tournament_setup_v2_before_optional_contact(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.activate_tournament_setup_v2(uuid,uuid,uuid,integer,uuid) from public,anon;
grant execute on function public.activate_tournament_setup_v2(uuid,uuid,uuid,integer,uuid) to service_role;

notify pgrst,'reload schema';
