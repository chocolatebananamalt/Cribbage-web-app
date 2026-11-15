-- Director-operated fallback intake for the October pilot. A manual entry is
-- only a private roster identity. It does not create an Auth account, payment,
-- check-in, seating assignment, event enrollment, or scoring authority.

alter table app.tournament_roster_entries
  add column source_kind text not null default 'registration_claim'
  check (source_kind in ('registration_claim', 'director_manual'));

alter table app.tournament_roster_entries
  alter column source_claim_id drop not null,
  alter column approval_decision_id drop not null,
  alter column claimed_email drop not null,
  alter column claimed_normalized_email drop not null;

alter table app.tournament_roster_entries
  drop constraint tournament_roster_entries_claimed_email_check,
  drop constraint tournament_roster_entries_claimed_normalized_email_check,
  add constraint tournament_roster_entries_claimed_email_check
    check (claimed_email is null or length(claimed_email) between 3 and 320),
  add constraint tournament_roster_entries_claimed_normalized_email_check
    check (claimed_normalized_email is null or length(claimed_normalized_email) between 3 and 320),
  add constraint tournament_roster_entries_source_shape_check check (
    (source_kind = 'registration_claim'
      and source_claim_id is not null
      and approval_decision_id is not null
      and claimed_email is not null
      and claimed_normalized_email is not null)
    or
    (source_kind = 'director_manual'
      and source_claim_id is null
      and approval_decision_id is null)
  );

create index tournament_roster_entries_manual_identity_idx
  on app.tournament_roster_entries(
    tournament_id,
    claimed_normalized_name,
    coalesce(claimed_normalized_email, ''),
    coalesce(claimed_normalized_acc_number, '')
  ) where source_kind = 'director_manual';

create or replace function public.create_manual_roster_entry_v1(
  p_tournament_id uuid,
  p_display_name text,
  p_email text,
  p_acc_number text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_name text;
  v_email text;
  v_acc text;
  v_existing app.operation_receipts%rowtype;
  v_entry_id uuid := extensions.gen_random_uuid();
  v_receipt_id uuid;
  v_hash text;
  v_response jsonb;
  v_error text;
  v_code text;
  v_authorized boolean := false;
  v_tournament_exists boolean := false;
begin
  begin
    if v_actor is null then
      raise exception using errcode = 'P0001', message = 'authentication required';
    end if;
    if p_tournament_id is null or p_idempotency_key is null
      or p_display_name is null
      or length(trim(p_display_name)) not between 1 and 160
      or (nullif(trim(coalesce(p_email, '')), '') is not null and (
        length(trim(p_email)) not between 3 and 320
        or lower(trim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      ))
      or length(trim(coalesce(p_acc_number, ''))) > 64 then
      raise exception using errcode = 'P0001', message = 'invalid manual roster entry';
    end if;

    v_name := lower(regexp_replace(trim(p_display_name), '[[:space:]]+', ' ', 'g'));
    v_email := nullif(lower(trim(coalesce(p_email, ''))), '');
    v_acc := nullif(upper(regexp_replace(trim(coalesce(p_acc_number, '')), '[[:space:]]+', '', 'g')), '');
    v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
      'create_manual_roster_entry_v1', p_tournament_id::text, v_name,
      coalesce(v_email, ''), coalesce(v_acc, '')
    )::text, 'utf8'), 'sha256'), 'hex');

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_actor::text || ':' || p_idempotency_key::text, 0)
    );
    select * into v_existing from app.operation_receipts
    where actor_profile_id = v_actor and client_operation_id = p_idempotency_key;
    if found then
      if v_existing.request_hash <> v_hash then
        raise exception using errcode = 'P0001', message = 'idempotency conflict';
      end if;
      return v_existing.response_payload;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('manual-roster:' || p_tournament_id::text, 0)
    );
    select status into v_status from app.tournaments
    where id = p_tournament_id for update;
    v_tournament_exists := found;
    if not v_tournament_exists or v_status not in ('draft', 'open') then
      raise exception using errcode = 'P0001', message = 'tournament unavailable';
    end if;
    if not exists (
      select 1 from app.tournament_roles r
      where r.tournament_id = p_tournament_id
        and r.profile_id = v_actor
        and r.role in ('director', 'co_director')
    ) then
      raise exception using errcode = 'P0001', message = 'director role required';
    end if;
    v_authorized := true;
    if exists (
      select 1 from app.initial_seating_publications p
      where p.tournament_id = p_tournament_id
    ) then
      raise exception using errcode = 'P0001', message = 'initial seating already published';
    end if;
    if exists (
      select 1 from app.tournament_roster_entries r
      where r.tournament_id = p_tournament_id
        and r.claimed_normalized_name = v_name
        and coalesce(r.claimed_normalized_email, '') = coalesce(v_email, '')
        and coalesce(r.claimed_normalized_acc_number, '') = coalesce(v_acc, '')
    ) then
      raise exception using errcode = 'P0001', message = 'duplicate roster entry';
    end if;

    v_response := jsonb_build_object(
      'status', 'manual_roster_entry_created',
      'rosterEntryId', v_entry_id,
      'source', 'director_manual',
      'profileLinked', false,
      'roleGranted', false,
      'eventEnrolled', false,
      'paymentRecorded', false,
      'checkedIn', false,
      'seatAssigned', false
    );
    insert into app.operation_receipts(
      actor_profile_id, tournament_id, operation_type, target_id, request_hash,
      client_operation_id, outcome, response_payload, applied_at
    ) values (
      v_actor, p_tournament_id, 'create_manual_roster_entry_v1', v_entry_id,
      v_hash, p_idempotency_key, 'accepted', v_response, now()
    ) returning id into v_receipt_id;
    insert into app.tournament_roster_entries(
      id, tournament_id, source_kind, source_claim_id, approval_decision_id,
      claimed_display_name, claimed_normalized_name, claimed_email,
      claimed_normalized_email, claimed_acc_number, claimed_normalized_acc_number,
      creator_profile_id, operation_receipt_id
    ) values (
      v_entry_id, p_tournament_id, 'director_manual', null, null,
      trim(p_display_name), v_name, nullif(trim(coalesce(p_email, '')), ''),
      v_email, nullif(trim(coalesce(p_acc_number, '')), ''), v_acc,
      v_actor, v_receipt_id
    );
    insert into app.audit_events(
      tournament_id, actor_profile_id, operation_receipt_id, entity_type,
      entity_id, action, after_state
    ) values (
      p_tournament_id, v_actor, v_receipt_id, 'tournament_roster_entry',
      v_entry_id, 'manual_roster_entry_created', v_response
    );
    return v_response;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_error = message_text;
    v_code := case v_error
      when 'authentication required' then 'authentication_required'
      when 'director role required' then 'not_director'
      when 'invalid manual roster entry' then 'invalid_manual_entry'
      when 'duplicate roster entry' then 'duplicate_roster_entry'
      when 'initial seating already published' then 'initial_seating_already_published'
      when 'idempotency conflict' then 'idempotency_conflict'
      else 'manual_roster_entry_rejected'
    end;
    v_response := jsonb_build_object('status', 'rejected', 'code', v_code);
    if v_error = 'idempotency conflict' then
      insert into app.roster_entry_operation_conflicts(
        actor_profile_id, tournament_id, attempted_idempotency_key,
        attempted_request_hash, prior_receipt_id, reason_code
      ) values (
        v_actor, p_tournament_id, p_idempotency_key, coalesce(v_hash, ''),
        v_existing.id, 'idempotency_conflict'
      );
    elsif v_authorized and v_tournament_exists then
      insert into app.operation_receipts(
        actor_profile_id, tournament_id, operation_type, target_id, request_hash,
        client_operation_id, outcome, response_payload, applied_at
      ) values (
        v_actor, p_tournament_id, 'create_manual_roster_entry_v1', p_tournament_id,
        coalesce(v_hash, repeat('0', 64)), p_idempotency_key, 'rejected', v_response, now()
      ) returning id into v_receipt_id;
      insert into app.audit_events(
        tournament_id, actor_profile_id, operation_receipt_id, entity_type,
        entity_id, action, after_state
      ) values (
        p_tournament_id, v_actor, v_receipt_id, 'tournament_roster_entry',
        p_tournament_id, 'manual_roster_entry_rejected', v_response
      );
    end if;
    return v_response;
  when others then
    raise;
  end;
end;
$$;

create or replace function public.get_manual_roster_entry_reconciliation_v1(
  p_tournament_id uuid,
  p_idempotency_key uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null
    and p_tournament_id is not null
    and p_idempotency_key is not null
    and exists (
      select 1 from app.tournament_roles r
      where r.tournament_id = p_tournament_id
        and r.profile_id = auth.uid()
        and r.role in ('director', 'co_director')
    ) then (
      select o.response_payload from app.operation_receipts o
      where o.actor_profile_id = auth.uid()
        and o.tournament_id = p_tournament_id
        and o.operation_type = 'create_manual_roster_entry_v1'
        and o.client_operation_id = p_idempotency_key
      limit 1
    ) else null end
$$;

create or replace function public.get_tournament_roster_workspace(p_tournament_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and exists (
    select 1 from app.tournament_roles r
    where r.tournament_id = p_tournament_id and r.profile_id = auth.uid()
      and r.role in ('director', 'co_director')
  ) then jsonb_build_object(
    'rosterEntries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rosterEntryId', e.id,
        'sourceClaimId', e.source_claim_id,
        'approvalDecisionId', e.approval_decision_id,
        'source', e.source_kind,
        'displayName', e.claimed_display_name,
        'email', e.claimed_email,
        'accNumber', e.claimed_acc_number,
        'createdAt', e.created_at
      ) order by e.created_at)
      from app.tournament_roster_entries e where e.tournament_id = p_tournament_id
    ), '[]'::jsonb),
    'promotionCandidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'approvalDecisionId', d.id, 'sourceClaimId', c.id,
        'displayName', c.display_name, 'email', c.email, 'accNumber', c.acc_number,
        'intendedPaymentMethod', c.intended_payment_method, 'submittedAt', c.submitted_at
      ) order by c.submitted_at)
      from app.registration_claim_decisions d
      join app.registration_claims c on c.id = d.claim_id and c.tournament_id = d.tournament_id
      left join app.tournament_roster_entries e on e.approval_decision_id = d.id
      where d.tournament_id = p_tournament_id and d.decision = 'approved_for_roster'
        and e.id is null
    ), '[]'::jsonb)
  ) else null end
$$;

revoke all on function public.create_manual_roster_entry_v1(uuid, text, text, text, uuid) from public, anon;
revoke all on function public.get_manual_roster_entry_reconciliation_v1(uuid, uuid) from public, anon;
revoke all on function public.get_tournament_roster_workspace(uuid) from public, anon;
grant execute on function public.create_manual_roster_entry_v1(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.get_manual_roster_entry_reconciliation_v1(uuid, uuid) to authenticated;
grant execute on function public.get_tournament_roster_workspace(uuid) to authenticated;
