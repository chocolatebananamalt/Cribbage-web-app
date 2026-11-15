-- Repair the pilot deployed before canonical idempotency fingerprints. JSON
-- serialization prevents delimiter collisions in independently supplied fields.
drop trigger if exists registration_claims_immutable on app.registration_claims;

update app.registration_claims
set request_fingerprint = encode(extensions.digest(convert_to(jsonb_build_array('public_registration', normalized_name, normalized_email, coalesce(normalized_acc_number, ''), intended_payment_method, client_operation_id::text)::text, 'utf8'), 'sha256'), 'hex');

create trigger registration_claims_immutable before update or delete on app.registration_claims
for each row execute function app.reject_immutable_history();

create or replace function public.submit_public_registration_claim(
  p_token text,
  p_display_name text,
  p_email text,
  p_acc_number text,
  p_intended_payment_method text,
  p_client_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tournament_id uuid;
  v_link_id uuid;
  v_name text;
  v_email text;
  v_acc text;
  v_status text;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_max_claims integer;
  v_max_claims_per_hour integer;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{24,200}$'
    or p_display_name is null or length(trim(p_display_name)) not between 1 and 160
    or p_email is null or length(trim(p_email)) not between 3 and 320
    or lower(trim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or coalesce(p_intended_payment_method, '') not in ('cash', 'check', 'other', 'unspecified')
    or p_client_operation_id is null then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid_request');
  end if;

  v_name := lower(regexp_replace(trim(p_display_name), '[[:space:]]+', ' ', 'g'));
  v_email := lower(trim(p_email));
  v_acc := nullif(upper(regexp_replace(trim(coalesce(p_acc_number, '')), '[[:space:]]+', '', 'g')), '');
  if v_acc is not null and length(v_acc) > 64 then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid_request');
  end if;
  v_fingerprint := encode(extensions.digest(convert_to(jsonb_build_array('public_registration', v_name, v_email, coalesce(v_acc, ''), p_intended_payment_method, p_client_operation_id::text)::text, 'utf8'), 'sha256'), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_token, 0));
  select l.tournament_id, l.id, l.max_claims, l.max_claims_per_hour into v_tournament_id, v_link_id, v_max_claims, v_max_claims_per_hour
  from app.tournament_registration_links l
  join app.tournaments t on t.id = l.tournament_id
  where l.enabled and l.disabled_at is null and t.registration_status = 'open'
    and l.token_hash = encode(extensions.digest(convert_to(p_token, 'utf8'), 'sha256'), 'hex')
  for update of l;
  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select c.request_fingerprint into v_existing_fingerprint
  from app.registration_claims c
  where c.tournament_id = v_tournament_id and c.client_operation_id = p_client_operation_id;
  if found then
    if v_existing_fingerprint <> v_fingerprint then
      return jsonb_build_object('status', 'rejected', 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object('status', 'received');
  end if;
  if (select count(*) from app.registration_claims c where c.registration_link_id = v_link_id) >= v_max_claims then
    return jsonb_build_object('status', 'rejected', 'code', 'registration_capacity_reached');
  end if;
  if (select count(*) from app.registration_claims c where c.registration_link_id = v_link_id and c.submitted_at >= now() - interval '1 hour') >= v_max_claims_per_hour then
    return jsonb_build_object('status', 'rejected', 'code', 'registration_rate_limited');
  end if;

  v_status := case when exists (
    select 1 from app.registration_claims c
    where c.tournament_id = v_tournament_id and c.status not in ('rejected', 'withdrawn')
      and (c.normalized_email = v_email or c.normalized_name = v_name or (v_acc is not null and c.normalized_acc_number = v_acc))
  ) then 'needs_review' else 'pending_review' end;

  insert into app.registration_claims(tournament_id, registration_link_id, display_name, normalized_name, email, normalized_email, acc_number, normalized_acc_number, intended_payment_method, status, client_operation_id, request_fingerprint)
  values (v_tournament_id, v_link_id, trim(p_display_name), v_name, trim(p_email), v_email, nullif(trim(p_acc_number), ''), v_acc, p_intended_payment_method, v_status, p_client_operation_id, v_fingerprint);
  return jsonb_build_object('status', 'received');
end;
$$;

revoke all on function public.submit_public_registration_claim(text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.submit_public_registration_claim(text, text, text, text, text, uuid) to anon, authenticated;
