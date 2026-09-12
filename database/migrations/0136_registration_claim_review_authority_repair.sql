-- Require current director authority before replay disclosure or any rejected
-- registration-review receipt/audit side effect.

create or replace function public.review_registration_claim(
  p_tournament_id uuid, p_claim_id uuid, p_decision text, p_duplicate_resolution text,
  p_duplicate_of_claim_id uuid, p_reason text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_status text; v_tournament_exists boolean := false;
  v_authorized boolean := false; v_claim app.registration_claims%rowtype;
  v_existing app.operation_receipts%rowtype; v_hash text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_receipt uuid; v_decision uuid := extensions.gen_random_uuid();
  v_response jsonb; v_error text; v_code text; v_collision boolean := false;
begin begin
  if v_actor is null then raise exception using errcode = 'P0001', message = 'authentication required'; end if;
  if p_tournament_id is null or p_claim_id is null or p_decision is null
    or p_decision not in ('approved_for_roster', 'rejected') or p_idempotency_key is null
    or length(coalesce(p_reason, '')) > 500 or octet_length(coalesce(p_reason, '')) > 2000 then
    raise exception using errcode = 'P0001', message = 'invalid registration review';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    'review_registration_claim', p_tournament_id::text, p_claim_id::text, p_decision,
    coalesce(p_duplicate_resolution, ''), coalesce(p_duplicate_of_claim_id::text, ''),
    coalesce(v_reason, ''), p_idempotency_key::text
  )::text, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0));
  select status into v_status from app.tournaments where id = p_tournament_id for update;
  v_tournament_exists := found;
  if not v_tournament_exists then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
  if not exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = v_actor
      and r.role in ('director', 'co_director')
  ) then raise exception using errcode = 'P0001', message = 'director role required'; end if;
  v_authorized := true;
  select * into v_existing from app.operation_receipts
  where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'idempotency conflict'; end if;
    return v_existing.response_payload;
  end if;
  if v_status not in ('draft', 'open') then raise exception using errcode = 'P0001', message = 'tournament unavailable'; end if;
  select * into v_claim from app.registration_claims
  where id = p_claim_id and tournament_id = p_tournament_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'claim unavailable'; end if;
  perform 1 from app.tournament_registration_links where id = v_claim.registration_link_id for update;
  if exists (select 1 from app.registration_claim_decisions where claim_id = p_claim_id) then
    raise exception using errcode = 'P0001', message = 'claim already decided';
  end if;
  select exists(
    select 1 from app.registration_claims other
    left join app.registration_claim_decisions od on od.claim_id = other.id
    where other.tournament_id = p_tournament_id and other.id <> p_claim_id
      and od.decision is distinct from 'rejected'
      and (other.normalized_email = v_claim.normalized_email
        or other.normalized_name = v_claim.normalized_name
        or (v_claim.normalized_acc_number is not null and other.normalized_acc_number = v_claim.normalized_acc_number))
  ) into v_collision;
  if p_decision = 'approved_for_roster' then
    if p_duplicate_of_claim_id is not null
      or (p_duplicate_resolution is not null and p_duplicate_resolution <> 'confirmed_distinct_person') then
      raise exception using errcode = 'P0001', message = 'invalid duplicate resolution';
    end if;
    if v_collision and p_duplicate_resolution is distinct from 'confirmed_distinct_person' then
      raise exception using errcode = 'P0001', message = 'collision requires confirmation';
    end if;
  end if;
  if p_decision = 'rejected' and p_duplicate_resolution = 'duplicate_of_claim' then
    if p_duplicate_of_claim_id is null or p_duplicate_of_claim_id = p_claim_id or not exists (
      select 1 from app.registration_claims other
      join app.registration_claim_decisions od on od.claim_id = other.id and od.decision = 'approved_for_roster'
      where other.id = p_duplicate_of_claim_id and other.tournament_id = p_tournament_id
        and (other.normalized_email = v_claim.normalized_email
          or other.normalized_name = v_claim.normalized_name
          or (v_claim.normalized_acc_number is not null and other.normalized_acc_number = v_claim.normalized_acc_number))
    ) then raise exception using errcode = 'P0001', message = 'invalid duplicate reference'; end if;
  elsif p_decision = 'rejected' and (p_duplicate_resolution is not null or p_duplicate_of_claim_id is not null) then
    raise exception using errcode = 'P0001', message = 'invalid duplicate resolution';
  end if;
  v_response := jsonb_build_object('status', p_decision, 'claimId', p_claim_id,
    'decisionId', v_decision, 'rosterCreated', false, 'paymentRecorded', false, 'checkedIn', false);
  insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
  values(v_actor, p_tournament_id, 'review_registration_claim', p_claim_id, v_hash, p_idempotency_key, 'accepted', v_response, now())
  returning id into v_receipt;
  insert into app.registration_claim_decisions(id, tournament_id, claim_id, decision, duplicate_resolution, duplicate_of_claim_id, reason, actor_profile_id, operation_receipt_id)
  values(v_decision, p_tournament_id, p_claim_id, p_decision, p_duplicate_resolution, p_duplicate_of_claim_id, v_reason, v_actor, v_receipt);
  insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
  values(p_tournament_id, v_actor, v_receipt, 'registration_claim', p_claim_id, 'registration_claim_reviewed', v_response);
  return v_response;
exception when sqlstate 'P0001' then
  get stacked diagnostics v_error = message_text;
  v_code := case v_error
    when 'authentication required' then 'authentication_required'
    when 'director role required' then 'not_director'
    when 'collision requires confirmation' then 'collision_unresolved'
    when 'invalid duplicate reference' then 'invalid_duplicate_reference'
    when 'claim already decided' then 'claim_already_decided'
    when 'idempotency conflict' then 'idempotency_conflict'
    else 'review_rejected' end;
  v_response := jsonb_build_object('status', 'rejected', 'code', v_code, 'claimId', p_claim_id);
  if v_error = 'idempotency conflict' and v_authorized then
    insert into app.registration_claim_operation_conflicts(actor_profile_id, tournament_id, attempted_idempotency_key, attempted_request_hash, prior_receipt_id, reason_code)
    values(v_actor, p_tournament_id, p_idempotency_key, coalesce(v_hash, ''), v_existing.id, 'idempotency_conflict');
  elsif v_authorized and v_tournament_exists then
    insert into app.operation_receipts(actor_profile_id, tournament_id, operation_type, target_id, request_hash, client_operation_id, outcome, response_payload, applied_at)
    values(v_actor, p_tournament_id, 'review_registration_claim', coalesce(p_claim_id, p_tournament_id), coalesce(v_hash, ''), p_idempotency_key, 'rejected', v_response, now())
    returning id into v_receipt;
    insert into app.audit_events(tournament_id, actor_profile_id, operation_receipt_id, entity_type, entity_id, action, after_state)
    values(p_tournament_id, v_actor, v_receipt, 'registration_claim', coalesce(p_claim_id, p_tournament_id), 'registration_claim_review_rejected', v_response);
  end if;
  return v_response;
when others then raise;
end; end; $$;

revoke all on function public.review_registration_claim(uuid,uuid,text,text,uuid,text,uuid) from public, anon;
grant execute on function public.review_registration_claim(uuid,uuid,text,text,uuid,text,uuid) to authenticated;
