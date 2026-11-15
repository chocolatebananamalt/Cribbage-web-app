-- An untrusted registration claimant must prove possession of the fragment
-- credential before it can enter the per-tournament serialized claim path.
-- This keeps arbitrary requests carrying a known link UUID from consuming the
-- same advisory lock as a valid player claim. The authoritative state and
-- digest are still locked and rechecked below, so close/rotate races fail
-- closed rather than relying on this preliminary lookup.

create or replace function public.submit_registration_claim_v2(
  p_link_id uuid, p_digest bytea, p_display_name text, p_email text, p_acc_number text,
  p_intended_payment_method text, p_client_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_head app.tournament_registration_link_heads%rowtype; v_link app.tournament_registration_links%rowtype;
  v_name text; v_email text; v_acc text; v_status text; v_fingerprint text; v_existing text;
  v_tournament_id uuid;
begin
  perform app.registration_v2_service_only();
  if p_link_id is null or octet_length(p_digest) <> 32 or p_display_name is null or length(trim(p_display_name)) not between 1 and 160
    or p_email is null or length(trim(p_email)) not between 3 and 320 or lower(trim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or coalesce(p_intended_payment_method, '') not in ('cash', 'check', 'other', 'unspecified') or p_client_operation_id is null then
    return jsonb_build_object('status', 'rejected', 'code', 'invalid_request');
  end if;
  v_name := lower(regexp_replace(trim(p_display_name), '[[:space:]]+', ' ', 'g'));
  v_email := lower(trim(p_email));
  v_acc := nullif(upper(regexp_replace(trim(coalesce(p_acc_number, '')), '[[:space:]]+', '', 'g')), '');
  if v_acc is not null and length(v_acc) > 64 then return jsonb_build_object('status', 'rejected', 'code', 'invalid_request'); end if;

  -- This has no state-dependent response: unknown, closed, expired, and
  -- wrong-digest values all continue as generic unavailable below. It exists
  -- solely to keep a wrong digest outside the advisory-lock critical section.
  select l.tournament_id into v_tournament_id
  from app.tournament_registration_links l
  where l.id = p_link_id and app.fixed_32_byte_equal(l.token_digest, p_digest);
  if not found then return jsonb_build_object('status', 'unavailable'); end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('registration-link-v2:' || v_tournament_id::text, 0));
  perform 1 from app.tournaments where id = v_tournament_id for update;
  select * into v_head from app.tournament_registration_link_heads h
  where h.tournament_id = v_tournament_id and h.registration_link_id = p_link_id for update;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  select * into v_link from app.tournament_registration_links where id = p_link_id and tournament_id = v_tournament_id for update;
  if not found or v_head.state <> 'open' or v_link.lifecycle_state <> 'issued' or v_link.expires_at <= now()
    or not app.fixed_32_byte_equal(v_link.token_digest, p_digest)
    or not exists (select 1 from app.tournaments t where t.id=v_link.tournament_id and t.status in ('draft','open') and t.registration_status='open') then
    return jsonb_build_object('status', 'unavailable');
  end if;
  v_fingerprint := encode(extensions.digest(convert_to(jsonb_build_array('registration_claim_v2', p_link_id::text, v_name, v_email, coalesce(v_acc, ''), p_intended_payment_method, p_client_operation_id::text)::text, 'utf8'), 'sha256'), 'hex');
  select request_fingerprint into v_existing from app.registration_claims where tournament_id=v_link.tournament_id and client_operation_id=p_client_operation_id for update;
  if found then
    if v_existing <> v_fingerprint then return jsonb_build_object('status','rejected','code','idempotency_conflict'); end if;
    return jsonb_build_object('status','received');
  end if;
  if (select count(*) from app.registration_claims c where c.registration_link_id=v_link.id) >= v_link.max_claims
    or (select count(*) from app.registration_claims c where c.registration_link_id=v_link.id and c.submitted_at >= now() - interval '1 hour') >= v_link.max_claims_per_hour then
    return jsonb_build_object('status','rejected','code','registration_capacity_reached');
  end if;
  v_status := case when exists (select 1 from app.registration_claims c where c.tournament_id=v_link.tournament_id and c.status not in ('rejected','withdrawn') and (c.normalized_email=v_email or c.normalized_name=v_name or (v_acc is not null and c.normalized_acc_number=v_acc))) then 'needs_review' else 'pending_review' end;
  insert into app.registration_claims(tournament_id, registration_link_id, display_name, normalized_name, email, normalized_email, acc_number, normalized_acc_number, intended_payment_method, status, client_operation_id, request_fingerprint)
  values(v_link.tournament_id, v_link.id, trim(p_display_name), v_name, trim(p_email), v_email, nullif(trim(p_acc_number), ''), v_acc, p_intended_payment_method, v_status, p_client_operation_id, v_fingerprint);
  return jsonb_build_object('status','received');
end;
$$;

revoke all on function public.submit_registration_claim_v2(uuid, bytea, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.submit_registration_claim_v2(uuid, bytea, text, text, text, text, uuid) to service_role;
