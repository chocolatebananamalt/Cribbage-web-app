-- Public flyer registration is deliberately a claim queue, never direct roster
-- enrollment. Raw QR/link tokens are never stored, and public callers cannot
-- read claims, roster data, roles, payment data, or seating assignments.
alter table app.tournaments
  add column if not exists registration_status text not null default 'closed'
  check (registration_status in ('closed', 'open'));

create table app.tournament_registration_links (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null unique references app.tournaments(id) on delete restrict,
  token_hash text not null unique check (length(token_hash) = 64),
  created_by_profile_id uuid not null references app.profiles(id) on delete restrict,
  enabled boolean not null default true,
  max_claims integer not null default 500 check (max_claims between 1 and 2000),
  max_claims_per_hour integer not null default 120 check (max_claims_per_hour between 1 and 1000),
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

create table app.registration_claims (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null references app.tournaments(id) on delete restrict,
  registration_link_id uuid not null references app.tournament_registration_links(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  normalized_name text not null check (length(normalized_name) between 1 and 160),
  email text not null check (length(email) between 3 and 320),
  normalized_email text not null check (length(normalized_email) between 3 and 320),
  acc_number text,
  normalized_acc_number text,
  intended_payment_method text not null check (intended_payment_method in ('cash', 'check', 'other', 'unspecified')),
  status text not null check (status in ('pending_review', 'needs_review', 'accepted', 'rejected', 'withdrawn')),
  client_operation_id uuid not null,
  request_fingerprint text not null check (length(request_fingerprint) = 64),
  submitted_at timestamptz not null default now(),
  unique (tournament_id, client_operation_id),
  check (normalized_acc_number is null or length(normalized_acc_number) between 1 and 64)
);

create index tournament_registration_links_creator_profile_id_idx
  on app.tournament_registration_links (created_by_profile_id);
create index registration_claims_tournament_status_idx
  on app.registration_claims (tournament_id, status);
create index registration_claims_registration_link_id_idx
  on app.registration_claims (registration_link_id);
create index registration_claims_link_submitted_at_idx
  on app.registration_claims (registration_link_id, submitted_at);
create index registration_claims_normalized_email_idx
  on app.registration_claims (tournament_id, normalized_email);
create index registration_claims_normalized_acc_number_idx
  on app.registration_claims (tournament_id, normalized_acc_number)
  where normalized_acc_number is not null;

alter table app.tournament_registration_links enable row level security;
alter table app.tournament_registration_links force row level security;
alter table app.registration_claims enable row level security;
alter table app.registration_claims force row level security;
revoke all on table app.tournament_registration_links from anon, authenticated;
revoke all on table app.registration_claims from anon, authenticated;

create trigger registration_claims_immutable before update or delete on app.registration_claims
for each row execute function app.reject_immutable_history();

create or replace function public.get_public_registration_context(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('tournamentName', t.name)
  from app.tournament_registration_links l
  join app.tournaments t on t.id = l.tournament_id
  where l.enabled
    and l.disabled_at is null
    and t.registration_status = 'open'
    and p_token ~ '^[A-Za-z0-9_-]{24,200}$'
    and l.token_hash = encode(extensions.digest(convert_to(p_token, 'utf8'), 'sha256'), 'hex')
  limit 1
$$;

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
    where c.tournament_id = v_tournament_id
      and c.status not in ('rejected', 'withdrawn')
      and (c.normalized_email = v_email or c.normalized_name = v_name or (v_acc is not null and c.normalized_acc_number = v_acc))
  ) then 'needs_review' else 'pending_review' end;

  insert into app.registration_claims(
    tournament_id, registration_link_id, display_name, normalized_name,
    email, normalized_email, acc_number, normalized_acc_number,
    intended_payment_method, status, client_operation_id, request_fingerprint
  ) values (
    v_tournament_id, v_link_id, trim(p_display_name), v_name,
    trim(p_email), v_email, nullif(trim(p_acc_number), ''), v_acc,
    p_intended_payment_method, v_status, p_client_operation_id, v_fingerprint
  );

  -- Keep the public response non-enumerating: no duplicate details, roster,
  -- payment, role, Table/Seat, or acceptance decision is exposed.
  return jsonb_build_object('status', 'received');
end;
$$;

revoke all on function public.get_public_registration_context(text) from public, anon, authenticated;
revoke all on function public.submit_public_registration_claim(text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.get_public_registration_context(text) to anon, authenticated;
grant execute on function public.submit_public_registration_claim(text, text, text, text, text, uuid) to anon, authenticated;
