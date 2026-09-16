-- Category 2: tournament contacts are explicit, player-facing setup data.
-- Existing free-text contact_details remains immutable historical evidence only.

alter table app.tournament_setup_revisions
  add column tournament_contact_phone text,
  add column tournament_contact_email text,
  add column tournament_mailing_address text;

alter table app.tournament_setup_revisions
  add constraint tournament_setup_revisions_contact_phone_length
    check (tournament_contact_phone is null or length(tournament_contact_phone) between 7 and 40),
  add constraint tournament_setup_revisions_contact_email_length
    check (tournament_contact_email is null or length(tournament_contact_email) between 3 and 320),
  add constraint tournament_setup_revisions_contact_email_shape
    check (tournament_contact_email is null or tournament_contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add constraint tournament_setup_revisions_mailing_address_length
    check (tournament_mailing_address is null or length(tournament_mailing_address) <= 500);

-- Amendments create a new setup revision from the preceding one. Preserve the
-- selected contact fields in that new version without reading a profile or
-- inferring a private address.
create or replace function app.inherit_structured_tournament_contact()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_prior app.tournament_setup_revisions%rowtype;
  v_phone text := current_setting('app.structured_tournament_contact_phone', true);
  v_email text := current_setting('app.structured_tournament_contact_email', true);
  v_mailing_address text := current_setting('app.structured_tournament_mailing_address', true);
begin
  if v_phone is not null and v_email is not null and v_mailing_address is not null then
    new.tournament_contact_phone := v_phone;
    new.tournament_contact_email := v_email;
    new.tournament_mailing_address := v_mailing_address;
    return new;
  end if;
  if new.tournament_contact_phone is not null
     and new.tournament_contact_email is not null
     and new.tournament_mailing_address is not null then
    return new;
  end if;
  select * into v_prior
  from app.tournament_setup_revisions
  where tournament_id = new.tournament_id and version < new.version
  order by version desc
  limit 1;
  if found then
    new.tournament_contact_phone := coalesce(new.tournament_contact_phone, v_prior.tournament_contact_phone);
    new.tournament_contact_email := coalesce(new.tournament_contact_email, v_prior.tournament_contact_email);
    new.tournament_mailing_address := coalesce(new.tournament_mailing_address, v_prior.tournament_mailing_address);
  end if;
  return new;
end;
$$;
revoke all on function app.inherit_structured_tournament_contact() from public, anon, authenticated;
drop trigger if exists tournament_setup_revision_contact_inheritance on app.tournament_setup_revisions;
create trigger tournament_setup_revision_contact_inheritance
before insert on app.tournament_setup_revisions
for each row execute function app.inherit_structured_tournament_contact();

-- Keep the previous hardened setup writer private. The public signature is
-- replaced by a strict adapter so current clients cannot submit the retired
-- free-text field, while legacy revisions remain untouched.
alter function public.save_tournament_setup_version(uuid, integer, jsonb, uuid)
  rename to save_tournament_setup_version_legacy;

create function public.save_tournament_setup_version(
  p_tournament_id uuid,
  p_expected_version integer,
  p_payload jsonb,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_phone text;
  v_email text;
  v_mailing_address text;
  v_marker text;
  v_legacy_payload jsonb;
  v_result jsonb;
  v_revision_id uuid;
  v_receipt_id uuid;
begin
  if coalesce(jsonb_typeof(p_payload), '') <> 'object'
     or not (p_payload ?& array[
       'tournamentName','city','venue','startsAt','endsAt','timezone',
       'tournamentContactPhone','tournamentContactEmail','tournamentMailingAddress',
       'sanctioningFeeCents','officials','events'
     ])
     or exists (
       select 1 from jsonb_object_keys(p_payload) as key
       where key <> all (array[
         'tournamentName','city','venue','startsAt','endsAt','timezone',
         'tournamentContactPhone','tournamentContactEmail','tournamentMailingAddress',
         'sanctioningFeeCents','officials','events'
       ])
     )
     or jsonb_typeof(p_payload->'tournamentContactPhone') <> 'string'
     or jsonb_typeof(p_payload->'tournamentContactEmail') <> 'string'
     or jsonb_typeof(p_payload->'tournamentMailingAddress') <> 'string' then
    return jsonb_build_object('status','rejected','code','invalid_setup_payload');
  end if;

  v_phone := trim(p_payload->>'tournamentContactPhone');
  v_email := lower(trim(p_payload->>'tournamentContactEmail'));
  v_mailing_address := p_payload->>'tournamentMailingAddress';
  if length(v_phone) not between 7 and 40
     or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7
     or length(v_email) not between 3 and 320
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or length(v_mailing_address) > 500 then
    return jsonb_build_object('status','rejected','code','invalid_setup_payload');
  end if;

  -- The marker is deliberately non-contact metadata. It binds every selected
  -- contact value into the legacy writer's idempotency digest without ever
  -- making old generic contact data public or meaningful again.
  v_marker := 'structured-contact-v1:' || encode(extensions.digest(convert_to(
    jsonb_build_array(v_phone, v_email, v_mailing_address)::text, 'utf8'
  ), 'sha256'), 'hex');
  v_legacy_payload := (p_payload - array[
    'tournamentContactPhone','tournamentContactEmail','tournamentMailingAddress'
  ]) || jsonb_build_object('contactDetails', v_marker);
  perform set_config('app.structured_tournament_contact_phone', v_phone, true);
  perform set_config('app.structured_tournament_contact_email', v_email, true);
  perform set_config('app.structured_tournament_mailing_address', v_mailing_address, true);
  v_result := public.save_tournament_setup_version_legacy(
    p_tournament_id, p_expected_version, v_legacy_payload, p_idempotency_key
  );
  if v_result->>'status' <> 'setup_draft_saved' then
    return v_result;
  end if;

  v_revision_id := (v_result->>'revisionId')::uuid;
  select operation_receipt_id into v_receipt_id
  from app.tournament_setup_revisions
  where id = v_revision_id and tournament_id = p_tournament_id;
  if v_receipt_id is null then
    raise exception using errcode = 'P0001', message = 'structured contact revision unavailable';
  end if;
  insert into app.audit_events(
    tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state
  ) values (
    p_tournament_id, auth.uid(), v_receipt_id, 'tournament_setup_contact', v_revision_id,
    'tournament_setup_contact_saved', jsonb_build_object(
      'phone', v_phone, 'email', v_email, 'mailingAddress', v_mailing_address
    )
  );
  return v_result;
end;
$$;
revoke all on function public.save_tournament_setup_version_legacy(uuid, integer, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.save_tournament_setup_version(uuid, integer, jsonb, uuid) from public, anon;
grant execute on function public.save_tournament_setup_version(uuid, integer, jsonb, uuid) to authenticated;

create or replace function public.get_tournament_setup_workspace(
  p_tournament_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = auth.uid()
      and r.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'current', (
      select jsonb_build_object(
        'revisionId', r.id, 'version', r.version, 'tournamentName', r.tournament_name,
        'city', r.city, 'venue', r.venue, 'startsAt', r.starts_at,
        'endsAt', r.ends_at, 'timezone', r.timezone_name,
        'tournamentContactPhone', coalesce(r.tournament_contact_phone, ''),
        'tournamentContactEmail', coalesce(r.tournament_contact_email, ''),
        'tournamentMailingAddress', coalesce(r.tournament_mailing_address, ''),
        'sanctioningFeeCents', r.sanctioning_fee_cents, 'createdAt', r.created_at,
        'officials', coalesce((
          select jsonb_agg(jsonb_build_object('profileId', o.profile_id, 'role', o.role)
            order by case o.role when 'director' then 0 else 1 end, o.profile_id)
          from app.tournament_setup_official_versions o
          where o.setup_revision_id = r.id and o.tournament_id = r.tournament_id
        ), '[]'::jsonb),
        'events', coalesce((
          select jsonb_agg(jsonb_build_object(
            'clientRowId', e.client_row_id, 'eventKind', e.event_kind,
            'displayName', e.display_name, 'startsAt', e.starts_at,
            'timezone', e.timezone_name, 'styleCode', e.style_code,
            'formatCode', e.format_code, 'gameCount', e.game_count,
            'entryFeeCents', e.entry_fee_cents, 'feeIncludesNote', e.fee_includes_note,
            'payoutNote', e.payout_note, 'qualificationNote', e.qualification_note,
            'eligibilityNote', e.eligibility_note, 'mugginsStatus', e.muggins_status,
            'sourceStatus', e.source_status,
            'qPools', coalesce((
              select jsonb_agg(jsonb_build_object('slot', q.slot, 'poolTypeCode', q.pool_type_code,
                'entryFeeCents', q.entry_fee_cents, 'note', q.note, 'sourceStatus', q.source_status)
                order by q.slot)
              from app.tournament_setup_q_pool_versions q
              where q.setup_event_version_id = e.id and q.tournament_id = e.tournament_id
                and q.setup_revision_id = e.setup_revision_id
            ), '[]'::jsonb)
          ) order by e.ordinal)
          from app.tournament_setup_event_versions e
          where e.setup_revision_id = r.id and e.tournament_id = r.tournament_id
        ), '[]'::jsonb)
      )
      from app.tournament_setup_revisions r
      where r.tournament_id = p_tournament_id
      order by r.version desc limit 1
    ),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'version', r.version, 'createdAt', r.created_at,
        'eventCount', (select count(*) from app.tournament_setup_event_versions e
          where e.setup_revision_id = r.id and e.tournament_id = r.tournament_id)
      ) order by r.version desc)
      from app.tournament_setup_revisions r where r.tournament_id = p_tournament_id
    ), '[]'::jsonb)
  ) else null end
$$;
revoke all on function public.get_tournament_setup_workspace(uuid) from public, anon;
grant execute on function public.get_tournament_setup_workspace(uuid) to authenticated;

create or replace function public.get_tournament_setup_official_choices(
  p_tournament_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and p_tournament_id is not null and exists (
    select 1 from app.tournament_roles caller
    where caller.tournament_id=p_tournament_id and caller.profile_id=auth.uid()
      and caller.role in ('director','co_director')
  ) then (
    select jsonb_build_object(
      'directorProfileId', t.director_profile_id,
      'directorDisplayName', coalesce(nullif(trim(director.display_name), ''), 'Primary director'),
      'coDirectorProfileIds', coalesce((
        select jsonb_agg(r.profile_id order by r.profile_id)
        from app.tournament_roles r
        where r.tournament_id=t.id and r.role='co_director'
      ), '[]'::jsonb)
    )
    from app.tournaments t
    join app.profiles director on director.id=t.director_profile_id
    where t.id=p_tournament_id
  ) else null end
$$;
revoke all on function public.get_tournament_setup_official_choices(uuid) from public, anon;
grant execute on function public.get_tournament_setup_official_choices(uuid) to authenticated;

-- Registration can display only the contact values deliberately saved on the
-- latest setup revision. It never joins account/profile addresses.
create or replace function public.get_public_registration_payment_options_v1(
  p_link_id uuid, p_digest bytea
) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'tournamentName', tournament.name,
    'acceptedMethods', jsonb_build_array() || case when coalesce(config.cash_enabled,true) then '"cash"'::jsonb else '[]'::jsonb end
      || case when coalesce(config.check_enabled,true) then '"check"'::jsonb else '[]'::jsonb end,
    'tournamentContact', jsonb_build_object(
      'phone', contact.tournament_contact_phone,
      'email', contact.tournament_contact_email,
      'mailingAddress', contact.tournament_mailing_address
    )
  )
  from app.tournament_registration_links link
  join app.tournament_registration_link_heads head on head.tournament_id=link.tournament_id and head.registration_link_id=link.id
  join app.tournaments tournament on tournament.id=link.tournament_id
  join lateral (
    select r.tournament_contact_phone, r.tournament_contact_email,
      coalesce(r.tournament_mailing_address, '') as tournament_mailing_address
    from app.tournament_setup_revisions r
    where r.tournament_id=link.tournament_id
      and r.tournament_contact_phone is not null
      and r.tournament_contact_email is not null
    order by r.version desc limit 1
  ) contact on true
  left join lateral(select item.cash_enabled,item.check_enabled from app.tournament_payment_method_config_versions item where item.tournament_id=link.tournament_id order by item.version desc limit 1)config on true
  where link.id=p_link_id and app.fixed_32_byte_equal(link.token_digest,p_digest)
    and link.lifecycle_state='issued' and link.enabled and link.expires_at>now()
    and tournament.registration_status='open' and tournament.status in('draft','open')
$$;
revoke all on function public.get_public_registration_payment_options_v1(uuid,bytea) from public,anon,authenticated;
grant execute on function public.get_public_registration_payment_options_v1(uuid,bytea) to service_role;

-- Setup activation must fail closed until the director has selected the
-- required player-facing phone/email; older revisions remain viewable and
-- recoverable but cannot be newly activated without those details.
alter function public.activate_tournament_setup_v2(uuid, uuid, uuid, integer, uuid)
  rename to activate_tournament_setup_v2_legacy;

create function public.activate_tournament_setup_v2(
  p_actor_id uuid,
  p_tournament_id uuid,
  p_setup_revision_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists (
    select 1 from app.tournament_setup_revisions r
    where r.id=p_setup_revision_id and r.tournament_id=p_tournament_id
      and r.version=p_expected_version
      and length(coalesce(trim(r.tournament_contact_phone), '')) between 7 and 40
      and length(regexp_replace(coalesce(r.tournament_contact_phone, ''), '[^0-9]', '', 'g')) >= 7
      and coalesce(r.tournament_contact_email, '') ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ) then
    return jsonb_build_object('status','rejected','code','missing_tournament_contact');
  end if;
  return public.activate_tournament_setup_v2_legacy(
    p_actor_id, p_tournament_id, p_setup_revision_id, p_expected_version, p_idempotency_key
  );
end;
$$;
revoke all on function public.activate_tournament_setup_v2_legacy(uuid, uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.activate_tournament_setup_v2(uuid, uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.activate_tournament_setup_v2(uuid, uuid, uuid, integer, uuid) to service_role;

notify pgrst, 'reload schema';
