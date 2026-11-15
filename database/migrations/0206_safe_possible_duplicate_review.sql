-- A weak name-only or email-only match is not proof of the same person.
-- Preserve hard identity blocks while allowing a director to record a distinct-person decision.

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
  v_response jsonb; v_error text; v_code text;
  v_collision boolean := false; v_hard_collision boolean := false;
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
  select exists(
    select 1 from app.registration_claims other
    left join app.registration_claim_decisions od on od.claim_id = other.id
    where other.tournament_id = p_tournament_id and other.id <> p_claim_id
      and od.decision is distinct from 'rejected'
      and (
        (v_claim.normalized_acc_number is not null and other.normalized_acc_number = v_claim.normalized_acc_number)
        or (v_claim.normalized_acc_number is null and other.normalized_name = v_claim.normalized_name and other.normalized_email = v_claim.normalized_email)
      )
  ) into v_hard_collision;
  if p_decision = 'approved_for_roster' then
    if p_duplicate_of_claim_id is not null
      or (p_duplicate_resolution is not null and p_duplicate_resolution <> 'confirmed_distinct_person') then
      raise exception using errcode = 'P0001', message = 'invalid duplicate resolution';
    end if;
    if v_hard_collision then raise exception using errcode = 'P0001', message = 'hard duplicate match'; end if;
    if v_collision and p_duplicate_resolution is distinct from 'confirmed_distinct_person' then
      raise exception using errcode = 'P0001', message = 'collision requires confirmation';
    end if;
  elsif p_duplicate_resolution is not null or p_duplicate_of_claim_id is not null then
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
  values(p_tournament_id, v_actor, v_receipt, 'registration_claim', p_claim_id, 'registration_claim_reviewed', v_response || jsonb_build_object('duplicateResolution', p_duplicate_resolution));
  return v_response;
exception when sqlstate 'P0001' then
  get stacked diagnostics v_error = message_text;
  v_code := case v_error
    when 'authentication required' then 'authentication_required'
    when 'director role required' then 'not_director'
    when 'collision requires confirmation' then 'collision_unresolved'
    when 'hard duplicate match' then 'hard_duplicate_match'
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

alter function public.create_roster_entry_from_registration_claim(uuid,uuid,uuid)
  rename to create_roster_entry_from_registration_claim_before_safe_possible_duplicate_review;

create function public.create_roster_entry_from_registration_claim(p_tournament_id uuid,p_approval_decision_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_claim app.registration_claims%rowtype; v_decision app.registration_claim_decisions%rowtype; v_outcome text;
begin
  if auth.uid() is null or not exists(select 1 from app.tournament_roles r where r.tournament_id=p_tournament_id and r.profile_id=auth.uid() and r.role in('director','co_director')) then
    return public.create_roster_entry_from_registration_claim_before_safe_possible_duplicate_review(p_tournament_id,p_approval_decision_id,p_idempotency_key);
  end if;
  select * into v_decision from app.registration_claim_decisions d
  where d.id=p_approval_decision_id and d.tournament_id=p_tournament_id;
  if found then
    select * into v_claim from app.registration_claims c
    where c.id=v_decision.claim_id and c.tournament_id=p_tournament_id;
    v_outcome:=app.roster_identity_outcome_v1(p_tournament_id,v_claim.normalized_name,v_claim.normalized_email,v_claim.normalized_acc_number,v_claim.id);
    if v_outcome='duplicate' then return jsonb_build_object('status','rejected','code','duplicate_roster_entry','approvalDecisionId',p_approval_decision_id); end if;
    if v_outcome='withdrawn' then return jsonb_build_object('status','rejected','code','withdrawn_roster_entry','approvalDecisionId',p_approval_decision_id); end if;
    if v_outcome='review' and v_decision.duplicate_resolution is distinct from 'confirmed_distinct_person' then
      return jsonb_build_object('status','rejected','code','potential_duplicate','approvalDecisionId',p_approval_decision_id);
    end if;
  end if;
  return public.create_roster_entry_from_registration_claim_before_safe_possible_duplicate_review(p_tournament_id,p_approval_decision_id,p_idempotency_key);
end $$;
revoke all on function public.create_roster_entry_from_registration_claim_before_safe_possible_duplicate_review(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.create_roster_entry_from_registration_claim(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_roster_entry_from_registration_claim(uuid,uuid,uuid) to authenticated;

create or replace function public.get_registration_claim_review_workspace(p_tournament_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_result jsonb;
begin
 if v_actor is null or not exists(select 1 from app.tournament_roles where tournament_id=p_tournament_id and profile_id=v_actor and role in('director','co_director')) then return null;end if;
 select jsonb_build_object('claims',coalesce(jsonb_agg(jsonb_build_object(
   'claimId',c.id,'displayName',c.display_name,'email',c.email,'accNumber',c.acc_number,
   'intendedPaymentMethod',c.intended_payment_method,'scorecardType',c.requested_scorecard_type,
   'submittedAt',c.submitted_at,'decision',d.decision,
   'collisionClaimIds',coalesce(claim_collisions.ids,'[]'::jsonb),
   'requiresDistinctConfirmation',coalesce(claim_collisions.has_collision,false) or coalesce(roster_collision.has_collision,false)
 ) order by c.submitted_at),'[]'::jsonb)) into v_result
 from app.registration_claims c
 left join app.registration_claim_decisions d on d.claim_id=c.id
 left join lateral (
   select jsonb_agg(other.id) as ids, count(*) > 0 as has_collision
   from app.registration_claims other left join app.registration_claim_decisions od on od.claim_id=other.id
   where other.tournament_id=c.tournament_id and other.id<>c.id and od.decision is distinct from 'rejected'
     and (other.normalized_email=c.normalized_email or other.normalized_name=c.normalized_name or (c.normalized_acc_number is not null and other.normalized_acc_number=c.normalized_acc_number))
 ) claim_collisions on true
 left join lateral (
   select exists(
     select 1 from app.tournament_roster_entries e
     left join lateral (select x.event_type from app.roster_entry_lifecycle_events x where x.roster_entry_id=e.id order by x.version desc limit 1) lifecycle on true
     where e.tournament_id=c.tournament_id and coalesce(lifecycle.event_type,'active')<>'withdrawn'
       and (e.claimed_normalized_email=c.normalized_email or e.claimed_normalized_name=c.normalized_name or (c.normalized_acc_number is not null and e.claimed_normalized_acc_number=c.normalized_acc_number))
   ) as has_collision
 ) roster_collision on true
 where c.tournament_id=p_tournament_id;
 return v_result;
end $$;

revoke all on function public.review_registration_claim(uuid,uuid,text,text,uuid,text,uuid) from public,anon;
grant execute on function public.review_registration_claim(uuid,uuid,text,text,uuid,text,uuid) to authenticated;
revoke all on function public.get_registration_claim_review_workspace(uuid) from public,anon;
grant execute on function public.get_registration_claim_review_workspace(uuid) to authenticated;
